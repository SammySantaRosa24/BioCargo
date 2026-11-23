import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { listAdminUsers, updateAdminUserStatus } from '../services/api.js'

export default function AdminUsersPage() {
  const { user } = useOutletContext()
  const [filters, setFilters] = useState({ q: '', tipo: '', situacao: '' })
  const [applied, setApplied] = useState(filters)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ data: [], meta: { total: 0, limit: 20 } })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setResult(await listAdminUsers({ ...applied, page, limit: 20 })) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [applied, page])
  // Load the currently selected filters and page.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function changeStatus(account) {
    const next = !account.ativo
    if (!window.confirm(`${next ? 'Ativar' : 'Inativar'} a conta de ${account.nome}?`)) return
    setBusyId(account.id); setError('')
    try { await updateAdminUserStatus(account.id, next); await load() }
    catch (e) { setError(e.message) }
    finally { setBusyId(null) }
  }

  function submit(event) { event.preventDefault(); setPage(1); setApplied(filters) }
  const pages = Math.max(1, Math.ceil(result.meta.total / result.meta.limit))
  return <div className="dashboard-content">
    <div className="dashboard-page-heading"><div><span className="dashboard-eyebrow">ADMINISTRAÇÃO</span><h1>Usuários</h1><p>Pesquise contas, consulte cadastros e altere sua situação sem excluir histórico.</p></div></div>
    <form className="admin-filter-form" onSubmit={submit}>
      <label className="demand-field">Nome, e-mail ou documento<input value={filters.q} maxLength={255} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></label>
      <label className="demand-field">Tipo<select value={filters.tipo} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}><option value="">Todos</option><option value="EMPRESA">Empresa</option><option value="MOTORISTA">Motorista</option><option value="ADMIN">Administrador</option></select></label>
      <label className="demand-field">Situação<select value={filters.situacao} onChange={(e) => setFilters({ ...filters, situacao: e.target.value })}><option value="">Todas</option><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
      <button className="dashboard-button" type="submit">Pesquisar</button>
    </form>
    {error && <div className="dashboard-alert" role="alert">{error}<button type="button" onClick={load}>Tentar novamente</button></div>}
    {loading ? <div className="dashboard-state">Carregando usuários...</div> : result.data.length ? <>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Cadastro</th><th>Tipo</th><th>Documento</th><th>Cadastrado em</th><th>Situação</th><th>Ações</th></tr></thead><tbody>
        {result.data.map((account) => <tr key={account.id}><td><strong>{account.nome}</strong><small>{account.email}</small></td><td>{account.tipoUsuario}</td><td>{account.cnpj || account.cpf || '—'}</td><td>{account.dataCadastro ? new Date(account.dataCadastro).toLocaleDateString('pt-BR') : '—'}</td><td>{account.ativo ? 'Ativo' : 'Inativo'}</td><td><div className="admin-row-actions"><Link to={`/admin/usuarios/${account.id}`}>Detalhes</Link><button type="button" disabled={busyId === account.id || (account.ativo && account.id === user.id)} onClick={() => changeStatus(account)}>{busyId === account.id ? 'Salvando...' : account.id === user.id ? 'Conta atual' : account.ativo ? 'Inativar' : 'Ativar'}</button></div></td></tr>)}
      </tbody></table></div>
      {pages > 1 && <div className="dashboard-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</button><span>Página {page} de {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>Próxima</button></div>}
    </> : <div className="dashboard-empty">Nenhum usuário encontrado para os filtros selecionados.</div>}
  </div>
}
