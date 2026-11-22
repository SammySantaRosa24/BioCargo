import { Router } from 'express';
import { requireAuthenticatedUser } from '../middleware/authorization.js';

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseFields(body, { creating = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'O corpo da requisição deve ser um objeto JSON.', status: 400 };
  }
  const fields = ['titulo', 'descricao'];
  const keys = Object.keys(body);
  if (keys.length === 0 || keys.some((key) => !fields.includes(key))) {
    return { error: 'Informe ao menos um campo permitido para a qualificação.', status: 400 };
  }
  if (creating && !Object.hasOwn(body, 'titulo')) {
    return { error: 'titulo é obrigatório.', status: 400 };
  }

  const values = {};
  if (Object.hasOwn(body, 'titulo')) {
    if (typeof body.titulo !== 'string') return { error: 'titulo deve ser texto.', status: 400 };
    if (!body.titulo.trim() || body.titulo.trim().length > 255) {
      return { error: 'titulo deve conter até 255 caracteres.', status: 422 };
    }
    values.titulo = body.titulo.trim();
  }
  if (Object.hasOwn(body, 'descricao')) {
    if (body.descricao !== null && typeof body.descricao !== 'string') {
      return { error: 'descricao deve ser texto ou null.', status: 400 };
    }
    values.descricao = typeof body.descricao === 'string' ? body.descricao.trim() || null : null;
  }
  return { values };
}

function handleError(res, error) {
  return res.status(500).json({ message: 'Não foi possível consultar ou atualizar a qualificação.' });
}

export function createQualificationRouter(pool) {
  const router = Router();
  const requireDriver = requireAuthenticatedUser(pool, ['MOTORISTA']);

  router.post('/drivers/me/qualifications', requireDriver, async (req, res) => {
    const input = parseFields(req.body, { creating: true });
    if (input.error) return res.status(input.status).json({ message: input.error });

    try {
      const [drivers] = await pool.execute(
        'SELECT id FROM motorista WHERE usuario_id = ? LIMIT 1',
        [req.authenticatedUser.id]
      );
      if (!drivers[0]) return res.status(404).json({ message: 'Perfil de motorista não encontrado.' });

      const [result] = await pool.execute(
        'INSERT INTO qualificacao (motorista_id, titulo, descricao) VALUES (?, ?, ?)',
        [drivers[0].id, input.values.titulo, input.values.descricao ?? null]
      );
      const [rows] = await pool.execute(
        'SELECT id, titulo, descricao FROM qualificacao WHERE id = ? AND motorista_id = ? LIMIT 1',
        [result.insertId, drivers[0].id]
      );
      return res.status(201).json({ data: rows[0] });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.get('/drivers/me/qualifications', requireDriver, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT q.id, q.titulo, q.descricao
         FROM qualificacao q
         INNER JOIN motorista m ON m.id = q.motorista_id
         WHERE m.usuario_id = ? ORDER BY q.id`,
        [req.authenticatedUser.id]
      );
      return res.status(200).json({ data: rows });
    } catch (error) {
      return handleError(res, error);
    }
  });

  router.patch('/qualifications/:id', requireDriver, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de qualificação inválido.' });
    const input = parseFields(req.body);
    if (input.error) return res.status(input.status).json({ message: input.error });

    try {
      const [result] = await pool.execute(
        `UPDATE qualificacao q
         INNER JOIN motorista m ON m.id = q.motorista_id
         SET ${Object.keys(input.values).map((key) => `q.${key} = ?`).join(', ')}
         WHERE q.id = ? AND m.usuario_id = ?`,
        [...Object.values(input.values), id, req.authenticatedUser.id]
      );
      if (result.affectedRows === 0) {
        const [existing] = await pool.execute(
          `SELECT q.id FROM qualificacao q INNER JOIN motorista m ON m.id = q.motorista_id
           WHERE q.id = ? AND m.usuario_id = ? LIMIT 1`,
          [id, req.authenticatedUser.id]
        );
        if (!existing[0]) return res.status(404).json({ message: 'Qualificação não encontrada.' });
      }
      const [rows] = await pool.execute(
        `SELECT q.id, q.titulo, q.descricao
         FROM qualificacao q INNER JOIN motorista m ON m.id = q.motorista_id
         WHERE q.id = ? AND m.usuario_id = ? LIMIT 1`,
        [id, req.authenticatedUser.id]
      );
      return res.status(200).json({ data: rows[0] });
    } catch (error) {
      return handleError(res, error);
    }
  });

  return router;
}
