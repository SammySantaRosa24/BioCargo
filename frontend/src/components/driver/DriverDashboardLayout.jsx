import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import Brand from '../Brand.jsx'
import { getCurrentUser, logoutUser } from '../../services/api.js'
import '../../styles/company-dashboard.css'

export default function DriverDashboardLayout() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    getCurrentUser().then((current) => {
      if (!active) return
      if (current.tipoUsuario !== 'MOTORISTA') { navigate('/', { replace: true }); return }
      setUser(current)
    }).catch((e) => {
      if (!active) return
      if (/autenticad|sess/i.test(e.message)) navigate('/login', { replace: true })
      else setError(e.message)
    }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [navigate])

  async function logout() {
    try { await logoutUser(); navigate('/login', { replace: true }) }
    catch (e) { setError(e.message) }
  }

  return <div className="company-app">
    <aside className="company-sidebar">
      <Brand />
      <span className="company-sidebar__label">ÁREA DO MOTORISTA</span>
      <nav aria-label="Navegação do dashboard">
        <NavLink to="/motorista" end>Visão geral</NavLink>
        <NavLink to="/motorista/perfil">Meu perfil</NavLink>
        <a href="#oportunidades">Oportunidades</a>
        <a href="#meus-servicos">Meus serviços</a>
        <a href="#historico">Histórico</a>
        <Link to="/">Voltar ao site</Link>
      </nav>
      <div className="company-sidebar__account"><span>{user?.email || 'Conta do motorista'}</span><button type="button" onClick={logout}>Sair da conta</button></div>
    </aside>
    <main className="company-main">{loading ? <div className="dashboard-state">Verificando acesso...</div> : error ? <div className="dashboard-alert" role="alert">{error}</div> : user ? <Outlet context={{ user }} /> : null}</main>
  </div>
}
