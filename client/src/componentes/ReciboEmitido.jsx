import { useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import { useAutenticacion } from '../hooks/useAutenticacion'
import { anularFactura } from '../servicios/facturas'
import { formatearMoneda, formatearNumero } from '../utilidades/formatoMoneda'

const ReciboEmitido = ({ factura, alCerrar, alAnular }) => {
  const { usuario } = useAutenticacion()
  const moneda = usuario?.empresa?.moneda || 'COP'
  const [confirmando, setConfirmando] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [error, setError] = useState('')
  const [anuladaLocal, setAnuladaLocal] = useState(false)

  if (!factura) return null

  const cantidadLineas = factura.detalles?.length ?? 0
  const anulada = anuladaLocal || factura.estado === 'anulada'

  const confirmarAnulacion = async () => {
    setAnulando(true)
    setError('')
    try {
      const facturaAnulada = await anularFactura(factura.id)
      setAnuladaLocal(true)
      setConfirmando(false)
      alAnular?.(facturaAnulada)
    } catch (fallo) {
      setError(
        fallo?.message || 'No pudimos anular la venta. Inténtalo de nuevo.',
      )
      setConfirmando(false)
    } finally {
      setAnulando(false)
    }
  }

  return (
    <section
      aria-label={`Recibo de la factura ${factura.numero_factura}`}
      className="anim-aparecer relative overflow-hidden rounded-lg bg-petroleo p-5 text-white shadow-impresa sm:p-6"
    >
      <div
        className="grano pointer-events-none absolute inset-0 opacity-20 mix-blend-overlay"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(70% 70% at 100% 0%, oklch(0.52 0.11 160 / 0.45), transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-xs text-white/70">
            <span
              className={`h-2 w-2 rounded-full ${
                anulada ? 'bg-error' : 'bg-exito'
              }`}
              aria-hidden="true"
            />
            {anulada ? 'Factura anulada' : 'Venta emitida'}
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Factura #{factura.numero_factura}
          </h2>
          <p className="mt-1 text-sm text-white/70">
            {formatearNumero(cantidadLineas)}{' '}
            {cantidadLineas === 1 ? 'línea' : 'líneas'} ·{' '}
            {factura.cliente_nombre || 'Consumidor final'}
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-xs text-white/70">Total</p>
          <p className="font-mono text-2xl font-semibold tabular-nums sm:text-3xl">
            {formatearMoneda(factura.total, moneda)}
          </p>
        </div>
      </div>

      {anulada && (
        <p
          role="status"
          className="relative mt-4 flex items-start gap-3 rounded-md border border-error/40 bg-error/15 px-3.5 py-3 text-sm text-white/85"
        >
          <span
            className="mt-px font-mono text-xs font-semibold leading-5 text-error-suave"
            aria-hidden="true"
          >
            !
          </span>
          <span className="min-w-0 leading-5">
            Factura anulada. Se revirtió el stock de{' '}
            {formatearNumero(cantidadLineas)}{' '}
            {cantidadLineas === 1 ? 'línea' : 'líneas'}.
          </span>
        </p>
      )}

      <dl className="relative mt-5 grid gap-px overflow-hidden rounded-md bg-white/10 sm:grid-cols-3">
        {[
          ['Subtotal', factura.subtotal],
          ['Descuento', factura.descuento],
          ['Impuesto', factura.impuesto],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="bg-petroleo px-4 py-3">
            <dt className="font-mono text-xs text-white/70">{etiqueta}</dt>
            <dd className="mt-1 font-mono text-sm tabular-nums">
              {formatearMoneda(valor, moneda)}
            </dd>
          </div>
        ))}
      </dl>

      {error && (
        <div className="relative mt-4 text-tinta">
          <Alerta variante="error">{error}</Alerta>
        </div>
      )}

      <div className="relative mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={alCerrar}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/25 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10"
        >
          Nueva venta
        </button>

        {!anulada && !confirmando && (
          <button
            type="button"
            onClick={() => {
              setError('')
              setConfirmando(true)
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-error/40 px-4 text-sm font-medium text-error-suave transition-colors duration-150 hover:bg-error/15"
          >
            Anular venta
          </button>
        )}
      </div>

      {!anulada && confirmando && (
        <div className="relative mt-4 rounded-md border border-error/40 bg-error/10 p-4">
          <p className="text-sm leading-5 text-white/90">
            ¿Anular la factura #{factura.numero_factura}? Se revertirá el stock
            vendido y la acción no se puede deshacer.
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
  )
}

export default ReciboEmitido
