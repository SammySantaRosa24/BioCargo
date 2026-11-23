import { Router } from 'express';
import { requireAuthenticatedUser } from '../middleware/authorization.js';

const DEMAND_FIELDS = {
  titulo: { column: 'titulo', maxLength: 180 },
  descricao: { column: 'descricao', maxLength: 65_535 },
  porte: { column: 'porte', values: ['PEQUENO', 'MEDIO', 'GRANDE'] },
  tipoTransporte: { column: 'tipo_transporte', maxLength: 100 },
  origemCidade: { column: 'origem_cidade', maxLength: 120 },
  origemEndereco: { column: 'origem_endereco', maxLength: 255 },
  origemComplemento: { column: 'origem_complemento', maxLength: 500, optional: true },
  destinoCidade: { column: 'destino_cidade', maxLength: 120 },
  destinoEndereco: { column: 'destino_endereco', maxLength: 255 },
  destinoComplemento: { column: 'destino_complemento', maxLength: 500, optional: true },
  dataTransporte: { column: 'data_transporte', date: true },
  periodoRetirada: { column: 'periodo_retirada', maxLength: 100, optional: true },
  valorOferecido: { column: 'valor_oferecido', money: true },
  requisitos: { column: 'requisitos', maxLength: 65_535, optional: true }
};

const DEMAND_SELECT = `
  d.id, d.titulo, d.descricao, d.porte, d.tipo_transporte AS tipoTransporte,
  d.origem_cidade AS origemCidade, d.origem_endereco AS origemEndereco,
  d.origem_complemento AS origemComplemento, d.destino_cidade AS destinoCidade,
  d.destino_endereco AS destinoEndereco, d.destino_complemento AS destinoComplemento,
  DATE_FORMAT(d.data_transporte, '%Y-%m-%d') AS dataTransporte,
  d.periodo_retirada AS periodoRetirada, d.valor_oferecido AS valorOferecido,
  d.requisitos, d.status,
  DATE_FORMAT(d.data_criacao, '%Y-%m-%dT%H:%i:%sZ') AS dataCriacao,
  DATE_FORMAT(d.atualizado_em, '%Y-%m-%dT%H:%i:%sZ') AS atualizadoEm,
  (SELECT COUNT(*) FROM interesse i WHERE i.demanda_id = d.id) AS totalInteresses,
  c.data_entrega AS dataEntrega, TIME_FORMAT(c.horario_entrega, '%H:%i') AS horarioEntrega,
  c.nome_recebedor AS nomeRecebedor, c.observacoes AS observacoesEntrega,
  DATE_FORMAT(c.enviado_em, '%Y-%m-%dT%H:%i:%sZ') AS comprovanteEnviadoEm,
  (c.id IS NOT NULL) AS possuiComprovante`;

const REQUIRED_FIELDS = Object.keys(DEMAND_FIELDS).filter((key) => !DEMAND_FIELDS[key].optional);
const TERMINAL_STATUSES = ['FINALIZADA', 'CANCELADA', 'EXPIRADA'];

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseDemand(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Informe os dados da demanda em formato válido.', status: 400 };
  }
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !Object.hasOwn(DEMAND_FIELDS, key))) {
    return { error: 'Há campos ausentes ou não permitidos na demanda.', status: 400 };
  }
  if (!partial) {
    const missing = REQUIRED_FIELDS.filter((key) => !Object.hasOwn(body, key));
    if (missing.length) return { error: `Preencha os campos obrigatórios: ${missing.join(', ')}.`, status: 400 };
  }

  const values = {};
  for (const key of keys) {
    const field = DEMAND_FIELDS[key];
    const value = body[key];
    if (field.optional && (value === null || (typeof value === 'string' && !value.trim()))) {
      values[key] = null;
    } else if (field.values) {
      if (!field.values.includes(value)) return { error: 'Porte deve ser pequeno, médio ou grande.', status: 422 };
      values[key] = value;
    } else if (field.date) {
      if (!validateDate(value)) return { error: 'Informe uma data de transporte válida.', status: 422 };
      values[key] = value;
    } else if (field.money) {
      const amount = typeof value === 'string' && value.trim() ? Number(value) : value;
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99) {
        return { error: 'O valor oferecido deve ser maior que zero e não exceder R$ 99.999.999,99.', status: 422 };
      }
      values[key] = amount;
    } else if (typeof value !== 'string') {
      return { error: `${key} deve ser um texto válido.`, status: 400 };
    } else if (!value.trim() || (field.maxLength > 1000
      ? Buffer.byteLength(value.trim(), 'utf8')
      : value.trim().length) > field.maxLength) {
      return { error: `${key} está vazio ou excede o limite de ${field.maxLength} caracteres.`, status: 422 };
    } else {
      values[key] = value.trim();
    }
  }
  return { values };
}

