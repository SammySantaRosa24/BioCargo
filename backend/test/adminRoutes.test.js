import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createAdminRouter } from '../src/routes/adminRoutes.js';

function makePool() {
  const calls = [];
  const users = new Map([
    [10, { id: 10, tipo_usuario: 'ADMIN', status: 1 }],
    [11, { id: 11, tipo_usuario: 'ADMIN', status: 1 }],
    [12, { id: 12, tipo_usuario: 'EMPRESA', status: 1 }]
  ]);
  let sessionsDeleted = 0;
  const pool = {
    calls,
    users,
    get sessionsDeleted() { return sessionsDeleted; },
    async execute(sql, values = []) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT COUNT(*) AS total FROM usuario')) return [[{ total: 1 }]];
      if (sql.includes('FROM usuario u LEFT JOIN empresa')) return [[{ id: 12, email: 'empresa@test.local', tipoUsuario: 'EMPRESA', ativo: 1, nome: 'Empresa' }]];
      if (sql.startsWith('SELECT COUNT(*) AS total FROM demanda')) return [[{ total: 0 }]];
      if (sql.includes('FROM demanda d INNER JOIN empresa')) return [[]];
      if (sql.includes('FROM usuario') && sql.includes('tipo_usuario, status')) {
        const user = users.get(Number(values[0]));
        return [user ? [{ ...user }] : []];
      }
      if (sql.startsWith('UPDATE usuario SET status = ? WHERE id = ?')) {
        users.get(Number(values[1])).status = values[0] ? 1 : 0;
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('DELETE FROM sessions')) {
        sessionsDeleted += 1;
        return [{ affectedRows: 1 }];
      }
      return [[]];
    },
    async getConnection() {
      return {
        execute: async (sql, values = []) => {
          calls.push({ sql, values });
          if (sql.includes('FROM usuario') && sql.includes("tipo_usuario = 'ADMIN' AND status = TRUE FOR UPDATE")) {
            const actor = users.get(Number(values[0]));
            return [actor?.tipo_usuario === 'ADMIN' && actor.status ? [{ id: actor.id }] : []];
          }
          if (sql.includes('FROM usuario') && sql.includes('WHERE id = ? FOR UPDATE')) {
            const user = users.get(Number(values[0]));
            return [user ? [{ ...user }] : []];
          }
          if (sql.includes("tipo_usuario = 'ADMIN'")) {
            return [[...users.values()].filter((user) => user.tipo_usuario === 'ADMIN' && user.status)];
          }
          if (sql.startsWith('UPDATE usuario SET status = ? WHERE id = ?')) {
            users.get(Number(values[1])).status = values[0] ? 1 : 0;
            return [{ affectedRows: 1 }];
          }
          if (sql.startsWith('DELETE FROM sessions')) {
            sessionsDeleted += 1;
            return [{ affectedRows: 1 }];
          }
          return [[]];
        },
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
  app.use('/api/v1', createAdminRouter(pool));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`, pool);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('ADMIN can query real-backed management endpoints while common accounts are blocked', async () => {
  await withApi(async (baseUrl, pool) => {
    const denied = await fetch(`${baseUrl}/api/v1/admin/users`, { headers: { 'x-test-user': '12' } });
    assert.equal(denied.status, 403);
    const summary = await fetch(`${baseUrl}/api/v1/admin/dashboard/summary`, { headers: { 'x-test-user': '10' } });
    assert.equal(summary.status, 200);
    const listing = await fetch(`${baseUrl}/api/v1/admin/users?q=ana%25&tipo=EMPRESA&page=2&limit=5`, { headers: { 'x-test-user': '10' } });
    assert.equal(listing.status, 200);
    const body = await listing.json();
    assert.equal(body.data[0].nome, 'Empresa');
    assert.deepEqual(body.meta, { page: 2, limit: 5, total: 1 });
    const search = pool.calls.find(({ sql }) => sql.includes('e.razao_social LIKE'));
    assert.ok(search.values.includes('%ana!%%'));
    const demands = await fetch(`${baseUrl}/api/v1/admin/demands?status=ABERTA`, { headers: { 'x-test-user': '10' } });
    assert.equal(demands.status, 200);
  });
});
test('ADMIN can logically deactivate a user and invalidate stored sessions', async () => {
  await withApi(async (baseUrl, pool) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/users/12/status`, {
      method: 'PATCH',
      headers: { 'x-test-user': '10', 'content-type': 'application/json' },
      body: JSON.stringify({ status: false })
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { id: 12, status: false });
    assert.equal(pool.users.get(12).status, 0);
    assert.equal(pool.sessionsDeleted, 1);
    const deletion = pool.calls.find(({ sql }) => sql.startsWith('DELETE FROM sessions'));
    assert.ok(deletion.sql.includes('JSON_EXTRACT'));
    assert.deepEqual(deletion.values, [12]);
  });
});

test('requires ADMIN and disallows self-deactivation while allowing reactivation', async () => {
  await withApi(async (baseUrl) => {
    const forbidden = await fetch(`${baseUrl}/api/v1/admin/users/12/status`, {
      method: 'PATCH',
      headers: { 'x-test-user': '12', 'content-type': 'application/json' },
      body: JSON.stringify({ status: false })
    });
    assert.equal(forbidden.status, 403);

    const reactivate = await fetch(`${baseUrl}/api/v1/admin/users/12/status`, {
      method: 'PATCH',
      headers: { 'x-test-user': '10', 'content-type': 'application/json' },
      body: JSON.stringify({ status: true })
    });
    assert.equal(reactivate.status, 200);

    const self = await fetch(`${baseUrl}/api/v1/admin/users/10/status`, {
      method: 'PATCH',
      headers: { 'x-test-user': '10', 'content-type': 'application/json' },
      body: JSON.stringify({ status: false })
    });
    assert.equal(self.status, 409);
  });
});
