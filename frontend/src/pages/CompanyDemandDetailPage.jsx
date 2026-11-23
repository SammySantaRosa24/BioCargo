import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DemandForm from '../components/company/DemandForm.jsx'
import DemandStatus from '../components/company/DemandStatus.jsx'
import { formatDemandDate } from '../components/company/demandFormat.js'
import {
  cancelCompanyDemand, getCompanyDemand, listDemandInterests,
  respondToDemandInterest, updateCompanyDemand, updateCompanyDemandStatus,
} from '../services/api.js'

const TODAY = new Date().toISOString().slice(0, 10)

function CompanyDemandDetailPage() {
  const { id } = useParams()
  const [demand, setDemand] = useState(null)
  const [interests, setInterests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [detail, applications] = await Promise.all([getCompanyDemand(id), listDemandInterests(id)])
      setDemand(detail)
      setInterests(applications)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  // Synchronize demand details and applications with the API.
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function runAction(action) {
    setBusy(true)
    setError('')
    try {
      await action()
      await load()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleEdit(fields) {
    const updated = await updateCompanyDemand(id, fields)
    setDemand(updated)
    setEditing(false)
  }

  async function handleCancel() {
    if (window.confirm('Deseja cancelar esta demanda?')) {
      await runAction(() => cancelCompanyDemand(id))
    }
  }

  const possibleStatuses = {
    ABERTA: [['EM_NEGOCIACAO', 'Marcar em negociação']],
    EM_NEGOCIACAO: [['EM_ANDAMENTO', 'Marcar em andamento']],
  }

  if (loading) return <div className="dashboard-state">Carregando demanda...</div>
  if (!demand) return <div className="dashboard-content"><div className="dashboard-alert" role="alert">{error || 'Demanda não encontrada.'}</div><Link className="dashboard-button" to="/empresa">Voltar ao painel</Link></div>

  if (editing) return (
    <div className="dashboard-content">
      <div className="dashboard-page-heading dashboard-page-heading--stacked">
        <div><Link className="dashboard-back" to={`/empresa/demandas/${id}`}>← Voltar aos detalhes</Link><span className="dashboard-eyebrow">EDITAR DEMANDA</span><h1>{demand.titulo}</h1></div>
      </div>
      <DemandForm initialData={demand} submitLabel="Salvar alterações" onSubmit={handleEdit} onCancel={() => setEditing(false)} />
    </div>
  )

  return (
    <div className="dashboard-content">
      <div className="dashboard-page-heading dashboard-page-heading--stacked">
        <div><Link className="dashboard-back" to="/empresa">← Voltar às demandas</Link><span className="dashboard-eyebrow">DEMANDA #{demand.id}</span><h1>{demand.titulo}</h1><DemandStatus status={demand.status} /></div>
        <div className="dashboard-heading-actions">
          {demand.status === 'ABERTA' && <button className="dashboard-button dashboard-button--secondary" type="button" onClick={() => setEditing(true)}>Editar demanda</button>}
          {possibleStatuses[demand.status]?.map(([status, label]) => <button className="dashboard-button" type="button" key={status} disabled={busy} onClick={() => runAction(() => updateCompanyDemandStatus(id, status))}>{label}</button>)}
          {['ABERTA', 'EM_NEGOCIACAO'].includes(demand.status) && <button className="dashboard-button dashboard-button--danger" type="button" disabled={busy} onClick={handleCancel}>Cancelar demanda</button>}
          {['ABERTA', 'EM_NEGOCIACAO'].includes(demand.status) && demand.dataTransporte < TODAY && <button className="dashboard-button dashboard-button--secondary" type="button" disabled={busy} onClick={() => runAction(() => updateCompanyDemandStatus(id, 'EXPIRADA'))}>Marcar expirada</button>}
        </div>
      </div>

      {error && <div className="dashboard-alert" role="alert">{error}</div>}
      <section className="demand-detail-card">
        <h2>Dados do transporte</h2>
        <dl className="demand-detail-grid">
          <div><dt>Descrição e informações da carga</dt><dd>{demand.descricao}</dd></div>
          <div><dt>Porte</dt><dd>{demand.porte.toLowerCase()}</dd></div>
          <div><dt>Tipo de transporte</dt><dd>{demand.tipoTransporte}</dd></div>
          <div><dt>Data do transporte</dt><dd>{formatDemandDate(demand.dataTransporte)}</dd></div>
          <div><dt>Retirada</dt><dd>{demand.origemCidade} · {demand.origemEndereco}{demand.origemComplemento ? ` · ${demand.origemComplemento}` : ''}</dd></div>
          <div><dt>Entrega</dt><dd>{demand.destinoCidade} · {demand.destinoEndereco}{demand.destinoComplemento ? ` · ${demand.destinoComplemento}` : ''}</dd></div>
          <div><dt>Período de retirada</dt><dd>{demand.periodoRetirada || 'Não informado'}</dd></div>
          <div><dt>Valor oferecido</dt><dd>{Number(demand.valorOferecido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</dd></div>
          {demand.requisitos && <div><dt>Requisitos adicionais</dt><dd>{demand.requisitos}</dd></div>}
          <div><dt>Publicada em</dt><dd>{new Date(demand.dataCriacao).toLocaleString('pt-BR')}</dd></div>
          <div><dt>Atualizada em</dt><dd>{new Date(demand.atualizadoEm).toLocaleString('pt-BR')}</dd></div>
        </dl>
      </section>

      {demand.possuiComprovante && <section className="demand-detail-card">
        <h2>Comprovação de entrega</h2>
        <dl className="demand-detail-grid">
          <div><dt>Entrega efetiva</dt><dd>{formatDemandDate(demand.dataEntrega)} às {demand.horarioEntrega}</dd></div>
          <div><dt>Recebido por</dt><dd>{demand.nomeRecebedor}</dd></div>
          <div><dt>Observações do motorista</dt><dd>{demand.observacoesEntrega}</dd></div>
          <div><dt>Comprovante enviado</dt><dd>{new Date(demand.comprovanteEnviadoEm).toLocaleString('pt-BR')}</dd></div>
        </dl>
        <a className="dashboard-button" href={`/api/v1/demands/${demand.id}/proof`} target="_blank" rel="noreferrer">Visualizar imagem do comprovante</a>
      </section>}

      <section className="dashboard-section">
        <div className="dashboard-section__heading"><div><h2>Manifestações de interesse</h2><span>{interests.length} prestadores</span></div></div>
        {interests.length ? <div className="interest-list">
          {interests.map((interest) => <article className="interest-card" key={interest.id}>
            <div className="interest-card__info"><strong>{interest.motoristaNome}</strong><span>{interest.veiculoMarca ? `${interest.veiculoMarca} ${interest.veiculoModelo} · ${interest.veiculoAno}` : 'Veículo não informado'}</span><span>Manifestou interesse em {new Date(interest.dataCriacao).toLocaleString('pt-BR')}</span></div>
            <DemandStatus status={interest.status} />
            {interest.status === 'PENDENTE' && ['ABERTA', 'EM_NEGOCIACAO'].includes(demand.status) && <div className="interest-card__actions"><button type="button" disabled={busy} onClick={() => runAction(() => respondToDemandInterest(id, interest.id, 'ACEITO'))}>Aceitar</button><button type="button" disabled={busy} onClick={() => runAction(() => respondToDemandInterest(id, interest.id, 'RECUSADO'))}>Recusar</button></div>}
          </article>)}
        </div> : <div className="dashboard-empty">Ainda não há manifestações para esta demanda.</div>}
      </section>
    </div>
  )
}

export default CompanyDemandDetailPage
