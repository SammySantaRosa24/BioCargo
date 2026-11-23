import Brand from './Brand.jsx'
import { Link } from 'react-router-dom'

function Header() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Brand />
        <nav className="site-nav" aria-label="Navegação principal">
          <Link to="/empresas">Empresas</Link>
          <Link to="/motoristas-pj">Motoristas PJ</Link>
        </nav>
        <div className="site-header__actions">
          <Link className="button button--text" to="/login">Entrar</Link>
          <Link className="button button--small" to="/cadastro">Criar conta <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </header>
  )
}

export default Header
