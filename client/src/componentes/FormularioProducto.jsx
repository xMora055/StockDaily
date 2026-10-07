import { useEffect, useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import CampoArea from './CampoArea'
import CampoEntrada from './CampoEntrada'
import { useAutenticacion } from '../hooks/useAutenticacion'
import { obtenerCategoria } from '../servicios/categorias'

const estadoInicial = (producto) => ({
  codigo: producto?.codigo ?? '',
  nombre: producto?.nombre ?? '',
  descripcion: producto?.descripcion ?? '',
  precio_unitario:
    producto?.precio_unitario !== undefined && producto?.precio_unitario !== null
      ? String(producto.precio_unitario)
      : '0',
  impuesto_porcentaje:
    producto?.impuesto_porcentaje !== undefined &&
    producto?.impuesto_porcentaje !== null
      ? String(producto.impuesto_porcentaje)
      : '0',
  categoria_id:
    producto?.categoria_id !== undefined && producto?.categoria_id !== null
      ? String(producto.categoria_id)
      : '',
  activo: producto?.activo ?? true,
})

const validar = (campos) => {
  const errores = {}

  const codigo = campos.codigo.trim()
  if (!codigo) errores.codigo = 'Ingresa el código.'
  else if (codigo.length > 50) errores.codigo = 'Máximo 50 caracteres.'

  const nombre = campos.nombre.trim()
  if (!nombre) errores.nombre = 'Ingresa el nombre.'
  else if (nombre.length > 150) errores.nombre = 'Máximo 150 caracteres.'

  const precio = Number(campos.precio_unitario)
  if (campos.precio_unitario.trim() === '' || !Number.isFinite(precio)) {
    errores.precio = 'Ingresa un precio válido.'
  } else if (precio < 0) {
    errores.precio = 'El precio no puede ser negativo.'
  }

  const impuesto = Number(campos.impuesto_porcentaje)
  if (campos.impuesto_porcentaje.trim() === '' || !Number.isFinite(impuesto)) {
    errores.impuesto = 'Ingresa un impuesto válido.'
  } else if (impuesto < 0 || impuesto > 100) {
    errores.impuesto = 'El impuesto debe estar entre 0 y 100.'
  }

  return errores
}

const etiquetaCategoria = (categoria) =>
  categoria.activo === false ? `${categoria.nombre} (inactiva)` : categoria.nombre

const FormularioProducto = ({
  producto,
  categorias = [],
  cargandoCategorias = false,
  errorCategorias = '',
  guardando = false,
  errorEnvio = '',
  alGuardar,
  alCancelar,
}) => {
  const editando = Boolean(producto)
  const [campos, setCampos] = useState(() => estadoInicial(producto))
  const [tocado, setTocado] = useState({})
  const [intento, setIntento] = useState(false)
  const [categoriaResuelta, setCategoriaResuelta] = useState(null)
  const { usuario } = useAutenticacion()
  const moneda = usuario?.empresa?.moneda || 'COP'

  const idCategoriaActual =
    producto?.categoria_id !== undefined && producto?.categoria_id !== null
      ? Number(producto.categoria_id)
      : null
  const estaEnActivas = categorias.some(
    (categoria) => categoria.id === idCategoriaActual,
  )

  /*
   * RF-018: si el producto referencia una categoría que no está entre las
   * activas (p. ej. desactivada), la traemos para mostrarla marcada como
   * "(inactiva)" en el select y no perder la asignación al guardar.
   */
  useEffect(() => {
    let vigente = true

    if (idCategoriaActual === null || estaEnActivas || cargandoCategorias) {
      return undefined
    }

    obtenerCategoria(idCategoriaActual)
      .then((categoria) => {
        if (vigente) setCategoriaResuelta(categoria)
      })
      .catch(() => {
        if (vigente) setCategoriaResuelta(null)
      })

    return () => {
      vigente = false
    }
  }, [idCategoriaActual, estaEnActivas, cargandoCategorias])

  const categoriaFueraDelCatalogo =
    categoriaResuelta && categoriaResuelta.id === idCategoriaActual
      ? categoriaResuelta
      : null

  const opcionesCategorias =
    categoriaFueraDelCatalogo &&
    !categorias.some(
      (categoria) => categoria.id === categoriaFueraDelCatalogo.id,
    )
      ? [...categorias, categoriaFueraDelCatalogo]
      : categorias

  const errores = validar(campos)
  const mostrarError = (campo) =>
    intento || tocado[campo] ? errores[campo] : ''

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
      codigo: campos.codigo.trim(),
      nombre: campos.nombre.trim(),
      descripcion: campos.descripcion.trim(),
      precio_unitario: Number(campos.precio_unitario),
      impuesto_porcentaje: Number(campos.impuesto_porcentaje),
      categoria_id: campos.categoria_id.trim()
        ? Number(campos.categoria_id)
        : null,
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
          {editando ? 'Editar producto' : 'Nuevo producto'}
        </h2>
        <p className="mt-1 text-sm text-tinta-suave">
          {editando
            ? `Cambios sobre ${producto.nombre}.`
            : 'Registra un artículo del catálogo.'}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoEntrada
            id="producto-codigo"
            etiqueta="Código"
            valor={campos.codigo}
            alCambiar={actualizar('codigo')}
            alSalir={marcarTocado('codigo')}
            error={mostrarError('codigo')}
            ayuda="Identificador único en tu empresa."
            enviando={guardando}
            requerido
          />
          <CampoEntrada
            id="producto-impuesto"
            etiqueta="Impuesto (%)"
            tipo="number"
            inputMode="decimal"
            valor={campos.impuesto_porcentaje}
            alCambiar={actualizar('impuesto_porcentaje')}
            alSalir={marcarTocado('impuesto_porcentaje')}
            error={mostrarError('impuesto')}
            ayuda="Entre 0 y 100."
            enviando={guardando}
          />
        </div>

        <CampoEntrada
          id="producto-nombre"
          etiqueta="Nombre"
          valor={campos.nombre}
          alCambiar={actualizar('nombre')}
          alSalir={marcarTocado('nombre')}
          error={mostrarError('nombre')}
          enviando={guardando}
          requerido
        />

        <CampoArea
          id="producto-descripcion"
          etiqueta="Descripción"
          valor={campos.descripcion}
          alCambiar={actualizar('descripcion')}
          alSalir={marcarTocado('descripcion')}
          ayuda="Opcional."
          deshabilitado={guardando}
          filas={3}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoEntrada
            id="producto-precio"
            etiqueta="Precio unitario"
            tipo="number"
            inputMode="decimal"
            valor={campos.precio_unitario}
            alCambiar={actualizar('precio_unitario')}
            alSalir={marcarTocado('precio_unitario')}
            error={mostrarError('precio')}
            ayuda={`Precio en ${moneda}.`}
            enviando={guardando}
            requerido
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="producto-categoria"
              className="text-sm font-medium text-tinta"
            >
              Categoría
            </label>
            <select
              id="producto-categoria"
              value={campos.categoria_id}
              onChange={(evento) => actualizar('categoria_id')(evento.target.value)}
              disabled={guardando || cargandoCategorias}
              className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte disabled:opacity-60"
            >
              <option value="">Sin categoría</option>
              {opcionesCategorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {etiquetaCategoria(categoria)}
                </option>
              ))}
            </select>
            {errorCategorias ? (
              <p role="alert" className="text-sm text-error">
                {errorCategorias}
              </p>
            ) : (
              <p className="text-sm text-tinta-suave">
                Opcional. Agrupa el producto en tu catálogo.
              </p>
            )}
          </div>
        </div>

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
            Producto activo
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
                : 'Crear producto'}
          </Boton>
          <Boton variante="sutil" onClick={alCancelar} deshabilitado={guardando}>
            {editando ? 'Cancelar edición' : 'Limpiar'}
          </Boton>
        </div>
      </div>
    </form>
  )
}

export default FormularioProducto