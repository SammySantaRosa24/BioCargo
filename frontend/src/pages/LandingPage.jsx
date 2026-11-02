import BenefitsSection from '../components/BenefitsSection.jsx'
import CallToAction from '../components/CallToAction.jsx'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'
import { Link } from 'react-router-dom'
import '../styles/landing.css'

function HeroArtwork() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-art__halo" />
      <div className="hero-art__route hero-art__route--one" />
      <div className="hero-art__route hero-art__route--two" />
      <div className="hero-art__pin hero-art__pin--top"><span>+</span></div>
      <div className="hero-art__pin hero-art__pin--right"><span>+</span></div>
      <div className="hero-art__pin hero-art__pin--left"><span>+</span></div>
      <div className="hero-art__card">
        <div className="hero-art__card-top"><span className="hero-art__pulse" /> <span>TRANSPORTE ESPECIALIZADO</span></div>
        <div className="hero-art__box">
          <span className="hero-art__box-mark">B</span>
          <span className="hero-art__box-lines"><i /><i /><i /></span>
        </div>
        <div className="hero-art__card-bottom"><span>Origem <b>Empresa</b></span><span className="hero-art__dash" /><span>Destino <b>Vida</b></span></div>
      </div>
      <div className="hero-art__badge"><span className="hero-art__badge-icon">✳</span><span>Conexões<br /><b>que cuidam</b></span></div>
      <div className="hero-art__dot hero-art__dot--one" />
      <div className="hero-art__dot hero-art__dot--two" />
    </div>
  )
}

function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <section className="hero-section">
          <div className="container hero-section__inner">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow__dot" /> LOGÍSTICA BIOLÓGICA, MAIS CONECTADA</span>
              <h1>Conectando empresas a soluções para o <em>transporte biológico.</em></h1>
              <p>A BioCargo aproxima empresas e motoristas PJ especializados para levar materiais biológicos com cuidado, eficiência e confiança.</p>
              <div className="hero-copy__actions">
                <Link className="button button--primary" to="/cadastro">Faça parte da BioCargo <span aria-hidden="true">↗</span></Link>
                <a className="button button--outline" href="#para-empresas">Conheça a plataforma</a>
              </div>
              <div className="hero-trust"><span className="hero-trust__icon" aria-hidden="true">✳</span><span>Conexões profissionais para uma logística que exige cuidado.</span></div>
            </div>
            <HeroArtwork />
          </div>
          <div className="hero-bottom" aria-hidden="true"><span>01 — CONECTAR</span><span className="hero-bottom__line" /><span>LOGÍSTICA COM PROPÓSITO</span></div>
        </section>
        <section className="intro-strip">
          <div className="container intro-strip__inner">
            <span className="intro-strip__label">UMA NOVA ROTA PARA A LOGÍSTICA</span>
            <p>Especialização e conexão para transportar o que precisa chegar com responsabilidade.</p>
          </div>
        </section>
        <BenefitsSection />
        <CallToAction />
      </main>
      <Footer />
    </>
  )
}

export default LandingPage
