import { Link } from 'react-router-dom'
import Brand from '../Brand.jsx'
import '../../styles/auth.css'

function AuthLayout({ eyebrow, title, description, children, size = 'standard' }) {
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Brand />
        <Link className="auth-header__back" to="/">Voltar ao início</Link>
      </header>
      <main className={`auth-main auth-main--${size}`}>
        <section className={`auth-card auth-card--${size}`} aria-labelledby="auth-title">
          <div className="auth-card__heading">
            {eyebrow && <span className="auth-eyebrow">{eyebrow}</span>}
            <h1 id="auth-title">{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {children}
        </section>
        <p className="auth-footnote">BioCargo <span aria-hidden="true">·</span> Conexões que cuidam da vida em movimento.</p>
      </main>
    </div>
  )
}

export default AuthLayout
