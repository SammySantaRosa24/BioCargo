import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCnpj, isValidCnpj, isValidCpf, normalizeCnpj } from '../src/utils/brazilianDocuments.js'

test('formats CNPJ progressively and accepts an unformatted paste', () => {
  assert.equal(formatCnpj('12'), '12')
  assert.equal(formatCnpj('123'), '12.3')
  assert.equal(formatCnpj('11222333000181'), '11.222.333/0001-81')
  assert.equal(formatCnpj('11.222.333/0001-81'), '11.222.333/0001-81')
})

test('mask strips non-digits, limits input and supports deletion/editing', () => {
  assert.equal(formatCnpj('11a.22/2-333000181'), '11.222.333/0001-81')
  assert.equal(formatCnpj('1122233300018100'), '11.222.333/0001-81')
  assert.equal(formatCnpj('11.222.333/0001-8'), '11.222.333/0001-8')
  assert.equal(formatCnpj('11.222.333/0001-'), '11.222.333/0001')
})

test('validates numeric CNPJ length and both check digits', () => {
  assert.equal(isValidCnpj('11.222.333/0001-81'), true)
  assert.equal(isValidCnpj('00000000000191'), true)
  assert.equal(isValidCnpj('1122233300018'), false)
  assert.equal(isValidCnpj('11222333000182'), false)
  assert.equal(isValidCnpj('11222333A00181'), false)
  assert.equal(isValidCnpj('11111111111111'), false)
  assert.equal(normalizeCnpj('11.222.333/0001-81'), '11222333000181')
})

test('CNPJ validation remains separate from driver CPF validation', () => {
  assert.equal(isValidCpf('000.000.001-91'), true)
  assert.equal(isValidCnpj('000.000.001-91'), false)
})
