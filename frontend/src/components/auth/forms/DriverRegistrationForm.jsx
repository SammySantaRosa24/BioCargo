
import { useState } from 'react'
import FormField from '../FormField.jsx'
import PasswordConfirmationFields from '../PasswordConfirmationFields.jsx'
import { isValidCpf, isValidCnpj } from '../../../utils/brazilianDocuments.js'
import { registerDriver } from '../../../services/api.js'

function DriverRegistrationForm() {
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  function handleChange() {
    setErrors({})
    setFeedback(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)

    const nomeCompleto = formData.get('nomeCompleto')
    const cpf = formData.get('cpf')
    const cnpj = formData.get('cnpj')
    const telefone = formData.get('telefone')
    const email = formData.get('email')
    const password = formData.get('password')
    const confirmPassword = formData.get('confirmPassword')

    const nextErrors = {}

    if (!isValidCpf(cpf)) {
      nextErrors.cpf = 'Informe um CPF válido.'
    }

    if (!isValidCnpj(cnpj)) {
      nextErrors.cnpj = 'Informe um CNPJ válido, numérico ou alfanumérico.'
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'As senhas não coincidem.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setFeedback(null)
    setIsSubmitting(true)

    try {
      await registerDriver({
        nomeCompleto: nomeCompleto.trim(),
        cpf: cpf.trim(),
        cnpj: cnpj.trim(),
        telefone: telefone.trim() || null,
        email: email.trim().toLowerCase(),
        senha: password,
      })

      setFeedback({
        type: 'success',
        message: 'Cadastro realizado com sucesso! Você já está cadastrado como motorista na BioCargo.',
      })

      form.reset()
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
    <form
      className="auth-form"
      onSubmit={handleSubmit}
      onChange={handleChange}
      noValidate={false}
    >
      <div className="auth-form__grid">
        <FormField
          id="nomeCompleto"
          label="Nome completo"
          required
          autoComplete="name"
          placeholder="Seu nome completo"
          wrapperClassName="auth-field--full"
        />

        <FormField
          id="cpf"
          label="CPF"
          required
          inputMode="numeric"
          maxLength={14}
          autoComplete="off"
          placeholder="000.000.000-00"
          error={errors.cpf}
        />

        <FormField
          id="cnpj"
          label="CNPJ"
          required
          inputMode="text"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={18}
          autoComplete="off"
          placeholder="00.000.000/0001-00"
          error={errors.cnpj}
        />

        <FormField
          id="telefone"
          label="Telefone"
          type="tel"
          autoComplete="tel"
          placeholder="(00) 00000-0000"
        />

        <FormField
          id="email"
          label="E-mail"
          type="email"
          required
          autoComplete="email"
          placeholder="voce@email.com.br"
          wrapperClassName="auth-field--full"
        />

        <PasswordConfirmationFields errors={errors} />
      </div>

      <button
        className="auth-submit"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Cadastrando...' : 'Criar cadastro'}
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
  )
}

export default DriverRegistrationForm
