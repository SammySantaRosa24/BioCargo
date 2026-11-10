const API_BASE_URL = '/api/v1'

// Cadastro de empresa
export async function registerCompany(companyData) {
  const response = await fetch(`${API_BASE_URL}/auth/register/company`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(companyData),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Erro ao realizar cadastro.')
  }

  return result.data
}

// Cadastro de motorista PJ
export async function registerDriver(driverData) {
  const response = await fetch(`${API_BASE_URL}/auth/register/driver`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(driverData),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Erro ao realizar cadastro.')
  }

  return result.data
}

// Login
export async function loginUser(credentials) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(credentials),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.message || 'Erro ao realizar login.')
  }

  return result.data
}