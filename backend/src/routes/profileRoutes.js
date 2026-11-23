import { Router } from 'express';
import { requireAuthenticatedUser } from '../middleware/authorization.js';
import { isValidCnpj, normalizeCnpj } from '../utils/brazilianDocuments.js';

const COMPANY_FIELDS = {
  razaoSocial: { column: 'razao_social', required: true, maxLength: 255 },
  nomeFantasia: { column: 'nome_fantasia', maxLength: 255, nullable: true },
  cnpj: { column: 'cnpj', required: true, maxLength: 18 },
  telefone: { column: 'telefone', maxLength: 20, nullable: true }
};

const DRIVER_FIELDS = {
  nome: { column: 'nome', required: true, maxLength: 255 },
  cpf: { column: 'cpf', required: true, maxLength: 14 },
  cnpj: { column: 'cnpj', required: true, maxLength: 18 },
  telefone: { column: 'telefone', maxLength: 20, nullable: true },
  disponivel: { column: 'disponivel', boolean: true }
};

function driverProfile(row) {
  return { ...row, disponivel: Boolean(row.disponivel) };
}

function buildUpdate(fields, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'O corpo da requisição deve ser um objeto JSON.' };
  }

  const keys = Object.keys(body);
  if (keys.length === 0 || keys.some((key) => !Object.hasOwn(fields, key))) {
    return { error: 'Informe ao menos um campo permitido para atualização.', status: 400 };
  }

  const assignments = [];
  const values = [];
  for (const key of keys) {
    const field = fields[key];
    const value = body[key];

    if (key === 'cnpj') {
      const normalized = normalizeCnpj(value);
      if (!isValidCnpj(normalized)) {
        return { error: 'CNPJ deve conter 14 numeros e digitos verificadores validos.', status: 422 };
      }
      assignments.push(`${field.column} = ?`);
      values.push(normalized);
      continue;
    }

    if (field.boolean) {
      if (typeof value !== 'boolean') return { error: `${key} deve ser booleano.`, status: 400 };
    } else if (value === null && field.nullable) {
      // Null explicitly clears nullable schema columns.
    } else if (typeof value !== 'string' || !value.trim()) {
      return { error: `${key} deve ser um texto não vazio.`, status: typeof value === 'string' ? 422 : 400 };
    } else if (value.trim().length > field.maxLength) {
      return { error: `${key} excede o tamanho máximo permitido.`, status: 422 };
    }

    assignments.push(`${field.column} = ?`);
    values.push(typeof value === 'string' ? value.trim() || (field.nullable ? null : '') : value);
  }

  return { assignments, values };
}

function handleDatabaseError(res, error, resourceName) {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'O CPF, CNPJ ou outro identificador informado já está cadastrado.' });
  }
  return res.status(500).json({ message: `Não foi possível consultar ou atualizar o perfil de ${resourceName}.` });
}

