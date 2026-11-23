import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCnpj, isValidCpf, normalizeCnpj } from '../src/utils/brazilianDocuments.js';
import { isCnpjAvailable } from '../src/utils/registrationValidation.js';

test('backend accepts valid formatted or numeric CNPJ and normalizes to digits', () => {
  assert.equal(isValidCnpj('11.222.333/0001-81'), true);
  assert.equal(isValidCnpj('11222333000181'), true);
  assert.equal(normalizeCnpj('11.222.333/0001-81'), '11222333000181');
});

test('backend rejects CNPJ with wrong length, check digits, letters or repeated digits', () => {
  assert.equal(isValidCnpj('1122233300018'), false);
  assert.equal(isValidCnpj('11222333000182'), false);
  assert.equal(isValidCnpj('11222333A00181'), false);
  assert.equal(isValidCnpj('11111111111111'), false);
});

test('backend CPF validation remains independent of CNPJ validation', () => {
  assert.equal(isValidCpf('00000000191'), true);
  assert.equal(isValidCnpj('00000000191'), false);
});

test('CNPJ duplicate check searches both company and driver profiles with normalized digits', async () => {
  let query;
  const emptyConnection = { async execute(sql, values) { query = { sql, values }; return [[]]; } };
  assert.equal(await isCnpjAvailable(emptyConnection, '11222333000181'), true);
  assert.match(query.sql, /FROM empresa[\s\S]*FROM motorista/);
  assert.deepEqual(query.values, ['11222333000181', '11222333000181']);

  const duplicateConnection = { async execute() { return [[{ id: 9 }]]; } };
  assert.equal(await isCnpjAvailable(duplicateConnection, '11222333000181'), false);
});
