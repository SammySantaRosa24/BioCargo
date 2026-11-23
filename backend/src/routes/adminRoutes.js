import { Router } from 'express';
import { requireAuthenticatedUser } from '../middleware/authorization.js';

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function parsePagination(query, allowed) {
  if (Object.keys(query).some((key) => !allowed.includes(key))) return { error: 'Há parâmetros de consulta não permitidos.', status: 400 };
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return { error: 'page e limit devem ser inteiros positivos; limit não pode exceder 100.', status: 422 };
  }
  return { page, limit, offset: (page - 1) * limit };
}

function escapeLike(value) { return value.replace(/[!%_]/g, (character) => `!${character}`); }

const ADMIN_USER_SELECT = `
  SELECT u.id, u.email, u.tipo_usuario AS tipoUsuario, u.status AS ativo,
    COALESCE(NULLIF(e.nome_fantasia, ''), e.razao_social, m.nome, u.email) AS nome,
    COALESCE(e.cnpj, m.cnpj) AS cnpj, m.cpf, COALESCE(e.telefone, m.telefone) AS telefone,
    e.id AS empresaId, m.id AS motoristaId, e.razao_social AS razaoSocial, e.nome_fantasia AS nomeFantasia,
    DATE_FORMAT(u.data_cadastro, '%Y-%m-%dT%H:%i:%sZ') AS dataCadastro
  FROM usuario u LEFT JOIN empresa e ON e.usuario_id = u.id
  LEFT JOIN motorista m ON m.usuario_id = u.id`;

const ADMIN_DEMAND_SELECT = `
  SELECT d.id, d.titulo, d.descricao, d.porte, d.tipo_transporte AS tipoTransporte,
    d.origem_cidade AS origemCidade, d.origem_endereco AS origemEndereco,
    d.origem_complemento AS origemComplemento, d.destino_cidade AS destinoCidade,
    d.destino_endereco AS destinoEndereco, d.destino_complemento AS destinoComplemento,
    DATE_FORMAT(d.data_transporte, '%Y-%m-%d') AS dataTransporte,
    d.periodo_retirada AS periodoRetirada, d.valor_oferecido AS valorOferecido,
    d.requisitos, d.status, DATE_FORMAT(d.data_criacao, '%Y-%m-%dT%H:%i:%sZ') AS dataCriacao,
    DATE_FORMAT(d.atualizado_em, '%Y-%m-%dT%H:%i:%sZ') AS atualizadoEm,
    e.id AS empresaId, COALESCE(NULLIF(e.nome_fantasia, ''), e.razao_social) AS empresaNome,
    i.id AS interesseId, i.status AS interesseStatus,
    m.id AS motoristaId, m.nome AS motoristaNome,
    c.data_entrega AS dataEntrega, TIME_FORMAT(c.horario_entrega, '%H:%i') AS horarioEntrega,
    c.nome_recebedor AS nomeRecebedor, c.observacoes AS observacoesEntrega,
    DATE_FORMAT(c.enviado_em, '%Y-%m-%dT%H:%i:%sZ') AS comprovanteEnviadoEm,
    c.id AS comprovanteId
  FROM demanda d INNER JOIN empresa e ON e.id = d.empresa_id
  LEFT JOIN interesse i ON i.demanda_id = d.id AND i.status = 'ACEITO'
  LEFT JOIN motorista m ON m.id = i.motorista_id
  LEFT JOIN comprovante_entrega c ON c.demanda_id = d.id`;

