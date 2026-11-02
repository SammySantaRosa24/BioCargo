import { Link } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import SignupOptionCard from '../components/auth/SignupOptionCard.jsx'

const signupOptions = [
  {
    id: 'empresa',
    to: '/cadastro/empresa',
    title: 'Sou uma empresa',
    description: 'Encontre profissionais especializados para suas demandas de transporte.',
    icon: 'E',
  },
  {
    id: 'motorista',
    to: '/cadastro/motorista',
    title: 'Sou motorista PJ',
    description: 'Conecte sua experiência a novas oportunidades de transporte biológico.',
    icon: 'M',
  },
]

function SignupTypePage() {
  return (
    <AuthLayout
      eyebrow="COMECE SUA JORNADA"
      title="Como você quer se cadastrar?"
      description="Escolha o perfil que melhor representa você para começar."
      size="wide"
    >
      <div className="signup-options" role="group" aria-label="Tipo de cadastro">
        {signupOptions.map((option) => (
          <SignupOptionCard
            key={option.id}
            to={option.to}
            title={option.title}
            description={option.description}
            icon={option.icon}
          />
        ))}
      </div>
      <p className="auth-switch">Já tem uma conta? <Link to="/login">Entrar</Link></p>
    </AuthLayout>
  )
}

export default SignupTypePage
