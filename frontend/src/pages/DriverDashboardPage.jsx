import { useCallback, useEffect, useState } from 'react'
import { completeDriverService, getDriverServiceSummary, listDriverDemands, listDriverServices, submitDriverInterest } from '../services/api.js'
import DemandStatus from '../components/company/DemandStatus.jsx'
import { formatDemandDate } from '../components/company/demandFormat.js'

const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function ServiceCard({ service, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState('')

  useEffect(() => {
    if (!file) { setPreview(''); return undefined }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function send(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!file) { setMessage('Anexe a imagem do comprovante.'); return }
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) { setMessage('Escolha uma imagem JPG ou PNG de até 5 MB.'); return }
    if (!window.confirm('Confirma o registro da conclusão? Depois de enviada, a comprovação não poderá ser substituída.')) return
    setBusy(true); setMessage('')
    const body = new FormData(form)
    body.set('comprovante', file)
    try {
      await completeDriverService(service.demandaId, body)
      setMessage('Serviço finalizado com sucesso.')
      setShowForm(false); setFile(null)
      await onRefresh()
    } catch (e) { setMessage(e.message) }
    finally { setBusy(false) }
  }

  const isRunning = service.interesseStatus === 'ACEITO' && service.statusDemanda === 'EM_ANDAMENTO'
  return <article className="demand-list-card driver-service-card">
    <div className="demand-list-card__top"><div><span className="demand-list-card__id">DEMANDA #{service.demandaId || service.id}</span><h3>{service.titulo}</h3></div><DemandStatus status={service.statusDemanda || service.interesseStatus} /></div>
    <div className="demand-list-card__details">
      <span><b>Empresa</b>{service.empresaNome || 'Empresa contratante'}</span><span><b>Origem</b>{service.origemCidade}</span><span><b>Destino</b>{service.destinoCidade}</span>
      <span><b>Data</b>{formatDemandDate(service.dataTransporte)}</span><span><b>Valor</b>{money(service.valorOferecido)}</span><span><b>Tipo / porte</b>{service.tipoTransporte} · {service.porte?.toLowerCase()}</span>
      {service.motivoCancelamento && <span><b>Motivo do cancelamento</b>{service.motivoCancelamento}</span>}
    </div>
    <details className="driver-service-details"><summary>Ver informações da operação</summary><p>{service.descricao}</p><p><b>Retirada:</b> {service.origemEndereco}, {service.origemCidade}</p><p><b>Entrega:</b> {service.destinoEndereco}, {service.destinoCidade}</p>{service.requisitos && <p><b>Requisitos:</b> {service.requisitos}</p>}</details>
    {isRunning && <button type="button" className="dashboard-button" onClick={() => setShowForm((value) => !value)}>{showForm ? 'Fechar formulário' : 'Finalizar serviço'}</button>}
    {showForm && <form className="demand-form driver-proof-form" onSubmit={send}>
      <h4>Comprovação de entrega</h4>
      <label className="demand-field demand-field--full">Imagem assinada pelo recebedor<input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" required onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
      {preview && <img className="driver-proof-preview" src={preview} alt="Prévia do comprovante de entrega" />}
      <div className="demand-form__grid">
        <label className="demand-field">Data efetiva da entrega<input name="dataEntrega" type="date" required /></label>
        <label className="demand-field">Horário efetivo<input name="horarioEntrega" type="time" required /></label>
        <label className="demand-field demand-field--full">Nome completo de quem recebeu<input name="nomeRecebedor" maxLength="255" required /></label>
        <label className="demand-field demand-field--full">Observações<textarea name="observacoes" maxLength="2000" rows="3" /></label>
      </div>
      {message && <p role="status" className="dashboard-alert">{message}</p>}
      <button className="dashboard-button" type="submit" disabled={busy}>{busy ? 'Enviando...' : 'Registrar conclusão'}</button>
    </form>}
    {service.comprovanteId && <div className="driver-proof-record"><b>Entrega recebida por:</b> {service.nomeRecebedor} · {formatDemandDate(service.dataEntrega)} às {service.horarioEntrega}<br />{service.observacoes && <span>{service.observacoes}<br /></span>}<a href={`/api/v1/demands/${service.demandaId}/proof`} target="_blank" rel="noreferrer">Consultar comprovante</a></div>}
    {message && !showForm && <p role="status">{message}</p>}
  </article>
}

function OpportunityCard({ demand, onRefresh }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function apply() {
    setBusy(true); setError('')
    try { await submitDriverInterest(demand.id); await onRefresh() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <article className="demand-list-card">
    <div className="demand-list-card__top"><div><span className="demand-list-card__id">DEMANDA #{demand.id}</span><h3>{demand.titulo}</h3></div><DemandStatus status={demand.status} /></div>
    <div className="demand-list-card__details"><span><b>Origem</b>{demand.origemCidade}</span><span><b>Destino</b>{demand.destinoCidade}</span><span><b>Data</b>{formatDemandDate(demand.dataTransporte)} · {demand.periodoRetirada || 'horário a combinar'}</span><span><b>Tipo / porte</b>{demand.tipoTransporte} · {demand.porte?.toLowerCase()}</span><span><b>Valor oferecido</b>{money(demand.valorOferecido)}</span><span><b>Empresa</b>{demand.empresaNome || 'Empresa contratante'}</span></div>
    <details className="driver-service-details"><summary>Detalhes e requisitos</summary><p>{demand.descricao}</p>{demand.requisitos && <p>{demand.requisitos}</p>}</details>
    {['PENDENTE', 'ACEITO'].includes(demand.meuInteresse) ? <p>Manifestação: <DemandStatus status={demand.meuInteresse} /></p> : <button type="button" className="dashboard-button" onClick={apply} disabled={busy}>{busy ? 'Enviando...' : 'Tenho interesse'}</button>}
    {error && <p className="dashboard-alert" role="alert">{error}</p>}
  </article>
}

export default function DriverDashboardPage() {
  const [summary, setSummary] = useState(null)
  const [opportunities, setOpportunities] = useState([])
  const [active, setActive] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setError('')
    try {
      const [metrics, available, services, past] = await Promise.all([
        getDriverServiceSummary(), listDriverDemands({ page: 1, limit: 100 }), listDriverServices('ativas'), listDriverServices('historico'),
      ])
      setSummary(metrics); setOpportunities(available.data); setActive(services); setHistory(past)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  // Load current API data when the dashboard is opened.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])
  const cards = [['oportunidades', 'Novas oportunidades'], ['interesses', 'Interesses enviados'], ['emAndamento', 'Em andamento'], ['finalizados', 'Finalizados'], ['cancelados', 'Cancelados']]
  return <div className="dashboard-content">
    <div className="dashboard-page-heading"><div><span className="dashboard-eyebrow">PAINEL DO MOTORISTA PJ</span><h1>Seu trabalho na BioCargo</h1><p>Acompanhe oportunidades, serviços em andamento e entregas concluídas.</p></div></div>
    {error && <div className="dashboard-alert" role="alert">{error}<button type="button" onClick={load}>Tentar novamente</button></div>}
    {loading ? <div className="dashboard-state">Carregando seus serviços...</div> : <>
      <div className="dashboard-metrics">{cards.map(([key, label]) => <article className="dashboard-metric" key={key}><span>{label}</span><strong>{summary?.[key] || 0}</strong></article>)}</div>
      <section id="oportunidades" className="dashboard-section"><div className="dashboard-section__heading"><div><h2>Oportunidades</h2><span>{opportunities.length} demandas disponíveis</span></div></div>{opportunities.length ? <div className="demand-list">{opportunities.map((d) => <OpportunityCard key={d.id} demand={d} onRefresh={load} />)}</div> : <div className="dashboard-empty">Não há demandas disponíveis neste momento.</div>}</section>
      <section id="meus-servicos" className="dashboard-section"><div className="dashboard-section__heading"><div><h2>Meus serviços</h2><span>Interesses enviados e operações em andamento</span></div></div>{active.length ? <div className="demand-list">{active.map((s) => <ServiceCard key={s.interesseId} service={s} onRefresh={load} />)}</div> : <div className="dashboard-empty">Você ainda não tem serviços ativos.</div>}</section>
      <section id="historico" className="dashboard-section"><div className="dashboard-section__heading"><div><h2>Histórico</h2><span>Serviços finalizados ou cancelados</span></div></div>{history.length ? <div className="demand-list">{history.map((s) => <ServiceCard key={s.interesseId} service={s} onRefresh={load} />)}</div> : <div className="dashboard-empty">Seu histórico aparecerá aqui.</div>}</section>
    </>}
  </div>
}
