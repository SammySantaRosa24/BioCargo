import { Link } from 'react-router-dom'

function CallToAction() {
  return (
    <section className="cta-section" id="cadastro">
      <div className="container cta-panel">
        <div>
          <span className="eyebrow eyebrow--light">BIOCARGO</span>
          <h2>Uma conexão que move a vida.</h2>
          <p>Empresas e profissionais especializados, mais perto de onde precisam estar.</p>
        </div>
        <div className="cta-panel__actions">
          <Link className="button button--light" to="/cadastro">Quero me cadastrar <span aria-hidden="true">↗</span></Link>
          <Link className="cta-panel__login" to="/login">Já tenho uma conta</Link>
        </div>
        <span className="cta-panel__orbit cta-panel__orbit--one" aria-hidden="true" />
        <span className="cta-panel__orbit cta-panel__orbit--two" aria-hidden="true" />
      </div>
    </section>
  )
}

export default CallToAction
