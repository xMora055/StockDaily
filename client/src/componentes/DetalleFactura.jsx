import { useEffect, useRef, useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import { useFacturaDetalle } from '../hooks/useFacturaDetalle'
import { anularFactura } from '../servicios/facturas'
import { formatearMoneda, formatearNumero } from '../utilidades/formatoMoneda'
import { formatearFechaHora } from '../utilidades/formatoFecha'

const MENSAJE_ANULACION =
  'No pudimos anular la venta. Inténtalo de nuevo.'

const claseEstado = (estado) =>
  estado === 'anulada'
    ? 'border-error/30 bg-error-suave text-error-fuerte'
    : 'border-exito/40 bg-exito-suave text-exito-fuerte'

const etiquetaEstado = (estado) =>
  estado === 'anulada' ? 'Anulada' : 'Emitida'

const nombreCliente = (factura) =>
  factura.cliente_nombre?.trim() || 'Consumidor final'

const Dato = ({ etiqueta, children }) => (
  <div className="min-w-0">
    <dt className="font-mono text-xs uppercase tracking-wide text-tinta-suave">
      {etiqueta}
    </dt>
    <dd className="mt-1 truncate text-sm text-tinta">{children}</dd>
  </div>
)

const DetalleFactura = ({ facturaId, alCerrar, alAnular }) => {
  const { factura, cargando, error, recargar, actualizarFactura } =
    useFacturaDetalle(facturaId)
  const refDialogo = useRef(null)

  const [confirmando, setConfirmando] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [errorAnulacion, setErrorAnulacion] = useState('')
  const [exitoAnulacion, setExitoAnulacion] = useState('')

  useEffect(() => {
    const dialogo = refDialogo.current
    if (dialogo && !dialogo.open) dialogo.showModal()
  }, [])

  const cerrar = () => {
    const dialogo = refDialogo.current
    if (dialogo?.open) {
      dialogo.close()
    } else {
      alCerrar?.()
    }
  }

  const manejarClicFondo = (evento) => {
    if (evento.target === refDialogo.current) cerrar()
  }

  const confirmarAnulacion = async () => {
    if (!factura) return
    setAnulando(true)
    setErrorAnulacion('')
    setExitoAnulacion('')
    try {
      const anulada = await anularFactura(factura.id)
      actualizarFactura(anulada)
      setConfirmando(false)
      setExitoAnulacion('Factura anulada. Se revirtió el stock vendido.')
      alAnular?.(anulada)
    } catch (fallo) {
      if (fallo?.estado === 409) {
        // Ya estaba anulada en el servidor: reconciliamos el estado local.
        actualizarFactura({ ...factura, estado: 'anulada' })
        setConfirmando(false)
        setExitoAnulacion('La factura ya estaba anulada. Actualizamos su estado.')
        alAnular?.(null)
      } else {
        setErrorAnulacion(fallo?.message || MENSAJE_ANULACION)
      }
    } finally {
      setAnulando(false)
    }
  }

  const renderCuerpo = () => {
    if (cargando && !factura) {
      return (
        <div className="space-y-3" aria-live="polite">
          <p className="sr-only">Cargando factura…</p>
          <div className="h-24 animate-pulse rounded-md bg-superficie-2" />
          <div className="h-40 animate-pulse rounded-md bg-superficie-2" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-error/30 bg-error-suave p-5">
          <Alerta variante="error">{error}</Alerta>
          <Boton variante="secundario" onClick={recargar}>
            Reintentar
          </Boton>
        </div>
      )
    }

    if (!factura) return null

    const anulada = factura.estado === 'anulada'
    const detalles = factura.detalles ?? []

    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-wide text-tinta-suave">
                Factura
              </p>
              <h2
                id="detalle-factura-titulo"
                className="truncate font-display text-2xl font-semibold tracking-tight text-tinta"
              >
                #{formatearNumero(factura.numero_factura)}
              </h2>
            </div>
            <span
              className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${claseEstado(
                factura.estado,
              )}`}
            >
              {etiquetaEstado(factura.estado)}
            </span>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-borde py-4 sm:grid-cols-3">
            <Dato etiqueta="Fecha">{formatearFechaHora(factura.fecha)}</Dato>
            <Dato etiqueta="Sucursal">{factura.sucursal_nombre || '—'}</Dato>
            <Dato etiqueta="Cliente">{nombreCliente(factura)}</Dato>
            {factura.cliente_documento && (
              <Dato etiqueta="Documento">{factura.cliente_documento}</Dato>
            )}
            {factura.anulada_en && (
              <Dato etiqueta="Anulada">
                {formatearFechaHora(factura.anulada_en)}
              </Dato>
            )}
          </dl>
        </div>

        {anulada && (
          <Alerta variante="error">
            Factura anulada. El stock vendido fue revertido.
          </Alerta>
        )}

        <section aria-labelledby="detalle-factura-lineas">
          <h3
            id="detalle-factura-lineas"
            className="border-b border-borde pb-2 font-display text-sm font-semibold tracking-tight text-tinta"
          >
            Líneas
          </h3>

          <div className="mt-3 hidden overflow-hidden rounded-md border border-borde sm:block">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col />
                <col className="w-[84px]" />
                <col className="w-[128px]" />
                <col className="w-[128px]" />
                <col className="w-[128px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-borde bg-superficie-2 text-left font-mono text-xs uppercase tracking-wide text-tinta-suave">
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Producto
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Cant.
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Precio unit.
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Subtotal
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-right font-medium"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {detalles.map((linea) => (
                  <tr key={linea.id} className="align-middle">
                    <td className="px-3 py-2.5">
                      <span
                        className="block truncate font-medium text-tinta"
                        title={linea.producto_nombre}
                      >
                        {linea.producto_nombre}
                      </span>
                      <span
                        className="mt-0.5 block truncate font-mono text-xs text-tinta-suave"
                        title={linea.producto_codigo}
                      >
                        {linea.producto_codigo || 'Sin código'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-tinta-suave">
                      {formatearNumero(linea.cantidad)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-tinta-suave">
                      {formatearMoneda(linea.precio_unitario)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-tinta-suave">
                      {formatearMoneda(linea.subtotal)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums text-tinta">
                      {formatearMoneda(linea.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-3 flex flex-col gap-2 sm:hidden">
            {detalles.map((linea) => (
              <li
                key={linea.id}
                className="rounded-md border border-borde bg-superficie-2/50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-tinta">
                      {linea.producto_nombre}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-tinta-suave">
                      {linea.producto_codigo || 'Sin código'}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono tabular-nums text-tinta">
                    {formatearMoneda(linea.total)}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-tinta-suave">
                  {formatearNumero(linea.cantidad)} ×{' '}
                  {formatearMoneda(linea.precio_unitario)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="detalle-factura-totales">
          <h3 id="detalle-factura-totales" className="sr-only">
            Totales
          </h3>
          <dl className="ml-auto w-full max-w-xs divide-y divide-borde border-y border-borde">
            {[
              ['Subtotal', factura.subtotal],
              ['Descuento', factura.descuento],
              ['Impuesto', factura.impuesto],
            ].map(([etiqueta, valor]) => (
              <div
                key={etiqueta}
                className="flex items-center justify-between gap-3 py-2"
              >
                <dt className="text-sm text-tinta-suave">{etiqueta}</dt>
                <dd className="font-mono tabular-nums text-sm text-tinta">
                  {formatearMoneda(valor)}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="font-display text-base font-semibold text-tinta">
                Total
              </dt>
              <dd className="font-mono text-lg font-semibold tabular-nums text-tinta">
                {formatearMoneda(factura.total)}
              </dd>
            </div>
          </dl>
        </section>

        {exitoAnulacion && <Alerta variante="exito">{exitoAnulacion}</Alerta>}
        {errorAnulacion && <Alerta variante="error">{errorAnulacion}</Alerta>}

        {factura.estado === 'emitida' && (
          <section className="border-t border-borde pt-5">
            {!confirmando ? (
              <Boton
                variante="peligro"
                onClick={() => {
                  setErrorAnulacion('')
                  setExitoAnulacion('')
                  setConfirmando(true)
                }}
              >
                Anular venta
              </Boton>
            ) : (
              <div className="rounded-md border border-error/30 bg-error-suave p-4">
                <p className="text-sm leading-5 text-error-fuerte">
                  ¿Anular la factura #{formatearNumero(factura.numero_factura)}?
                  Se revertirá el stock vendido y la acción no se puede
                  deshacer.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Boton
                    variante="secundario"
                    deshabilitado={anulando}
                    onClick={() => setConfirmando(false)}
                  >
                    Cancelar
                  </Boton>
                  <Boton
                    variante="peligro"
                    cargando={anulando}
                    onClick={confirmarAnulacion}
                  >
                    Sí, anular venta
                  </Boton>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    )
  }

  return (
    <dialog
      ref={refDialogo}
      onClose={alCerrar}
      onClick={manejarClicFondo}
      aria-labelledby="detalle-factura-titulo"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-2xl overflow-hidden border-0 bg-superficie p-0 text-tinta shadow-impresa backdrop:bg-tinta/40"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-borde px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span
              className="grid h-8 w-8 place-items-center rounded-md bg-petroleo font-mono text-xs font-semibold text-fondo"
              aria-hidden="true"
            >
              SD
            </span>
            <p className="font-display text-base font-semibold tracking-tight">
              Detalle de factura
            </p>
          </div>
          <Boton variante="sutil" className="px-3" onClick={cerrar}>
            Cerrar
          </Boton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {renderCuerpo()}
        </div>
      </div>
    </dialog>
  )
}

export default DetalleFactura
