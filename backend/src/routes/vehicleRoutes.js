import { Router } from 'express';
import { requireAuthenticatedUser } from '../middleware/authorization.js';

const VEHICLE_FIELDS = {
  placa: { column: 'placa', maxLength: 8 },
  renavam: { column: 'renavam', maxLength: 11 },
  marca: { column: 'marca', maxLength: 100 },
  modelo: { column: 'modelo', maxLength: 100 },
  ano: { column: 'ano', integer: true }
};

const VEHICLE_COLUMNS = 'id, placa, renavam, marca, modelo, ano, disponivel';

function parseVehicleFields(body, { creating = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'O corpo da requisição deve ser um objeto JSON.', status: 400 };
  }

  const allowed = creating ? [...Object.keys(VEHICLE_FIELDS), 'disponivel'] : Object.keys(VEHICLE_FIELDS);
  const keys = Object.keys(body);
  if (keys.length === 0 || keys.some((key) => !allowed.includes(key))) {
    return { error: 'Informe ao menos um campo permitido para o veículo.', status: 400 };
  }

  if (creating) {
    const missing = Object.keys(VEHICLE_FIELDS).filter((key) => !Object.hasOwn(body, key));
    if (missing.length > 0) {
      return { error: `Campos obrigatórios ausentes: ${missing.join(', ')}.`, status: 400 };
    }
  }

  const assignments = [];
  const values = [];
  for (const key of keys) {
    if (key === 'disponivel') {
      if (typeof body[key] !== 'boolean') return { error: 'disponivel deve ser booleano.', status: 400 };
      assignments.push('disponivel = ?');
      values.push(body[key]);
      continue;
    }

    const field = VEHICLE_FIELDS[key];
    const value = body[key];
    if (field.integer) {
      if (!Number.isInteger(value)) return { error: 'ano deve ser um número inteiro.', status: 400 };
    } else if (typeof value !== 'string') {
      return { error: `${key} deve ser texto.`, status: 400 };
    } else if (!value.trim() || value.trim().length > field.maxLength) {
      return { error: `${key} possui valor ou comprimento inválido.`, status: 422 };
    }

    assignments.push(`${field.column} = ?`);
    values.push(field.integer ? value : value.trim());
  }

  return { assignments, values };
}

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function respondWithError(res, error) {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Placa ou RENAVAM já cadastrado.' });
  }
  return res.status(500).json({ message: 'Não foi possível consultar ou atualizar o veículo.' });
}

