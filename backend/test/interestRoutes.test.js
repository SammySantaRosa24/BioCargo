import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createInterestRouter } from '../src/routes/interestRoutes.js';

function makePool() {
  const calls = [];
  const interest = {
    id: 501,
    empresaId: 21,
    motoristaId: 22,
    veiculoId: null,
    status: 'PENDENTE',
    dataCriacao: '2026-11-16T10:00:00Z',
    dataLimiteResposta: '2026-11-17T10:00:00Z',
    canceladoPor: null,
    observacaoCancelamento: null,
    dataCancelamento: null
  };
  let expireOnRead = false;
  let created = false;
  const pool = {
    calls,
    interest,
    expireOnRead(value) { expireOnRead = value; },
    async execute(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('FROM usuario')) {
        const userId = Number(values[0]);
        const type = userId === 1 ? 'EMPRESA' : 'MOTORISTA';
        return [[{ id: userId, tipo_usuario: type, status: 1 }]];
      }
      if (sql.startsWith("UPDATE interesse SET status = 'EXPIRADO'")) {
        if (expireOnRead && interest.status === 'PENDENTE') interest.status = 'EXPIRADO';
        return [{ affectedRows: 0 }];
      }
      if (sql.startsWith('SELECT id FROM empresa')) return [[{ id: 21 }]];
      if (sql.includes('SELECT m.id FROM motorista')) {
        return [Number(values[0]) === 22 ? [{ id: 22 }] : []];
      }
      if (sql.startsWith('SELECT id FROM veiculo')) {
        return [Number(values[0]) === 31 ? [{ id: 31 }] : []];
      }
      if (sql.startsWith('SELECT id FROM interesse')) {
        return [created && (interest.status === 'PENDENTE' || interest.status === 'ACEITO') ? [{ id: interest.id }] : []];
      }
      if (sql.startsWith('INSERT INTO interesse')) {
        created = true;
        interest.empresaId = values[0];
        interest.motoristaId = values[1];
        interest.veiculoId = values[2];
        interest.status = 'PENDENTE';
        return [{ insertId: interest.id }];
      }
      if (sql.includes('SELECT COUNT(*) AS total FROM interesse')) {
        const ownerId = Number(values[0]);
        const matches = sql.includes('INNER JOIN empresa') ? ownerId === 1 : ownerId === 2;
        return [[{ total: matches ? 1 : 0 }]];
      }
      if (sql.includes('FROM interesse i')) {
        const ownerIndex = sql.includes('i.id = ?') ? 1 : 0;
        if (sql.includes('INNER JOIN empresa e') && Number(values[ownerIndex]) !== 1) return [[]];
        if (sql.includes('INNER JOIN motorista m') && Number(values[ownerIndex]) !== 2) return [[]];
        if (sql.includes('i.id = ?') && Number(values[0]) !== interest.id) return [[]];
        return [[{ ...interest }]];
      }
      if (sql.startsWith('UPDATE interesse i INNER JOIN motorista') && sql.includes('SET i.status = ?')) {
        const [status, id, userId] = values;
        if (id !== interest.id || userId !== 2 || interest.status !== 'PENDENTE') return [{ affectedRows: 0 }];
        interest.status = status;
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('UPDATE interesse i INNER JOIN empresa')) {
        const [id, userId] = values;
        if (id !== interest.id || userId !== 1 || interest.status !== 'PENDENTE') return [{ affectedRows: 0 }];
        interest.status = 'CANCELADO';
        interest.canceladoPor = 'EMPRESA';
        interest.observacaoCancelamento = null;
        interest.dataCancelamento = '2026-11-16T10:30:00Z';
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("SET i.status = 'CANCELADO'")) {
        const [observation, id, userId] = values;
        if (id !== interest.id || userId !== 2 || interest.status !== 'ACEITO') return [{ affectedRows: 0 }];
        interest.status = 'CANCELADO';
        interest.canceladoPor = 'MOTORISTA';
        interest.observacaoCancelamento = observation;
        interest.dataCancelamento = '2026-11-16T10:30:00Z';
        return [{ affectedRows: 1 }];
      }
      return [[]];
    },
    async getConnection() {
      return {
        execute: pool.execute.bind(pool),
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {}
      };
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
  app.use('/api/v1', createInterestRouter(pool));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, pool);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('company creates and lists an interest; driver accepts and cancels it', async () => {
  await withApi(async (baseUrl, pool) => {
    const created = await fetch(`${baseUrl}/api/v1/interests`, {
      method: 'POST',
      headers: { 'x-test-user': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ motoristaId: 22, veiculoId: 31 })
    });
    assert.equal(created.status, 201);
    const createCall = pool.calls.find(({ sql }) => sql.startsWith('INSERT INTO interesse'));
    assert.deepEqual(createCall.values, [21, 22, 31]);
    assert.match(createCall.sql, /DATE_ADD\(UTC_TIMESTAMP\(\), INTERVAL 24 HOUR\)/);

    const duplicate = await fetch(`${baseUrl}/api/v1/interests`, {
      method: 'POST',
      headers: { 'x-test-user': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ motoristaId: 22 })
    });
    assert.equal(duplicate.status, 409);

    const list = await fetch(`${baseUrl}/api/v1/companies/me/interests`, {
      headers: { 'x-test-user': '1' }
    });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).data[0].status, 'PENDENTE');

    const accepted = await fetch(`${baseUrl}/api/v1/interests/501/accept`, {
      method: 'POST', headers: { 'x-test-user': '2' }
    });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).data.status, 'ACEITO');

    const missingReason = await fetch(`${baseUrl}/api/v1/interests/501/cancel`, {
      method: 'POST',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(missingReason.status, 422);

    const cancelled = await fetch(`${baseUrl}/api/v1/interests/501/cancel`, {
      method: 'POST',
      headers: { 'x-test-user': '2', 'content-type': 'application/json' },
      body: JSON.stringify({ observacaoCancelamento: 'Agenda alterada' })
    });
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).data.canceladoPor, 'MOTORISTA');
  });
});

