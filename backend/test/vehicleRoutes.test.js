import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createVehicleRouter } from '../src/routes/vehicleRoutes.js';

function makePool() {
  const calls = [];
  const vehicle = {
    id: 55,
    placa: 'ABC1D23',
    renavam: '12345678901',
    marca: 'Volvo',
    modelo: 'VM',
    ano: 2024,
    disponivel: 0,
    motorista_id: 7
  };
  return {
    calls,
    async execute(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('FROM usuario')) {
        const userId = Number(values[0]);
        return [[{ id: userId, tipo_usuario: userId === 1 ? 'EMPRESA' : 'MOTORISTA', status: 1 }]];
      }
      if (sql.startsWith('SELECT id FROM motorista')) {
        return [[{ id: Number(values[0]) === 4 ? 8 : 7 }]];
      }
      if (sql.startsWith('INSERT INTO veiculo')) return [{ insertId: vehicle.id }];
      if (sql.startsWith('UPDATE veiculo')) return [{ affectedRows: 1 }];
      if (sql.includes('FROM veiculo')) {
        if (sql.includes('AND motorista_id = ?')) {
          if (Number(values.at(-1)) !== vehicle.motorista_id) return [[]];
          return [[{ ...vehicle }]];
        }
        const userId = Number(values.at(-1));
        if (userId !== 2) return [[]];
        if (sql.includes('v.id = ?') && Number(values[0]) !== vehicle.id) return [[]];
        if (sql.includes('SELECT v.id FROM')) return [[{ id: vehicle.id }]];
        if (sql.includes('SELECT v.id, v.disponivel')) {
          return [[{ id: vehicle.id, disponivel: vehicle.disponivel }]];
        }
        return [[{
          id: vehicle.id,
          placa: vehicle.placa,
          renavam: vehicle.renavam,
          marca: vehicle.marca,
          modelo: vehicle.modelo,
          ano: vehicle.ano,
          disponivel: vehicle.disponivel
        }]];
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
  app.use('/api/v1', createVehicleRouter(pool));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, pool);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('creates, lists, updates, and changes availability of an owned vehicle', async () => {
  await withApi(async (baseUrl, pool) => {
    const invalid = await fetch(`${baseUrl}/api/v1/drivers/me/vehicles`, {
      method: 'POST',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({ placa: 'ABC', motoristaId: 8 })
    });
    assert.equal(invalid.status, 400);

    const created = await fetch(`${baseUrl}/api/v1/drivers/me/vehicles`, {
      method: 'POST',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({
        placa: 'ABC1D23', renavam: '12345678901', marca: 'Volvo', modelo: 'VM', ano: 2024
      })
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).data.id, 55);
    const insert = pool.calls.find(({ sql }) => sql.startsWith('INSERT INTO veiculo'));
    assert.deepEqual(insert.values, [7, 'ABC1D23', '12345678901', 'Volvo', 'VM', null, 2024, false]);

    const listed = await fetch(`${baseUrl}/api/v1/drivers/me/vehicles`, {
      headers: { 'x-test-user': '2' }
    });
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).data.length, 1);

    const fetched = await fetch(`${baseUrl}/api/v1/vehicles/55`, {
      headers: { 'x-test-user': '2' }
    });
    assert.equal(fetched.status, 200);

    const updated = await fetch(`${baseUrl}/api/v1/vehicles/55`, {
      method: 'PATCH',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({ marca: 'Mercedes' })
    });
    assert.equal(updated.status, 200);

    const availability = await fetch(`${baseUrl}/api/v1/vehicles/55/availability`, {
      method: 'PATCH',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({ disponivel: true })
    });
    assert.equal(availability.status, 200);
  });
});

test('hides a vehicle owned by another driver', async () => {
  await withApi(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/vehicles/55`, {
      headers: { 'x-test-user': '4' }
    });
    assert.equal(response.status, 404);
  });
});