export function createVehicleRouter(pool) {
  const router = Router();
  const requireDriver = requireAuthenticatedUser(pool, ['MOTORISTA']);

  router.post('/drivers/me/vehicles', requireDriver, async (req, res) => {
    const input = parseVehicleFields(req.body, { creating: true });
    if (input.error) return res.status(input.status).json({ message: input.error });

    try {
      const [drivers] = await pool.execute(
        'SELECT id FROM motorista WHERE usuario_id = ? LIMIT 1',
        [req.authenticatedUser.id]
      );
      if (!drivers[0]) return res.status(404).json({ message: 'Perfil de motorista não encontrado.' });

      const disponivel = Object.hasOwn(req.body, 'disponivel') ? req.body.disponivel : false;
      const [result] = await pool.execute(
        `INSERT INTO veiculo (motorista_id, placa, renavam, marca, modelo, ano, disponivel)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [drivers[0].id, req.body.placa.trim(), req.body.renavam.trim(), req.body.marca.trim(),
          req.body.modelo.trim(), req.body.ano, disponivel]
      );
      const [rows] = await pool.execute(
        `SELECT ${VEHICLE_COLUMNS} FROM veiculo WHERE id = ? AND motorista_id = ? LIMIT 1`,
        [result.insertId, drivers[0].id]
      );
      return res.status(201).json({ data: rows[0] });
    } catch (error) {
      return respondWithError(res, error);
    }
  });

  router.get('/drivers/me/vehicles', requireDriver, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT v.${VEHICLE_COLUMNS.replaceAll(', ', ', v.')}
         FROM veiculo v
         INNER JOIN motorista m ON m.id = v.motorista_id
         WHERE m.usuario_id = ? ORDER BY v.id`,
        [req.authenticatedUser.id]
      );
      return res.status(200).json({ data: rows });
    } catch (error) {
      return respondWithError(res, error);
    }
  });

  router.get('/vehicles/:id', requireDriver, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de veículo inválido.' });

    try {
      const [rows] = await pool.execute(
        `SELECT v.${VEHICLE_COLUMNS.replaceAll(', ', ', v.')}
         FROM veiculo v
         INNER JOIN motorista m ON m.id = v.motorista_id
         WHERE v.id = ? AND m.usuario_id = ? LIMIT 1`,
        [id, req.authenticatedUser.id]
      );
      if (!rows[0]) return res.status(404).json({ message: 'Veículo não encontrado.' });
      return res.status(200).json({ data: rows[0] });
    } catch (error) {
      return respondWithError(res, error);
    }
  });

  router.patch('/vehicles/:id', requireDriver, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de veículo inválido.' });
    const input = parseVehicleFields(req.body);
    if (input.error) return res.status(input.status).json({ message: input.error });

    try {
      const [result] = await pool.execute(
        `UPDATE veiculo v
         INNER JOIN motorista m ON m.id = v.motorista_id
         SET ${input.assignments.map((assignment) => `v.${assignment}`).join(', ')}
         WHERE v.id = ? AND m.usuario_id = ?`,
        [...input.values, id, req.authenticatedUser.id]
      );
      if (result.affectedRows === 0) {
        const [existing] = await pool.execute(
          `SELECT v.id FROM veiculo v INNER JOIN motorista m ON m.id = v.motorista_id
           WHERE v.id = ? AND m.usuario_id = ? LIMIT 1`,
          [id, req.authenticatedUser.id]
        );
        if (!existing[0]) return res.status(404).json({ message: 'Veículo não encontrado.' });
      }
      const [rows] = await pool.execute(
        `SELECT v.${VEHICLE_COLUMNS.replaceAll(', ', ', v.')}
         FROM veiculo v INNER JOIN motorista m ON m.id = v.motorista_id
         WHERE v.id = ? AND m.usuario_id = ? LIMIT 1`,
        [id, req.authenticatedUser.id]
      );
      return res.status(200).json({ data: rows[0] });
    } catch (error) {
      return respondWithError(res, error);
    }
  });

  router.patch('/vehicles/:id/availability', requireDriver, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de veículo inválido.' });
    if (!req.body || Array.isArray(req.body) || Object.keys(req.body).length !== 1 ||
        typeof req.body.disponivel !== 'boolean') {
      return res.status(400).json({ message: 'Informe somente disponivel como booleano.' });
    }

    try {
      const [result] = await pool.execute(
        `UPDATE veiculo v
         INNER JOIN motorista m ON m.id = v.motorista_id
         SET v.disponivel = ? WHERE v.id = ? AND m.usuario_id = ?`,
        [req.body.disponivel, id, req.authenticatedUser.id]
      );
      if (result.affectedRows === 0) {
        const [existing] = await pool.execute(
          `SELECT v.id FROM veiculo v INNER JOIN motorista m ON m.id = v.motorista_id
           WHERE v.id = ? AND m.usuario_id = ? LIMIT 1`,
          [id, req.authenticatedUser.id]
        );
        if (!existing[0]) return res.status(404).json({ message: 'Veículo não encontrado.' });
      }
      const [rows] = await pool.execute(
        `SELECT v.id, v.disponivel FROM veiculo v
         INNER JOIN motorista m ON m.id = v.motorista_id
         WHERE v.id = ? AND m.usuario_id = ? LIMIT 1`,
        [id, req.authenticatedUser.id]
      );
      return res.status(200).json({ data: rows[0] });
    } catch (error) {
      return respondWithError(res, error);
    }
  });

  return router;
}
