import { formatearMoneda, formatearNumero } from '../utilidades/formatoMoneda'

const GraficoBarras = ({
  items = [],
  formatearValor = formatearMoneda,
  formatearSecundario = formatearNumero,
  sufijoSecundario = '',
  mensajeVacio = 'Sin datos para mostrar en el periodo.',
}) => {
  const filas = (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      etiqueta: item.etiqueta ?? '—',
      valor: Number(item.valor) || 0,
      secundario:
        item.secundario === undefined || item.secundario === null
          ? null
          : Number(item.secundario) || 0,
    }))

  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-borde-fuerte bg-superficie px-5 py-8 text-center text-sm text-tinta-suave">
        {mensajeVacio}
      </p>
    )
  }

  const maximo = filas.reduce((mayor, fila) => Math.max(mayor, fila.valor), 0)

  return (
    <ul className="flex flex-col gap-4">
      {filas.map((fila, indice) => {
        const relativo = maximo > 0 ? (fila.valor / maximo) * 100 : 0
        // Deja una huella visible incluso cuando el valor es pequeño.
        const ancho = fila.valor > 0 ? Math.max(relativo, 3) : 0

        return (
          <li key={`${fila.etiqueta}-${indice}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium text-tinta">
                {fila.etiqueta}
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums text-tinta">
                {formatearValor(fila.valor)}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2.5">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-superficie-2"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-marca"
                  style={{ width: `${ancho}%` }}
                />
              </div>

              {fila.secundario !== null && (
                <span className="shrink-0 font-mono text-xs tabular-nums text-tinta-suave">
                  {formatearSecundario(fila.secundario)}
                  {sufijoSecundario ? ` ${sufijoSecundario}` : ''}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default GraficoBarras
