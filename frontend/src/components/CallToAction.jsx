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
          <a className="button button--light" href="#cadastro">Quero me cadastrar <span aria-hidden="true">↗</span></a>
          <a className="cta-panel__login" href="#login">Já tenho uma conta</a>
        </div>
        <span className="cta-panel__orbit cta-panel__orbit--one" aria-hidden="true" />
        <span className="cta-panel__orbit cta-panel__orbit--two" aria-hidden="true" />
      </div>
    </section>
  )
}

export default CallToAction
