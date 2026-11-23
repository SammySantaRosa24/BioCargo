import { useEffect, useState } from 'react'
import { getAdminSummary } from '../services/api.js'

const cards = [
  ['empresas', 'Empresas'], ['motoristas', 'Motoristas'], ['usuariosAtivos', 'Usuários ativos'], ['usuariosInativos', 'Usuários inativos'],
  ['demandas', 'Demandas publicadas'], ['demandasAbertas', 'Demandas abertas'], ['demandasEmAndamento', 'Em andamento'], ['demandasFinalizadas', 'Finalizadas'], ['demandasCanceladas', 'Canceladas'],
]

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getAdminSummary().then((data) => active && setSummary(data)).catch((e) => active && setError(e.message)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  return <div className="dashboard-content">
    <div className="dashboard-page-heading"><div><span className="dashboard-eyebrow">BIOCARGO</span><h1>Painel administrativo</h1><p>Indicadores consolidados da plataforma.</p></div></div>
    {error && <div className="dashboard-alert" role="alert">{error}</div>}
    {loading ? <div className="dashboard-state">Carregando indicadores...</div> : <div className="dashboard-metrics admin-metrics">{cards.map(([key, label]) => <article className="dashboard-metric" key={key}><span>{label}</span><strong>{summary?.[key] ?? 0}</strong></article>)}</div>}
  </div>
}
