import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuthenticatedUser } from '../middleware/authorization.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_STORAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../storage/private/delivery-proofs');

function parseMultipart(buffer, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.slice(1).find(Boolean)?.trim();
  if (!boundary || !Buffer.isBuffer(buffer)) return { error: 'Envie um formulário multipart válido.' };
  const delimiter = Buffer.from(`--${boundary}`);
  const result = {};
  let cursor = buffer.indexOf(delimiter);
  if (cursor < 0) return { error: 'Formulário multipart inválido.' };
  while (cursor >= 0) {
    cursor += delimiter.length;
    if (buffer.subarray(cursor, cursor + 2).toString() === '--') break;
    if (buffer.subarray(cursor, cursor + 2).toString() === '\r\n') cursor += 2;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd < 0) return { error: 'Cabeçalho multipart inválido.' };
    const headers = buffer.subarray(cursor, headerEnd).toString('latin1');
    const name = /(?:^|;)\s*name="([^"\r\n]+)"/i.exec(headers)?.[1];
    if (!name || Object.hasOwn(result, name)) return { error: 'Campo multipart ausente ou duplicado.' };
    const valueStart = headerEnd + 4;
    const next = buffer.indexOf(delimiter, valueStart);
    if (next < 0) return { error: 'Final do formulário multipart ausente.' };
    let valueEnd = next;
    if (buffer.subarray(valueEnd - 2, valueEnd).toString() === '\r\n') valueEnd -= 2;
    const bytes = buffer.subarray(valueStart, valueEnd);
    if (/filename="[^"]*"/i.test(headers)) {
      const mime = /(?:^|\r\n)content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim().toLowerCase();
      result[name] = { bytes, mime };
    } else result[name] = bytes.toString('utf8');
    cursor = next;
  }
  return { fields: result };
}

function sniffImage(file) {
  if (!file || !Buffer.isBuffer(file.bytes) || file.bytes.length < 12 || file.bytes.length > MAX_IMAGE_BYTES) return null;
  const b = file.bytes;
  const png = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && b.subarray(-8, -4).toString() === 'IEND';
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
  if (png && file.mime === 'image/png') return { mime: 'image/png', extension: 'png' };
  if (jpeg && ['image/jpeg', 'image/jpg', 'image/pjpeg'].includes(file.mime)) return { mime: 'image/jpeg', extension: 'jpg' };
  return null;
}

function parseDateTime(fields) {
  const date = fields.dataEntrega;
  const time = fields.horarioEntrega;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return false;
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return false;
  return true;
}