function parsePagination(query) {
  if (Object.keys(query).some((key) => !['page', 'limit', 'grupo'].includes(key))) {
    return { error: 'Use somente os parâmetros page, limit e grupo.', status: 400 };
  }
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const group = query.grupo ?? 'ativas';
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return { error: 'page e limit devem ser inteiros positivos; limit não pode exceder 100.', status: 422 };
  }
  if (!['ativas', 'historico'].includes(group)) return { error: 'grupo deve ser ativas ou historico.', status: 400 };
  return { page, limit, group, offset: (page - 1) * limit };
}

async function getCompanyId(pool, userId) {
  const [rows] = await pool.execute('SELECT id FROM empresa WHERE usuario_id = ? LIMIT 1', [userId]);
  return rows[0]?.id ?? null;
}

async function ownedDemand(pool, demandId, companyId) {
  const [rows] = await pool.execute(
    `SELECT ${DEMAND_SELECT} FROM demanda d LEFT JOIN comprovante_entrega c ON c.demanda_id = d.id WHERE d.id = ? AND d.empresa_id = ? LIMIT 1`,
    [demandId, companyId]
  );
  return rows[0];
}

function failure(res) {
  return res.status(500).json({ message: 'Não foi possível processar a demanda.' });
}

export function createDemandRouter(pool) {
  const router = Router();
  const requireCompany = requireAuthenticatedUser(pool, ['EMPRESA']);
  const requireDriver = requireAuthenticatedUser(pool, ['MOTORISTA']);

  router.get('/companies/me/demands/summary', requireCompany, async (req, res) => {
    try {
      const companyId = await getCompanyId(pool, req.authenticatedUser.id);
      if (!companyId) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      const [rows] = await pool.execute(
        `SELECT
          COUNT(*) AS total,
          COALESCE(SUM(status = 'ABERTA'), 0) AS abertas,
          COALESCE(SUM(status = 'EM_NEGOCIACAO'), 0) AS emNegociacao,
          COALESCE(SUM(status = 'EM_ANDAMENTO'), 0) AS emAndamento,
          COALESCE(SUM(status = 'FINALIZADA'), 0) AS finalizadas,
          COALESCE(SUM(status IN ('CANCELADA', 'EXPIRADA')), 0) AS encerradas
         FROM demanda WHERE empresa_id = ?`, [companyId]
      );
      return res.status(200).json({ data: Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)])) });
    } catch {
      return failure(res);
    }
  });

  router.get('/companies/me/demands', requireCompany, async (req, res) => {
    const pagination = parsePagination(req.query);
    if (pagination.error) return res.status(pagination.status).json({ message: pagination.error });
    try {
      const companyId = await getCompanyId(pool, req.authenticatedUser.id);
      if (!companyId) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      const states = pagination.group === 'historico' ? TERMINAL_STATUSES : ['ABERTA', 'EM_NEGOCIACAO', 'EM_ANDAMENTO'];
      const placeholders = states.map(() => '?').join(', ');
      const where = `empresa_id = ? AND status IN (${placeholders})`;
      const values = [companyId, ...states];
      const [counts] = await pool.execute(`SELECT COUNT(*) AS total FROM demanda WHERE ${where}`, values);
      const [rows] = await pool.execute(
        `SELECT ${DEMAND_SELECT} FROM demanda d LEFT JOIN comprovante_entrega c ON c.demanda_id = d.id
         WHERE d.empresa_id = ? AND d.status IN (${placeholders})
         ORDER BY d.data_transporte ASC, d.id DESC LIMIT ? OFFSET ?`,
        [...values, pagination.limit, pagination.offset]
      );
      return res.status(200).json({ data: rows, meta: { page: pagination.page, limit: pagination.limit, total: Number(counts[0]?.total || 0) } });
    } catch {
      return failure(res);
    }
  });

  router.post('/companies/me/demands', requireCompany, async (req, res) => {
    const parsed = parseDemand(req.body);
    if (parsed.error) return res.status(parsed.status).json({ message: parsed.error });
    try {
      const companyId = await getCompanyId(pool, req.authenticatedUser.id);
      if (!companyId) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      const keys = Object.keys(parsed.values);
      const columns = keys.map((key) => DEMAND_FIELDS[key].column);
      const [created] = await pool.execute(
        `INSERT INTO demanda (empresa_id, ${columns.join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`,
        [companyId, ...keys.map((key) => parsed.values[key])]
      );
      const demand = await ownedDemand(pool, created.insertId, companyId);
      return res.status(201).json({ data: demand });
    } catch (error) {
      if (error.code === 'ER_DATA_TOO_LONG') return res.status(422).json({ message: 'Um dos campos excede o limite aceito.' });
      return failure(res);
    }
  });

  router.get('/companies/me/demands/:id/interests', requireCompany, async (req, res) => {
    const demandId = parseId(req.params.id);
    if (!demandId) return res.status(400).json({ message: 'ID de demanda inválido.' });
    try {
      const companyId = await getCompanyId(pool, req.authenticatedUser.id);
      if (!companyId) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      if (!(await ownedDemand(pool, demandId, companyId))) return res.status(404).json({ message: 'Demanda não encontrada.' });
      const [rows] = await pool.execute(
        `SELECT i.id, i.status, i.veiculo_id AS veiculoId,
                DATE_FORMAT(i.data_criacao, '%Y-%m-%dT%H:%i:%sZ') AS dataCriacao,
                m.id AS motoristaId, m.nome AS motoristaNome,
                v.marca AS veiculoMarca, v.modelo AS veiculoModelo, v.ano AS veiculoAno
         FROM interesse i INNER JOIN motorista m ON m.id = i.motorista_id
         LEFT JOIN veiculo v ON v.id = i.veiculo_id
         WHERE i.demanda_id = ? ORDER BY i.data_criacao DESC LIMIT 100`, [demandId]
      );
      return res.status(200).json({ data: rows });
    } catch {
      return failure(res);
    }
  });

  router.patch('/companies/me/demands/:id/interests/:interestId', requireCompany, async (req, res) => {
    const demandId = parseId(req.params.id);
    const interestId = parseId(req.params.interestId);
    const nextStatus = req.body?.status;
    if (!demandId || !interestId) return res.status(400).json({ message: 'ID inválido.' });
    if (!req.body || Object.keys(req.body).length !== 1 || !['ACEITO', 'RECUSADO'].includes(nextStatus)) {
      return res.status(400).json({ message: 'status deve ser ACEITO ou RECUSADO.' });
    }
    try {
      const companyId = await getCompanyId(pool, req.authenticatedUser.id);
      if (!companyId) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      if (nextStatus === 'ACEITO') {
        const [alreadyAssigned] = await pool.execute(
          `SELECT id FROM interesse WHERE demanda_id = ? AND status = 'ACEITO' LIMIT 1`, [demandId]
        );
        if (alreadyAssigned.length) return res.status(409).json({ message: 'A demanda já possui motorista aceito.' });
      }
      const [result] = await pool.execute(
        `UPDATE interesse i INNER JOIN demanda d ON d.id = i.demanda_id
         SET i.status = ? WHERE i.id = ? AND i.demanda_id = ? AND d.empresa_id = ?
           AND d.status IN ('ABERTA', 'EM_NEGOCIACAO') AND i.status = 'PENDENTE'`,
        [nextStatus, interestId, demandId, companyId]
      );
      if (!result.affectedRows) return res.status(404).json({ message: 'Manifestação pendente não encontrada para esta demanda.' });
      return res.status(200).json({ data: { id: interestId, demandaId: demandId, status: nextStatus } });
    } catch {
      return failure(res);
    }
  });

  router.get('/companies/me/demands/:id', requireCompany, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de demanda inválido.' });
    try {
      const companyId = await getCompanyId(pool, req.authenticatedUser.id);
      if (!companyId) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      const demand = await ownedDemand(pool, id, companyId);
      return demand ? res.status(200).json({ data: demand }) : res.status(404).json({ message: 'Demanda não encontrada.' });
    } catch {
      return failure(res);
    }
  });

  router.patch('/companies/me/demands/:id/status', requireCompany, async (req, res) => {
    const id = parseId(req.params.id);
    const nextStatus = req.body?.status;
    if (!id) return res.status(400).json({ message: 'ID de demanda inválido.' });
    if (!req.body || Object.keys(req.body).length !== 1 || !['EM_NEGOCIACAO', 'EM_ANDAMENTO', 'CANCELADA', 'EXPIRADA'].includes(nextStatus)) {
      return res.status(400).json({ message: 'Informe um próximo status permitido.' });
    }
    try {
      const companyId = await getCompanyId(pool, req.authenticatedUser.id);
      if (!companyId) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      const current = await ownedDemand(pool, id, companyId);
      if (!current) return res.status(404).json({ message: 'Demanda não encontrada.' });
      const allowed = {
        ABERTA: ['EM_NEGOCIACAO', 'CANCELADA', 'EXPIRADA'],
        EM_NEGOCIACAO: ['EM_ANDAMENTO', 'CANCELADA', 'EXPIRADA']
      };
      if (!allowed[current.status]?.includes(nextStatus)) {
        return res.status(409).json({ message: `A demanda não pode mudar de ${current.status} para ${nextStatus}.` });
      }
      if (nextStatus === 'EM_ANDAMENTO') {
        const [accepted] = await pool.execute(
          `SELECT id FROM interesse WHERE demanda_id = ? AND status = 'ACEITO' LIMIT 1`, [id]
        );
        if (!accepted.length) return res.status(409).json({ message: 'Aceite uma manifestação de interesse antes de iniciar o transporte.' });
      }
      if (nextStatus === 'EXPIRADA' && current.dataTransporte >= new Date().toISOString().slice(0, 10)) {
        return res.status(422).json({ message: 'Só é possível marcar como expirada após a data do transporte.' });
      }
      if (nextStatus === 'CANCELADA' || nextStatus === 'EXPIRADA') {
        const [accepted] = await pool.execute(
          `SELECT id FROM interesse WHERE demanda_id = ? AND status = 'ACEITO' LIMIT 1`, [id]
        );
        if (accepted.length) return res.status(409).json({ message: 'A demanda tem uma manifestação aceita; atualize o estado da operação antes de encerrar.' });
      }
      const [updated] = await pool.execute(
        'UPDATE demanda SET status = ? WHERE id = ? AND empresa_id = ? AND status = ?',
        [nextStatus, id, companyId, current.status]
      );
      if (!updated.affectedRows) return res.status(409).json({ message: 'O status da demanda mudou; atualize a página e tente novamente.' });
      return res.status(200).json({ data: await ownedDemand(pool, id, companyId) });
    } catch {
      return failure(res);
    }
  });

  router.patch('/companies/me/demands/:id', requireCompany, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de demanda inválido.' });
    const parsed = parseDemand(req.body, { partial: true });
    if (parsed.error) return res.status(parsed.status).json({ message: parsed.error });
    try {
      const companyId = await getCompanyId(pool, req.authenticatedUser.id);
      if (!companyId) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      const current = await ownedDemand(pool, id, companyId);
      if (!current) return res.status(404).json({ message: 'Demanda não encontrada.' });
      if (current.status !== 'ABERTA') return res.status(409).json({ message: 'Somente demandas abertas podem ser editadas.' });
      const fields = Object.keys(parsed.values);
      const [updated] = await pool.execute(
        `UPDATE demanda SET ${fields.map((key) => `${DEMAND_FIELDS[key].column} = ?`).join(', ')} WHERE id = ? AND empresa_id = ? AND status = 'ABERTA'`,
        [...fields.map((key) => parsed.values[key]), id, companyId]
      );
      if (!updated.affectedRows) return res.status(409).json({ message: 'A demanda mudou de estado e não pode mais ser editada.' });
      return res.status(200).json({ data: await ownedDemand(pool, id, companyId) });
    } catch {
      return failure(res);
    }
  });

  router.post('/companies/me/demands/:id/cancel', requireCompany, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de demanda inválido.' });
    if (req.body && Object.keys(req.body).length) return res.status(400).json({ message: 'Cancelamento não recebe campos.' });
    try {
      const companyId = await getCompanyId(pool, req.authenticatedUser.id);
      if (!companyId) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      const [result] = await pool.execute(
        `UPDATE demanda SET status = 'CANCELADA'
         WHERE id = ? AND empresa_id = ? AND status IN ('ABERTA', 'EM_NEGOCIACAO')
           AND NOT EXISTS (SELECT 1 FROM interesse WHERE demanda_id = ? AND status = 'ACEITO')`,
        [id, companyId, id]
      );
      if (!result.affectedRows) return res.status(409).json({ message: 'A demanda não existe, já foi encerrada ou possui manifestação aceita.' });
      return res.status(200).json({ data: await ownedDemand(pool, id, companyId) });
    } catch {
      return failure(res);
    }
  });

  router.post('/demands/:id/interests', requireDriver, async (req, res) => {
    const demandId = parseId(req.params.id);
    const vehicleId = req.body?.veiculoId;
    if (!demandId) return res.status(400).json({ message: 'ID de demanda inválido.' });
    if (req.body && (Object.keys(req.body).some((key) => key !== 'veiculoId') ||
        (vehicleId !== undefined && (!Number.isSafeInteger(vehicleId) || vehicleId < 1)))) {
      return res.status(400).json({ message: 'É permitido enviar somente um veiculoId válido.' });
    }
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [drivers] = await connection.execute('SELECT id FROM motorista WHERE usuario_id = ? LIMIT 1', [req.authenticatedUser.id]);
      if (!drivers[0]) {
        await connection.rollback();
        return res.status(404).json({ message: 'Perfil de motorista não encontrado.' });
      }
      const [demands] = await connection.execute(
        `SELECT id, empresa_id FROM demanda WHERE id = ? AND status IN ('ABERTA', 'EM_NEGOCIACAO') FOR UPDATE`, [demandId]
      );
      if (!demands[0]) {
        await connection.rollback();
        return res.status(404).json({ message: 'Demanda disponível não encontrada.' });
      }
      if (vehicleId !== undefined) {
        const [vehicles] = await connection.execute(
          'SELECT id FROM veiculo WHERE id = ? AND motorista_id = ? AND ativo = TRUE LIMIT 1', [vehicleId, drivers[0].id]
        );
        if (!vehicles[0]) {
          await connection.rollback();
          return res.status(422).json({ message: 'O veículo precisa pertencer ao motorista e estar ativo.' });
        }
      }
      const [active] = await connection.execute(
        `SELECT id FROM interesse WHERE demanda_id = ? AND motorista_id = ? AND status IN ('PENDENTE', 'ACEITO') LIMIT 1`,
        [demandId, drivers[0].id]
      );
      if (active.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'Você já demonstrou interesse ativo nesta demanda.' });
      }
      const [created] = await connection.execute(
        `INSERT INTO interesse (empresa_id, motorista_id, veiculo_id, demanda_id, status, data_criacao, data_limite_resposta)
         VALUES (?, ?, ?, ?, 'PENDENTE', UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))`,
        [demands[0].empresa_id, drivers[0].id, vehicleId ?? null, demandId]
      );
      await connection.commit();
      return res.status(201).json({ data: { id: created.insertId, demandaId: demandId, status: 'PENDENTE' } });
    } catch (error) {
      if (connection) await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Já existe uma manifestação ativa.' });
      return failure(res);
    } finally {
      if (connection) connection.release();
    }
  });

  router.get('/drivers/me/demands', requireDriver, async (req, res) => {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    if (Object.keys(req.query).some((key) => !['page', 'limit'].includes(key)) ||
        !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return res.status(422).json({ message: 'Use page e limit como inteiros positivos; limit não pode exceder 100.' });
    }
    try {
      const [drivers] = await pool.execute('SELECT id FROM motorista WHERE usuario_id = ? LIMIT 1', [req.authenticatedUser.id]);
      if (!drivers[0]) return res.status(404).json({ message: 'Perfil de motorista não encontrado.' });
      const [counts] = await pool.execute(
        `SELECT COUNT(*) AS total FROM demanda WHERE status IN ('ABERTA', 'EM_NEGOCIACAO')`
      );
      const [rows] = await pool.execute(
        `SELECT ${DEMAND_SELECT}, COALESCE(e.nome_fantasia, e.razao_social) AS empresaNome,
          (SELECT i.status FROM interesse i WHERE i.demanda_id = d.id AND i.motorista_id = ? ORDER BY i.id DESC LIMIT 1) AS meuInteresse
         FROM demanda d INNER JOIN empresa e ON e.id = d.empresa_id LEFT JOIN comprovante_entrega c ON c.demanda_id = d.id
         WHERE d.status IN ('ABERTA', 'EM_NEGOCIACAO')
         ORDER BY d.data_transporte ASC, d.id DESC LIMIT ? OFFSET ?`,
        [drivers[0].id, limit, (page - 1) * limit]
      );
      return res.status(200).json({ data: rows, meta: { page, limit, total: Number(counts[0]?.total || 0) } });
    } catch {
      return failure(res);
    }
  });

  router.get('/drivers/me/demands/:id', requireDriver, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de demanda inválido.' });
    try {
      const [drivers] = await pool.execute('SELECT id FROM motorista WHERE usuario_id = ? LIMIT 1', [req.authenticatedUser.id]);
      if (!drivers[0]) return res.status(404).json({ message: 'Perfil de motorista não encontrado.' });
      const [rows] = await pool.execute(
        `SELECT ${DEMAND_SELECT}, COALESCE(e.nome_fantasia, e.razao_social) AS empresaNome,
          (SELECT i.status FROM interesse i WHERE i.demanda_id = d.id AND i.motorista_id = ? ORDER BY i.id DESC LIMIT 1) AS meuInteresse
         FROM demanda d INNER JOIN empresa e ON e.id = d.empresa_id LEFT JOIN comprovante_entrega c ON c.demanda_id = d.id
         WHERE d.id = ? AND d.status IN ('ABERTA', 'EM_NEGOCIACAO') LIMIT 1`,
        [drivers[0].id, id]
      );
      return rows[0]
        ? res.status(200).json({ data: rows[0] })
        : res.status(404).json({ message: 'Demanda aberta não encontrada.' });
    } catch {
      return failure(res);
    }
  });

  return router;
}
