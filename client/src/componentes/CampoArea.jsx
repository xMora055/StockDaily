const CampoArea = ({
  id,
  etiqueta,
  valor,
  alCambiar,
  alSalir,
  error = '',
  ayuda = '',
  filas = 3,
  maxLength,
  requerido = false,
  deshabilitado = false,
}) => {
  const idAyuda = ayuda ? `${id}-ayuda` : undefined
  const idError = error ? `${id}-error` : undefined
  const descrito = [idAyuda, idError].filter(Boolean).join(' ') || undefined

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

      <textarea
        id={id}
        value={valor}
        rows={filas}
        maxLength={maxLength}
        onChange={(evento) => alCambiar(evento.target.value)}
        onBlur={alSalir}
        disabled={deshabilitado}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito}
        className={`w-full resize-y rounded-md border bg-superficie px-3 py-2.5 text-base text-tinta transition-colors duration-150 placeholder:text-tinta-suave/70 disabled:opacity-60 ${
          error ? 'border-error' : 'border-borde hover:border-borde-fuerte'
        }`}
      />

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

export default CampoArea