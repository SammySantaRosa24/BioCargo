import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createDemandRouter } from '../src/routes/demandRoutes.js';

const input = (overrides = {}) => ({
  titulo: 'Amostras unidade central',
  descricao: 'Transporte de amostras biológicas refrigeradas.',
  porte: 'PEQUENO',
  tipoTransporte: 'Refrigerado',
  origemCidade: 'São Paulo',
  origemEndereco: 'Rua A, 10',
  origemComplemento: '',
  destinoCidade: 'Campinas',
  destinoEndereco: 'Rua B, 20',
  destinoComplemento: '',
  dataTransporte: '2027-02-10',
  periodoRetirada: '8h às 10h',
  valorOferecido: 450.5,
  requisitos: '',
  ...overrides
});

function makePool() {
  const demands = [];
  const interests = [];
  let nextDemandId = 1;
  let nextInterestId = 1;
  const calls = [];

  function ownedDemand(id, companyId) {
    return demands.find((demand) => demand.id === Number(id) && demand.empresaId === Number(companyId));
  }

  async function execute(sql, values = []) {
    calls.push({ sql, values });
    if (sql.includes('FROM usuario')) {
      const id = Number(values[0]);
      const type = id <= 2 ? 'EMPRESA' : 'MOTORISTA';
      return [[{ id, tipo_usuario: type, status: 1 }]];
    }
    if (sql.startsWith('SELECT id FROM empresa')) {
      const userId = Number(values[0]);
      return userId <= 2 ? [[{ id: userId * 10 }]] : [[]];
    }
    if (sql.startsWith('SELECT id FROM motorista WHERE usuario_id')) return [[{ id: 30 }]];
    if (sql.startsWith('SELECT id, empresa_id FROM demanda')) {
      const demand = demands.find((item) => item.id === Number(values[0]) && ['ABERTA', 'EM_NEGOCIACAO'].includes(item.status));
      return [demand ? [{ id: demand.id, empresa_id: demand.empresaId }] : []];
    }
    if (sql.startsWith('INSERT INTO interesse')) {
      const [empresaId, motoristaId, veiculoId, demandaId] = values;
      const interest = { id: nextInterestId++, empresaId, motoristaId, veiculoId, demandaId, status: 'PENDENTE', dataCriacao: '2026-11-23T12:00:00Z', motoristaNome: 'Motorista de teste' };
      interests.push(interest);
      const demand = demands.find((item) => item.id === Number(demandaId));
      if (demand) demand.totalInteresses++;
      return [{ insertId: interest.id }];
    }
    if (sql.includes('COALESCE(SUM(status =')) {
      const own = demands.filter((demand) => demand.empresaId === Number(values[0]));
      return [[{
        total: own.length,
        abertas: own.filter((item) => item.status === 'ABERTA').length,
        emNegociacao: own.filter((item) => item.status === 'EM_NEGOCIACAO').length,
        emAndamento: own.filter((item) => item.status === 'EM_ANDAMENTO').length,
        finalizadas: own.filter((item) => item.status === 'FINALIZADA').length,
        encerradas: own.filter((item) => ['CANCELADA', 'EXPIRADA'].includes(item.status)).length,
      }]];
    }
    if (sql.startsWith('SELECT COUNT(*) AS total FROM demanda WHERE status IN')) {
      return [[{ total: demands.filter((item) => ['ABERTA', 'EM_NEGOCIACAO'].includes(item.status)).length }]];
    }
    if (sql.includes('COUNT(*) AS total') && sql.includes('FROM demanda')) {
      const [companyId, ...statuses] = values;
      const filtered = demands.filter((demand) => demand.empresaId === Number(companyId) && statuses.includes(demand.status));
      return [[{ total: filtered.length }]];
    }
    if (sql.startsWith('INSERT INTO demanda')) {
      const match = sql.match(/INSERT INTO demanda \((.*?)\) VALUES/s);
      const columns = match[1].split(',').map((column) => column.trim());
      const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
      const mapping = {
        empresa_id: 'empresaId', titulo: 'titulo', descricao: 'descricao', porte: 'porte',
        tipo_transporte: 'tipoTransporte', origem_cidade: 'origemCidade', origem_endereco: 'origemEndereco',
        origem_complemento: 'origemComplemento', destino_cidade: 'destinoCidade', destino_endereco: 'destinoEndereco',
        destino_complemento: 'destinoComplemento', data_transporte: 'dataTransporte', periodo_retirada: 'periodoRetirada',
        valor_oferecido: 'valorOferecido', requisitos: 'requisitos',
      };
      const demand = { id: nextDemandId++, status: 'ABERTA', dataCriacao: '2026-11-23T12:00:00Z', atualizadoEm: '2026-11-23T12:00:00Z', totalInteresses: 0 };
      for (const [column, key] of Object.entries(mapping)) if (Object.hasOwn(row, column)) demand[key] = row[column];
      demands.push(demand);
      return [{ insertId: demand.id }];
    }
    if (sql.includes('FROM demanda d LEFT JOIN comprovante_entrega c') && sql.includes('WHERE d.id = ? AND d.empresa_id = ?')) {
      const demand = ownedDemand(values[0], values[1]);
      return [demand ? [{ ...demand }] : []];
    }
    if (sql.includes('FROM demanda d INNER JOIN empresa e') && sql.includes('WHERE d.id = ? AND d.status IN')) {
      const demand = demands.find((item) => item.id === Number(values[1]) && ['ABERTA', 'EM_NEGOCIACAO'].includes(item.status));
      return [demand ? [{ ...demand, meuInteresse: null }] : []];
    }
    if (sql.includes('FROM demanda d INNER JOIN empresa e') && sql.includes('ORDER BY d.data_transporte ASC')) {
      const [driverId, limit, offset] = values;
      const open = demands.filter((item) => ['ABERTA', 'EM_NEGOCIACAO'].includes(item.status));
      return [open.slice(offset, offset + limit).map((item) => ({ ...item, meuInteresse: interests.find((interest) => interest.demandaId === item.id && interest.motoristaId === driverId)?.status ?? null }))];
    }
    if (sql.includes('FROM demanda d LEFT JOIN comprovante_entrega c') && sql.includes('ORDER BY d.data_transporte')) {
      const [companyId, ...rest] = values;
      const statuses = rest.slice(0, -2);
      const limit = rest.at(-2);
      const offset = rest.at(-1);
      const rows = demands.filter((demand) => demand.empresaId === Number(companyId) && statuses.includes(demand.status));
      return [rows.slice(offset, offset + limit).map((item) => ({ ...item }))];
    }
    if (sql.startsWith('UPDATE demanda SET status = ?')) {
      const [status, id, companyId] = values;
      const demand = ownedDemand(id, companyId);
      if (!demand) return [{ affectedRows: 0 }];
      demand.status = status;
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('UPDATE demanda SET') && sql.includes("status = 'ABERTA'")) {
      const whereIndex = values.length - 2;
      const demand = ownedDemand(values[whereIndex], values[whereIndex + 1]);
      if (!demand || demand.status !== 'ABERTA') return [{ affectedRows: 0 }];
      const assignments = sql.match(/SET (.*?) WHERE/)[1].split(', ');
      assignments.forEach((assignment, index) => {
        const column = assignment.split(' = ')[0];
        const key = ({ titulo: 'titulo', descricao: 'descricao', porte: 'porte', tipo_transporte: 'tipoTransporte', origem_cidade: 'origemCidade', origem_endereco: 'origemEndereco', origem_complemento: 'origemComplemento', destino_cidade: 'destinoCidade', destino_endereco: 'destinoEndereco', destino_complemento: 'destinoComplemento', data_transporte: 'dataTransporte', periodo_retirada: 'periodoRetirada', valor_oferecido: 'valorOferecido', requisitos: 'requisitos' })[column];
        demand[key] = values[index];
      });
      return [{ affectedRows: 1 }];
    }
    if (sql.includes("SET status = 'CANCELADA'")) {
      const [id, companyId] = values;
      const demand = ownedDemand(id, companyId);
      if (!demand || !['ABERTA', 'EM_NEGOCIACAO'].includes(demand.status) || interests.some((item) => item.demandaId === demand.id && item.status === 'ACEITO')) return [{ affectedRows: 0 }];
      demand.status = 'CANCELADA';
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('SELECT id FROM interesse WHERE demanda_id = ? AND motorista_id')) {
      const match = interests.find((item) => item.demandaId === Number(values[0]) && item.motoristaId === Number(values[1]) && ['PENDENTE', 'ACEITO'].includes(item.status));
      return [match ? [{ id: match.id }] : []];
    }
    if (sql.includes('SELECT id FROM interesse WHERE demanda_id = ? AND status')) {
      const match = interests.find((item) => item.demandaId === Number(values[0]) && item.status === 'ACEITO');
      return [match ? [{ id: match.id }] : []];
    }
    if (sql.includes('SELECT i.id, i.status') && sql.includes('FROM interesse i')) {
      return [interests.filter((item) => item.demandaId === Number(values[0])).map((item) => ({ ...item }))];
    }
    if (sql.startsWith('UPDATE interesse i INNER JOIN demanda')) {
      const [status, interestId, demandId, companyId] = values;
      const item = interests.find((interest) => interest.id === Number(interestId) && interest.demandaId === Number(demandId));
      if (!item || !ownedDemand(demandId, companyId) || item.status !== 'PENDENTE') return [{ affectedRows: 0 }];
      item.status = status;
      return [{ affectedRows: 1 }];
    }
    return [[]];
  }

  const pool = {
    demands, interests, calls, execute,
    async getConnection() {
      return {
        execute,
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {},
      };
    },
    createInterest(demandId, motoristaId) {
      const demand = demands.find((item) => item.id === demandId);
      const interest = { id: nextInterestId++, demandaId: demandId, motoristaId, empresaId: demand.empresaId * 10, status: 'PENDENTE', dataCriacao: '2026-11-23T12:00:00Z' };
      interests.push(interest);
      demand.totalInteresses++;
      return interest;
    },
  };
  return pool;
}

