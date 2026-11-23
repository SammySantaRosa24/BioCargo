import FormField from './FormField.jsx'
import { formatCnpj } from '../../utils/brazilianDocuments.js'

function caretAfterDigits(value, digits) {
  if (digits === 0) return 0
  let count = 0
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) count += 1
    if (count === digits) return index + 1
  }
  return value.length
}

function CnpjField({ value, onValueChange, error }) {
  function handleChange(event) {
    const input = event.currentTarget
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    const digitsBeforeStart = input.value.slice(0, start).replace(/\D/g, '').length
    const digitsBeforeEnd = input.value.slice(0, end).replace(/\D/g, '').length
    const formatted = formatCnpj(input.value)

    onValueChange(formatted)
    requestAnimationFrame(() => {
      input.setSelectionRange(
        caretAfterDigits(formatted, digitsBeforeStart),
        caretAfterDigits(formatted, digitsBeforeEnd),
      )
    })
  }

  return (
    <FormField
      id="cnpj"
      label="CNPJ"
      required
      inputMode="numeric"
      maxLength={18}
      autoComplete="off"
      placeholder="00.000.000/0000-00"
      value={value}
      onChange={handleChange}
      error={error}
    />
  )
}

export default CnpjField
