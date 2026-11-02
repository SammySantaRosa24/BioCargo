import { useState } from 'react'
import FormField from '../FormField.jsx'
import PasswordConfirmationFields from '../PasswordConfirmationFields.jsx'
import PendingIntegrationMessage from '../PendingIntegrationMessage.jsx'
import { isValidCpf, isValidCnpj } from '../../../utils/brazilianDocuments.js'

function DriverRegistrationForm() {
  const [errors, setErrors] = useState({})
  const [showPendingMessage, setShowPendingMessage] = useState(false)

  function handleChange() {
    setErrors({})
    setShowPendingMessage(false)
  }

  function handleSubmit(event) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const nextErrors = {}
    const cpf = formData.get('cpf')
    const cnpj = formData.get('cnpj')
    const password = formData.get('password')
    const confirmPassword = formData.get('confirmPassword')

    if (!isValidCpf(cpf)) {
      nextErrors.cpf = 'Informe um CPF válido.'
    }

    if (!isValidCnpj(cnpj)) {
      nextErrors.cnpj = 'Informe um CNPJ válido, numérico ou alfanumérico.'
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'As senhas não coincidem.'
    }

    setErrors(nextErrors)
    setShowPendingMessage(Object.keys(nextErrors).length === 0)
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} onChange={handleChange} noValidate={false}>
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
      <button className="auth-submit" type="submit">Criar cadastro <span aria-hidden="true">↗</span></button>
      {showPendingMessage && <PendingIntegrationMessage context="registration" />}
    </form>
  )
}

export default DriverRegistrationForm
