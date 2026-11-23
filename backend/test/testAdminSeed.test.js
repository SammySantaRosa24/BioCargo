import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { seedTestAdmin } from '../src/seeds/testAdmin.js';
import { verifyPassword } from '../src/utils/passwords.js';

function makePool(existing = []) {
  const users = [...existing];
  return {
    users,
    async getConnection() {
      return {
        async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
        async execute(sql, values = []) {
          if (sql.startsWith('SELECT id, tipo_usuario')) {
            const user = users.find((item) => item.email === values[0]);
            return [user ? [{ id: user.id, tipo_usuario: user.type }] : []];
          }
          if (sql.startsWith('INSERT INTO usuario')) {
            const user = { id: users.length + 1, email: values[0], passwordHash: values[1], type: 'ADMIN' };
            users.push(user);
            return [{ insertId: user.id }];
          }
          return [[]];
        },
      };
    },
  };
}

test('creates an ADMIN with a hashed password and safely skips it on rerun', async () => {
  const pool = makePool();
  const options = { email: ' Admin.Teste@BioCargo.local ', password: 'BioCargo@123', environment: 'development' };
  assert.equal((await seedTestAdmin(pool, options)).result, 'created');
  assert.equal((await seedTestAdmin(pool, options)).result, 'skipped-existing-email');
  assert.equal(pool.users.length, 1);
  assert.equal(pool.users[0].type, 'ADMIN');
  assert.match(pool.users[0].passwordHash, /^scrypt:/);
  assert.equal(await verifyPassword(options.password, pool.users[0].passwordHash), true);
});

test('does not promote an existing user and rejects production or weak configuration', async () => {
  const pool = makePool([{ id: 7, email: 'admin.teste@biocargo.local', type: 'EMPRESA' }]);
  assert.equal((await seedTestAdmin(pool, { email: 'admin.teste@biocargo.local', password: 'BioCargo@123', environment: 'test' })).result, 'skipped-existing-email');
  await assert.rejects(seedTestAdmin(pool, { email: 'other@test.local', password: 'BioCargo@123', environment: 'production' }), /development ou test/);
  await assert.rejects(seedTestAdmin(pool, { email: 'other@test.local', password: 'short', environment: 'test' }), /12 caracteres/);
  assert.equal(pool.users[0].type, 'EMPRESA');
});

test('test ADMIN seed refuses production before loading database configuration', () => {
  const script = fileURLToPath(new URL('../scripts/seedTestAdmin.js', import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: resolve(fileURLToPath(new URL('..', import.meta.url))),
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Seed recusado/);
});
