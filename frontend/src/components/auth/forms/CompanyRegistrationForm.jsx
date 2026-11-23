
import { useState } from 'react'
import FormField from '../FormField.jsx'
import PasswordConfirmationFields from '../PasswordConfirmationFields.jsx'
import CnpjField from '../CnpjField.jsx'
import { isValidCnpj, normalizeCnpj } from '../../../utils/brazilianDocuments.js'
import { registerCompany } from '../../../services/api.js'

function CompanyRegistrationForm() {
  const [cnpjValue, setCnpjValue] = useState('')
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

    const razaoSocial = formData.get('razaoSocial')
    const nomeFantasia = formData.get('nomeFantasia')
    const cnpj = formData.get('cnpj')
    const telefone = formData.get('telefone')
    const email = formData.get('email')
    const password = formData.get('password')
    const confirmPassword = formData.get('confirmPassword')

    const nextErrors = {}

    if (!isValidCnpj(cnpj)) {
      nextErrors.cnpj = 'CNPJ deve conter 14 numeros e digitos verificadores validos.'
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
      await registerCompany({
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim() || null,
        cnpj: normalizeCnpj(cnpj),
        telefone: telefone.trim() || null,
        email: email.trim().toLowerCase(),
        senha: password,
      })

      setFeedback({
        type: 'success',
        message: 'Cadastro realizado com sucesso! Sua empresa já está cadastrada na BioCargo.',
      })

      form.reset()
      setCnpjValue('')
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
          id="razaoSocial"
          label="Razão social"
          required
          autoComplete="organization"
          placeholder="Razão social da empresa"
          wrapperClassName="auth-field--full"
        />

        <FormField
          id="nomeFantasia"
          label="Nome fantasia"
          autoComplete="organization"
          placeholder="Nome fantasia"
        />

        <CnpjField value={cnpjValue} onValueChange={setCnpjValue} error={errors.cnpj} />

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
          placeholder="contato@empresa.com.br"
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

export default CompanyRegistrationForm
