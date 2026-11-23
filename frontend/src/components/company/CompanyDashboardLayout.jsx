import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import Brand from '../Brand.jsx'
import { getCurrentUser, logoutUser } from '../../services/api.js'
import '../../styles/company-dashboard.css'

function CompanyDashboardLayout() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    getCurrentUser().then((currentUser) => {
      if (!active) return
      if (currentUser.tipoUsuario !== 'EMPRESA') {
        navigate('/', { replace: true })
        return
      }
      setUser(currentUser)
    }).catch((requestError) => {
      if (!active) return
      if (/autenticad|sessão/i.test(requestError.message)) {
        navigate('/login', { replace: true })
        return
      }
      setError(requestError.message)
    }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [navigate])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logoutUser()
      navigate('/login', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
      setLoggingOut(false)
    }
  }

  return (
    <div className="company-app">
      <aside className="company-sidebar">
        <Brand />
        <span className="company-sidebar__label">ÁREA DA EMPRESA</span>
        <nav aria-label="Navegação do dashboard">
          <NavLink to="/empresa" end>Visão geral</NavLink>
          <NavLink to="/empresa/demandas/nova">Publicar demanda</NavLink>
          <NavLink to="/empresa/motoristas">Buscar motoristas</NavLink>
          <Link to="/">Voltar ao site</Link>
        </nav>
        <div className="company-sidebar__account">
          <span>{user?.email || 'Conta da empresa'}</span>
          <button type="button" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Saindo...' : 'Sair da conta'}
          </button>
        </div>
      </aside>
      <main className="company-main">
        {loading ? <div className="dashboard-state">Verificando acesso...</div> : error ? (
          <div className="dashboard-alert" role="alert">{error}</div>
        ) : user ? <Outlet context={{ user }} /> : null}
      </main>
    </div>
  )
}

export default CompanyDashboardLayout
