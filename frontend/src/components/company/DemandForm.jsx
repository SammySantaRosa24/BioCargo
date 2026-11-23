import { useState } from 'react'

const initialForm = {
  titulo: '', descricao: '', porte: '', tipoTransporte: '',
  origemCidade: '', origemEndereco: '', origemComplemento: '',
  destinoCidade: '', destinoEndereco: '', destinoComplemento: '',
  dataTransporte: '', periodoRetirada: '', valorOferecido: '', requisitos: '',
}

function DemandForm({ initialData = initialForm, submitLabel, onSubmit, onCancel }) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const fields = new FormData(event.currentTarget)
    const demand = Object.fromEntries(fields.entries())
    demand.valorOferecido = Number(demand.valorOferecido)
    try {
      await onSubmit(demand)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  function field(name, label, { required = true, type = 'text', maxLength, min, step, placeholder } = {}) {
    return (
      <label className="demand-field" key={name}>
        <span>{label}{required ? ' *' : ' (opcional)'}</span>
        <input
          name={name} type={type} required={required} maxLength={maxLength}
          min={min} step={step} placeholder={placeholder}
          defaultValue={initialData[name] ?? ''}
        />
      </label>
    )
  }

  return (
    <form className="demand-form" onSubmit={handleSubmit}>
      <div className="demand-form__section">
        <h2>Sobre o transporte</h2>
        <div className="demand-form__grid">
          {field('titulo', 'Título ou identificação', { maxLength: 180, placeholder: 'Ex.: Transporte de amostras — Unidade Centro' })}
          <label className="demand-field">
            <span>Porte do transporte *</span>
            <select name="porte" required defaultValue={initialData.porte || ''}>
              <option value="" disabled>Selecione</option>
              <option value="PEQUENO">Pequeno</option>
              <option value="MEDIO">Médio</option>
              <option value="GRANDE">Grande</option>
            </select>
          </label>
          {field('tipoTransporte', 'Tipo de transporte', { maxLength: 100, placeholder: 'Ex.: Refrigerado, temperatura controlada' })}
          <label className="demand-field demand-field--full">
            <span>Descrição e informações da carga *</span>
            <textarea name="descricao" rows={4} maxLength={20000} required defaultValue={initialData.descricao ?? ''} placeholder="Descreva o material, acondicionamento e cuidados necessários." />
          </label>
        </div>
      </div>

      <div className="demand-form__section">
        <h2>Retirada e entrega</h2>
        <h3>Local de retirada</h3>
        <div className="demand-form__grid">
          {field('origemCidade', 'Cidade', { maxLength: 120 })}
          {field('origemEndereco', 'Endereço', { maxLength: 255 })}
          {field('origemComplemento', 'Informações complementares', { required: false, maxLength: 500 })}
        </div>
        <h3>Local de entrega</h3>
        <div className="demand-form__grid">
          {field('destinoCidade', 'Cidade', { maxLength: 120 })}
          {field('destinoEndereco', 'Endereço', { maxLength: 255 })}
          {field('destinoComplemento', 'Informações complementares', { required: false, maxLength: 500 })}
        </div>
      </div>

      <div className="demand-form__section">
        <h2>Data, período e valor</h2>
        <div className="demand-form__grid">
          {field('dataTransporte', 'Data do transporte', { type: 'date' })}
          {field('periodoRetirada', 'Horário ou período de retirada', { required: false, maxLength: 100, placeholder: 'Ex.: entre 8h e 10h' })}
          {field('valorOferecido', 'Valor oferecido (R$)', { type: 'number', min: '0.01', step: '0.01', placeholder: '0,00' })}
          <label className="demand-field demand-field--full">
            <span>Requisitos adicionais (opcional)</span>
            <textarea name="requisitos" rows={3} maxLength={20000} defaultValue={initialData.requisitos ?? ''} placeholder="Licenças, equipamentos ou observações adicionais." />
          </label>
        </div>
      </div>

      {error && <p className="dashboard-alert" role="alert">{error}</p>}
      <div className="demand-form__actions">
        {onCancel && <button className="dashboard-button dashboard-button--secondary" type="button" onClick={onCancel}>Cancelar</button>}
        <button className="dashboard-button" type="submit" disabled={submitting}>{submitting ? 'Salvando...' : submitLabel}</button>
      </div>
    </form>
  )
}

export default DemandForm
