import { useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import CampoEntrada from './CampoEntrada'

const estadoInicial = (categoria) => ({
  nombre: categoria?.nombre ?? '',
  activo: categoria?.activo ?? true,
})

const validar = (campos) => {
  const errores = {}

  const nombre = campos.nombre.trim()
  if (!nombre) errores.nombre = 'Ingresa el nombre de la categoría.'
  else if (nombre.length > 100) errores.nombre = 'Máximo 100 caracteres.'

  return errores
}

const FormularioCategoria = ({
  categoria,
  guardando = false,
  errorEnvio = '',
  alGuardar,
  alCancelar,
}) => {
  const editando = Boolean(categoria)
  const [campos, setCampos] = useState(() => estadoInicial(categoria))
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

    const payload = { nombre: campos.nombre.trim() }
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
          {editando ? 'Editar categoría' : 'Nueva categoría'}
        </h2>
        <p className="mt-1 text-sm text-tinta-suave">
          {editando
            ? `Cambios sobre ${categoria.nombre}.`
            : 'Agrupa tus productos para filtrarlos y encontrarlos rápido.'}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        <CampoEntrada
          id="categoria-nombre"
          etiqueta="Nombre"
          valor={campos.nombre}
          alCambiar={actualizar('nombre')}
          alSalir={marcarTocado('nombre')}
          error={mostrarError('nombre')}
          maxLength={100}
          ayuda="Único dentro de tu empresa. Máximo 100 caracteres."
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
            Categoría activa
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
                : 'Crear categoría'}
          </Boton>
          <Boton variante="sutil" onClick={alCancelar} deshabilitado={guardando}>
            {editando ? 'Cancelar edición' : 'Limpiar'}
          </Boton>
        </div>
      </div>
    </form>
  )
}

export default FormularioCategoria
