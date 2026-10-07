import { useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import CampoEntrada from './CampoEntrada'

const estadoInicial = (usuario) => ({
  empresaId: usuario?.empresa_id ?? '',
  nombre: usuario?.nombre ?? '',
  correo: usuario?.correo ?? '',
  activo: usuario?.activo ?? true,
})

const validar = (campos, editando) => {
  const errores = {}

  if (!editando) {
    const empresaId = Number(campos.empresaId)
    if (!Number.isFinite(empresaId) || empresaId <= 0) {
      errores.empresaId = 'Selecciona una empresa.'
    }
  }

  const nombre = campos.nombre.trim()
  if (!nombre) errores.nombre = 'Ingresa el nombre del administrador.'
  else if (nombre.length > 150) errores.nombre = 'Máximo 150 caracteres.'

  const correo = campos.correo.trim()
  if (!correo) errores.correo = 'Ingresa el correo del administrador.'
  else if (correo.length > 150) errores.correo = 'Máximo 150 caracteres.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
    errores.correo = 'Ingresa un correo válido.'

  return errores
}

const FormularioUsuario = ({
  usuario,
  empresas = [],
  guardando = false,
  errorEnvio = '',
  alGuardar,
  alCancelar,
}) => {
  const editando = Boolean(usuario)
  const [campos, setCampos] = useState(() => estadoInicial(usuario))
  const [tocado, setTocado] = useState({})
  const [intento, setIntento] = useState(false)

  const errores = validar(campos, editando)
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
      correo: campos.correo.trim().toLowerCase(),
    }

    if (!editando) {
      payload.empresa_id = Number(campos.empresaId)
    } else {
      payload.activo = campos.activo
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
          {editando ? 'Editar administrador' : 'Nuevo administrador'}
        </h2>
        <p className="mt-1 text-sm text-tinta-suave">
          {editando
            ? `Cambios sobre ${usuario.nombre}.`
            : 'Crea un administrador adicional para una empresa existente.'}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        {!editando && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="usuario-empresa"
              className="text-sm font-medium text-tinta"
            >
              Empresa
              <span className="text-error" aria-hidden="true">
                {' '}
                *
              </span>
            </label>
            <select
              id="usuario-empresa"
              value={campos.empresaId}
              onChange={(evento) => actualizar('empresaId')(evento.target.value)}
              disabled={guardando}
              aria-invalid={mostrarError('empresaId') ? true : undefined}
              className={`h-11 w-full rounded-md border bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte disabled:opacity-60 ${
                mostrarError('empresaId')
                  ? 'border-error'
                  : 'border-borde hover:border-borde-fuerte'
              }`}
            >
              <option value="">Selecciona una empresa</option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </select>
            {mostrarError('empresaId') && (
              <p className="text-sm text-error">{errores.empresaId}</p>
            )}
          </div>
        )}

        <CampoEntrada
          id="usuario-nombre"
          etiqueta="Nombre"
          valor={campos.nombre}
          alCambiar={actualizar('nombre')}
          alSalir={marcarTocado('nombre')}
          error={mostrarError('nombre')}
          maxLength={150}
          enviando={guardando}
          requerido
        />

        <CampoEntrada
          id="usuario-correo"
          etiqueta="Correo"
          tipo="email"
          inputMode="email"
          valor={campos.correo}
          alCambiar={actualizar('correo')}
          alSalir={marcarTocado('correo')}
          error={mostrarError('correo')}
          maxLength={150}
          enviando={guardando}
          requerido
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
            Administrador activo
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
                : 'Crear administrador'}
          </Boton>
          <Boton variante="sutil" onClick={alCancelar} deshabilitado={guardando}>
            {editando ? 'Cancelar edición' : 'Limpiar'}
          </Boton>
        </div>
      </div>
    </form>
  )
}

export default FormularioUsuario
