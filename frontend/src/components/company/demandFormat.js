const labels = {
  ABERTA: 'Aberta',
  EM_NEGOCIACAO: 'Em negociação',
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
  EXPIRADA: 'Expirada',
  PENDENTE: 'Pendente',
  ACEITO: 'Aceito',
  RECUSADO: 'Recusado',
  EXPIRADO: 'Expirado',
}

export function statusLabel(status) {
  return labels[status] || status
}

export function formatDemandDate(value) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day))
}
