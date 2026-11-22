import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createProfileRouter } from '../src/routes/profileRoutes.js';

const profiles = {
  EMPRESA: {
    id: 21,
    usuarioId: 1,
    razaoSocial: 'Bio Cargo Ltda',
    nomeFantasia: 'Bio Cargo',
    cnpj: '11222333000181',
    telefone: null
  },
  MOTORISTA: {
    id: 31,
    usuarioId: 2,
    nome: 'Rafael Motorista',
    cpf: '12345678901',
    cnpj: '99888777000166',
    telefone: null,
    disponivel: 0
  }
};

function makePool() {
  const calls = [];
  const pool = {
    calls,
    async execute(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('FROM usuario')) {
        const userId = Number(values[0]);
        return [[{
          id: userId,
          tipo_usuario: userId === 1 ? 'EMPRESA' : 'MOTORISTA',
          status: userId === 3 ? 0 : 1
        }]];
      }
      if (sql.includes('FROM empresa') && sql.includes('SELECT')) {
        const row = profiles.EMPRESA;
        return [[{
          id: row.id,
          razaoSocial: row.razaoSocial,
          nomeFantasia: row.nomeFantasia,
          cnpj: row.cnpj,
          telefone: row.telefone
        }]];
      }
      if (sql.includes('FROM motorista') && sql.includes('SELECT')) {
        const row = profiles.MOTORISTA;
        return [[{
          id: row.id,
          nome: row.nome,
          cpf: row.cpf,
          cnpj: row.cnpj,
          telefone: row.telefone,
          disponivel: row.disponivel
        }]];
      }
      if (sql.includes('UPDATE')) return [{ affectedRows: 1 }];
      return [[]];
    }
  };
  return pool;
}

async function withApi(run) {
  const pool = makePool();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = Number(req.get('x-test-user'));
    req.session = {
      ...(userId ? { usuario: { id: userId } } : {}),
      destroy(callback) { callback(); }
    };
    next();
  });
  app.use('/api/v1', createProfileRouter(pool));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, pool);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('requires a session and the matching account type', async () => {
  await withApi(async (baseUrl) => {
    const anonymous = await fetch(`${baseUrl}/api/v1/companies/me`);
    assert.equal(anonymous.status, 401);

    const wrongRole = await fetch(`${baseUrl}/api/v1/companies/me`, {
      headers: { 'x-test-user': '2' }
    });
    assert.equal(wrongRole.status, 403);

    const inactive = await fetch(`${baseUrl}/api/v1/companies/me`, {
      headers: { 'x-test-user': '3' }
    });
    assert.equal(inactive.status, 401);
  });
});

test('returns own company profile and updates only allowlisted fields', async () => {
  await withApi(async (baseUrl, pool) => {
    const response = await fetch(`${baseUrl}/api/v1/companies/me`, {
      headers: { 'x-test-user': '1' }
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.id, 21);

    const patch = await fetch(`${baseUrl}/api/v1/companies/me`, {
      method: 'PATCH',
      headers: { 'x-test-user': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ telefone: '(11) 3333-4444' })
    });
    assert.equal(patch.status, 200);
    const updateCall = pool.calls.find(({ sql }) => sql.startsWith('UPDATE empresa'));
    assert.deepEqual(updateCall.values, ['(11) 3333-4444', 1]);

    const invalidPatch = await fetch(`${baseUrl}/api/v1/companies/me`, {
      method: 'PATCH',
      headers: { 'x-test-user': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ usuarioId: 2 })
    });
    assert.equal(invalidPatch.status, 400);
  });
});

test('returns own driver profile and validates availability as a boolean', async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/drivers/me`, {
      headers: { 'x-test-user': '2' }
    });
    assert.equal(response.status, 200);
    const profile = (await response.json()).data;
    assert.equal(profile.nome, 'Rafael Motorista');
    assert.equal(profile.disponivel, false);

    const invalidPatch = await fetch(`${baseUrl}/api/v1/drivers/me`, {
      method: 'PATCH',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({ disponivel: 'true' })
    });
    assert.equal(invalidPatch.status, 400);

    const validPatch = await fetch(`${baseUrl}/api/v1/drivers/me`, {
      method: 'PATCH',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({ disponivel: true })
    });
    assert.equal(validPatch.status, 200);
  });
});
