import { useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import CampoArea from './CampoArea'
import { formatearNumero } from '../utilidades/formatoMoneda'

const TIPOS = [
  { valor: 'carga_inicial', etiqueta: 'Carga inicial' },
  { valor: 'ajuste', etiqueta: 'Ajuste' },
]

const DIRECCIONES = [
  { valor: 'entrada', etiqueta: 'Entrada', signo: '+' },
  { valor: 'salida', etiqueta: 'Salida', signo: '−' },
]

const COTA_CANTIDAD = 1000000

const estadoInicial = (sucursalId = '') => ({
  producto_id: '',
  sucursal_id: sucursalId,
  tipo: 'carga_inicial',
  direccion: 'entrada',
  cantidad: '',
  observacion: '',
})

const sanearEntero = (valor) => valor.replace(/[^\d]/g, '').slice(0, 7)

const validar = (campos) => {
  const errores = {}

  if (!campos.producto_id) errores.producto = 'Selecciona un producto.'
  if (!campos.sucursal_id) errores.sucursal = 'Selecciona una sucursal.'
  if (!TIPOS.some((tipo) => tipo.valor === campos.tipo)) {
    errores.tipo = 'Selecciona el tipo de movimiento.'
  }

  const cantidad = Number(campos.cantidad)
  if (campos.cantidad === '' || !Number.isInteger(cantidad)) {
    errores.cantidad = 'Ingresa una cantidad entera.'
  } else if (cantidad <= 0) {
    errores.cantidad = 'La cantidad debe ser mayor que cero.'
  } else if (cantidad > COTA_CANTIDAD) {
    errores.cantidad = `Máximo ${formatearNumero(COTA_CANTIDAD)} por movimiento.`
  }

  if (campos.observacion.trim().length > 255) {
    errores.observacion = 'Máximo 255 caracteres.'
  }

  return errores
}

const FormularioMovimiento = ({
  productos = [],
  sucursales = [],
  cargando = false,
  errorCatalogos = '',
  alReintentar,
  guardando = false,
  errorEnvio = '',
  alGuardar,
}) => {
  const [campos, setCampos] = useState(() => estadoInicial())
  const [tocado, setTocado] = useState({})
  const [intento, setIntento] = useState(false)

  // La sucursal elegida o, por defecto, la primera del catálogo.
  const sucursalId =
    campos.sucursal_id ||
    (sucursales.length > 0 ? String(sucursales[0].id) : '')

  const errores = validar({ ...campos, sucursal_id: sucursalId })
  const mostrandoError = (campo) =>
    intento || tocado[campo] ? errores[campo] : ''

  const actualizar = (campo) => (valor) => {
    setCampos((previos) => ({ ...previos, [campo]: valor }))
  }

  const marcarTocado = (campo) => () => {
    setTocado((previos) => ({ ...previos, [campo]: true }))
  }

  const limpiar = () => {
    setCampos(estadoInicial(campos.sucursal_id))
    setTocado({})
    setIntento(false)
  }

  const manejarEnvio = async (evento) => {
    evento.preventDefault()
    setIntento(true)
    if (Object.keys(errores).length > 0) return

    const cantidad = Number(campos.cantidad)
    const firmada = campos.direccion === 'salida' ? -cantidad : cantidad

    const guardado = await alGuardar({
      producto_id: Number(campos.producto_id),
      sucursal_id: Number(sucursalId),
      tipo: campos.tipo,
      cantidad: firmada,
      observacion: campos.observacion.trim() || null,
    })

    if (guardado) {
      // Conserva producto y sucursal para registrar varios movimientos seguidos.
      setCampos((previos) => ({
        ...estadoInicial(previos.sucursal_id),
        producto_id: previos.producto_id,
        tipo: previos.tipo,
        direccion: previos.direccion,
      }))
      setTocado({})
      setIntento(false)
    }
  }

  const renderContenido = () => {
    if (cargando) {
      return (
        <div className="space-y-4" aria-live="polite">
          <p className="sr-only">Cargando catálogos…</p>
          {[0, 1, 2].map((indice) => (
            <div
              key={indice}
              className="h-11 animate-pulse rounded-md bg-superficie-2"
            />
          ))}
        </div>
      )
    }

    if (errorCatalogos) {
      return (
        <div className="flex flex-col items-start gap-4">
          <Alerta variante="error">{errorCatalogos}</Alerta>
          <Boton variante="secundario" onClick={alReintentar}>
            Reintentar
          </Boton>
        </div>
      )
    }

    if (productos.length === 0 || sucursales.length === 0) {
      return (
        <p className="text-sm text-tinta-suave">
          {productos.length === 0 && sucursales.length === 0
            ? 'Necesitas al menos un producto y una sucursal para registrar movimientos.'
            : productos.length === 0
              ? 'Necesitas registrar un producto antes de mover inventario.'
              : 'Necesitas registrar una sucursal antes de mover inventario.'}
        </p>
      )
    }

    return (
      <form onSubmit={manejarEnvio} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="movimiento-producto"
            className="text-sm font-medium text-tinta"
          >
            Producto
            <span className="text-error" aria-hidden="true">
              {' '}
              *
            </span>
          </label>
          <select
            id="movimiento-producto"
            value={campos.producto_id}
            onChange={(evento) => actualizar('producto_id')(evento.target.value)}
            onBlur={marcarTocado('producto')}
            disabled={guardando}
            aria-invalid={mostrandoError('producto') ? true : undefined}
            className={`h-11 w-full rounded-md border bg-superficie px-3 text-base text-tinta transition-colors duration-150 disabled:opacity-60 ${
              mostrandoError('producto')
                ? 'border-error'
                : 'border-borde hover:border-borde-fuerte'
            }`}
          >
            <option value="">Selecciona…</option>
            {productos.map((producto) => (
              <option key={producto.id} value={producto.id}>
                {producto.codigo
                  ? `${producto.nombre} · ${producto.codigo}`
                  : producto.nombre}
              </option>
            ))}
          </select>
          {mostrandoError('producto') && (
            <p role="alert" className="text-sm text-error">
              {mostrandoError('producto')}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="movimiento-sucursal"
              className="text-sm font-medium text-tinta"
            >
              Sucursal
              <span className="text-error" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <select
              id="movimiento-sucursal"
              value={sucursalId}
              onChange={(evento) =>
                actualizar('sucursal_id')(evento.target.value)
              }
              onBlur={marcarTocado('sucursal')}
              disabled={guardando}
              aria-invalid={mostrandoError('sucursal') ? true : undefined}
              className={`h-11 w-full rounded-md border bg-superficie px-3 text-base text-tinta transition-colors duration-150 disabled:opacity-60 ${
                mostrandoError('sucursal')
                  ? 'border-error'
                  : 'border-borde hover:border-borde-fuerte'
              }`}
            >
              <option value="">Selecciona…</option>
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </option>
              ))}
            </select>
            {mostrandoError('sucursal') && (
              <p role="alert" className="text-sm text-error">
                {mostrandoError('sucursal')}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="movimiento-tipo"
              className="text-sm font-medium text-tinta"
            >
              Tipo
              <span className="text-error" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <select
              id="movimiento-tipo"
              value={campos.tipo}
              onChange={(evento) => actualizar('tipo')(evento.target.value)}
              disabled={guardando}
              className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte disabled:opacity-60"
            >
              {TIPOS.map((tipo) => (
                <option key={tipo.valor} value={tipo.valor}>
                  {tipo.etiqueta}
                </option>
              ))}
            </select>
            <p className="text-sm text-tinta-suave">
              Las ventas generan salidas por su cuenta.
            </p>
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-tinta">Dirección</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-borde bg-borde">
            {DIRECCIONES.map((direccion) => (
              <label
                key={direccion.valor}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-2 bg-superficie px-3 text-sm font-medium text-tinta-suave transition-colors duration-150 hover:bg-superficie-2 has-[:checked]:bg-marca-suave has-[:checked]:font-semibold has-[:checked]:text-marca-fuerte has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-marca has-[:focus-visible]:ring-inset"
              >
                <input
                  type="radio"
                  name="movimiento-direccion"
                  value={direccion.valor}
                  checked={campos.direccion === direccion.valor}
                  onChange={() => actualizar('direccion')(direccion.valor)}
                  disabled={guardando}
                  className="sr-only"
                />
                <span className="font-mono" aria-hidden="true">
                  {direccion.signo}
                </span>
                {direccion.etiqueta}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="movimiento-cantidad"
            className="text-sm font-medium text-tinta"
          >
            Cantidad
            <span className="text-error" aria-hidden="true">
              {' '}
              *
            </span>
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-base text-tinta-suave"
              aria-hidden="true"
            >
              {campos.direccion === 'salida' ? '−' : '+'}
            </span>
            <input
              id="movimiento-cantidad"
              type="text"
              inputMode="numeric"
              value={campos.cantidad}
              onChange={(evento) =>
                actualizar('cantidad')(sanearEntero(evento.target.value))
              }
              onBlur={marcarTocado('cantidad')}
              disabled={guardando}
              placeholder="0"
              aria-invalid={mostrandoError('cantidad') ? true : undefined}
              className={`h-11 w-full rounded-md border bg-superficie pl-9 pr-3 font-mono text-base tabular-nums text-tinta transition-colors duration-150 placeholder:text-tinta-suave/70 disabled:opacity-60 ${
                mostrandoError('cantidad')
                  ? 'border-error'
                  : 'border-borde hover:border-borde-fuerte'
              }`}
            />
          </div>
          {mostrandoError('cantidad') ? (
            <p role="alert" className="text-sm text-error">
              {mostrandoError('cantidad')}
            </p>
          ) : (
            <p className="text-sm text-tinta-suave">
              Entero positivo; el signo lo define la dirección.
            </p>
          )}
        </div>

        <CampoArea
          id="movimiento-observacion"
          etiqueta="Observación"
          valor={campos.observacion}
          alCambiar={actualizar('observacion')}
          alSalir={marcarTocado('observacion')}
          error={mostrandoError('observacion')}
          ayuda="Opcional. Máximo 255 caracteres."
          maxLength={255}
          filas={2}
          deshabilitado={guardando}
        />

        {errorEnvio && <Alerta variante="error">{errorEnvio}</Alerta>}

        <div className="flex flex-wrap items-center gap-3 border-t border-borde pt-4">
          <Boton
            tipo="submit"
            cargando={guardando}
            className="flex-1 sm:flex-none"
          >
            {guardando ? 'Registrando…' : 'Registrar movimiento'}
          </Boton>
          <Boton variante="sutil" onClick={limpiar} deshabilitado={guardando}>
            Limpiar
          </Boton>
        </div>
      </form>
    )
  }

  return (
    <div className="anim-aparecer overflow-hidden rounded-lg border border-borde bg-superficie shadow-impresa">
      <div className="seam-x h-px text-borde" aria-hidden="true" />

      <div className="border-b border-borde px-5 py-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Registrar movimiento
        </h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Carga inventario inicial o corrige existencias con un ajuste.
        </p>
      </div>

      <div className="px-5 py-5">{renderContenido()}</div>
    </div>
  )
}

export default FormularioMovimiento
