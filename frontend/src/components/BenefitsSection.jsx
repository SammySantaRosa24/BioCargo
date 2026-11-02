import { Link } from 'react-router-dom'

const benefits = {
  companies: [
    { number: '01', title: 'Especialistas preparados', description: 'Encontre motoristas PJ com experiência no transporte de materiais biológicos.' },
    { number: '02', title: 'Mais agilidade na operação', description: 'Conecte sua demanda a profissionais disponíveis para realizar cada entrega.' },
    { number: '03', title: 'Confiança em cada etapa', description: 'Conte com uma plataforma pensada para as necessidades da logística biológica.' },
  ],
  drivers: [
    { number: '01', title: 'Oportunidades alinhadas', description: 'Acesse demandas de empresas que precisam de profissionais especializados.' },
    { number: '02', title: 'Sua experiência em destaque', description: 'Apresente seu perfil PJ e a experiência que você construiu na estrada.' },
    { number: '03', title: 'Conexões mais simples', description: 'Encontre novas possibilidades para ampliar sua atuação profissional.' },
  ],
}

function BenefitCards({ items }) {
  return (
    <div className="benefit-grid">
      {items.map((item) => (
        <article className="benefit-card" key={item.number}>
          <span className="benefit-card__number">{item.number}</span>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <span className="benefit-card__line" aria-hidden="true" />
        </article>
      ))}
    </div>
  )
}

function BenefitsSection() {
  return (
    <>
      <section className="benefits-section" id="para-empresas">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">PARA EMPRESAS</span>
            <h2>Logística especializada para cuidar do que importa.</h2>
            <p>Uma conexão mais direta com profissionais preparados para transportar materiais biológicos.</p>
          </div>
          <BenefitCards items={benefits.companies} />
        </div>
      </section>

      <section className="benefits-section benefits-section--tinted" id="para-motoristas">
        <div className="container benefits-section__driver-layout">
          <div className="section-heading section-heading--left">
            <span className="eyebrow">PARA MOTORISTAS PJ</span>
            <h2>Seu próximo caminho começa com uma conexão.</h2>
            <p>Valorize sua experiência e encontre empresas que precisam da sua especialidade.</p>
            <Link className="text-link" to="/cadastro">Quero me conectar <span aria-hidden="true">↗</span></Link>
          </div>
          <BenefitCards items={benefits.drivers} />
        </div>
      </section>
    </>
  )
}

export default BenefitsSection
