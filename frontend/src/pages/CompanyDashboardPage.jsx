import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCompanyDemandSummary, listCompanyDemands } from '../services/api.js'
import DemandStatus from '../components/company/DemandStatus.jsx'
import { formatDemandDate } from '../components/company/demandFormat.js'

const summaryCards = [
  ['abertas', 'Demandas abertas'],
  ['emNegociacao', 'Em negociação'],
  ['emAndamento', 'Em andamento'],
  ['finalizadas', 'Finalizadas'],
]

function DemandList({ title, group, page, setPage, result }) {
  const demands = result?.data || []
  const pages = Math.max(1, Math.ceil((result?.meta?.total || 0) / (result?.meta?.limit || 10)))
  return (
    <section className="dashboard-section">
      <div className="dashboard-section__heading">
        <div><h2>{title}</h2><span>{result?.meta?.total ?? 0} demandas</span></div>
      </div>
      {demands.length ? <div className="demand-list">
        {demands.map((demand) => (
          <Link className="demand-list-card" to={`/empresa/demandas/${demand.id}`} key={demand.id}>
            <div className="demand-list-card__top">
              <div><span className="demand-list-card__id">DEMANDA #{demand.id}</span><h3>{demand.titulo}</h3></div>
              <DemandStatus status={demand.status} />
            </div>
            <div className="demand-list-card__details">
              <span><b>Origem</b>{demand.origemCidade}</span>
              <span><b>Destino</b>{demand.destinoCidade}</span>
              <span><b>Data</b>{formatDemandDate(demand.dataTransporte)}</span>
              <span><b>Tipo / porte</b>{demand.tipoTransporte} · {demand.porte.toLowerCase()}</span>
              <span><b>Valor oferecido</b>{Number(demand.valorOferecido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              {group === 'ativas' && <span><b>Manifestações</b>{demand.totalInteresses}</span>}
            </div>
          </Link>
        ))}
      </div> : <div className="dashboard-empty">{group === 'ativas' ? 'Você ainda não publicou demandas.' : 'Ainda não há demandas no histórico.'}</div>}
      {pages > 1 && <div className="dashboard-pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page} de {pages}</span>
        <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button>
      </div>}
    </section>
  )
}

function CompanyDashboardPage() {
  const [summary, setSummary] = useState(null)
  const [active, setActive] = useState(null)
  const [history, setHistory] = useState(null)
  const [activePage, setActivePage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [counts, activeDemands, historicalDemands] = await Promise.all([
        getCompanyDemandSummary(),
        listCompanyDemands({ group: 'ativas', page: activePage, limit: 10 }),
        listCompanyDemands({ group: 'historico', page: historyPage, limit: 10 }),
      ])
      setSummary(counts)
      setActive(activeDemands)
      setHistory(historicalDemands)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [activePage, historyPage])

  // Synchronize the dashboard with the API when pagination changes.
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { load() }, [load])

  return (
    <div className="dashboard-content">
      <div className="dashboard-page-heading">
        <div><span className="dashboard-eyebrow">PAINEL DA EMPRESA</span><h1>Suas demandas</h1><p>Acompanhe os transportes publicados e as manifestações dos prestadores.</p></div>
        <Link className="dashboard-button" to="/empresa/demandas/nova">+ Publicar nova demanda</Link>
      </div>
      {error && <div className="dashboard-alert" role="alert">{error}<button type="button" onClick={load}>Tentar novamente</button></div>}
      {loading ? <div className="dashboard-state">Carregando suas demandas...</div> : <>
        <div className="dashboard-metrics">
          {summaryCards.map(([key, label]) => <article className="dashboard-metric" key={key}><span>{label}</span><strong>{summary?.[key] ?? 0}</strong></article>)}
        </div>
        <DemandList title="Demandas abertas e em operação" group="ativas" page={activePage} setPage={setActivePage} result={active} />
        <DemandList title="Histórico" group="historico" page={historyPage} setPage={setHistoryPage} result={history} />
      </>}
    </div>
  )
}

export default CompanyDashboardPage
