import Paginacion from './Paginacion'
import { useAutenticacion } from '../hooks/useAutenticacion'
import { formatearMoneda, formatearNumero } from '../utilidades/formatoMoneda'
import { formatearFecha } from '../utilidades/formatoFecha'

const claseEstado = (estado) =>
  estado === 'anulada'
    ? 'border-error/30 bg-error-suave text-error-fuerte'
    : 'border-exito/40 bg-exito-suave text-exito-fuerte'

const etiquetaEstado = (estado) =>
  estado === 'anulada' ? 'Anulada' : 'Emitida'

const nombreCliente = (factura) =>
  factura.cliente_nombre?.trim() || 'Consumidor final'

const TablaFacturas = ({
  facturas,
  pagina,
  totalPaginas,
  total,
  porPagina,
  alAnterior,
  alSiguiente,
  alCambiarPorPagina,
  alSeleccionar,
}) => {
  const { usuario } = useAutenticacion()
  const moneda = usuario?.empresa?.moneda || 'COP'
  const abrirDetalle = (factura) => alSeleccionar(factura)

  const manejarTecla = (evento, factura) => {
    if (evento.key !== 'Enter' && evento.key !== ' ') return
    evento.preventDefault()
    abrirDetalle(factura)
  }

  const chipEstado = (estado) => (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
        estado,
      )}`}
    >
      {etiquetaEstado(estado)}
    </span>
  )

  return (
    <>
      {/* Escritorio/tablet: tabla de ancho fijo con celdas que recortan. */}
      <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie md:block">
        <div className="overflow-x-auto rounded-lg">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-sm">
            <caption className="sr-only">Facturas emitidas</caption>
            <colgroup>
              <col className="w-[110px]" />
              <col className="w-[132px]" />
              <col className="w-[22%]" />
              <col />
              <col className="w-[136px]" />
              <col className="w-[104px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-borde bg-superficie-2 text-left font-mono text-xs uppercase tracking-wide text-tinta-suave">
                <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                  Factura
                </th>
                <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                  Fecha
                </th>
                <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                  Sucursal
                </th>
                <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                  Cliente
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-right font-medium sm:px-4"
                >
                  Total
                </th>
                <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {facturas.map((factura) => (
                <tr
                  key={factura.id}
                  tabIndex={0}
                  aria-label={`Ver detalle de la factura ${factura.numero_factura}`}
                  onClick={() => abrirDetalle(factura)}
                  onKeyDown={(evento) => manejarTecla(evento, factura)}
                  className="cursor-pointer align-middle transition-colors duration-150 hover:bg-superficie-2"
                >
                  <td className="px-3 py-3 font-mono text-xs font-medium text-tinta sm:px-4">
                    <span className="block truncate">
                      #{formatearNumero(factura.numero_factura)}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-tinta-suave sm:px-4">
                    <span
                      className="block truncate"
                      title={formatearFecha(factura.fecha)}
                    >
                      {formatearFecha(factura.fecha)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-tinta-suave sm:px-4">
                    <span
                      className="block truncate"
                      title={factura.sucursal_nombre}
                    >
                      {factura.sucursal_nombre || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-tinta sm:px-4">
                    <span
                      className="block truncate"
                      title={factura.cliente_nombre ?? ''}
                    >
                      {nombreCliente(factura)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-tinta sm:px-4">
                    {formatearMoneda(factura.total, moneda)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    {chipEstado(factura.estado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Móvil: tarjetas, sin scroll horizontal. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {facturas.map((factura) => (
          <li key={factura.id}>
            <button
              type="button"
              onClick={() => abrirDetalle(factura)}
              aria-label={`Ver detalle de la factura ${factura.numero_factura}`}
              className="w-full rounded-lg border border-borde bg-superficie p-4 text-left transition-colors duration-150 hover:border-borde-fuerte hover:bg-superficie-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-tinta-suave">Factura</p>
                  <p className="truncate font-display text-lg font-semibold tracking-tight text-tinta">
                    #{formatearNumero(factura.numero_factura)}
                  </p>
                </div>
                <span className="shrink-0">{chipEstado(factura.estado)}</span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-borde pt-3 text-sm">
                <div className="min-w-0">
                  <dt className="font-mono text-xs text-tinta-suave">Fecha</dt>
                  <dd className="mt-0.5 font-mono text-xs text-tinta">
                    {formatearFecha(factura.fecha)}
                  </dd>
                </div>
                <div className="min-w-0 text-right">
                  <dt className="font-mono text-xs text-tinta-suave">Total</dt>
                  <dd className="mt-0.5 font-mono tabular-nums text-tinta">
                    {formatearMoneda(factura.total, moneda)}
                  </dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="font-mono text-xs text-tinta-suave">
                    Sucursal
                  </dt>
                  <dd className="mt-0.5 truncate text-tinta-suave">
                    {factura.sucursal_nombre || '—'}
                  </dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="font-mono text-xs text-tinta-suave">Cliente</dt>
                  <dd className="mt-0.5 truncate text-tinta">
                    {nombreCliente(factura)}
                  </dd>
                </div>
              </dl>
            </button>
          </li>
        ))}
      </ul>

      {Number(total) > 0 && (
        <Paginacion
          pagina={pagina}
          totalPaginas={totalPaginas}
          total={total}
          porPagina={porPagina}
          etiqueta="factura"
          plural="facturas"
          ariaLabel="Paginación de facturas"
          alAnterior={alAnterior}
          alSiguiente={alSiguiente}
          alCambiarPorPagina={alCambiarPorPagina}
        />
      )}
    </>
  )
}

export default TablaFacturas
