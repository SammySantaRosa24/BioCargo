import { useCallback, useEffect, useState } from 'react'
import { searchCompanyDrivers } from '../services/api.js'

function ProviderCard({ driver }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const initials = driver.nome.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  return <article className="provider-card">
    <div className="provider-card__avatar">
      {driver.fotoUrl && !photoFailed ? <img src={driver.fotoUrl} alt={`Foto de ${driver.nome}`} onError={() => setPhotoFailed(true)} /> : <span>{initials}</span>}
    </div>
    <div className="provider-card__body">
      <h3>{driver.nome}</h3>
      <span>{driver.motoristaDisponivel ? 'Disponível' : 'Indisponível'}</span>
      {!!driver.veiculos.length && <p><b>Veículos:</b> {driver.veiculos.map((vehicle) => `${vehicle.marca} ${vehicle.modelo} (${vehicle.ano})`).join(', ')}</p>}
      {!!driver.qualificacoes.length && <p><b>Qualificações:</b> {driver.qualificacoes.join(', ')}</p>}
    </div>
  </article>
}

export default function CompanyDriverSearchPage() {
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ data: [], meta: { total: 0, limit: 20 } })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setResult(await searchCompanyDrivers({ q: appliedQuery, page, limit: 20 })) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [appliedQuery, page])
  // Refresh providers when search or page changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  function submit(event) { event.preventDefault(); setPage(1); setAppliedQuery(query) }
  const pageCount = Math.max(1, Math.ceil(result.meta.total / result.meta.limit))
  return <div className="dashboard-content">
    <div className="dashboard-page-heading"><div><span className="dashboard-eyebrow">PRESTADORES</span><h1>Buscar motoristas</h1><p>Consulte motoristas disponíveis e seus perfis.</p></div></div>
    <form className="provider-search-form" onSubmit={submit}>
      <label className="demand-field">Nome do motorista<input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={255} placeholder="Digite um nome" /></label>
      <button className="dashboard-button" type="submit" disabled={loading}>Buscar</button>
    </form>
    {error && <div className="dashboard-alert" role="alert">{error}<button type="button" onClick={load}>Tentar novamente</button></div>}
    {loading ? <div className="dashboard-state">Carregando prestadores...</div> : result.data.length ? <>
      <div className="provider-list">{result.data.map((driver) => <ProviderCard key={driver.id} driver={driver} />)}</div>
      {pageCount > 1 && <div className="dashboard-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Próxima</button></div>}
    </> : <div className="dashboard-empty">Nenhum motorista disponível para esta busca.</div>}
  </div>
}
