import { Router } from 'express';
import { requireAuthenticatedUser } from '../middleware/authorization.js';

const ALLOWED_QUERY_FIELDS = new Set([
  'veiculoDisponivel', 'marca', 'modelo', 'ano', 'qualificacao', 'page', 'limit'
]);

function escapeLike(value) {
  return value.replace(/[!%_]/g, (character) => `!${character}`);
}

function parseSearchQuery(query) {
  const unknown = Object.keys(query).find((key) => !ALLOWED_QUERY_FIELDS.has(key));
  if (unknown) return { error: `Filtro não permitido: ${unknown}.`, status: 400 };

  const parsed = { page: 1, limit: 20, vehicleConditions: ['ativo = TRUE'], vehicleValues: [] };
  if (query.veiculoDisponivel !== undefined) {
    if (!['true', 'false'].includes(query.veiculoDisponivel)) {
      return { error: 'veiculoDisponivel deve ser true ou false.', status: 400 };
    }
    parsed.vehicleConditions.push('disponivel = ?');
    parsed.vehicleValues.push(query.veiculoDisponivel === 'true');
  }
  for (const field of ['marca', 'modelo']) {
    if (query[field] !== undefined) {
      if (typeof query[field] !== 'string' || !query[field].trim()) {
        return { error: `${field} deve ser texto não vazio.`, status: 400 };
      }
      if (query[field].trim().length > 100) {
        return { error: `${field} excede o comprimento permitido.`, status: 422 };
      }
      parsed.vehicleConditions.push(`${field} LIKE ? ESCAPE '!'`);
      parsed.vehicleValues.push(`%${escapeLike(query[field].trim())}%`);
    }
  }
  if (query.ano !== undefined) {
    const year = Number(query.ano);
    if (!Number.isSafeInteger(year) || year < -2147483648 || year > 2147483647) {
      return { error: 'ano deve ser um inteiro dentro do intervalo do banco.', status: 400 };
    }
    parsed.vehicleConditions.push('ano = ?');
    parsed.vehicleValues.push(year);
  }
  if (query.qualificacao !== undefined) {
    if (typeof query.qualificacao !== 'string' || !query.qualificacao.trim()) {
      return { error: 'qualificacao deve ser texto não vazio.', status: 400 };
    }
    if (query.qualificacao.trim().length > 255) {
      return { error: 'qualificacao excede 255 caracteres.', status: 422 };
    }
    parsed.qualificationValue = `%${escapeLike(query.qualificacao.trim())}%`;
  }
  for (const field of ['page', 'limit']) {
    if (query[field] !== undefined) {
      const number = Number(query[field]);
      if (!Number.isSafeInteger(number) || number < 1) {
        return { error: `${field} deve ser um inteiro positivo.`, status: 400 };
      }
      parsed[field] = number;
    }
  }
  if (parsed.limit > 100) return { error: 'limit não pode exceder 100.', status: 422 };
  if ((parsed.page - 1) * parsed.limit > 2147483647) {
    return { error: 'page está fora do intervalo permitido.', status: 422 };
  }
  return parsed;
}

function buildDriverConditions(parsed) {
  const conditions = ['u.status = TRUE', 'm.disponivel = TRUE'];
  const values = [];
  if (parsed.vehicleConditions.length > 1) {
    conditions.push(`EXISTS (
      SELECT 1 FROM veiculo vf WHERE vf.motorista_id = m.id
      AND ${parsed.vehicleConditions.map((condition) => `vf.${condition}`).join(' AND ')}
    )`);
    values.push(...parsed.vehicleValues);
  }
  if (parsed.qualificationValue !== undefined) {
    conditions.push(`EXISTS (
      SELECT 1 FROM qualificacao qf WHERE qf.motorista_id = m.id AND qf.titulo LIKE ? ESCAPE '!'
    )`);
    values.push(parsed.qualificationValue);
  }
  return { sql: conditions.join(' AND '), values };
}

export function createSearchRouter(pool) {
  const router = Router();

  router.get('/drivers', requireAuthenticatedUser(pool, ['EMPRESA']), async (req, res) => {
    const parsed = parseSearchQuery(req.query);
    if (parsed.error) return res.status(parsed.status).json({ message: parsed.error });

    const conditions = buildDriverConditions(parsed);
    try {
      const [countRows] = await pool.execute(
        `SELECT COUNT(DISTINCT m.id) AS total
         FROM motorista m INNER JOIN usuario u ON u.id = m.usuario_id
         WHERE ${conditions.sql}`,
        conditions.values
      );
      const total = Number(countRows[0]?.total || 0);
      const [drivers] = await pool.execute(
        `SELECT m.id, m.disponivel AS motoristaDisponivel
         FROM motorista m INNER JOIN usuario u ON u.id = m.usuario_id
         WHERE ${conditions.sql} ORDER BY m.id LIMIT ? OFFSET ?`,
        [...conditions.values, parsed.limit, (parsed.page - 1) * parsed.limit]
      );

      if (drivers.length === 0) {
        return res.status(200).json({ data: [], meta: { page: parsed.page, limit: parsed.limit, total } });
      }

      const ids = drivers.map((driver) => driver.id);
      const marks = ids.map(() => '?').join(', ');
      const vehicleConditions = ['ativo = TRUE', ...parsed.vehicleConditions.slice(1)];
      const [vehicles] = await pool.execute(
        `SELECT id, motorista_id AS motoristaId, marca, modelo, ano, disponivel
         FROM veiculo WHERE motorista_id IN (${marks}) AND ${vehicleConditions.join(' AND ')}
         ORDER BY motorista_id, id`,
        [...ids, ...parsed.vehicleValues]
      );
      const [qualifications] = await pool.execute(
        `SELECT motorista_id AS motoristaId, titulo
         FROM qualificacao WHERE motorista_id IN (${marks}) ORDER BY motorista_id, id`,
        ids
      );

      const result = new Map(drivers.map((driver) => [driver.id, {
        id: driver.id,
        motoristaDisponivel: Boolean(driver.motoristaDisponivel),
        veiculos: [],
        qualificacoes: []
      }]));
      for (const vehicle of vehicles) {
        result.get(vehicle.motoristaId)?.veiculos.push({
          id: vehicle.id,
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          disponivel: Boolean(vehicle.disponivel)
        });
      }
      for (const qualification of qualifications) {
        result.get(qualification.motoristaId)?.qualificacoes.push(qualification.titulo);
      }

      return res.status(200).json({
        data: [...result.values()],
        meta: { page: parsed.page, limit: parsed.limit, total }
      });
    } catch {
      return res.status(500).json({ message: 'Não foi possível realizar a busca.' });
    }
  });

  return router;
}
