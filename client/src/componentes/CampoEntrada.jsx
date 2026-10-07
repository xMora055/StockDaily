const CampoEntrada = ({
  id,
  etiqueta,
  tipo = 'text',
  valor,
  alCambiar,
  alSalir,
  error = '',
  ayuda = '',
  valido = false,
  enviando = false,
  autoComplete,
  inputMode,
  maxLength,
  requerido = false,
}) => {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined
  const idError = error ? `${id}-error` : undefined
  const descrito = [idAyuda, idError].filter(Boolean).join(' ') || undefined

  const claseBorde = error
    ? 'border-error'
    : 'border-borde hover:border-borde-fuerte'

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-tinta">
        {etiqueta}
        {requerido && (
          <span className="text-error" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>

      <div className="relative">
        <input
          id={id}
          type={tipo}
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          onBlur={alSalir}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          required={requerido}
          disabled={enviando}
          aria-invalid={error ? true : undefined}
          aria-describedby={descrito}
          className={`h-11 w-full rounded-md border bg-superficie px-3 pr-10 text-base text-tinta shadow-[inset_0_1px_0_0_rgba(0,0,0,0.03)] transition-colors duration-150 placeholder:text-tinta/55 disabled:opacity-60 ${claseBorde}`}
        />

        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          {enviando ? (
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 animate-spin text-tinta-suave"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="3"
                className="opacity-25"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            valido && (
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-exito"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m5 12 5 5L20 7" />
              </svg>
            )
          )}
        </span>
      </div>

      {error ? (
        <p id={idError} role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : ayuda ? (
        <p id={idAyuda} className="text-sm text-tinta-suave">
          {ayuda}
        </p>
      ) : null}
    </div>
  )
}

export default CampoEntrada
