const variantes = {
  error: 'border-error/30 border-l-error bg-error-suave text-error-fuerte',
  exito: 'border-exito/30 border-l-exito bg-exito-suave text-exito-fuerte',
  info: 'border-marca/25 border-l-marca bg-marca-suave text-marca-fuerte',
}

const simbolos = {
  error: '!',
  exito: '✓',
  info: 'i',
}

const Alerta = ({ variante = 'info', children, className = '' }) => (
  <div
    role="alert"
    className={`flex items-start gap-3 rounded-md border border-l-4 px-3.5 py-3 text-sm ${variantes[variante]} ${className}`}
  >
    <span
      className="mt-px font-mono text-xs font-semibold leading-5"
      aria-hidden="true"
    >
      {simbolos[variante]}
    </span>
    <p className="min-w-0 leading-5">{children}</p>
  </div>
)

export default Alerta
