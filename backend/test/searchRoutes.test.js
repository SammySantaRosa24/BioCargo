import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createSearchRouter } from '../src/routes/searchRoutes.js';

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
      if (sql.includes('COUNT(DISTINCT m.id)')) return [[{ total: 1 }]];
      if (sql.includes('SELECT m.id, m.nome, m.disponivel')) return [[{ id: 22, nome: 'Motorista Teste', motoristaDisponivel: 1, fotoPerfil: null }]];
      if (sql.includes('FROM veiculo WHERE motorista_id IN')) {
        return [[{ id: 33, motoristaId: 22, marca: 'Volvo', modelo: 'VM', ano: 2024, disponivel: 1 }]];
      }
      if (sql.includes('FROM qualificacao WHERE motorista_id IN')) {
        return [[{ motoristaId: 22, titulo: 'Transporte biológico' }]];
      }
      return [[]];
    }
  };
}

async function withApi(run) {
  const pool = makePool();
  const app = express();
  app.use((req, _res, next) => {
    const userId = Number(req.get('x-test-user'));
    req.session = {
      ...(userId ? { usuario: { id: userId } } : {}),
      destroy(callback) { callback(); }
    };
    next();
  });
  app.use('/api/v1', createSearchRouter(pool));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, pool);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('searches only with company access and returns minimal vehicle and qualification data', async () => {
  await withApi(async (baseUrl, pool) => {
    const response = await fetch(
      `${baseUrl}/api/v1/drivers?marca=Volvo&veiculoDisponivel=true&qualificacao=biol&page=2&limit=5`,
      { headers: { 'x-test-user': '1' } }
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.meta, { page: 2, limit: 5, total: 1 });
    assert.equal(body.data[0].motoristaDisponivel, true);
    assert.deepEqual(body.data[0].qualificacoes, ['Transporte biológico']);
    assert.equal(body.data[0].veiculos[0].disponivel, true);
    assert.equal(body.data[0].nome, 'Motorista Teste');
    assert.equal(Object.hasOwn(body.data[0].veiculos[0], 'placa'), false);
    const count = pool.calls.find(({ sql }) => sql.includes('COUNT(DISTINCT m.id)'));
    assert.ok(count.sql.includes('EXISTS'));
    assert.ok(count.values.includes('%Volvo%'));
    assert.ok(count.values.includes(true));
    assert.ok(count.values.includes('%biol%'));
  });
});

test('rejects vehicle search for drivers and unknown filters', async () => {
  await withApi(async (baseUrl) => {
    const wrongRole = await fetch(`${baseUrl}/api/v1/drivers`, {
      headers: { 'x-test-user': '2' }
    });
    assert.equal(wrongRole.status, 403);

    const invalidFilter = await fetch(`${baseUrl}/api/v1/drivers?email=secret@example.test`, {
      headers: { 'x-test-user': '1' }
    });
    assert.equal(invalidFilter.status, 400);
  });
});
