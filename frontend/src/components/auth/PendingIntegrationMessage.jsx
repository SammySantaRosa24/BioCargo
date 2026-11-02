function PendingIntegrationMessage({ context = 'login' }) {
  const message = context === 'registration'
    ? 'A integração com o backend ainda está pendente. Nenhum dado foi enviado e o cadastro não foi realizado.'
    : 'A integração com o backend ainda está pendente. Nenhuma autenticação foi realizada e nenhum dado foi enviado.'

  return (
    <p className="auth-notice" role="status" aria-live="polite">
      {message}
    </p>
  )
}

export default PendingIntegrationMessage
