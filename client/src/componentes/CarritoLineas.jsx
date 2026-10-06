import {
  formatearMoneda,
  formatearNumero,
} from '../utilidades/formatoMoneda'

const claseInput =
  'h-11 rounded-md border border-borde bg-superficie px-3 font-mono text-sm tabular-nums text-tinta transition-colors duration-150 hover:border-borde-fuerte'

const CarritoLineas = ({
  lineas,
  totales,
  alCambiarCantidad,
  alNormalizarCantidad,
  alCambiarDescuento,
  alNormalizarDescuento,
  alQuitar,
  alVaciar,
}) => {
  const unidad = totales.unidades === 1 ? 'unidad' : 'unidades'

  return (
    <div className="overflow-hidden rounded-lg border border-borde bg-superficie">
      <div className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            Carrito
          </h2>
          <p className="mt-0.5 font-mono text-xs text-tinta-suave">
            {formatearNumero(totales.articulos)}{' '}
            {totales.articulos === 1 ? 'producto' : 'productos'} ·{' '}
            {formatearNumero(totales.unidades)} {unidad}
          </p>
        </div>
        {lineas.length > 0 && (
          <button
            type="button"
            onClick={alVaciar}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-tinta-suave transition-colors duration-150 hover:bg-superficie-2 hover:text-tinta"
          >
            Vaciar
          </button>
        )}
      </div>

      {lineas.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <span
            className="mx-auto grid h-11 w-11 place-items-center rounded-md bg-superficie-2 text-tinta-suave"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="20" r="1.4" />
              <circle cx="18" cy="20" r="1.4" />
              <path d="M2.5 3h2.2l2.2 12.2a1.6 1.6 0 0 0 1.6 1.3h8.9a1.6 1.6 0 0 0 1.6-1.3L21 7H5.4" />
            </svg>
          </span>
          <p className="mt-3 text-sm text-tinta-suave">
            Busca un producto y agréguelo para empezar la venta.
          </p>
        </div>
      ) : (
        <ul>
          {lineas.map((linea) => (
            <li
              key={linea.producto_id}
              className="border-b border-borde px-4 py-3 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-tinta">
                    {linea.nombre}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-tinta-suave">
                    {linea.codigo || 'Sin código'} ·{' '}
                    {formatearMoneda(linea.precio_unitario)} c/u
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => alQuitar(linea.producto_id)}
                  aria-label={`Quitar ${linea.nombre} del carrito`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-borde text-tinta-suave transition-colors duration-150 hover:border-error hover:text-error"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`pos-cantidad-${linea.producto_id}`}
                    className="font-mono text-[11px] text-tinta-suave"
                  >
                    Cant.
                  </label>
                  <input
                    id={`pos-cantidad-${linea.producto_id}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={linea.cantidad}
                    onChange={(evento) =>
                      alCambiarCantidad(linea.producto_id, evento.target.value)
                    }
                    onBlur={() => alNormalizarCantidad(linea.producto_id)}
                    aria-label={`Cantidad de ${linea.nombre}`}
                    className={`${claseInput} w-16`}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`pos-descuento-${linea.producto_id}`}
                    className="font-mono text-[11px] text-tinta-suave"
                  >
                    Desc.
                  </label>
                  <div className="relative">
                    <input
                      id={`pos-descuento-${linea.producto_id}`}
                      type="text"
                      inputMode="decimal"
                      value={linea.descuento_porcentaje}
                      onChange={(evento) =>
                        alCambiarDescuento(
                          linea.producto_id,
                          evento.target.value,
                        )
                      }
                      onBlur={() =>
                        alNormalizarDescuento(linea.producto_id)
                      }
                      aria-label={`Descuento de ${linea.nombre} en porcentaje`}
                      className={`${claseInput} w-20 pr-7`}
                    />
                    <span
                      className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-xs text-tinta-suave"
                      aria-hidden="true"
                    >
                      %
                    </span>
                  </div>
                </div>

                <div className="ml-auto text-right">
                  <p className="font-mono text-[11px] text-tinta-suave">
                    Importe
                  </p>
                  <p className="font-mono text-sm font-medium tabular-nums text-tinta">
                    {formatearMoneda(linea.total)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CarritoLineas
