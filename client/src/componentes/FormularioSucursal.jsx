import { useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import CampoArea from './CampoArea'
import CampoEntrada from './CampoEntrada'

const estadoInicial = (sucursal) => ({
  nombre: sucursal?.nombre ?? '',
  direccion: sucursal?.direccion ?? '',
  telefono: sucursal?.telefono ?? '',
  activo: sucursal?.activo ?? true,
})

const validar = (campos) => {
  const errores = {}

  const nombre = campos.nombre.trim()
  if (!nombre) errores.nombre = 'Ingresa el nombre de la sucursal.'
  else if (nombre.length > 150) errores.nombre = 'Máximo 150 caracteres.'

  const direccion = campos.direccion.trim()
  if (direccion.length > 200) errores.direccion = 'Máximo 200 caracteres.'

  const telefono = campos.telefono.trim()
  if (telefono.length > 30) errores.telefono = 'Máximo 30 caracteres.'

  return errores
}

const FormularioSucursal = ({
  sucursal,
  guardando = false,
  errorEnvio = '',
  alGuardar,
  alCancelar,
}) => {
  const editando = Boolean(sucursal)
  const [campos, setCampos] = useState(() => estadoInicial(sucursal))
  const [tocado, setTocado] = useState({})
  const [intento, setIntento] = useState(false)

  const errores = validar(campos)
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
      direccion: campos.direccion.trim(),
      telefono: campos.telefono.trim(),
    }
    if (editando) payload.activo = campos.activo

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
          {editando ? 'Editar sucursal' : 'Nueva sucursal'}
        </h2>
        <p className="mt-1 text-sm text-tinta-suave">
          {editando
            ? `Cambios sobre ${sucursal.nombre}.`
            : 'Registra un punto de venta o bodega.'}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        <CampoEntrada
          id="sucursal-nombre"
          etiqueta="Nombre"
          valor={campos.nombre}
          alCambiar={actualizar('nombre')}
          alSalir={marcarTocado('nombre')}
          error={mostrarError('nombre')}
          maxLength={150}
          ayuda="Cómo identificas esta sede en el panel."
          enviando={guardando}
          requerido
        />

        <CampoArea
          id="sucursal-direccion"
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

        <CampoEntrada
          id="sucursal-telefono"
          etiqueta="Teléfono"
          tipo="tel"
          inputMode="tel"
          valor={campos.telefono}
          alCambiar={actualizar('telefono')}
          alSalir={marcarTocado('telefono')}
          error={mostrarError('telefono')}
          maxLength={30}
          ayuda="Opcional. Máximo 30 caracteres."
          enviando={guardando}
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
            Sucursal activa
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
                : 'Crear sucursal'}
          </Boton>
          <Boton variante="sutil" onClick={alCancelar} deshabilitado={guardando}>
            {editando ? 'Cancelar edición' : 'Limpiar'}
          </Boton>
        </div>
      </div>
    </form>
  )
}

export default FormularioSucursal