async function withApi(run) {
  const pool = makePool();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = Number(req.get('x-test-user'));
    req.session = { ...(userId ? { usuario: { id: userId } } : {}), destroy(callback) { callback(); } };
    next();
  });
  app.use('/api/v1', createDemandRouter(pool));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`, pool);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('company publishes, lists, edits and starts only its own demand; driver completion owns finalization', async () => {
  await withApi(async (base, pool) => {
    const headers = { 'x-test-user': '1', 'content-type': 'application/json' };
    const createdResponse = await fetch(`${base}/api/v1/companies/me/demands`, { method: 'POST', headers, body: JSON.stringify(input()) });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).data;
    assert.equal(created.status, 'ABERTA');

    const listed = await fetch(`${base}/api/v1/companies/me/demands?grupo=ativas`, { headers });
    assert.equal((await listed.json()).meta.total, 1);
    const summary = await fetch(`${base}/api/v1/companies/me/demands/summary`, { headers });
    assert.equal((await summary.json()).data.abertas, 1);

    const edit = await fetch(`${base}/api/v1/companies/me/demands/${created.id}`, { method: 'PATCH', headers, body: JSON.stringify({ titulo: 'Título revisado' }) });
    assert.equal((await edit.json()).data.titulo, 'Título revisado');
    const interest = pool.createInterest(created.id, 30);
    interest.status = 'ACEITO';
    for (const status of ['EM_NEGOCIACAO', 'EM_ANDAMENTO']) {
      const change = await fetch(`${base}/api/v1/companies/me/demands/${created.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
      assert.equal(change.status, 200);
    }
    const finalize = await fetch(`${base}/api/v1/companies/me/demands/${created.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status: 'FINALIZADA' }) });
    assert.equal(finalize.status, 400);
    const history = await fetch(`${base}/api/v1/companies/me/demands?grupo=historico`, { headers });
    assert.equal((await history.json()).data.length, 0);
    assert.equal(pool.calls.some(({ sql }) => sql.includes('WHERE d.id = ? AND d.empresa_id = ?')), true);
  });
});

test('demands are private to their owning company; cancel and history separation work', async () => {
  await withApi(async (base) => {
    const ownerHeaders = { 'x-test-user': '1', 'content-type': 'application/json' };
    const created = await fetch(`${base}/api/v1/companies/me/demands`, { method: 'POST', headers: ownerHeaders, body: JSON.stringify(input()) });
    const id = (await created.json()).data.id;
    const otherHeaders = { 'x-test-user': '2', 'content-type': 'application/json' };
    assert.equal((await fetch(`${base}/api/v1/companies/me/demands/${id}`, { headers: otherHeaders })).status, 404);
    assert.equal((await fetch(`${base}/api/v1/companies/me/demands/${id}`, { method: 'PATCH', headers: otherHeaders, body: JSON.stringify({ titulo: 'Tentar alterar' }) })).status, 404);
    assert.equal((await fetch(`${base}/api/v1/companies/me/demands/${id}/cancel`, { method: 'POST', headers: otherHeaders })).status, 409);
    const cancelled = await fetch(`${base}/api/v1/companies/me/demands/${id}/cancel`, { method: 'POST', headers: ownerHeaders });
    assert.equal((await cancelled.json()).data.status, 'CANCELADA');
    const active = await fetch(`${base}/api/v1/companies/me/demands?grupo=ativas`, { headers: ownerHeaders });
    assert.equal((await active.json()).meta.total, 0);
    const history = await fetch(`${base}/api/v1/companies/me/demands?grupo=historico`, { headers: ownerHeaders });
    assert.equal((await history.json()).data[0].status, 'CANCELADA');
  });
});

test('demand data validation and company authentication are enforced', async () => {
  await withApi(async (base) => {
    const noSession = await fetch(`${base}/api/v1/companies/me/demands`);
    assert.equal(noSession.status, 401);
    const driver = await fetch(`${base}/api/v1/companies/me/demands`, { headers: { 'x-test-user': '3' } });
    assert.equal(driver.status, 403);
    const invalid = await fetch(`${base}/api/v1/companies/me/demands`, {
      method: 'POST', headers: { 'x-test-user': '1', 'content-type': 'application/json' },
      body: JSON.stringify(input({ porte: 'EXTRA GRANDE', valorOferecido: 0 })),
    });
    assert.equal(invalid.status, 422);
    const oversizedText = await fetch(`${base}/api/v1/companies/me/demands`, {
      method: 'POST', headers: { 'x-test-user': '1', 'content-type': 'application/json' },
      body: JSON.stringify(input({ descricao: '😀'.repeat(17_000) })),
    });
    assert.equal(oversizedText.status, 422);
  });
});

test('drivers can register a demand interest and the company can review it', async () => {
  await withApi(async (base, pool) => {
    const companyHeaders = { 'x-test-user': '1', 'content-type': 'application/json' };
    const created = await fetch(`${base}/api/v1/companies/me/demands`, { method: 'POST', headers: companyHeaders, body: JSON.stringify(input()) });
    const demandId = (await created.json()).data.id;
    const discover = await fetch(`${base}/api/v1/drivers/me/demands`, { headers: { 'x-test-user': '3' } });
    assert.equal((await discover.json()).data[0].id, demandId);
    const discoverDetail = await fetch(`${base}/api/v1/drivers/me/demands/${demandId}`, { headers: { 'x-test-user': '3' } });
    assert.equal((await discoverDetail.json()).data.id, demandId);
    const application = await fetch(`${base}/api/v1/demands/${demandId}/interests`, {
      method: 'POST', headers: { 'x-test-user': '3', 'content-type': 'application/json' }, body: JSON.stringify({}),
    });
    assert.equal(application.status, 201);
    const applicationBody = (await application.json()).data;
    assert.equal(applicationBody.demandaId, demandId);
    assert.equal(applicationBody.status, 'PENDENTE');

    const companyList = await fetch(`${base}/api/v1/companies/me/demands/${demandId}/interests`, { headers: companyHeaders });
    const listed = (await companyList.json()).data;
    assert.equal(listed.length, 1);
    assert.equal(listed[0].motoristaNome, 'Motorista de teste');

    const accepted = await fetch(`${base}/api/v1/companies/me/demands/${demandId}/interests/${applicationBody.id}`, {
      method: 'PATCH', headers: companyHeaders, body: JSON.stringify({ status: 'ACEITO' }),
    });
    assert.equal((await accepted.json()).data.status, 'ACEITO');
    const cancelAccepted = await fetch(`${base}/api/v1/companies/me/demands/${demandId}/cancel`, {
      method: 'POST', headers: companyHeaders,
    });
    assert.equal(cancelAccepted.status, 409);
    const duplicate = await fetch(`${base}/api/v1/demands/${demandId}/interests`, {
      method: 'POST', headers: { 'x-test-user': '3', 'content-type': 'application/json' }, body: JSON.stringify({}),
    });
    assert.equal(duplicate.status, 409);
  });
});
