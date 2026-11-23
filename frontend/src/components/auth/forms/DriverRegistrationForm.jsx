
import { useEffect, useState } from 'react'
import FormField from '../FormField.jsx'
import PasswordConfirmationFields from '../PasswordConfirmationFields.jsx'
import CnpjField from '../CnpjField.jsx'
import { isValidCpf, isValidCnpj, normalizeCnpj } from '../../../utils/brazilianDocuments.js'
import { registerDriver } from '../../../services/api.js'

const MAX_VEHICLE_YEAR = new Date().getFullYear() + 1

function DriverRegistrationForm() {
  const [cnpjValue, setCnpjValue] = useState('')
  const [vehicles, setVehicles] = useState([])
  const [profilePhoto, setProfilePhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    if (!profilePhoto) { setPhotoPreview(''); return undefined }
    const previewUrl = URL.createObjectURL(profilePhoto)
    setPhotoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [profilePhoto])

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
      nextErrors.cnpj = 'CNPJ deve conter 14 numeros e digitos verificadores validos.'
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'As senhas não coincidem.'
    }

    if (profilePhoto && !['image/jpeg', 'image/png'].includes(profilePhoto.type)) {
      nextErrors.fotoPerfil = 'A foto deve estar no formato JPG ou PNG.'
    } else if (profilePhoto && profilePhoto.size > 5 * 1024 * 1024) {
      nextErrors.fotoPerfil = 'A foto pode ter no máximo 5 MB.'
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
        cnpj: normalizeCnpj(cnpj),
        telefone: telefone.trim() || null,
        email: email.trim().toLowerCase(),
        senha: password,
        veiculos: vehicles.map((vehicle) => ({ ...vehicle, ano: Number(vehicle.ano) })),
        fotoPerfil: profilePhoto,
      })

      setVehicles([])
      setProfilePhoto(null)
      setCnpjValue('')
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

        <CnpjField value={cnpjValue} onValueChange={setCnpjValue} error={errors.cnpj} />

        <div className="auth-field auth-field--full driver-photo-picker">
          <label htmlFor="fotoPerfil">Foto de perfil <span className="auth-field__optional">(opcional)</span></label>
          <input id="fotoPerfil" name="fotoPerfil" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)} aria-invalid={Boolean(errors.fotoPerfil)} />
          <small>JPG ou PNG, até 5 MB. Você poderá adicionar ou trocar a foto depois.</small>
          {photoPreview && <img className="driver-photo-preview" src={photoPreview} alt="Prévia da foto de perfil" />}
          {errors.fotoPerfil && <span className="auth-field__error" role="alert">{errors.fotoPerfil}</span>}
        </div>

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

        <section className="driver-vehicles auth-field--full" aria-labelledby="driver-vehicles-title">
          <div className="driver-vehicles__heading">
            <div>
              <h3 id="driver-vehicles-title">Carros utilitários</h3>
              <p>Adicione os veículos que você utiliza para realizar os transportes.</p>
            </div>
            <button
              className="driver-vehicles__add"
              type="button"
              onClick={() => setVehicles((current) => [...current, {
                id: crypto.randomUUID(), placa: '', renavam: '', marca: '', modelo: '', ano: '',
              descricao: '',
              }])}
            >
              + Adicionar carro utilitário
            </button>
          </div>

          {vehicles.map((vehicle, index) => (
            <fieldset className="driver-vehicle" key={vehicle.id}>
              <legend>Veículo {index + 1}</legend>
              <button
                className="driver-vehicle__remove"
                type="button"
                onClick={() => setVehicles((current) => current.filter((item) => item.id !== vehicle.id))}
                aria-label={`Remover veículo ${index + 1}`}
              >
                Remover
              </button>
              <div className="auth-form__grid">
                <div className="auth-field">
                  <label htmlFor={`veiculo-${vehicle.id}-placa`}>Placa <span className="auth-field__required" aria-hidden="true"> *</span></label>
                  <input id={`veiculo-${vehicle.id}-placa`} name={`veiculos[${index}].placa`} value={vehicle.placa} onChange={(event) => setVehicles((current) => current.map((item) => item.id === vehicle.id ? { ...item, placa: event.target.value.toUpperCase() } : item))} maxLength={8} placeholder="ABC1D23" required />
                </div>
                <div className="auth-field">
                  <label htmlFor={`veiculo-${vehicle.id}-renavam`}>RENAVAM <span className="auth-field__required" aria-hidden="true"> *</span></label>
                  <input id={`veiculo-${vehicle.id}-renavam`} name={`veiculos[${index}].renavam`} value={vehicle.renavam} onChange={(event) => setVehicles((current) => current.map((item) => item.id === vehicle.id ? { ...item, renavam: event.target.value.replace(/\D/g, '') } : item))} inputMode="numeric" maxLength={11} placeholder="00000000000" required />
                </div>
                <div className="auth-field">
                  <label htmlFor={`veiculo-${vehicle.id}-marca`}>Marca <span className="auth-field__required" aria-hidden="true"> *</span></label>
                  <input id={`veiculo-${vehicle.id}-marca`} name={`veiculos[${index}].marca`} value={vehicle.marca} onChange={(event) => setVehicles((current) => current.map((item) => item.id === vehicle.id ? { ...item, marca: event.target.value } : item))} maxLength={100} placeholder="Ex.: Fiat" required />
                </div>
                <div className="auth-field">
                  <label htmlFor={`veiculo-${vehicle.id}-modelo`}>Modelo <span className="auth-field__required" aria-hidden="true"> *</span></label>
                  <input id={`veiculo-${vehicle.id}-modelo`} name={`veiculos[${index}].modelo`} value={vehicle.modelo} onChange={(event) => setVehicles((current) => current.map((item) => item.id === vehicle.id ? { ...item, modelo: event.target.value } : item))} maxLength={100} placeholder="Ex.: Fiorino" required />
                </div>
                <div className="auth-field">
                  <label htmlFor={`veiculo-${vehicle.id}-ano`}>Ano <span className="auth-field__required" aria-hidden="true"> *</span></label>
                  <input id={`veiculo-${vehicle.id}-ano`} name={`veiculos[${index}].ano`} type="number" value={vehicle.ano} onChange={(event) => setVehicles((current) => current.map((item) => item.id === vehicle.id ? { ...item, ano: event.target.value } : item))} min="1900" max={MAX_VEHICLE_YEAR} step="1" placeholder="2024" required />
                </div>
                <div className="auth-field auth-field--full">
                  <label htmlFor={`veiculo-${vehicle.id}-descricao`}>Descrição do veículo <span className="auth-field__optional">(opcional)</span></label>
                  <textarea id={`veiculo-${vehicle.id}-descricao`} name={`veiculos[${index}].descricao`} value={vehicle.descricao} onChange={(event) => setVehicles((current) => current.map((item) => item.id === vehicle.id ? { ...item, descricao: event.target.value } : item))} maxLength={1000} rows={3} placeholder="Descreva características do veículo, como capacidade ou adaptações." />
                </div>
              </div>
            </fieldset>
          ))}
        </section>

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
