import FormField from './FormField.jsx'

function PasswordConfirmationFields({ errors = {} }) {
  return (
    <>
      <FormField
        id="password"
        label="Senha"
        type="password"
        required
        autoComplete="new-password"
        placeholder="Digite sua senha"
        error={errors.password}
      />
      <FormField
        id="confirmPassword"
        label="Confirmar senha"
        type="password"
        required
        autoComplete="new-password"
        placeholder="Digite novamente sua senha"
        error={errors.confirmPassword}
      />
    </>
  )
}

export default PasswordConfirmationFields
