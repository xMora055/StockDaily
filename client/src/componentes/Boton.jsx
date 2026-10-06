const variantes = {
  primario:
    'border border-petroleo-fuerte bg-petroleo text-fondo shadow-[2px_2px_0_0_var(--color-petroleo-fuerte)] hover:bg-petroleo-fuerte active:translate-x-px active:translate-y-px active:shadow-none',
  secundario:
    'border border-borde-fuerte bg-superficie text-tinta hover:border-tinta-suave hover:bg-superficie-2 active:translate-x-px active:translate-y-px',
  acento:
    'border border-acento-fuerte bg-acento text-tinta shadow-[2px_2px_0_0_var(--color-acento-fuerte)] hover:brightness-105 active:translate-x-px active:translate-y-px active:shadow-none',
  peligro:
    'border border-error-fuerte bg-error text-fondo shadow-[2px_2px_0_0_var(--color-error-fuerte)] hover:bg-error-fuerte active:translate-x-px active:translate-y-px active:shadow-none',
  sutil:
    'border border-transparent bg-transparent text-tinta-suave hover:bg-superficie-2 hover:text-tinta',
}

const Boton = ({
  children,
  variante = 'primario',
  tipo = 'button',
  cargando = false,
  deshabilitado = false,
  className = '',
  ...resto
}) => {
  const inactivo = cargando || deshabilitado

  return (
    <button
      type={tipo}
      disabled={inactivo}
      aria-busy={cargando || undefined}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-medium tracking-tight transition duration-150 ease-out disabled:translate-x-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none ${variantes[variante]} ${className}`}
      {...resto}
    >
      {cargando && (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 animate-spin"
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
      )}
      {children}
    </button>
  )
}

export default Boton
