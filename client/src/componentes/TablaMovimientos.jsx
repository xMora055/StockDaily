import Paginacion from './Paginacion'
import { formatearNumero } from '../utilidades/formatoMoneda'

const ETIQUETAS_TIPO = {
  carga_inicial: 'Carga inicial',
  ajuste: 'Ajuste',
  salida_venta: 'Salida venta',
  anulacion: 'Anulación',
}

const claseTipo = (tipo) => {
  switch (tipo) {
    case 'carga_inicial':
      return 'border-exito/40 bg-exito-suave text-exito-fuerte'
    case 'ajuste':
      return 'border-marca/25 bg-marca-suave text-marca-fuerte'
    case 'salida_venta':
      return 'border-error/30 bg-error-suave text-error-fuerte'
    default:
      return 'border-borde bg-superficie-2 text-tinta-suave'
  }
}

const formatearFecha = (valor) => {
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return null
  const partes = new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(fecha)
  const valorDe = (tipo) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  const soloFecha = `${valorDe('day')} ${valorDe('month')} ${valorDe('year')}`
  const hora = new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha)
  return { fecha: soloFecha, hora, completa: `${soloFecha}, ${hora}` }
}

const formatearFechaTexto = (valor) => {
  const partes = formatearFecha(valor)
  return partes ? partes.completa : '—'
}

const formatearCantidad = (valor) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'
  if (numero === 0) return '0'
  const signo = numero > 0 ? '+' : '−'
  return `${signo}${formatearNumero(Math.abs(numero))}`
}

const TablaMovimientos = ({
  movimientos,
  pagina,
  totalPaginas,
  total,
  porPagina,
  alAnterior,
  alSiguiente,
  alCambiarPorPagina,
}) => (
  <>
    {/* Escritorio/tablet: scroll horizontal y columnas porcentuales que suman 100%. */}
    <div className="hidden overflow-hidden rounded-lg border border-borde bg-superficie md:block">
      <div className="overflow-x-auto rounded-lg">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
          <caption className="sr-only">Historial de movimientos</caption>
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[26%]" />
            <col className="w-[15%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-borde bg-superficie-2 text-left font-mono text-xs uppercase tracking-wide text-tinta-suave">
              <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                Fecha
              </th>
              <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                Producto
              </th>
              <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                Sucursal
              </th>
              <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                Tipo
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-right font-medium sm:px-4"
              >
                Cantidad
              </th>
              <th scope="col" className="px-3 py-3 font-medium sm:px-4">
                Observación
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {movimientos.map((movimiento) => {
              const entrada = Number(movimiento.cantidad) > 0
              const fecha = formatearFecha(movimiento.creado_en)
              return (
                <tr key={movimiento.id} className="align-middle">
                  <td className="px-3 py-3 font-mono text-xs text-tinta-suave sm:px-4">
                    <span className="block truncate" title={fecha?.completa}>
                      {fecha?.fecha ?? '—'}
                    </span>
                    <span className="block truncate" title={fecha?.completa}>
                      {fecha?.hora ?? ''}
                    </span>
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <span
                      className="block truncate font-medium text-tinta"
                      title={movimiento.producto_nombre}
                    >
                      {movimiento.producto_nombre}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-tinta-suave sm:px-4">
                    <span
                      className="block truncate"
                      title={movimiento.sucursal_nombre}
                    >
                      {movimiento.sucursal_nombre}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseTipo(
                        movimiento.tipo,
                      )}`}
                    >
                      {ETIQUETAS_TIPO[movimiento.tipo] ?? movimiento.tipo}
                    </span>
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums sm:px-4 ${
                      entrada ? 'text-exito-fuerte' : 'text-error-fuerte'
                    }`}
                  >
                    {formatearCantidad(movimiento.cantidad)}
                  </td>
                  <td className="px-3 py-3 text-tinta-suave sm:px-4">
                    <span
                      className="block truncate"
                      title={movimiento.observacion ?? ''}
                    >
                      {movimiento.observacion?.trim() || '—'}
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
      {movimientos.map((movimiento) => {
        const entrada = Number(movimiento.cantidad) > 0
        return (
          <li
            key={movimiento.id}
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-tinta">
                  {movimiento.producto_nombre}
                </p>
                <p className="mt-0.5 font-mono text-xs text-tinta-suave">
                  {formatearFechaTexto(movimiento.creado_en)}
                </p>
              </div>
              <span
                className={`shrink-0 font-mono tabular-nums ${
                  entrada ? 'text-exito-fuerte' : 'text-error-fuerte'
                }`}
              >
                {formatearCantidad(movimiento.cantidad)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseTipo(
                  movimiento.tipo,
                )}`}
              >
                {ETIQUETAS_TIPO[movimiento.tipo] ?? movimiento.tipo}
              </span>
              <span className="min-w-0 truncate text-sm text-tinta-suave">
                {movimiento.sucursal_nombre}
              </span>
            </div>

            {movimiento.observacion?.trim() && (
              <p className="mt-3 break-words text-sm text-tinta-suave">
                {movimiento.observacion}
              </p>
            )}
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
        etiqueta="movimiento"
        plural="movimientos"
        ariaLabel="Paginación de movimientos"
        alAnterior={alAnterior}
        alSiguiente={alSiguiente}
        alCambiarPorPagina={alCambiarPorPagina}
      />
    )}
  </>
)

export default TablaMovimientos
