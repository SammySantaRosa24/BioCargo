import { Link } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import CompanyRegistrationForm from '../components/auth/forms/CompanyRegistrationForm.jsx'

function CompanySignupPage() {
  return (
    <AuthLayout
      eyebrow="CADASTRO DE EMPRESA"
      title="Conecte sua empresa"
      description="Preencha os dados da empresa para iniciar seu cadastro na BioCargo."
      size="registration"
    >
      <CompanyRegistrationForm />
      <p className="auth-switch"><Link to="/cadastro">Voltar à escolha do perfil</Link></p>
    </AuthLayout>
  )
}

export default CompanySignupPage
