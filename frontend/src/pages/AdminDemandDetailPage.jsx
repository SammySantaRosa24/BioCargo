import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import DemandStatus from '../components/company/DemandStatus.jsx'
import { formatDemandDate } from '../components/company/demandFormat.js'
import { getAdminDemand } from '../services/api.js'

export default function AdminDemandDetailPage() {
  const { id } = useParams()
  const [demand, setDemand] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getAdminDemand(id).then((data) => active && setDemand(data)).catch((e) => active && setError(e.message))
    return () => { active = false }
  }, [id])
  if (!demand && !error) return <div className="dashboard-state">Carregando demanda...</div>
  if (!demand) return <div className="dashboard-content"><div className="dashboard-alert" role="alert">{error}</div></div>
  return <div className="dashboard-content">
    <div className="dashboard-page-heading dashboard-page-heading--stacked"><div><Link className="dashboard-back" to="/admin/demandas">← Voltar às demandas</Link><span className="dashboard-eyebrow">DEMANDA #{demand.id}</span><h1>{demand.titulo}</h1><DemandStatus status={demand.status} /></div></div>
    <section className="demand-detail-card"><h2>Operação</h2><dl className="demand-detail-grid">
      <div><dt>Empresa</dt><dd>{demand.empresaNome} (#{demand.empresaId})</dd></div><div><dt>Motorista</dt><dd>{demand.motoristaNome || 'Não contratado'}</dd></div>
      <div><dt>Origem</dt><dd>{demand.origemCidade} · {demand.origemEndereco}</dd></div><div><dt>Destino</dt><dd>{demand.destinoCidade} · {demand.destinoEndereco}</dd></div>
      <div><dt>Data</dt><dd>{formatDemandDate(demand.dataTransporte)} · {demand.periodoRetirada || 'Horário não informado'}</dd></div><div><dt>Valor</dt><dd>{Number(demand.valorOferecido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</dd></div>
      <div><dt>Tipo / porte</dt><dd>{demand.tipoTransporte} · {demand.porte}</dd></div><div><dt>Requisitos</dt><dd>{demand.requisitos || 'Nenhum requisito adicional'}</dd></div>
      <div><dt>Criada em</dt><dd>{new Date(demand.dataCriacao).toLocaleString('pt-BR')}</dd></div><div><dt>Atualizada em</dt><dd>{new Date(demand.atualizadoEm).toLocaleString('pt-BR')}</dd></div>
      {demand.comprovanteId && <><div><dt>Entregue em</dt><dd>{formatDemandDate(demand.dataEntrega)} às {demand.horarioEntrega}</dd></div><div><dt>Recebedor</dt><dd>{demand.nomeRecebedor}</dd></div><div><dt>Observações</dt><dd>{demand.observacoesEntrega}</dd></div></>}
    </dl>{demand.comprovanteId && <a className="dashboard-button" href={`/api/v1/demands/${demand.id}/proof`} target="_blank" rel="noreferrer">Visualizar comprovante</a>}</section>
  </div>
}
