import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import pool from '../src/config/database.js';
import { createSearchRouter } from '../src/routes/searchRoutes.js';

let server;
let baseUrl;
let marker;
let vehicleActiveColumnExists;
const executedQueries = [];

before(async () => {
  const [companies] = await pool.execute(
    `SELECT u.id
     FROM usuario u
     INNER JOIN empresa e ON e.usuario_id = u.id
     WHERE u.status = TRUE
     ORDER BY u.id
     LIMIT 1`
  );
  assert.ok(companies[0], 'MySQL integration tests require an existing active EMPRESA account.');
  marker = `mysql-e2e-${randomUUID()}`;
  const [activeColumn] = await pool.execute(
    `SELECT COUNT(*) AS matches
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'veiculo' AND column_name = 'ativo'`
  );
  vehicleActiveColumnExists = Number(activeColumn[0].matches) === 1;

  const app = express();
  app.use((req, _res, next) => {
    req.session = {
      usuario: { id: companies[0].id },
      destroy(callback) { callback(); }
    };
    next();
  });
  const trackedPool = {
    async execute(sql, values) {
      const call = { sql, values };
      executedQueries.push(call);
      try {
        return await pool.execute(sql, values);
      } catch (error) {
        call.errorCode = error.code;
        call.errorMessage = error.sqlMessage;
        throw error;
      }
    }
  };
  app.use('/api/v1', createSearchRouter(trackedPool));

  server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await pool.end();
});

async function search(filters = {}) {
  const query = new URLSearchParams(filters);
  const suffix = query.size ? `?${query}` : '';
  executedQueries.length = 0;
  const response = await fetch(`${baseUrl}/api/v1/drivers${suffix}`);
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(executedQueries.filter((call) => call.errorCode).map(({ errorCode, errorMessage }) => ({ errorCode, errorMessage }))));
  assert.ok(Array.isArray(body.data));
  assert.equal(typeof body.meta.total, 'number');
  return body;
}

function assertEscapedSearchParameter(field, value) {
  const countQuery = executedQueries.find(({ sql }) => sql.includes('COUNT(DISTINCT m.id)'));
  assert.ok(countQuery, 'The route must execute its count query against MySQL.');
  assert.ok(countQuery.sql.includes(`${field} LIKE ? ESCAPE '!'`));
  const escaped = value.replace(/[!%_]/g, (character) => `!${character}`);
  assert.ok(countQuery.values.includes(`%${escaped}%`));
}

test('MySQL search executes without textual filters', async () => {
  // A high page keeps this syntax check independent of rows that may trigger
  // the separate vehicle.ativo schema mismatch in the local database.
  const body = await search({ page: '1000000', limit: '1' });
  assert.deepEqual(body.data, []);
});

test('MySQL search executes with a brand filter', async (t) => {
  if (!vehicleActiveColumnExists) {
    t.skip('Actual database is missing veiculo.ativo, which the search query requires independently of ESCAPE.');
    return;
  }
  const value = `${marker}-brand`;
  const body = await search({ marca: value });
  assert.deepEqual(body.data, []);
  assertEscapedSearchParameter('vf.marca', value);
});

test('MySQL search executes with a model filter', async (t) => {
  if (!vehicleActiveColumnExists) {
    t.skip('Actual database is missing veiculo.ativo, which the search query requires independently of ESCAPE.');
    return;
  }
  const value = `${marker}-model`;
  const body = await search({ modelo: value });
  assert.deepEqual(body.data, []);
  assertEscapedSearchParameter('vf.modelo', value);
});

test('MySQL search executes with a qualification filter', async () => {
  const value = `${marker}-qualification`;
  const body = await search({ qualificacao: value });
  assert.deepEqual(body.data, []);
  assertEscapedSearchParameter('qf.titulo', value);
});

test('MySQL search treats percent, underscore, and backslash as literal filter characters', async (t) => {
  if (!vehicleActiveColumnExists) {
    t.skip('Actual database is missing veiculo.ativo, which the search query requires independently of ESCAPE.');
    return;
  }
  const marca = `${marker}%_\\!brand`;
  const modelo = `${marker}_%\\model`;
  const qualificacao = `${marker}%_\\qualification`;
  const body = await search({ marca, modelo, qualificacao });
  assert.deepEqual(body.data, []);
  assertEscapedSearchParameter('vf.marca', marca);
  assertEscapedSearchParameter('vf.modelo', modelo);
  assertEscapedSearchParameter('qf.titulo', qualificacao);

  const escaped = (value) => value.replace(/[!%_]/g, (character) => `!${character}`);
  const literal = `${marker}%_\\!`;
  const [rows] = await pool.execute(
    `SELECT ? LIKE ? ESCAPE '!' AS exact_match,
            ? LIKE ? ESCAPE '!' AS wildcard_substitute_match`,
    [literal, `%${escaped(literal)}%`, literal.replace('%', 'x'), `%${escaped(literal)}%`]
  );
  assert.equal(Number(rows[0].exact_match), 1);
  assert.equal(Number(rows[0].wildcard_substitute_match), 0);
});

test('MySQL search executes combined textual and availability filters', async (t) => {
  if (!vehicleActiveColumnExists) {
    t.skip('Actual database is missing veiculo.ativo, which the search query requires independently of ESCAPE.');
    return;
  }
  const marca = `${marker}-combined-brand`;
  const modelo = `${marker}-combined-model`;
  const qualificacao = `${marker}-combined-qualification`;
  const body = await search({ marca, modelo, qualificacao, veiculoDisponivel: 'false' });
  assert.deepEqual(body.data, []);
  assertEscapedSearchParameter('vf.marca', marca);
  assertEscapedSearchParameter('vf.modelo', modelo);
  assertEscapedSearchParameter('qf.titulo', qualificacao);
});

test('MySQL LIKE ESCAPE predicates match literal percent, underscore, and backslash values', async () => {
  const literal = `${marker}%_\\!`;
  const escaped = literal.replace(/[!%_]/g, (character) => `!${character}`);
  const pattern = `%${escaped}%`;
  const [rows] = await pool.execute(
    `SELECT CAST(? AS CHAR(255)) LIKE ? ESCAPE '!' AS brand_match,
            CAST(? AS CHAR(255)) LIKE ? ESCAPE '!' AS model_match,
            CAST(? AS CHAR(255)) LIKE ? ESCAPE '!' AS qualification_match,
            CAST(? AS CHAR(255)) LIKE ? ESCAPE '!' AS wildcard_substitute_match`,
    [literal, pattern, literal, pattern, literal, pattern,
      literal.replace('%', 'x'), pattern]
  );
  assert.equal(Number(rows[0].brand_match), 1);
  assert.equal(Number(rows[0].model_match), 1);
  assert.equal(Number(rows[0].qualification_match), 1);
  assert.equal(Number(rows[0].wildcard_substitute_match), 0);
});

test('MySQL executes the escaped predicates against vehicle and qualification columns', async () => {
  const pattern = `%${marker}%`;
  const [rows] = await pool.execute(
    `SELECT (SELECT COUNT(*) FROM veiculo WHERE marca LIKE ? ESCAPE '!') AS brand_matches,
            (SELECT COUNT(*) FROM veiculo WHERE modelo LIKE ? ESCAPE '!') AS model_matches,
            (SELECT COUNT(*) FROM qualificacao WHERE titulo LIKE ? ESCAPE '!') AS qualification_matches`,
    [pattern, pattern, pattern]
  );
  assert.equal(Number(rows[0].brand_matches), 0);
  assert.equal(Number(rows[0].model_matches), 0);
  assert.equal(Number(rows[0].qualification_matches), 0);
});
