import { Router } from 'express';
import { requireAuthenticatedUser } from '../middleware/authorization.js';

function parseId(rawId) {
  if (!/^[1-9]\d*$/.test(rawId)) return null;
  const id = Number(rawId);
  return Number.isSafeInteger(id) ? id : null;
}

export function createAdminRouter(pool) {
  const router = Router();
  router.patch('/admin/users/:id/status', requireAuthenticatedUser(pool, ['ADMIN']), async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de usuário inválido.' });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        Object.keys(req.body).length !== 1 || req.body.status !== false) {
      return res.status(400).json({ message: 'Envie somente { "status": false } para inativar a conta.' });
    }
    if (id === Number(req.authenticatedUser.id)) {
      return res.status(409).json({ message: 'Um administrador não pode inativar a própria conta.' });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [actors] = await connection.execute(
        `SELECT id FROM usuario
         WHERE id = ? AND tipo_usuario = 'ADMIN' AND status = TRUE FOR UPDATE`,
        [req.authenticatedUser.id]
      );
      if (!actors[0]) {
        await connection.rollback();
        return res.status(403).json({ message: 'Conta ADMIN ativa necessária.' });
      }
      const [targets] = await connection.execute(
        'SELECT id, tipo_usuario, status FROM usuario WHERE id = ? FOR UPDATE',
        [id]
      );
      const target = targets[0];
      if (!target) {
        await connection.rollback();
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      if (target.tipo_usuario === 'ADMIN' && target.status) {
        const [admins] = await connection.execute(
          'SELECT id FROM usuario WHERE tipo_usuario = \'ADMIN\' AND status = TRUE FOR UPDATE'
        );
        if (admins.length <= 1) {
          await connection.rollback();
          return res.status(409).json({ message: 'Não é possível inativar o último administrador ativo.' });
        }
      }

      await connection.execute('UPDATE usuario SET status = FALSE WHERE id = ?', [id]);
      await connection.execute(
        `DELETE FROM sessions
         WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.usuario.id')) AS UNSIGNED) = ?`,
        [id]
      );
      await connection.commit();
      return res.status(200).json({ data: { id: target.id, status: false } });
    } catch {
      if (connection) await connection.rollback();
      return res.status(500).json({ message: 'Não foi possível inativar o usuário.' });
    } finally {
      if (connection) connection.release();
    }
  });
  return router;
}
