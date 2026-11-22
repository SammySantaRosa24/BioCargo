export function requireAuthenticatedUser(pool, allowedTypes = []) {
  return async function authorize(req, res, next) {
    const sessionUser = req.session?.usuario;
    const userId = Number(sessionUser?.id);

    if (!sessionUser || !Number.isSafeInteger(userId) || userId < 1) {
      return res.status(401).json({ message: 'Usuário não autenticado.' });
    }

    try {
      const [users] = await pool.execute(
        'SELECT id, tipo_usuario, status FROM usuario WHERE id = ? LIMIT 1',
        [userId]
      );
      const user = users[0];

      if (!user || !user.status) {
        req.session.destroy(() => {});
        res.clearCookie('biocargo.sid');
        return res.status(401).json({ message: 'Sessão inválida ou expirada.' });
      }

      if (allowedTypes.length > 0 && !allowedTypes.includes(user.tipo_usuario)) {
        return res.status(403).json({ message: 'Perfil sem permissão para esta operação.' });
      }

      req.authenticatedUser = {
        id: user.id,
        tipoUsuario: user.tipo_usuario
      };
      return next();
    } catch {
      return res.status(500).json({ message: 'Não foi possível validar a sessão.' });
    }
  };
}
