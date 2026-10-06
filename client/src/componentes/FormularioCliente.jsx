import { useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import CampoArea from './CampoArea'
import CampoEntrada from './CampoEntrada'

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const estadoInicial = (cliente) => ({
  sucursal_id:
    cliente?.sucursal_id !== undefined && cliente?.sucursal_id !== null
      ? String(cliente.sucursal_id)
      : '',
  nombre: cliente?.nombre ?? '',
  documento: cliente?.documento ?? '',
  telefono: cliente?.telefono ?? '',
  correo: cliente?.correo ?? '',
  direccion: cliente?.direccion ?? '',
  activo: cliente?.activo ?? true,
})

const validar = (campos, { editando }) => {
  const errores = {}

  if (!editando && !campos.sucursal_id.trim()) {
    errores.sucursal = 'Elige la sucursal del cliente.'
  }

  const nombre = campos.nombre.trim()
  if (!nombre) errores.nombre = 'Ingresa el nombre del cliente.'
  else if (nombre.length > 150) errores.nombre = 'Máximo 150 caracteres.'

  const documento = campos.documento.trim()
  if (documento.length > 30) errores.documento = 'Máximo 30 caracteres.'

  const telefono = campos.telefono.trim()
  if (telefono.length > 30) errores.telefono = 'Máximo 30 caracteres.'

  const correo = campos.correo.trim()
  if (correo.length > 150) errores.correo = 'Máximo 150 caracteres.'
  else if (correo && !PATRON_CORREO.test(correo)) {
    errores.correo = 'Ingresa un correo válido, por ejemplo nombre@dominio.com.'
  }

  const direccion = campos.direccion.trim()
  if (direccion.length > 200) errores.direccion = 'Máximo 200 caracteres.'

  return errores
}

const FormularioCliente = ({
  cliente,
  sucursales = [],
  cargandoSucursales = false,
  guardando = false,
  errorEnvio = '',
  alGuardar,
  alCancelar,
}) => {
  const editando = Boolean(cliente)
  const [campos, setCampos] = useState(() => estadoInicial(cliente))
  const [tocado, setTocado] = useState({})
  const [intento, setIntento] = useState(false)

  const errores = validar(campos, { editando })
  const mostrarError = (campo) =>
    intento || tocado[campo] ? errores[campo] ?? '' : ''

  const reiniciar = () => {
    setCampos(estadoInicial(null))
    setTocado({})
    setIntento(false)
  }

  const actualizar = (campo) => (valor) => {
    setCampos((previos) => ({ ...previos, [campo]: valor }))
  }

  const marcarTocado = (campo) => () => {
    setTocado((previos) => ({ ...previos, [campo]: true }))
  }

  const manejarEnvio = async (evento) => {
    evento.preventDefault()
    setIntento(true)
    if (Object.keys(errores).length > 0) return

    const payload = {
      nombre: campos.nombre.trim(),
      documento: campos.documento.trim(),
      telefono: campos.telefono.trim(),
      correo: campos.correo.trim(),
      direccion: campos.direccion.trim(),
    }
    if (editando) {
      payload.activo = campos.activo
    } else {
      payload.sucursal_id = Number(campos.sucursal_id)
    }

    const guardado = await alGuardar(payload)
    if (guardado) reiniciar()
  }

  return (
    <form
      onSubmit={manejarEnvio}
      noValidate
      className="anim-aparecer overflow-hidden rounded-lg border border-borde bg-superficie shadow-impresa"
    >
      <div className="seam-x h-px text-borde" aria-hidden="true" />

      <div className="border-b border-borde px-5 py-4">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {editando ? 'Editar cliente' : 'Nuevo cliente'}
        </h2>
        <p className="mt-1 text-sm text-tinta-suave">
          {editando
            ? `Cambios sobre ${cliente.nombre}.`
            : 'Registra un cliente para asociarlo a sus ventas.'}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        {editando ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-tinta">Sucursal</span>
            <p className="font-mono text-sm text-tinta-suave">
              {cliente.sucursal_nombre ?? `Sucursal #${cliente.sucursal_id}`}
            </p>
            <p className="text-xs text-tinta-suave">
              La sucursal no se puede cambiar una vez creado el cliente.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="cliente-sucursal"
              className="text-sm font-medium text-tinta"
            >
              Sucursal
              <span className="text-error" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <select
              id="cliente-sucursal"
              value={campos.sucursal_id}
              onChange={(evento) => actualizar('sucursal_id')(evento.target.value)}
              onBlur={marcarTocado('sucursal')}
              disabled={guardando || cargandoSucursales}
              aria-invalid={mostrarError('sucursal') ? true : undefined}
              className={`h-11 w-full rounded-md border bg-superficie px-3 text-base text-tinta transition-colors duration-150 disabled:opacity-60 ${
                mostrarError('sucursal')
                  ? 'border-error'
                  : 'border-borde hover:border-borde-fuerte'
              }`}
            >
              <option value="">
                {cargandoSucursales ? 'Cargando sucursales…' : 'Elige una sucursal'}
              </option>
              {sucursales.map((sucursal) => (
                <option key={sucursal.id} value={sucursal.id}>
                  {sucursal.nombre}
                </option>
              ))}
            </select>
            {mostrarError('sucursal') ? (
              <p role="alert" className="text-sm text-error">
                {mostrarError('sucursal')}
              </p>
            ) : (
              <p className="text-sm text-tinta-suave">
                El cliente pertenecerá a esta sede.
              </p>
            )}
          </div>
        )}

        <CampoEntrada
          id="cliente-nombre"
          etiqueta="Nombre"
          valor={campos.nombre}
          alCambiar={actualizar('nombre')}
          alSalir={marcarTocado('nombre')}
          error={mostrarError('nombre')}
          maxLength={150}
          enviando={guardando}
          requerido
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoEntrada
            id="cliente-documento"
            etiqueta="Documento"
            valor={campos.documento}
            alCambiar={actualizar('documento')}
            alSalir={marcarTocado('documento')}
            error={mostrarError('documento')}
            maxLength={30}
            ayuda="Opcional. Único por sucursal."
            enviando={guardando}
          />
          <CampoEntrada
            id="cliente-telefono"
            etiqueta="Teléfono"
            tipo="tel"
            inputMode="tel"
            valor={campos.telefono}
            alCambiar={actualizar('telefono')}
            alSalir={marcarTocado('telefono')}
            error={mostrarError('telefono')}
            maxLength={30}
            ayuda="Opcional."
            enviando={guardando}
          />
        </div>

        <CampoEntrada
          id="cliente-correo"
          etiqueta="Correo"
          tipo="email"
          inputMode="email"
          valor={campos.correo}
          alCambiar={actualizar('correo')}
          alSalir={marcarTocado('correo')}
          error={mostrarError('correo')}
          maxLength={150}
          ayuda="Opcional."
          enviando={guardando}
        />

        <CampoArea
          id="cliente-direccion"
          etiqueta="Dirección"
          valor={campos.direccion}
          alCambiar={actualizar('direccion')}
          alSalir={marcarTocado('direccion')}
          error={mostrarError('direccion')}
          maxLength={200}
          ayuda="Opcional. Máximo 200 caracteres."
          deshabilitado={guardando}
          filas={2}
        />

        {editando && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-tinta">
            <input
              type="checkbox"
              checked={campos.activo}
              onChange={(evento) =>
                setCampos((previos) => ({
                  ...previos,
                  activo: evento.target.checked,
                }))
              }
              disabled={guardando}
              className="h-5 w-5 rounded border-borde-fuerte accent-marca"
            />
            Cliente activo
          </label>
        )}

        {errorEnvio && <Alerta variante="error">{errorEnvio}</Alerta>}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Boton
            tipo="submit"
            cargando={guardando}
            className="flex-1 sm:flex-none"
          >
            {guardando
              ? 'Guardando…'
              : editando
                ? 'Guardar cambios'
                : 'Crear cliente'}
          </Boton>
          <Boton variante="sutil" onClick={alCancelar} deshabilitado={guardando}>
            {editando ? 'Cancelar edición' : 'Limpiar'}
          </Boton>
        </div>
      </div>
    </form>
  )
}

export default FormularioCliente