export function createAdminRouter(pool) {
  const router = Router();
  const requireAdmin = requireAuthenticatedUser(pool, ['ADMIN']);

  router.get('/admin/dashboard/summary', requireAdmin, async (_req, res) => {
    try {
      const [users] = await pool.execute(
        `SELECT
          (SELECT COUNT(*) FROM empresa) AS empresas,
          (SELECT COUNT(*) FROM motorista) AS motoristas,
          SUM(status = TRUE) AS usuariosAtivos,
          SUM(status = FALSE) AS usuariosInativos
         FROM usuario`
      );
      const [demands] = await pool.execute(
        `SELECT COUNT(*) AS demandas,
          COALESCE(SUM(status IN ('ABERTA', 'EM_NEGOCIACAO')), 0) AS demandasAbertas,
          COALESCE(SUM(status = 'EM_ANDAMENTO'), 0) AS demandasEmAndamento,
          COALESCE(SUM(status = 'FINALIZADA'), 0) AS demandasFinalizadas,
          COALESCE(SUM(status = 'CANCELADA'), 0) AS demandasCanceladas
         FROM demanda`
      );
      const userCounts = users[0] || {};
      const demandCounts = demands[0] || {};
      return res.json({ data: Object.fromEntries(Object.entries({ ...userCounts, ...demandCounts }).map(([key, value]) => [key, Number(value || 0)])) });
    } catch { return res.status(500).json({ message: 'Não foi possível carregar os indicadores administrativos.' }); }
  });

  router.get('/admin/users', requireAdmin, async (req, res) => {
    const pagination = parsePagination(req.query, ['page', 'limit', 'q', 'tipo', 'situacao']);
    if (pagination.error) return res.status(pagination.status).json({ message: pagination.error });
    const conditions = [];
    const values = [];
    if (req.query.tipo !== undefined) {
      if (!['EMPRESA', 'MOTORISTA', 'ADMIN'].includes(req.query.tipo)) return res.status(400).json({ message: 'tipo deve ser EMPRESA, MOTORISTA ou ADMIN.' });
      conditions.push('u.tipo_usuario = ?'); values.push(req.query.tipo);
    }
    if (req.query.situacao !== undefined) {
      if (!['ativo', 'inativo'].includes(req.query.situacao)) return res.status(400).json({ message: 'situacao deve ser ativo ou inativo.' });
      conditions.push('u.status = ?'); values.push(req.query.situacao === 'ativo');
    }
    if (req.query.q !== undefined) {
      if (typeof req.query.q !== 'string' || !req.query.q.trim() || req.query.q.trim().length > 255) return res.status(422).json({ message: 'q deve conter de 1 a 255 caracteres.' });
      const search = `%${escapeLike(req.query.q.trim())}%`;
      conditions.push(`(u.email LIKE ? ESCAPE '!' OR e.razao_social LIKE ? ESCAPE '!' OR e.nome_fantasia LIKE ? ESCAPE '!'
        OR m.nome LIKE ? ESCAPE '!' OR e.cnpj LIKE ? ESCAPE '!' OR m.cnpj LIKE ? ESCAPE '!' OR m.cpf LIKE ? ESCAPE '!')`);
      values.push(search, search, search, search, search, search, search);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    try {
      const [counts] = await pool.execute(`SELECT COUNT(*) AS total FROM usuario u LEFT JOIN empresa e ON e.usuario_id = u.id LEFT JOIN motorista m ON m.usuario_id = u.id${where}`, values);
      const [rows] = await pool.execute(`${ADMIN_USER_SELECT}${where} ORDER BY u.data_cadastro DESC, u.id DESC LIMIT ? OFFSET ?`, [...values, pagination.limit, pagination.offset]);
      return res.json({ data: rows.map((user) => ({ ...user, ativo: Boolean(user.ativo) })), meta: { page: pagination.page, limit: pagination.limit, total: Number(counts[0]?.total || 0) } });
    } catch { return res.status(500).json({ message: 'Não foi possível listar os usuários.' }); }
  });

  router.get('/admin/users/:id', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de usuário inválido.' });
    try {
      const [rows] = await pool.execute(`${ADMIN_USER_SELECT} WHERE u.id = ? LIMIT 1`, [id]);
      if (!rows[0]) return res.status(404).json({ message: 'Usuário não encontrado.' });
      return res.json({ data: { ...rows[0], ativo: Boolean(rows[0].ativo) } });
    } catch { return res.status(500).json({ message: 'Não foi possível consultar o usuário.' }); }
  });

  router.patch('/admin/users/:id/status', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de usuário inválido.' });
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) ||
        Object.keys(req.body).length !== 1 || typeof req.body.status !== 'boolean') {
      return res.status(400).json({ message: 'Envie somente { "status": true|false }.' });
    }
    const active = req.body.status;
    if (!active && id === Number(req.authenticatedUser.id)) return res.status(409).json({ message: 'Um administrador não pode inativar a própria conta.' });

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [actors] = await connection.execute("SELECT id FROM usuario WHERE id = ? AND tipo_usuario = 'ADMIN' AND status = TRUE FOR UPDATE", [req.authenticatedUser.id]);
      if (!actors[0]) { await connection.rollback(); return res.status(403).json({ message: 'Conta ADMIN ativa necessária.' }); }
      const [targets] = await connection.execute('SELECT id, tipo_usuario, status FROM usuario WHERE id = ? FOR UPDATE', [id]);
      const target = targets[0];
      if (!target) { await connection.rollback(); return res.status(404).json({ message: 'Usuário não encontrado.' }); }
      if (!active && target.tipo_usuario === 'ADMIN' && target.status) {
        const [admins] = await connection.execute("SELECT id FROM usuario WHERE tipo_usuario = 'ADMIN' AND status = TRUE FOR UPDATE");
        if (admins.length <= 1) { await connection.rollback(); return res.status(409).json({ message: 'Não é possível inativar o último administrador ativo.' }); }
      }
      await connection.execute('UPDATE usuario SET status = ? WHERE id = ?', [active, id]);
      if (!active) {
        await connection.execute(
          `DELETE FROM sessions WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.usuario.id')) AS UNSIGNED) = ?`, [id]
        );
      }
      await connection.commit();
      return res.json({ data: { id: target.id, status: active } });
    } catch {
      if (connection) await connection.rollback();
      return res.status(500).json({ message: 'Não foi possível atualizar a situação do usuário.' });
    } finally { connection?.release(); }
  });

  router.get('/admin/demands', requireAdmin, async (req, res) => {
    const pagination = parsePagination(req.query, ['page', 'limit', 'status', 'empresaId']);
    if (pagination.error) return res.status(pagination.status).json({ message: pagination.error });
    const conditions = [];
    const values = [];
    if (req.query.status !== undefined) {
      if (!['ABERTA', 'EM_NEGOCIACAO', 'EM_ANDAMENTO', 'FINALIZADA', 'CANCELADA', 'EXPIRADA'].includes(req.query.status)) return res.status(400).json({ message: 'Status de demanda inválido.' });
      conditions.push('d.status = ?'); values.push(req.query.status);
    }
    if (req.query.empresaId !== undefined) {
      const companyId = parseId(req.query.empresaId);
      if (!companyId) return res.status(400).json({ message: 'empresaId deve ser um ID positivo.' });
      conditions.push('d.empresa_id = ?'); values.push(companyId);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    try {
      const [counts] = await pool.execute(`SELECT COUNT(*) AS total FROM demanda d${where}`, values);
      const [rows] = await pool.execute(`${ADMIN_DEMAND_SELECT}${where} ORDER BY d.data_criacao DESC, d.id DESC LIMIT ? OFFSET ?`, [...values, pagination.limit, pagination.offset]);
      return res.json({ data: rows, meta: { page: pagination.page, limit: pagination.limit, total: Number(counts[0]?.total || 0) } });
    } catch { return res.status(500).json({ message: 'Não foi possível listar as demandas.' }); }
  });

  router.get('/admin/demands/:id', requireAdmin, async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID de demanda inválido.' });
    try {
      const [rows] = await pool.execute(`${ADMIN_DEMAND_SELECT} WHERE d.id = ? LIMIT 1`, [id]);
      if (!rows[0]) return res.status(404).json({ message: 'Demanda não encontrada.' });
      return res.json({ data: rows[0] });
    } catch { return res.status(500).json({ message: 'Não foi possível consultar a demanda.' }); }
  });

  return router;
}
