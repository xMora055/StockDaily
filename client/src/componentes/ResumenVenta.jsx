import Alerta from './Alerta'
import Boton from './Boton'
import SelectorCliente from './SelectorCliente'
import { formatearMoneda } from '../utilidades/formatoMoneda'

const FilaTotal = ({ etiqueta, valor, negativo = false, fuerte = false }) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className={fuerte ? 'text-sm font-medium text-tinta' : 'text-sm text-tinta-suave'}>
      {etiqueta}
    </dt>
    <dd
      className={`font-mono tabular-nums ${
        fuerte
          ? 'text-lg font-semibold text-tinta'
          : 'text-sm text-tinta'
      }`}
    >
      {negativo && valor > 0 ? '−' : ''}
      {formatearMoneda(valor)}
    </dd>
  </div>
)

const ResumenVenta = ({
  totales,
  descuentoGlobal,
  alCambiarDescuento,
  alNormalizarDescuento,
  clientes = [],
  clienteRegistrado = null,
  alSeleccionarCliente,
  cargandoClientes = false,
  errorClientes = '',
  alReintentarClientes,
  clienteNombre,
  alCambiarClienteNombre,
  clienteDocumento,
  alCambiarClienteDocumento,
  enviando = false,
  errorEnvio = '',
  alEnviar,
  puedeEnviar = false,
}) => {
  const manejarEnvio = (evento) => {
    evento.preventDefault()
    if (!puedeEnviar || enviando) return
    alEnviar()
  }

  return (
    <form
      onSubmit={manejarEnvio}
      className="anim-aparecer overflow-hidden rounded-lg border border-borde bg-superficie shadow-impresa"
    >
      <div className="seam-x h-px text-borde" aria-hidden="true" />

      <div className="border-b border-borde px-4 py-3">
        <h2 className="font-display text-base font-semibold tracking-tight">
          Cobro
        </h2>
        <p className="mt-0.5 text-sm text-tinta-suave">
          Revisa los totales antes de emitir.
        </p>
      </div>

      <details className="border-b border-borde">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-tinta transition-colors duration-150 hover:bg-superficie-2">
          <span className="min-w-0 truncate">
            Cliente
            <span className="ml-2 font-normal text-tinta-suave">
              {clienteRegistrado?.nombre?.trim() ||
                clienteNombre.trim() ||
                'Consumidor final'}
            </span>
          </span>
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-tinta-suave"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="grid gap-3 px-4 pb-4">
          <SelectorCliente
            clientes={clientes}
            clienteRegistrado={clienteRegistrado}
            alSeleccionar={alSeleccionarCliente}
            cargando={cargandoClientes}
            error={errorClientes}
            alReintentar={alReintentarClientes}
            deshabilitado={enviando}
          />

          {clienteRegistrado ? (
            <div className="grid gap-3 rounded-md border border-marca/25 bg-marca-suave/50 px-3 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xs text-tinta-suave">
                  Nombre
                </span>
                <span className="text-sm text-tinta">
                  {clienteRegistrado.nombre}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xs text-tinta-suave">
                  Documento
                </span>
                <span className="font-mono text-sm tabular-nums text-tinta">
                  {clienteRegistrado.documento?.trim() || '—'}
                </span>
              </div>
              <p className="text-xs text-tinta-suave">
                La venta se asociará a este cliente registrado.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="pos-cliente-nombre"
                  className="text-sm font-medium text-tinta"
                >
                  Nombre
                </label>
                <input
                  id="pos-cliente-nombre"
                  type="text"
                  value={clienteNombre}
                  maxLength={150}
                  onChange={(evento) =>
                    alCambiarClienteNombre(evento.target.value)
                  }
                  placeholder="Consumidor final"
                  autoComplete="off"
                  className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 placeholder:text-tinta-suave/70 hover:border-borde-fuerte"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="pos-cliente-documento"
                  className="text-sm font-medium text-tinta"
                >
                  Documento
                </label>
                <input
                  id="pos-cliente-documento"
                  type="text"
                  value={clienteDocumento}
                  maxLength={30}
                  onChange={(evento) =>
                    alCambiarClienteDocumento(evento.target.value)
                  }
                  placeholder="Opcional"
                  autoComplete="off"
                  className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 placeholder:text-tinta-suave/70 hover:border-borde-fuerte"
                />
              </div>
              <p className="text-xs text-tinta-suave">
                Si lo dejas vacío, la venta se registra como consumidor final.
              </p>
            </>
          )}
        </div>
      </details>

      <div className="border-b border-borde px-4 py-4">
        <label
          htmlFor="pos-descuento-global"
          className="text-sm font-medium text-tinta"
        >
          Descuento global
        </label>
        <div className="relative mt-1.5">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-sm text-tinta-suave"
            aria-hidden="true"
          >
            $
          </span>
          <input
            id="pos-descuento-global"
            type="text"
            inputMode="decimal"
            value={descuentoGlobal}
            onChange={(evento) => alCambiarDescuento(evento.target.value)}
            onBlur={alNormalizarDescuento}
            className="h-11 w-full rounded-md border border-borde bg-superficie pl-7 pr-3 font-mono text-sm tabular-nums text-tinta transition-colors duration-150 hover:border-borde-fuerte"
          />
        </div>
        <p className="mt-1.5 text-xs text-tinta-suave">
          Monto absoluto sobre el total de la venta.
        </p>
      </div>

      <dl className="space-y-2.5 px-4 py-4">
        <FilaTotal etiqueta="Subtotal" valor={totales.subtotal} />
        <FilaTotal
          etiqueta="Descuento"
          valor={totales.descuento}
          negativo
        />
        <FilaTotal etiqueta="Impuesto" valor={totales.impuesto} />
        <div className="border-t border-borde pt-2.5">
          <FilaTotal etiqueta="Total" valor={totales.total} fuerte />
        </div>
      </dl>

      <div className="flex flex-col gap-3 border-t border-borde px-4 pb-4 pt-4">
        {errorEnvio && <Alerta variante="error">{errorEnvio}</Alerta>}
        <Boton
          tipo="submit"
          variante="acento"
          cargando={enviando}
          deshabilitado={!puedeEnviar}
          className="w-full"
        >
          {enviando ? 'Emitiendo…' : 'Emitir factura'}
        </Boton>
        {!puedeEnviar && !enviando && (
          <p className="text-center text-xs text-tinta-suave">
            Selecciona una sucursal y agrega al menos un producto.
          </p>
        )}
      </div>
    </form>
  )
}

export default ResumenVenta
