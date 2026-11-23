import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDeliveryRouter } from '../src/routes/deliveryRoutes.js';

function makePool() {
  const state = { status: 'EM_ANDAMENTO', proof: null };
  async function execute(sql, values = []) {
    if (sql.includes('FROM usuario')) {
      const id = Number(values[0]);
      return [[{ id, tipo_usuario: id === 1 || id === 2 ? 'EMPRESA' : id === 4 ? 'ADMIN' : 'MOTORISTA', status: 1 }]];
    }
    if (sql.includes('SELECT id FROM empresa WHERE usuario_id')) return [[{ id: Number(values[0]) * 10 }]];
    if (sql.includes('SELECT d.id, d.status AS demandaStatus')) {
      return [Number(values[1]) === 3 ? [{ id: 8, demandaStatus: state.status, interesseId: 9, motoristaId: 30 }] : []];
    }
    if (sql.includes('SELECT id FROM comprovante_entrega WHERE demanda_id')) return [state.proof ? [{ id: 12 }] : []];
    if (sql.includes('INSERT INTO comprovante_entrega')) {
      const [demandaId, interesseId, motoristaId, nomeArquivo, mimeType, size, date, time, name, notes] = values;
      state.proof = { id: 12, demandaId, interesseId, motoristaId, nomeArquivo, mime_type: mimeType, tamanho_bytes: size, dataEntrega: date, horarioEntrega: time, nomeRecebedor: name, observacoes: notes, empresa_id: 10 };
      return [{ insertId: 12 }];
    }
    if (sql.startsWith("UPDATE demanda SET status = 'FINALIZADA'")) { state.status = 'FINALIZADA'; return [{ affectedRows: 1 }]; }
    if (sql.includes('FROM comprovante_entrega c INNER JOIN interesse i')) {
      if (!state.proof) return [[]];
      return [[{ nome_arquivo: state.proof.nomeArquivo, mime_type: state.proof.mime_type, empresa_id: 10, motoristaUsuarioId: 3 }]];
    }
    return [[]];
  }
  return {
    state, execute,
    async getConnection() { return { execute, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} }; },
  };
}

async function withApi(callback) {
  const storage = await mkdtemp(path.join(os.tmpdir(), 'biocargo-proof-'));
  const pool = makePool();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const id = Number(req.get('x-test-user'));
    req.session = { ...(id ? { usuario: { id } } : {}), destroy(callback) { callback(); } };
    next();
  });
  app.use('/api/v1', createDeliveryRouter(pool, { storageDir: storage }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`, pool, storage); }
  finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(storage, { recursive: true, force: true });
  }
}

function completionForm() {
  const form = new FormData();
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(8), Buffer.from('IEND'), Buffer.alloc(4)]);
  form.set('comprovante', new Blob([png], { type: 'image/png' }), 'entrega.png');
  form.set('dataEntrega', '2026-11-23');
  form.set('horarioEntrega', '14:25');
  form.set('nomeRecebedor', 'Pessoa Recebedora');
  form.set('observacoes', 'Embalagem íntegra.');
  return form;
}

test('driver completes only an accepted in-progress service and authorized participants can view its private proof', async () => {
  await withApi(async (base, pool, storage) => {
    const completed = await fetch(`${base}/api/v1/drivers/me/services/8/complete`, { method: 'POST', headers: { 'x-test-user': '3' }, body: completionForm() });
    assert.equal(completed.status, 201);
    assert.equal((await completed.json()).data.status, 'FINALIZADA');
    assert.equal(pool.state.status, 'FINALIZADA');

    const image = await fetch(`${base}/api/v1/demands/8/proof`, { headers: { 'x-test-user': '1' } });
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/png');
    assert.equal((await image.arrayBuffer()).byteLength > 0, true);

    const denied = await fetch(`${base}/api/v1/demands/8/proof`, { headers: { 'x-test-user': '2' } });
    assert.equal(denied.status, 404);
    const duplicate = await fetch(`${base}/api/v1/drivers/me/services/8/complete`, { method: 'POST', headers: { 'x-test-user': '3' }, body: completionForm() });
    assert.equal(duplicate.status, 409);
    assert.equal((await readdir(storage)).length, 1);
    const adminImage = await fetch(`${base}/api/v1/demands/8/proof`, { headers: { 'x-test-user': '4' } });
    assert.equal(adminImage.status, 200);
  });
});

test('completion rejects unauthenticated users, other drivers, missing fields, and invalid image data', async () => {
  await withApi(async (base) => {
    assert.equal((await fetch(`${base}/api/v1/drivers/me/services/8/complete`, { method: 'POST', body: completionForm() })).status, 401);
    assert.equal((await fetch(`${base}/api/v1/drivers/me/services/8/complete`, { method: 'POST', headers: { 'x-test-user': '5' }, body: completionForm() })).status, 404);
    const empty = new FormData();
    empty.set('dataEntrega', '2026-11-23'); empty.set('horarioEntrega', '14:25'); empty.set('nomeRecebedor', 'Recebedor');
    empty.set('comprovante', new Blob(['isto não é PNG'], { type: 'image/png' }), 'fake.png');
    assert.equal((await fetch(`${base}/api/v1/drivers/me/services/8/complete`, { method: 'POST', headers: { 'x-test-user': '3' }, body: empty })).status, 422);
    const badDate = completionForm(); badDate.set('dataEntrega', '2026-02-31');
    assert.equal((await fetch(`${base}/api/v1/drivers/me/services/8/complete`, { method: 'POST', headers: { 'x-test-user': '3' }, body: badDate })).status, 422);
  });
});
