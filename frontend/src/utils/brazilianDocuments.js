const SEPARATOR_CHARACTERS = /[\p{P}\p{Z}\s]/gu

export function normalizeCpf(value) {
  return String(value ?? '').replace(SEPARATOR_CHARACTERS, '')
}

export function normalizeCnpj(value) {
  return String(value ?? '').replace(SEPARATOR_CHARACTERS, '').toUpperCase()
}

function hasRepeatedCharacters(value) {
  return /^([A-Z0-9])\1+$/.test(value)
}

function calculateCpfDigit(base) {
  const sum = [...base].reduce((total, digit, index) => {
    return total + Number(digit) * (base.length + 1 - index)
  }, 0)

  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCpf(value) {
  const cpf = normalizeCpf(value)

  if (!/^\d{11}$/.test(cpf) || hasRepeatedCharacters(cpf)) {
    return false
  }

  const firstDigit = calculateCpfDigit(cpf.slice(0, 9))
  const secondDigit = calculateCpfDigit(`${cpf.slice(0, 9)}${firstDigit}`)

  return cpf.endsWith(`${firstDigit}${secondDigit}`)
}

function calculateCnpjDigit(base) {
  const weights = base.length === 12
    ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const sum = [...base].reduce((total, character, index) => {
    return total + (character.charCodeAt(0) - 48) * weights[index]
  }, 0)

  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCnpj(value) {
  const cnpj = normalizeCnpj(value)

  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || hasRepeatedCharacters(cnpj)) {
    return false
  }

  const firstDigit = calculateCnpjDigit(cnpj.slice(0, 12))
  const secondDigit = calculateCnpjDigit(`${cnpj.slice(0, 12)}${firstDigit}`)

  return cnpj.endsWith(`${firstDigit}${secondDigit}`)
}
