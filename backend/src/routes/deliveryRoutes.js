import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuthenticatedUser } from '../middleware/authorization.js';
import { inspectPrivateImage, optionalMultipartRaw, parseMultipartBody, removePrivateFile, storePrivateImage } from '../utils/privateImages.js';

const DEFAULT_STORAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../storage/private/delivery-proofs');

function isValidDeliveryDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function isValidDeliveryTime(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
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

  router.post('/drivers/me/services/:id/complete', requireDriver, optionalMultipartRaw('6mb'), async (req, res) => {
    const demandId = /^[1-9]\d*$/.test(req.params.id) ? Number(req.params.id) : null;
    if (!demandId || !Number.isSafeInteger(demandId)) return res.status(400).json({ message: 'ID de demanda inválido.' });
    const parsed = parseMultipartBody(req.body, req.headers['content-type'] || '');
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const fields = parsed.fields;
    if (Object.keys(fields).some((key) => !['comprovante', 'dataEntrega', 'horarioEntrega', 'nomeRecebedor', 'observacoes'].includes(key))) return res.status(400).json({ message: 'O formulário contém campos não permitidos.' });
    const image = inspectPrivateImage(fields.comprovante);
    if (!image) return res.status(422).json({ message: 'O comprovante deve ser uma imagem JPG ou PNG valida de ate 5 MB.', errors: { comprovante: 'Selecione uma imagem valida.' } });
    const receiver = fields.nomeRecebedor;
    const notes = fields.observacoes;
    const errors = {};
    if (!isValidDeliveryDate(fields.dataEntrega)) errors.dataEntrega = 'Informe uma data valida no formato AAAA-MM-DD.';
    if (!isValidDeliveryTime(fields.horarioEntrega)) errors.horarioEntrega = 'Informe um horario valido no formato HH:mm.'
    if (typeof receiver !== 'string' || !receiver.trim() || receiver.trim().length > 255) errors.nomeRecebedor = 'Informe o nome completo de quem recebeu (ate 255 caracteres).';
    if (typeof notes !== 'string' || !notes.trim() || notes.trim().length > 2000) errors.observacoes = 'Informe as observacoes da entrega (ate 2.000 caracteres).';
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Revise os campos obrigatorios da conclusao.', errors });

    let connection;
    let storedFile;
    try {
      storedFile = await storePrivateImage(fields.comprovante, storageDir, image);
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        `SELECT d.id, d.status AS demandaStatus, i.id AS interesseId, m.id AS motoristaId FROM demanda d
         INNER JOIN interesse i ON i.demanda_id = d.id AND i.status = 'ACEITO'
         INNER JOIN motorista m ON m.id = i.motorista_id
         WHERE d.id = ? AND m.usuario_id = ? FOR UPDATE`,
        [demandId, req.authenticatedUser.id]
      );
      if (!rows[0]) { await connection.rollback(); await removePrivateFile(storedFile.path); return res.status(404).json({ message: 'Servico aceito nao encontrado para este motorista.' }); }
      if (rows[0].demandaStatus !== 'EM_ANDAMENTO') {
        await connection.rollback(); await removePrivateFile(storedFile.path);
        return res.status(409).json({ message: rows[0].demandaStatus === 'FINALIZADA' ? 'Este servico ja foi finalizado.' : 'O servico precisa estar em andamento para ser concluido.' });
      }
      const [existing] = await connection.execute('SELECT id FROM comprovante_entrega WHERE demanda_id = ? LIMIT 1 FOR UPDATE', [demandId]);
      if (existing.length) { await connection.rollback(); await removePrivateFile(storedFile.path); return res.status(409).json({ message: 'Este servico ja foi finalizado e possui comprovante.' }); }
      await connection.execute(
        `INSERT INTO comprovante_entrega (demanda_id, interesse_id, motorista_id, nome_arquivo, mime_type, tamanho_bytes,
          data_entrega, horario_entrega, nome_recebedor, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [demandId, rows[0].interesseId, rows[0].motoristaId, storedFile.filename, image.mime, fields.comprovante.bytes.length, fields.dataEntrega, `${fields.horarioEntrega}:00`, receiver.trim(), notes.trim()]
      );
      const [updated] = await connection.execute("UPDATE demanda SET status = 'FINALIZADA' WHERE id = ? AND status = 'EM_ANDAMENTO'", [demandId]);
      if (!updated.affectedRows) throw new Error('status_changed');
      await connection.commit();
      return res.status(201).json({ data: { demandaId: demandId, status: 'FINALIZADA', dataEntrega: fields.dataEntrega, horarioEntrega: fields.horarioEntrega, nomeRecebedor: receiver.trim(), observacoes: notes.trim() } });
    } catch (error) {
      if (connection) await connection.rollback();
      if (storedFile) await removePrivateFile(storedFile.path).catch(() => {});
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Este servico ja possui uma conclusao registrada.' });
      return res.status(500).json({ message: 'Nao foi possivel registrar a conclusao do servico.' });
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
