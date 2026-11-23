const CNPJ_FORMATTING = /[.\-/\s]/g;
const CPF_FORMATTING = /[.\-/\s]/g;

export function normalizeCpf(value) {
  return String(value ?? '').replace(CPF_FORMATTING, '');
}

function calculateCpfDigit(base) {
  const remainder = [...base].reduce((sum, digit, index) => {
    return sum + Number(digit) * (base.length + 1 - index);
  }, 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return false;
  const firstDigit = calculateCpfDigit(cpf.slice(0, 9));
  const secondDigit = calculateCpfDigit(`${cpf.slice(0, 9)}${firstDigit}`);
  return cpf.endsWith(`${firstDigit}${secondDigit}`);
}

export function normalizeCnpj(value) {
  return String(value ?? '').replace(CNPJ_FORMATTING, '');
}

function hasRepeatedDigits(value) {
  return /^(\d)\1+$/.test(value);
}

function calculateCnpjDigit(base, weights) {
  const remainder = [...base].reduce((sum, digit, index) => {
    return sum + Number(digit) * weights[index];
  }, 0) % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value) {
  const cnpj = normalizeCnpj(value);
  if (!/^\d{14}$/.test(cnpj) || hasRepeatedDigits(cnpj)) return false;

  const firstDigit = calculateCnpjDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateCnpjDigit(`${cnpj.slice(0, 12)}${firstDigit}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${firstDigit}${secondDigit}`);
}
