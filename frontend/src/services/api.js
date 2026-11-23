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

async function demandRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: options.body instanceof FormData
      ? { ...options.headers }
      : { 'Content-Type': 'application/json', ...options.headers },
  })
  const result = response.status === 204 ? {} : await response.json()
  if (!response.ok) throw new Error(result.message || 'Não foi possível concluir a operação.')
  return result
}

export async function getCurrentUser() {
  return (await demandRequest('/auth/me')).data.usuario
}

export async function logoutUser() {
  return demandRequest('/auth/logout', { method: 'POST' })
}

export async function getCompanyDemandSummary() {
  return (await demandRequest('/companies/me/demands/summary')).data
}

export async function listCompanyDemands({ group = 'ativas', page = 1, limit = 10 } = {}) {
  return demandRequest(`/companies/me/demands?grupo=${group}&page=${page}&limit=${limit}`)
}

export async function getCompanyDemand(id) {
  return (await demandRequest(`/companies/me/demands/${id}`)).data
}

export async function createCompanyDemand(demand) {
  return (await demandRequest('/companies/me/demands', {
    method: 'POST', body: JSON.stringify(demand),
  })).data
}

export async function updateCompanyDemand(id, demand) {
  return (await demandRequest(`/companies/me/demands/${id}`, {
    method: 'PATCH', body: JSON.stringify(demand),
  })).data
}

export async function updateCompanyDemandStatus(id, status) {
  return (await demandRequest(`/companies/me/demands/${id}/status`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  })).data
}

export async function cancelCompanyDemand(id) {
  return (await demandRequest(`/companies/me/demands/${id}/cancel`, { method: 'POST' })).data
}

export async function listDemandInterests(id) {
  return (await demandRequest(`/companies/me/demands/${id}/interests`)).data
}

export async function respondToDemandInterest(demandId, interestId, status) {
  return (await demandRequest(`/companies/me/demands/${demandId}/interests/${interestId}`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  })).data
}

export async function getDriverServiceSummary() {
  return (await demandRequest('/drivers/me/services/summary')).data
}

export async function listDriverDemands({ page = 1, limit = 20 } = {}) {
  return demandRequest(`/drivers/me/demands?page=${page}&limit=${limit}`)
}

export async function listDriverServices(group = 'ativas') {
  return (await demandRequest(`/drivers/me/services?grupo=${group}`)).data
}

export async function submitDriverInterest(demandId, veiculoId) {
  return (await demandRequest(`/demands/${demandId}/interests`, {
    method: 'POST', body: JSON.stringify(veiculoId ? { veiculoId } : {}),
  })).data
}

export async function completeDriverService(demandId, formData) {
  return (await demandRequest(`/drivers/me/services/${demandId}/complete`, {
    method: 'POST', body: formData,
  })).data
}
