import Brand from './Brand.jsx'
import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__main">
        <div className="site-footer__brand">
          <Brand />
          <p>Conexões que cuidam da vida em movimento.</p>
        </div>
        <div className="site-footer__links">
          <a href="#para-empresas">Empresas</a>
          <a href="#para-motoristas">Motoristas PJ</a>
          <Link to="/login">Entrar</Link>
          <Link to="/cadastro">Criar conta</Link>
        </div>
      </div>
      <div className="container site-footer__bottom">
        <span>© {new Date().getFullYear()} BioCargo</span>
        <span>Conectando cuidado e logística.</span>
      </div>
    </footer>
  )
}

export default Footer
