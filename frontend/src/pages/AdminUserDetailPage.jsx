import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getAdminUser } from '../services/api.js'

export default function AdminUserDetailPage() {
  const { id } = useParams()
  const [account, setAccount] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getAdminUser(id).then((data) => active && setAccount(data)).catch((e) => active && setError(e.message))
    return () => { active = false }
  }, [id])
  if (!account && !error) return <div className="dashboard-state">Carregando usuário...</div>
  if (!account) return <div className="dashboard-content"><div className="dashboard-alert" role="alert">{error}</div></div>
  return <div className="dashboard-content">
    <div className="dashboard-page-heading dashboard-page-heading--stacked"><div><Link className="dashboard-back" to="/admin/usuarios">← Voltar aos usuários</Link><span className="dashboard-eyebrow">USUÁRIO #{account.id}</span><h1>{account.nome}</h1></div></div>
    <section className="demand-detail-card"><h2>Dados da conta</h2><dl className="demand-detail-grid">
      <div><dt>E-mail</dt><dd>{account.email}</dd></div><div><dt>Tipo</dt><dd>{account.tipoUsuario}</dd></div><div><dt>Situação</dt><dd>{account.ativo ? 'Ativo' : 'Inativo'}</dd></div><div><dt>Cadastrado em</dt><dd>{account.dataCadastro ? new Date(account.dataCadastro).toLocaleString('pt-BR') : '—'}</dd></div>
      {account.razaoSocial && <div><dt>Razão social</dt><dd>{account.razaoSocial}</dd></div>}{account.nomeFantasia && <div><dt>Nome fantasia</dt><dd>{account.nomeFantasia}</dd></div>}
      {account.cnpj && <div><dt>CNPJ</dt><dd>{account.cnpj}</dd></div>}{account.cpf && <div><dt>CPF</dt><dd>{account.cpf}</dd></div>}{account.telefone && <div><dt>Telefone</dt><dd>{account.telefone}</dd></div>}
    </dl>{account.motoristaId && <img className="admin-user-photo" src={`/api/v1/drivers/${account.motoristaId}/photo`} alt={`Foto de ${account.nome}`} onError={(e) => { e.currentTarget.hidden = true }} />}</section>
  </div>
}
