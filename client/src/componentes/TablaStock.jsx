import Paginacion from './Paginacion'
import { formatearNumero } from '../utilidades/formatoMoneda'

const esFaltante = (cantidad) => Number(cantidad) < 0

const claveFila = (fila) => `${fila.producto_id}-${fila.sucursal_id}`

const TablaStock = ({
  existencias,
  pagina,
  totalPaginas,
  total,
  porPagina,
  alAnterior,
  alSiguiente,
  alCambiarPorPagina,
}) => (
  <>
    {/* Escritorio/tablet: tabla de ancho fijo con proporciones intencionales. */}
    <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie md:block">
      <div className="overflow-x-auto rounded-lg">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
          <caption className="sr-only">
            Existencias por producto y sucursal
          </caption>
          <colgroup>
            <col />
            <col className="w-[140px]" />
            <col className="w-[24%]" />
            <col className="w-[160px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-borde bg-superficie-2 text-left font-mono text-xs uppercase tracking-wide text-tinta-suave">
              <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                Producto
              </th>
              <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                Código
              </th>
              <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                Sucursal
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-right font-medium sm:px-4"
              >
                Cantidad
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {existencias.map((fila) => {
              const faltante = esFaltante(fila.cantidad)
              return (
                <tr
                  key={claveFila(fila)}
                  className={faltante ? 'bg-error-suave/60' : undefined}
                >
                  <td className="px-3 py-3 sm:px-4">
                    <p
                      className="truncate font-medium text-tinta"
                      title={fila.producto_nombre}
                    >
                      {fila.producto_nombre}
                    </p>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-tinta-suave sm:px-4">
                    <span
                      className="block truncate"
                      title={fila.producto_codigo}
                    >
                      {fila.producto_codigo || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-tinta-suave sm:px-4">
                    <span
                      className="block truncate"
                      title={fila.sucursal_nombre}
                    >
                      {fila.sucursal_nombre}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right sm:px-4">
                    <span className="inline-flex items-center gap-2">
                      {faltante && (
                        <span className="rounded-full border border-error/30 bg-error-suave px-2 py-0.5 text-xs font-medium text-error-fuerte">
                          Faltante
                        </span>
                      )}
                      <span
                        className={`font-mono tabular-nums ${
                          faltante
                            ? 'font-semibold text-error-fuerte'
                            : 'text-tinta'
                        }`}
                      >
                        {formatearNumero(fila.cantidad)}
                      </span>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* Móvil: tarjetas, sin scroll horizontal. */}
    <ul className="flex flex-col gap-3 md:hidden">
      {existencias.map((fila) => {
        const faltante = esFaltante(fila.cantidad)
        return (
          <li
            key={claveFila(fila)}
            className={`rounded-lg border bg-superficie p-4 ${
              faltante ? 'border-error/40' : 'border-borde'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-tinta">
                  {fila.producto_nombre}
                </p>
                <p className="mt-0.5 font-mono text-xs text-tinta-suave">
                  {fila.producto_codigo || 'Sin código'}
                </p>
              </div>
              <span
                className={`shrink-0 font-mono tabular-nums ${
                  faltante
                    ? 'font-semibold text-error-fuerte'
                    : 'text-tinta'
                }`}
              >
                {formatearNumero(fila.cantidad)}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-borde pt-3">
              <p className="min-w-0 truncate text-sm text-tinta-suave">
                {fila.sucursal_nombre}
              </p>
              {faltante && (
                <span className="shrink-0 rounded-full border border-error/30 bg-error-suave px-2 py-0.5 text-xs font-medium text-error-fuerte">
                  Faltante
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>

    {Number(total) > 0 && (
      <Paginacion
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={total}
        porPagina={porPagina}
        etiqueta="referencia"
        plural="referencias"
        ariaLabel="Paginación de existencias"
        alAnterior={alAnterior}
        alSiguiente={alSiguiente}
        alCambiarPorPagina={alCambiarPorPagina}
      />
    )}
  </>
)

export default TablaStock
