import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import FormField from '../components/auth/FormField.jsx'
import { loginUser } from '../services/api.js'

function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)

    const email = formData.get('email')
    const senha = formData.get('password')

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const result = await loginUser({
        email: email.trim().toLowerCase(),
        senha,
      })

      if (result.usuario.tipoUsuario === 'EMPRESA') {
        navigate('/empresa', { replace: true })
        return
      }

      if (result.usuario.tipoUsuario === 'MOTORISTA') {
        navigate('/motorista', { replace: true })
        return
      }

      setFeedback({
        type: 'success',
        message: 'Login realizado com sucesso!',
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error.message,
      })
    } finally {
      setIsSubmitting(false)
    }
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

        <button
          className="auth-submit"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Entrando...' : 'Entrar'}
          {!isSubmitting && <span aria-hidden="true">↗</span>}
        </button>

        {feedback && (
          <p
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={feedback.type === 'error' ? 'auth-field__error' : ''}
          >
            {feedback.message}
          </p>
        )}
      </form>

      <p className="auth-switch">
        Ainda não tem uma conta? <Link to="/cadastro">Cadastre-se</Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