export function createProfileRouter(pool) {
  const router = Router();

  router.get('/companies/me', requireAuthenticatedUser(pool, ['EMPRESA']), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, razao_social AS razaoSocial, nome_fantasia AS nomeFantasia,
                cnpj, telefone
         FROM empresa WHERE usuario_id = ? LIMIT 1`,
        [req.authenticatedUser.id]
      );
      if (!rows[0]) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });
      return res.status(200).json({ data: rows[0] });
    } catch (error) {
      return handleDatabaseError(res, error, 'empresa');
    }
  });

  router.patch('/companies/me', requireAuthenticatedUser(pool, ['EMPRESA']), async (req, res) => {
    const update = buildUpdate(COMPANY_FIELDS, req.body);
    if (update.error) return res.status(update.status).json({ message: update.error });

    try {
      if (Object.hasOwn(req.body, 'cnpj')) {
        const normalizedCnpj = normalizeCnpj(req.body.cnpj);
        const [existing] = await pool.execute(
          `SELECT id FROM empresa WHERE cnpj = ? AND usuario_id <> ?
           UNION ALL
           SELECT id FROM motorista WHERE cnpj = ? LIMIT 1`,
          [normalizedCnpj, req.authenticatedUser.id, normalizedCnpj]
        );
        if (existing.length > 0) return res.status(409).json({ message: 'Este CNPJ já está cadastrado.' });
      }

      const [profile] = await pool.execute(
        'SELECT id FROM empresa WHERE usuario_id = ? LIMIT 1',
        [req.authenticatedUser.id]
      );
      if (!profile[0]) return res.status(404).json({ message: 'Perfil de empresa não encontrado.' });

      await pool.execute(
        `UPDATE empresa SET ${update.assignments.join(', ')} WHERE usuario_id = ?`,
        [...update.values, req.authenticatedUser.id]
      );
      const [rows] = await pool.execute(
        `SELECT id, razao_social AS razaoSocial, nome_fantasia AS nomeFantasia,
                cnpj, telefone FROM empresa WHERE usuario_id = ? LIMIT 1`,
        [req.authenticatedUser.id]
      );
      return res.status(200).json({ data: rows[0] });
    } catch (error) {
      return handleDatabaseError(res, error, 'empresa');
    }
  });

  router.get('/drivers/me', requireAuthenticatedUser(pool, ['MOTORISTA']), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, nome, cpf, cnpj, telefone, disponivel
         FROM motorista WHERE usuario_id = ? LIMIT 1`,
        [req.authenticatedUser.id]
      );
      if (!rows[0]) return res.status(404).json({ message: 'Perfil de motorista não encontrado.' });
      return res.status(200).json({ data: driverProfile(rows[0]) });
    } catch (error) {
      return handleDatabaseError(res, error, 'motorista');
    }
  });

  router.patch('/drivers/me', requireAuthenticatedUser(pool, ['MOTORISTA']), async (req, res) => {
    const update = buildUpdate(DRIVER_FIELDS, req.body);
    if (update.error) return res.status(update.status).json({ message: update.error });

    try {
      if (Object.hasOwn(req.body, 'cnpj') || Object.hasOwn(req.body, 'cpf')) {
        const cpf = req.body.cpf;
        const cnpj = req.body.cnpj;
        if (cnpj !== undefined) {
          const normalizedCnpj = normalizeCnpj(cnpj);
          const [existingCnpj] = await pool.execute(
            `SELECT id FROM motorista WHERE cnpj = ? AND usuario_id <> ?
             UNION ALL
             SELECT id FROM empresa WHERE cnpj = ? LIMIT 1`,
            [normalizedCnpj, req.authenticatedUser.id, normalizedCnpj]
          );
          if (existingCnpj.length > 0) return res.status(409).json({ message: 'Este CNPJ já está cadastrado.' });
        }
        if (cpf !== undefined) {
          const [existingCpf] = await pool.execute(
            'SELECT id FROM motorista WHERE cpf = ? AND usuario_id <> ? LIMIT 1',
            [cpf.trim(), req.authenticatedUser.id]
          );
          if (existingCpf.length > 0) return res.status(409).json({ message: 'Este CPF já está cadastrado.' });
        }
      }

      const [profile] = await pool.execute(
        'SELECT id FROM motorista WHERE usuario_id = ? LIMIT 1',
        [req.authenticatedUser.id]
      );
      if (!profile[0]) return res.status(404).json({ message: 'Perfil de motorista não encontrado.' });

      await pool.execute(
        `UPDATE motorista SET ${update.assignments.join(', ')} WHERE usuario_id = ?`,
        [...update.values, req.authenticatedUser.id]
      );
      const [rows] = await pool.execute(
        `SELECT id, nome, cpf, cnpj, telefone, disponivel
         FROM motorista WHERE usuario_id = ? LIMIT 1`,
        [req.authenticatedUser.id]
      );
      return res.status(200).json({ data: driverProfile(rows[0]) });
    } catch (error) {
      return handleDatabaseError(res, error, 'motorista');
    }
  });

  return router;
}
