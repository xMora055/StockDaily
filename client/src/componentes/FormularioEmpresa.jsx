import { useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import CampoArea from './CampoArea'
import CampoEntrada from './CampoEntrada'

const MONEDA_POR_DEFECTO = 'COP'

const estadoInicial = (empresa) => ({
  nombre: empresa?.nombre ?? '',
  documento: empresa?.documento ?? '',
  moneda: empresa?.moneda ?? MONEDA_POR_DEFECTO,
  direccion: empresa?.direccion ?? '',
  telefono: empresa?.telefono ?? '',
  correo: empresa?.correo ?? '',
  adminNombre: '',
  adminCorreo: '',
  activo: empresa?.activo ?? true,
})

const validar = (campos, editando) => {
  const errores = {}

  const nombre = campos.nombre.trim()
  if (!nombre) errores.nombre = 'Ingresa el nombre de la empresa.'
  else if (nombre.length > 150) errores.nombre = 'Máximo 150 caracteres.'

  const documento = campos.documento.trim()
  if (documento.length > 30) errores.documento = 'Máximo 30 caracteres.'

  const moneda = campos.moneda.trim()
  if (!moneda) errores.moneda = 'Selecciona una moneda.'
  else if (moneda.length > 3) errores.moneda = 'Máximo 3 caracteres.'

  const direccion = campos.direccion.trim()
  if (direccion.length > 200) errores.direccion = 'Máximo 200 caracteres.'

  const telefono = campos.telefono.trim()
  if (telefono.length > 30) errores.telefono = 'Máximo 30 caracteres.'

  const correo = campos.correo.trim()
  if (correo.length > 150) errores.correo = 'Máximo 150 caracteres.'

  if (!editando) {
    const adminNombre = campos.adminNombre.trim()
    if (!adminNombre) errores.adminNombre = 'Ingresa el nombre del administrador.'
    else if (adminNombre.length > 150)
      errores.adminNombre = 'Máximo 150 caracteres.'

    const adminCorreo = campos.adminCorreo.trim()
    if (!adminCorreo) errores.adminCorreo = 'Ingresa el correo del administrador.'
    else if (adminCorreo.length > 150)
      errores.adminCorreo = 'Máximo 150 caracteres.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminCorreo))
      errores.adminCorreo = 'Ingresa un correo válido.'
  }

  return errores
}

const FormularioEmpresa = ({
  empresa,
  guardando = false,
  errorEnvio = '',
  alGuardar,
  alCancelar,
}) => {
  const editando = Boolean(empresa)
  const [campos, setCampos] = useState(() => estadoInicial(empresa))
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
      documento: campos.documento.trim(),
      moneda: campos.moneda.trim().toUpperCase() || MONEDA_POR_DEFECTO,
      direccion: campos.direccion.trim(),
      telefono: campos.telefono.trim(),
      correo: campos.correo.trim(),
    }

    if (!editando) {
      payload.admin = {
        nombre: campos.adminNombre.trim(),
        correo: campos.adminCorreo.trim().toLowerCase(),
      }
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
          {editando ? 'Editar empresa' : 'Nueva empresa'}
        </h2>
        <p className="mt-1 text-sm text-tinta-suave">
          {editando
            ? `Cambios sobre ${empresa.nombre}.`
            : 'Registra una empresa y su primer administrador.'}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        <CampoEntrada
          id="empresa-nombre"
          etiqueta="Nombre de la empresa"
          valor={campos.nombre}
          alCambiar={actualizar('nombre')}
          alSalir={marcarTocado('nombre')}
          error={mostrarError('nombre')}
          maxLength={150}
          ayuda="Razón social o nombre comercial."
          enviando={guardando}
          requerido
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoEntrada
            id="empresa-documento"
            etiqueta="Documento / NIT"
            valor={campos.documento}
            alCambiar={actualizar('documento')}
            alSalir={marcarTocado('documento')}
            error={mostrarError('documento')}
            maxLength={30}
            ayuda="Opcional."
            enviando={guardando}
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="empresa-moneda"
              className="text-sm font-medium text-tinta"
            >
              Moneda
            </label>
            <select
              id="empresa-moneda"
              value={campos.moneda}
              onChange={(evento) => actualizar('moneda')(evento.target.value)}
              disabled={guardando}
              className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte disabled:opacity-60"
            >
              <option value="COP">COP — Peso colombiano</option>
              <option value="USD">USD — Dólar estadounidense</option>
              <option value="EUR">EUR — Euro</option>
              <option value="MXN">MXN — Peso mexicano</option>
            </select>
          </div>
        </div>

        <CampoArea
          id="empresa-direccion"
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

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoEntrada
            id="empresa-telefono"
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

          <CampoEntrada
            id="empresa-correo"
            etiqueta="Correo de contacto"
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
        </div>

        {!editando && (
          <div className="rounded-md border border-acento/30 bg-acento-suave/60 px-4 py-4">
            <h3 className="font-display text-sm font-semibold text-tinta">
              Administrador inicial
            </h3>
            <p className="mt-1 text-sm text-tinta-suave">
              Se creará un usuario administrador para operar dentro de esta
              empresa.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              <CampoEntrada
                id="empresa-admin-nombre"
                etiqueta="Nombre del administrador"
                valor={campos.adminNombre}
                alCambiar={actualizar('adminNombre')}
                alSalir={marcarTocado('adminNombre')}
                error={mostrarError('adminNombre')}
                maxLength={150}
                enviando={guardando}
                requerido
              />

              <CampoEntrada
                id="empresa-admin-correo"
                etiqueta="Correo del administrador"
                tipo="email"
                inputMode="email"
                valor={campos.adminCorreo}
                alCambiar={actualizar('adminCorreo')}
                alSalir={marcarTocado('adminCorreo')}
                error={mostrarError('adminCorreo')}
                maxLength={150}
                enviando={guardando}
                requerido
              />
            </div>
          </div>
        )}

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
            Empresa activa
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
                : 'Crear empresa'}
          </Boton>
          <Boton variante="sutil" onClick={alCancelar} deshabilitado={guardando}>
            {editando ? 'Cancelar edición' : 'Limpiar'}
          </Boton>
        </div>
      </div>
    </form>
  )
}

export default FormularioEmpresa
