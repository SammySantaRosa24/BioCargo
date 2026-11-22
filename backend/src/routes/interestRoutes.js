import { Router } from 'express';
import { requireAuthenticatedUser } from '../middleware/authorization.js';

const INTEREST_FIELDS = `
  i.id, i.empresa_id AS empresaId, i.motorista_id AS motoristaId,
  i.veiculo_id AS veiculoId, i.status,
  DATE_FORMAT(i.data_criacao, '%Y-%m-%dT%H:%i:%sZ') AS dataCriacao,
  DATE_FORMAT(i.data_limite_resposta, '%Y-%m-%dT%H:%i:%sZ') AS dataLimiteResposta,
  i.cancelado_por AS canceladoPor,
  i.observacao_cancelamento AS observacaoCancelamento,
  DATE_FORMAT(i.data_cancelamento, '%Y-%m-%dT%H:%i:%sZ') AS dataCancelamento`;

function parseId(rawId) {
  if (!/^[1-9]\d*$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parsePagination(query) {
  for (const key of Object.keys(query)) {
    if (!['page', 'limit'].includes(key)) return { error: `Parâmetro não permitido: ${key}.`, status: 400 };
  }
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1) {
    return { error: 'page e limit devem ser inteiros positivos.', status: 400 };
  }
  if (limit > 100 || (page - 1) * limit > 2147483647) {
    return { error: 'Paginação fora do intervalo permitido.', status: 422 };
  }
  return { page, limit, offset: (page - 1) * limit };
}

export async function expirePendingInterests(pool) {
  await pool.execute(
    `UPDATE interesse SET status = 'EXPIRADO'
     WHERE status = 'PENDENTE' AND data_limite_resposta <= UTC_TIMESTAMP()`
  );
}

export function startInterestExpiryWorker(pool) {
  const timer = setInterval(() => {
    expirePendingInterests(pool).catch(() => {
      console.error('Falha ao atualizar interesses expirados.');
    });
  }, 60_000);
  timer.unref();
  return timer;
}

function listQueryForUser(user) {
  if (user.tipoUsuario === 'EMPRESA') {
    return {
      join: 'INNER JOIN empresa e ON e.id = i.empresa_id',
      ownerCondition: 'e.usuario_id = ?',
      values: [user.id]
    };
  }
  return {
    join: 'INNER JOIN motorista m ON m.id = i.motorista_id',
    ownerCondition: 'm.usuario_id = ?',
    values: [user.id]
  };
}

async function selectOwnInterest(pool, id, user) {
  const owner = listQueryForUser(user);
  const [rows] = await pool.execute(
    `SELECT ${INTEREST_FIELDS} FROM interesse i ${owner.join}
     WHERE i.id = ? AND ${owner.ownerCondition} LIMIT 1`,
    [id, ...owner.values]
  );
  return rows[0];
}

function genericError(res) {
  return res.status(500).json({ message: 'Não foi possível processar o interesse.' });
}

export function createInterestRouter(pool) {
  const router = Router();
  const requireCompany = requireAuthenticatedUser(pool, ['EMPRESA']);
  const requireDriver = requireAuthenticatedUser(pool, ['MOTORISTA']);
  const requireParticipant = requireAuthenticatedUser(pool, ['EMPRESA', 'MOTORISTA']);

  router.post('/interests', requireCompany, async (req, res) => {
    const body = req.body;
    const allowedKeys = new Set(['motoristaId', 'veiculoId']);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some((key) => !allowedKeys.has(key)) ||
        !Number.isSafeInteger(body.motoristaId) || body.motoristaId < 1 ||
        (body.veiculoId !== undefined && (!Number.isSafeInteger(body.veiculoId) || body.veiculoId < 1))) {
      return res.status(400).json({ message: 'Informe motoristaId e, opcionalmente, veiculoId válidos.' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [companies] = await connection.execute(
        'SELECT id FROM empresa WHERE usuario_id = ? LIMIT 1',
        [req.authenticatedUser.id]
      );
      if (!companies[0]) {
        await connection.rollback();
        return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      }

      const [drivers] = await connection.execute(
        `SELECT m.id FROM motorista m INNER JOIN usuario u ON u.id = m.usuario_id
         WHERE m.id = ? AND m.disponivel = TRUE AND u.status = TRUE FOR UPDATE`,
        [Number(body.motoristaId)]
      );
      if (!drivers[0]) {
        await connection.rollback();
        return res.status(404).json({ message: 'Motorista disponível não encontrado.' });
      }

      if (body.veiculoId !== undefined) {
        const [vehicles] = await connection.execute(
          `SELECT id FROM veiculo
           WHERE id = ? AND motorista_id = ? AND ativo = TRUE AND disponivel = TRUE FOR UPDATE`,
          [Number(body.veiculoId), drivers[0].id]
        );
        if (!vehicles[0]) {
          await connection.rollback();
          return res.status(422).json({ message: 'O veículo deve estar ativo, disponível e pertencer ao motorista.' });
        }
      }

      const [active] = await connection.execute(
        `SELECT id FROM interesse
         WHERE empresa_id = ? AND motorista_id = ? AND status IN ('PENDENTE', 'ACEITO')
         LIMIT 1 FOR UPDATE`,
        [companies[0].id, drivers[0].id]
      );
      if (active.length > 0) {
        await connection.rollback();
        return res.status(409).json({ message: 'Já existe um interesse ativo para este motorista.' });
      }

      const [created] = await connection.execute(
        `INSERT INTO interesse (
          empresa_id, motorista_id, veiculo_id, status, data_criacao, data_limite_resposta
        ) VALUES (?, ?, ?, 'PENDENTE', UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 24 HOUR))`,
        [companies[0].id, drivers[0].id, body.veiculoId === undefined ? null : Number(body.veiculoId)]
      );
      const [rows] = await connection.execute(
        `SELECT ${INTEREST_FIELDS} FROM interesse i WHERE i.id = ? LIMIT 1`,
        [created.insertId]
      );
      await connection.commit();
      return res.status(201).json({ data: rows[0] });
    } catch {
      if (connection) await connection.rollback();
      return genericError(res);
    } finally {
      if (connection) connection.release();
    }
  });

  async function listInterests(req, res) {
    const pagination = parsePagination(req.query);
    if (pagination.error) return res.status(pagination.status).json({ message: pagination.error });
    try {
      await expirePendingInterests(pool);
      const owner = listQueryForUser(req.authenticatedUser);
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM interesse i ${owner.join} WHERE ${owner.ownerCondition}`,
        owner.values
      );
      const [rows] = await pool.execute(
        `SELECT ${INTEREST_FIELDS} FROM interesse i ${owner.join}
         WHERE ${owner.ownerCondition} ORDER BY i.id DESC LIMIT ? OFFSET ?`,
        [...owner.values, pagination.limit, pagination.offset]
      );
      return res.status(200).json({
        data: rows,
        meta: { page: pagination.page, limit: pagination.limit, total: Number(countRows[0]?.total || 0) }
      });
    } catch {
      return genericError(res);
    }
  }

  router.get('/companies/me/interests', requireCompany, listInterests);
  router.get('/drivers/me/interests', requireDriver, listInterests);

  router.get('/interests/:id', requireParticipant, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de interesse inválido.' });
    try {
      await expirePendingInterests(pool);
      const interest = await selectOwnInterest(pool, id, req.authenticatedUser);
      if (!interest) return res.status(404).json({ message: 'Interesse não encontrado.' });
      return res.status(200).json({ data: interest });
    } catch {
      return genericError(res);
    }
  });

  async function respondToInterest(req, res, nextStatus) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de interesse inválido.' });
    try {
      await expirePendingInterests(pool);
      const current = await selectOwnInterest(pool, id, req.authenticatedUser);
      if (!current) return res.status(404).json({ message: 'Interesse não encontrado.' });
      if (current.status !== 'PENDENTE') {
        return res.status(409).json({ message: 'Somente interesses pendentes podem receber resposta.' });
      }
      const [result] = await pool.execute(
        `UPDATE interesse i INNER JOIN motorista m ON m.id = i.motorista_id
         SET i.status = ?
         WHERE i.id = ? AND m.usuario_id = ? AND i.status = 'PENDENTE'
           AND i.data_limite_resposta > UTC_TIMESTAMP()`,
        [nextStatus, id, req.authenticatedUser.id]
      );
      if (result.affectedRows === 0) return res.status(409).json({ message: 'O interesse expirou ou já recebeu resposta.' });
      const updated = await selectOwnInterest(pool, id, req.authenticatedUser);
      return res.status(200).json({ data: updated });
    } catch {
      return genericError(res);
    }
  }

  router.post('/interests/:id/accept', requireDriver, (req, res) => respondToInterest(req, res, 'ACEITO'));
  router.post('/interests/:id/reject', requireDriver, (req, res) => respondToInterest(req, res, 'RECUSADO'));

  router.post('/interests/:id/cancel', requireParticipant, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de interesse inválido.' });
    const driverCancel = req.authenticatedUser.tipoUsuario === 'MOTORISTA';
    const observation = req.body?.observacaoCancelamento;
    const bodyKeys = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? Object.keys(req.body)
      : [];
    if (req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        bodyKeys.some((key) => key !== 'observacaoCancelamento'))) {
      return res.status(400).json({ message: 'Corpo de cancelamento inválido.' });
    }
    if (driverCancel && (typeof observation !== 'string' || !observation.trim())) {
      return res.status(422).json({ message: 'observacaoCancelamento é obrigatória para cancelamento pelo motorista.' });
    }
    if (driverCancel && Buffer.byteLength(observation.trim(), 'utf8') > 65_535) {
      return res.status(422).json({ message: 'observacaoCancelamento excede o limite do campo no banco.' });
    }
    if (!driverCancel && req.body && Object.hasOwn(req.body, 'observacaoCancelamento')) {
      return res.status(400).json({ message: 'Empresa não deve enviar justificativa para cancelamento.' });
    }

    try {
      await expirePendingInterests(pool);
      const current = await selectOwnInterest(pool, id, req.authenticatedUser);
      if (!current) return res.status(404).json({ message: 'Interesse não encontrado.' });
      const expectedStatus = driverCancel ? 'ACEITO' : 'PENDENTE';
      if (current.status !== expectedStatus) {
        return res.status(409).json({ message: `Este interesse não pode ser cancelado no estado ${current.status}.` });
      }

      const [result] = driverCancel
        ? await pool.execute(
          `UPDATE interesse i INNER JOIN motorista m ON m.id = i.motorista_id
           SET i.status = 'CANCELADO', i.cancelado_por = 'MOTORISTA',
               i.observacao_cancelamento = ?, i.data_cancelamento = UTC_TIMESTAMP()
           WHERE i.id = ? AND m.usuario_id = ? AND i.status = 'ACEITO'`,
          [observation.trim(), id, req.authenticatedUser.id]
        )
        : await pool.execute(
          `UPDATE interesse i INNER JOIN empresa e ON e.id = i.empresa_id
           SET i.status = 'CANCELADO', i.cancelado_por = 'EMPRESA',
               i.observacao_cancelamento = NULL, i.data_cancelamento = UTC_TIMESTAMP()
           WHERE i.id = ? AND e.usuario_id = ? AND i.status = 'PENDENTE'
             AND i.data_limite_resposta > UTC_TIMESTAMP()`,
          [id, req.authenticatedUser.id]
        );
      if (result.affectedRows === 0) return res.status(409).json({ message: 'O interesse mudou de estado e não pode ser cancelado.' });
      const updated = await selectOwnInterest(pool, id, req.authenticatedUser);
      return res.status(200).json({ data: updated });
    } catch {
      return genericError(res);
    }
  });

  return router;
}