export function createDeliveryRouter(pool, { storageDir = process.env.DELIVERY_PROOF_STORAGE_DIR || DEFAULT_STORAGE } = {}) {
  const router = Router();
  const requireDriver = requireAuthenticatedUser(pool, ['MOTORISTA']);
  const requireViewer = requireAuthenticatedUser(pool, ['EMPRESA', 'MOTORISTA', 'ADMIN']);

  router.get('/drivers/me/services/summary', requireDriver, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT COUNT(*) AS total,
          SUM(i.status = 'PENDENTE') AS interesses,
          SUM(i.status = 'ACEITO' AND d.status = 'EM_ANDAMENTO') AS emAndamento,
          SUM(i.status = 'ACEITO' AND d.status = 'FINALIZADA') AS finalizados,
          SUM(i.status = 'CANCELADO' OR d.status = 'CANCELADA') AS cancelados
         FROM interesse i INNER JOIN motorista m ON m.id = i.motorista_id
         LEFT JOIN demanda d ON d.id = i.demanda_id WHERE m.usuario_id = ? AND i.demanda_id IS NOT NULL`,
        [req.authenticatedUser.id]
      );
      const [opportunities] = await pool.execute("SELECT COUNT(*) AS total FROM demanda WHERE status IN ('ABERTA','EM_NEGOCIACAO')");
      return res.json({ data: { oportunidades: Number(opportunities[0]?.total || 0), interesses: Number(rows[0]?.interesses || 0), emAndamento: Number(rows[0]?.emAndamento || 0), finalizados: Number(rows[0]?.finalizados || 0), cancelados: Number(rows[0]?.cancelados || 0) } });
    } catch { return res.status(500).json({ message: 'Não foi possível carregar o resumo dos serviços.' }); }
  });

  router.get('/drivers/me/services', requireDriver, async (req, res) => {
    const group = req.query.grupo || 'ativas';
    if (Object.keys(req.query).some((key) => key !== 'grupo') || !['ativas', 'historico'].includes(group)) return res.status(400).json({ message: 'grupo deve ser ativas ou historico.' });
    try {
      const states = group === 'historico' ? ['FINALIZADA', 'CANCELADA'] : ['PENDENTE', 'ACEITO'];
      const [rows] = await pool.execute(
        `SELECT i.id AS interesseId, i.status AS interesseStatus, i.observacao_cancelamento AS motivoCancelamento,
          d.id AS demandaId, d.titulo, d.descricao, d.porte, d.tipo_transporte AS tipoTransporte,
          d.origem_cidade AS origemCidade, d.origem_endereco AS origemEndereco,
          d.destino_cidade AS destinoCidade, d.destino_endereco AS destinoEndereco,
          DATE_FORMAT(d.data_transporte, '%Y-%m-%d') AS dataTransporte, d.periodo_retirada AS periodoRetirada,
          d.valor_oferecido AS valorOferecido, d.requisitos, d.status AS statusDemanda,
          e.nome_fantasia AS empresaNome,
          c.data_entrega AS dataEntrega, TIME_FORMAT(c.horario_entrega, '%H:%i') AS horarioEntrega,
          c.nome_recebedor AS nomeRecebedor, c.observacoes, c.enviado_em AS comprovanteEnviadoEm,
          c.id AS comprovanteId
         FROM interesse i INNER JOIN motorista m ON m.id = i.motorista_id
         LEFT JOIN demanda d ON d.id = i.demanda_id INNER JOIN empresa e ON e.id = i.empresa_id
         LEFT JOIN comprovante_entrega c ON c.demanda_id = d.id
         WHERE m.usuario_id = ? AND i.demanda_id IS NOT NULL AND
          ((? = 'ativas' AND i.status IN ('PENDENTE','ACEITO') AND d.status NOT IN ('FINALIZADA','CANCELADA','EXPIRADA')) OR
           (? = 'historico' AND (d.status IN ('FINALIZADA','CANCELADA','EXPIRADA') OR i.status = 'CANCELADO')))
         ORDER BY d.data_transporte DESC, i.id DESC LIMIT 200`,
        [req.authenticatedUser.id, group, group]
      );
      return res.json({ data: rows });
    } catch { return res.status(500).json({ message: 'Não foi possível carregar seus serviços.' }); }
  });

  router.post('/drivers/me/services/:id/complete', requireDriver, expressRaw(), async (req, res) => {
    const demandId = /^[1-9]\d*$/.test(req.params.id) ? Number(req.params.id) : null;
    if (!demandId || !Number.isSafeInteger(demandId)) return res.status(400).json({ message: 'ID de demanda inválido.' });
    const parsed = parseMultipart(req.body, req.headers['content-type'] || '');
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const fields = parsed.fields;
    if (Object.keys(fields).some((key) => !['comprovante', 'dataEntrega', 'horarioEntrega', 'nomeRecebedor', 'observacoes'].includes(key))) return res.status(400).json({ message: 'O formulário contém campos não permitidos.' });
    const image = sniffImage(fields.comprovante);
    if (!image) return res.status(422).json({ message: 'Envie um comprovante JPG ou PNG válido de até 5 MB.' });
    const receiver = fields.nomeRecebedor;
    const notes = fields.observacoes || '';
    if (!parseDateTime(fields) || typeof receiver !== 'string' || !receiver.trim() || receiver.trim().length > 255 || typeof notes !== 'string' || notes.length > 2000) return res.status(422).json({ message: 'Informe data, horário e nome do recebedor válidos. Observações podem ter até 2.000 caracteres.' });

    const filename = `${randomUUID()}.${image.extension}`;
    const filePath = path.join(storageDir, filename);
    let connection;
    let stored = false;
    try {
      await mkdir(storageDir, { recursive: true });
      await writeFile(filePath, fields.comprovante.bytes, { flag: 'wx', mode: 0o600 });
      stored = true;
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT d.id, d.status AS demandaStatus, i.id AS interesseId, m.id AS motoristaId FROM demanda d
         INNER JOIN interesse i ON i.demanda_id = d.id AND i.status = 'ACEITO'
         INNER JOIN motorista m ON m.id = i.motorista_id
         WHERE d.id = ? AND m.usuario_id = ? FOR UPDATE`,
        [demandId, req.authenticatedUser.id]
      );
      if (!rows[0]) { await connection.rollback(); await rm(filePath, { force: true }); return res.status(404).json({ message: 'Serviço aceito não encontrado para este motorista.' }); }
      if (rows[0].demandaStatus !== 'EM_ANDAMENTO') {
        await connection.rollback(); await rm(filePath, { force: true });
        return res.status(409).json({ message: rows[0].demandaStatus === 'FINALIZADA' ? 'Este serviço já foi finalizado.' : 'O serviço precisa estar em andamento para ser concluído.' });
      }
      const [existing] = await connection.execute('SELECT id FROM comprovante_entrega WHERE demanda_id = ? LIMIT 1 FOR UPDATE', [demandId]);
      if (existing.length) { await connection.rollback(); await rm(filePath, { force: true }); return res.status(409).json({ message: 'Este serviço já foi finalizado e possui comprovante.' }); }
      await connection.execute(
        `INSERT INTO comprovante_entrega (demanda_id, interesse_id, motorista_id, nome_arquivo, mime_type, tamanho_bytes,
          data_entrega, horario_entrega, nome_recebedor, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [demandId, rows[0].interesseId, rows[0].motoristaId, filename, image.mime, fields.comprovante.bytes.length, fields.dataEntrega, `${fields.horarioEntrega}:00`, receiver.trim(), notes.trim() || null]
      );
      const [updated] = await connection.execute("UPDATE demanda SET status = 'FINALIZADA' WHERE id = ? AND status = 'EM_ANDAMENTO'", [demandId]);
      if (!updated.affectedRows) throw new Error('status_changed');
      await connection.commit();
      return res.status(201).json({ data: { demandaId: demandId, status: 'FINALIZADA', dataEntrega: fields.dataEntrega, horarioEntrega: fields.horarioEntrega, nomeRecebedor: receiver.trim() } });
    } catch (error) {
      if (connection) await connection.rollback();
      if (stored) await rm(filePath, { force: true }).catch(() => {});
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Este serviço já possui uma conclusão registrada.' });
      return res.status(500).json({ message: 'Não foi possível registrar a conclusão do serviço.' });
    } finally { connection?.release(); }
  });

  router.get('/demands/:id/proof', requireViewer, async (req, res) => {
    const demandId = /^[1-9]\d*$/.test(req.params.id) ? Number(req.params.id) : null;
    if (!demandId || !Number.isSafeInteger(demandId)) return res.status(400).json({ message: 'ID de demanda inválido.' });
    try {
      const [rows] = await pool.execute(
        `SELECT c.nome_arquivo, c.mime_type, i.empresa_id, m.usuario_id AS motoristaUsuarioId
         FROM comprovante_entrega c INNER JOIN interesse i ON i.id = c.interesse_id
         INNER JOIN motorista m ON m.id = c.motorista_id WHERE c.demanda_id = ? LIMIT 1`, [demandId]
      );
      const proof = rows[0];
      if (!proof) return res.status(404).json({ message: 'Comprovante não encontrado.' });
      if (req.authenticatedUser.tipoUsuario !== 'ADMIN') {
        let authorized = req.authenticatedUser.tipoUsuario === 'MOTORISTA' && Number(proof.motoristaUsuarioId) === Number(req.authenticatedUser.id);
        if (req.authenticatedUser.tipoUsuario === 'EMPRESA') {
          const [companies] = await pool.execute('SELECT id FROM empresa WHERE usuario_id = ? LIMIT 1', [req.authenticatedUser.id]);
          authorized = Number(companies[0]?.id) === Number(proof.empresa_id);
        }
        if (!authorized) return res.status(404).json({ message: 'Comprovante não encontrado.' });
      }
      res.setHeader('Content-Type', proof.mime_type);
      res.setHeader('Content-Disposition', 'inline; filename="comprovante-entrega"');
      res.setHeader('Cache-Control', 'private, no-store');
      return res.sendFile(path.join(storageDir, proof.nome_arquivo), (error) => { if (error && !res.headersSent) res.status(404).json({ message: 'Arquivo de comprovante não encontrado.' }); });
    } catch { return res.status(500).json({ message: 'Não foi possível consultar o comprovante.' }); }
  });
  return router;
}

function expressRaw() {
  return (req, res, next) => {
    const type = req.headers['content-type'] || '';
    if (!type.toLowerCase().startsWith('multipart/form-data;')) return res.status(415).json({ message: 'Envie o comprovante como multipart/form-data.' });
    express.raw({ type: 'multipart/form-data', limit: '6mb' })(req, res, (error) => {
      if (error) return res.status(error.status === 413 ? 413 : 400).json({ message: error.status === 413 ? 'O formulário excede o tamanho permitido.' : 'Não foi possível ler o formulário de conclusão.' });
      next();
    });
  };
}
