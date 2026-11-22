import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createQualificationRouter } from '../src/routes/qualificationRoutes.js';

function makePool() {
  const calls = [];
  return {
    calls,
    async execute(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('FROM usuario')) {
        const userId = Number(values[0]);
        return [[{ id: userId, tipo_usuario: userId === 1 ? 'EMPRESA' : 'MOTORISTA', status: 1 }]];
      }
      if (sql.startsWith('SELECT id FROM motorista')) return [[{ id: Number(values[0]) === 4 ? 8 : 7 }]];
      if (sql.startsWith('INSERT INTO qualificacao')) return [{ insertId: 45 }];
      if (sql.startsWith('UPDATE qualificacao')) return [{ affectedRows: Number(values.at(-1)) === 2 ? 1 : 0 }];
      if (sql.includes('FROM qualificacao')) {
        if (Number(values.at(-1)) !== 2 && sql.includes('m.usuario_id = ?')) return [[]];
        if (sql.includes('q.id = ?') && Number(values[0]) !== 45) return [[]];
        return [[{ id: 45, titulo: 'Transporte biológico', descricao: null }]];
      }
      return [[]];
    }
  };
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
  app.use('/api/v1', createQualificationRouter(pool));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, pool);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('creates, lists, and updates a qualification owned by the driver', async () => {
  await withApi(async (baseUrl, pool) => {
    const created = await fetch(`${baseUrl}/api/v1/drivers/me/qualifications`, {
      method: 'POST',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({ titulo: 'Transporte biológico' })
    });
    assert.equal(created.status, 201);
    const insert = pool.calls.find(({ sql }) => sql.startsWith('INSERT INTO qualificacao'));
    assert.deepEqual(insert.values, [7, 'Transporte biológico', null]);

    const list = await fetch(`${baseUrl}/api/v1/drivers/me/qualifications`, {
      headers: { 'x-test-user': '2' }
    });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).data[0].id, 45);

    const update = await fetch(`${baseUrl}/api/v1/qualifications/45`, {
      method: 'PATCH',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({ descricao: 'Capacitação vigente' })
    });
    assert.equal(update.status, 200);
  });
});

test('rejects invalid qualification input and hides another driver qualification', async () => {
  await withApi(async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/api/v1/drivers/me/qualifications`, {
      method: 'POST',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({ descricao: 'Missing title' })
    });
    assert.equal(invalid.status, 400);

    const notOwned = await fetch(`${baseUrl}/api/v1/qualifications/45`, {
      method: 'PATCH',
      headers: { 'x-test-user': '4', 'content-type': 'application/json' },
      body: JSON.stringify({ titulo: 'Alteração indevida' })
    });
    assert.equal(notOwned.status, 404);
  });
});
