import Brand from './Brand.jsx'

function Header() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Brand />
        <nav className="site-nav" aria-label="Navegação principal">
          <a href="#para-empresas">Empresas</a>
          <a href="#para-motoristas">Motoristas PJ</a>
        </nav>
        <div className="site-header__actions">
          <a className="button button--text" href="#login">Entrar</a>
          <a className="button button--small" href="#cadastro">Criar conta <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </header>
  )
}

export default Header
