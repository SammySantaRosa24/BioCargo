import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import FormField from '../components/auth/FormField.jsx'
import PendingIntegrationMessage from '../components/auth/PendingIntegrationMessage.jsx'

function LoginPage() {
  const [showPendingMessage, setShowPendingMessage] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    setShowPendingMessage(true)
  }

  return (
    <AuthLayout
      eyebrow="BEM-VINDO À BIOCARGO"
      title="Acesse sua conta"
      description="Entre para continuar sua jornada com a BioCargo."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField
          id="email"
          label="E-mail"
          type="email"
          required
          autoComplete="email"
          placeholder="voce@empresa.com.br"
        />
        <FormField
          id="password"
          label="Senha"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Digite sua senha"
        />
        <button className="auth-submit" type="submit">Entrar <span aria-hidden="true">↗</span></button>
        {showPendingMessage && <PendingIntegrationMessage />}
      </form>
      <p className="auth-switch">Ainda não tem uma conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </AuthLayout>
  )
}

export default LoginPage