test('expires pending interests and hides an interest from nonparticipants', async () => {
  await withApi(async (baseUrl, pool) => {
    pool.expireOnRead(true);
    const expired = await fetch(`${baseUrl}/api/v1/interests/501`, {
      headers: { 'x-test-user': '1' }
    });
    assert.equal(expired.status, 200);
    assert.equal((await expired.json()).data.status, 'EXPIRADO');

    const hidden = await fetch(`${baseUrl}/api/v1/interests/501`, {
      headers: { 'x-test-user': '4' }
    });
    assert.equal(hidden.status, 404);
  });
});

test('company can cancel pending interests; driver can reject pending interests', async () => {
  await withApi(async (baseUrl) => {
    const create = () => fetch(`${baseUrl}/api/v1/interests`, {
      method: 'POST',
      headers: { 'x-test-user': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ motoristaId: 22 })
    });
    const createdForCancel = await create();
    assert.equal(createdForCancel.status, 201);

    const cancelled = await fetch(`${baseUrl}/api/v1/interests/501/cancel`, {
      method: 'POST', headers: { 'x-test-user': '1' }
    });
    assert.equal(cancelled.status, 200);
    const cancelledBody = await cancelled.json();
    assert.equal(cancelledBody.data.status, 'CANCELADO');
    assert.equal(cancelledBody.data.canceladoPor, 'EMPRESA');

    const createdForReject = await create();
    assert.equal(createdForReject.status, 201);
    const rejected = await fetch(`${baseUrl}/api/v1/interests/501/reject`, {
      method: 'POST', headers: { 'x-test-user': '2' }
    });
    assert.equal(rejected.status, 200);
    assert.equal((await rejected.json()).data.status, 'RECUSADO');
  });
});
