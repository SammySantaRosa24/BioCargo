import { Link } from 'react-router-dom'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'
import '../styles/landing.css'

const audienceContent = {
  companies: {
    eyebrow: 'SOLUÇÕES PARA EMPRESAS',
    title: 'Logística especializada para cuidar do que importa.',
    description: 'Encontre motoristas PJ preparados para transportar materiais biológicos com atenção, agilidade e responsabilidade.',
    action: 'Cadastrar minha empresa',
    signup: '/cadastro/empresa',
    benefits: [
      ['01', 'Profissionais especializados', 'Encontre motoristas PJ com experiência no transporte de materiais biológicos.'],
      ['02', 'Mais agilidade na operação', 'Conecte sua demanda a profissionais disponíveis para realizar cada entrega.'],
      ['03', 'Confiança em cada etapa', 'Conte com uma plataforma pensada para as necessidades da logística biológica.'],
    ],
  },
  drivers: {
    eyebrow: 'OPORTUNIDADES PARA MOTORISTAS PJ',
    title: 'Seu próximo caminho começa com uma conexão.',
    description: 'Valorize sua experiência e encontre empresas que precisam da sua especialidade no transporte biológico.',
    action: 'Cadastrar como motorista',
    signup: '/cadastro/motorista',
    benefits: [
      ['01', 'Oportunidades alinhadas', 'Acesse demandas de empresas que precisam de profissionais especializados.'],
      ['02', 'Sua experiência em destaque', 'Apresente seu perfil PJ e a experiência que você construiu na estrada.'],
      ['03', 'Conexões mais simples', 'Encontre novas possibilidades para ampliar sua atuação profissional.'],
    ],
  },
}

function AudiencePage({ audience }) {
  const content = audienceContent[audience]

  return (
    <>
      <Header />
      <main>
        <section className="audience-hero">
          <div className="container audience-hero__inner">
            <span className="eyebrow">{content.eyebrow}</span>
            <h1>{content.title}</h1>
            <p>{content.description}</p>
            <Link className="button button--primary" to={content.signup}>
              {content.action}<span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
        <section className="benefits-section audience-benefits">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">BIOCARGO PARA VOCÊ</span>
              <h2>Uma conexão que facilita o próximo passo.</h2>
              <p>Conheça os benefícios de fazer parte de uma rede dedicada à logística biológica.</p>
            </div>
            <div className="benefit-grid">
              {content.benefits.map(([number, title, description]) => (
                <article className="benefit-card" key={number}>
                  <span className="benefit-card__number">{number}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <span className="benefit-card__line" aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

export default AudiencePage
