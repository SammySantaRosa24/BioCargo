import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DemandStatus from '../components/company/DemandStatus.jsx'
import { formatDemandDate } from '../components/company/demandFormat.js'
import { listAdminDemands } from '../services/api.js'

export default function AdminDemandsPage() {
  const [filters, setFilters] = useState({ status: '', empresaId: '' })
  const [applied, setApplied] = useState(filters)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ data: [], meta: { total: 0, limit: 20 } })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setResult(await listAdminDemands({ ...applied, page, limit: 20 })) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [applied, page])
  // Load the selected filters and page.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  function submit(event) { event.preventDefault(); setPage(1); setApplied(filters) }

  const pages = Math.max(1, Math.ceil(result.meta.total / result.meta.limit))
  return <div className="dashboard-content">
    <div className="dashboard-page-heading"><div><span className="dashboard-eyebrow">ADMINISTRAÇÃO</span><h1>Demandas</h1><p>Consulta somente leitura do histórico operacional.</p></div></div>
    <form className="admin-filter-form" onSubmit={submit}>
      <label className="demand-field">Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">Todos</option><option value="ABERTA">Aberta</option><option value="EM_NEGOCIACAO">Em negociação</option><option value="EM_ANDAMENTO">Em andamento</option><option value="FINALIZADA">Finalizada</option><option value="CANCELADA">Cancelada</option><option value="EXPIRADA">Expirada</option></select></label>
      <label className="demand-field">ID da empresa<input type="number" min="1" value={filters.empresaId} onChange={(e) => setFilters({ ...filters, empresaId: e.target.value })} /></label>
      <button className="dashboard-button" type="submit">Filtrar</button>
    </form>
    {error && <div className="dashboard-alert" role="alert">{error}<button type="button" onClick={load}>Tentar novamente</button></div>}
    {loading ? <div className="dashboard-state">Carregando demandas...</div> : result.data.length ? <>
      <div className="demand-list">{result.data.map((demand) => <Link className="demand-list-card" to={`/admin/demandas/${demand.id}`} key={demand.id}>
        <div className="demand-list-card__top"><div><span className="demand-list-card__id">DEMANDA #{demand.id}</span><h3>{demand.titulo}</h3></div><DemandStatus status={demand.status} /></div>
        <div className="demand-list-card__details"><span><b>Empresa</b>{demand.empresaNome}</span><span><b>Origem</b>{demand.origemCidade}</span><span><b>Destino</b>{demand.destinoCidade}</span><span><b>Data</b>{formatDemandDate(demand.dataTransporte)}</span><span><b>Valor</b>{Number(demand.valorOferecido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><span><b>Motorista</b>{demand.motoristaNome || 'Ainda não contratado'}</span></div>
      </Link>)}</div>
      {pages > 1 && <div className="dashboard-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Próxima</button></div>}
    </> : <div className="dashboard-empty">Nenhuma demanda encontrada.</div>}
  </div>
}
