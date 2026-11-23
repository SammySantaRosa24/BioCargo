import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { seedTestUsers } from '../src/seeds/testUsers.js';
import { isValidCnpj, isValidCpf } from '../src/utils/brazilianDocuments.js';
import { verifyPassword } from '../src/utils/passwords.js';

function makePool() {
  const users = [];
  const companies = [];
  const drivers = [];
  const pool = {
    users, companies, drivers,
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
        async execute(sql, values) {
          if (sql.startsWith('SELECT id FROM usuario')) {
            const user = users.find((item) => item.email === values[0]);
            return [user ? [{ id: user.id }] : []];
          }
          if (sql.includes('SELECT id FROM empresa WHERE cnpj')) {
            const found = [...companies, ...drivers].find((item) => item.cnpj === values[0] || item.cnpj === values[1]);
            return [found ? [{ id: found.id }] : []];
          }
          if (sql.startsWith('SELECT id FROM motorista WHERE cpf')) {
            const found = drivers.find((item) => item.cpf === values[0]);
            return [found ? [{ id: found.id }] : []];
          }
          if (sql.startsWith('INSERT INTO usuario')) {
            const [email, passwordHash, type] = values;
            const user = { id: users.length + 1, email, passwordHash, type };
            users.push(user);
            return [{ insertId: user.id }];
          }
          if (sql.startsWith('INSERT INTO empresa')) {
            companies.push({ id: companies.length + 1, userId: values[0], razaoSocial: values[1], cnpj: values[3] });
            return [{ insertId: companies.length }];
          }
          if (sql.startsWith('INSERT INTO motorista')) {
            drivers.push({ id: drivers.length + 1, userId: values[0], nome: values[1], cpf: values[2], cnpj: values[3] });
            return [{ insertId: drivers.length }];
          }
          return [[]];
        },
      };
    },
  };
  return pool;
}

test('creates hashed test accounts once and skips existing accounts on rerun', async () => {
  const pool = makePool();
  const firstRun = await seedTestUsers(pool);
  const secondRun = await seedTestUsers(pool);

  assert.deepEqual(firstRun.map((item) => item.result), ['created', 'created']);
  assert.deepEqual(secondRun.map((item) => item.result), ['skipped-existing-email', 'skipped-existing-email']);
  assert.equal(pool.users.length, 2);
  assert.equal(pool.companies.length, 1);
  assert.equal(pool.drivers.length, 1);
  assert.equal(pool.users.every(({ passwordHash }) => passwordHash.startsWith('scrypt:')), true);
  assert.equal(await verifyPassword('BioCargo@123', pool.users[0].passwordHash), true);
  assert.equal(pool.users[0].passwordHash === 'BioCargo@123', false);
  assert.equal(isValidCnpj(pool.companies[0].cnpj), true);
  assert.equal(isValidCnpj(pool.drivers[0].cnpj), true);
  assert.equal(isValidCpf(pool.drivers[0].cpf), true);
  assert.notEqual(pool.companies[0].cnpj, pool.drivers[0].cnpj);
});

test('test account seed refuses production before opening a database connection', () => {
  const script = fileURLToPath(new URL('../scripts/seedTestUsers.js', import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: resolve(fileURLToPath(new URL('..', import.meta.url))),
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Seed recusado/);
});
