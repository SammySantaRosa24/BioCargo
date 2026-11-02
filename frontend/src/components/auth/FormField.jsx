function FormField({
  id,
  label,
  type = 'text',
  required = false,
  autoComplete,
  placeholder,
  inputMode,
  maxLength,
  autoCapitalize,
  spellCheck,
  error,
  wrapperClassName = '',
}) {
  return (
    <div className={`auth-field ${wrapperClassName}`.trim()}>
      <label htmlFor={id}>
        {label}
        {required && <span className="auth-field__required" aria-hidden="true"> *</span>}
        {!required && <span className="auth-field__optional"> (opcional)</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        required={required}
        aria-required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <span className="auth-field__error" id={`${id}-error`}>{error}</span>}
    </div>
  )
}

export default FormField
