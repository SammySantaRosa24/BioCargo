import { Link } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import DriverRegistrationForm from '../components/auth/forms/DriverRegistrationForm.jsx'

function DriverSignupPage() {
  return (
    <AuthLayout
      eyebrow="CADASTRO DE MOTORISTA PJ"
      title="Sua experiência abre caminhos"
      description="Informe seus dados para iniciar seu cadastro como motorista PJ."
      size="registration"
    >
      <DriverRegistrationForm />
      <p className="auth-switch"><Link to="/cadastro">Voltar à escolha do perfil</Link></p>
    </AuthLayout>
  )
}

export default DriverSignupPage
