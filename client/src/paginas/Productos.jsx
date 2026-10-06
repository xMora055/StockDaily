import { useEffect, useRef, useState } from 'react'
import Alerta from '../componentes/Alerta'
import Boton from '../componentes/Boton'
import FiltrosProductos from '../componentes/FiltrosProductos'
import FormularioProducto from '../componentes/FormularioProducto'
import ProductosTabla from '../componentes/ProductosTabla'
import { useCategoriasCatalogo } from '../hooks/useCategoriasCatalogo'
import { useProductos } from '../hooks/useProductos'
import { actualizarProducto, crearProducto } from '../servicios/productos'
import { formatearNumero } from '../utilidades/formatoMoneda'

const MENSAJE_GUARDAR = 'No pudimos guardar el producto. Inténtalo de nuevo.'
const MENSAJE_ESTADO =
  'No pudimos cambiar el estado del producto. Inténtalo de nuevo.'

const Productos = () => {
  const [filtros, setFiltros] = useState({})
  const [claveFiltros, setClaveFiltros] = useState(0)
  const {
    datos,
    cargando,
    error,
    recargar,
    pagina,
    porPagina,
    total,
    totalPaginas,
    paginaAnterior,
    paginaSiguiente,
    cambiarPorPagina,
  } = useProductos(filtros)

  const {
    categorias,
    mapa: mapaCategorias,
    cargando: cargandoCategorias,
    error: errorCategorias,
  } = useCategoriasCatalogo()

  const [productoEditando, setProductoEditando] = useState(null)
  const [claveFormulario, setClaveFormulario] = useState(0)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [exito, setExito] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [idAlternando, setIdAlternando] = useState(null)
  const [confirmandoId, setConfirmandoId] = useState(null)

  const refFormulario = useRef(null)

  const hayFiltros = Object.keys(filtros).length > 0

  useEffect(() => {
    if (!exito) return undefined
    const temporizador = setTimeout(() => setExito(''), 4000)
    return () => clearTimeout(temporizador)
  }, [exito])

  const desplazarAlFormulario = () => {
    window.requestAnimationFrame(() => {
      refFormulario.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const abrirNuevo = () => {
    setProductoEditando(null)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
    setFormularioAbierto(true)
    desplazarAlFormulario()
  }

  const abrirEdicion = (producto) => {
    setProductoEditando(producto)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
    setFormularioAbierto(true)
    desplazarAlFormulario()
  }

  const cerrarFormulario = () => {
    setFormularioAbierto(false)
    setProductoEditando(null)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
  }

  const manejarGuardar = async (payload) => {
    setGuardando(true)
    setErrorFormulario('')
    setErrorAccion('')
    try {
      if (productoEditando) {
        await actualizarProducto(productoEditando.id, payload)
        setExito('Producto actualizado.')
      } else {
        await crearProducto(payload)
        setExito('Producto creado.')
      }
      setFormularioAbierto(false)
      setProductoEditando(null)
      recargar()
      return true
    } catch (fallo) {
      setErrorFormulario(fallo?.message || MENSAJE_GUARDAR)
      return false
    } finally {
      setGuardando(false)
    }
  }

  const alternarEstado = async (producto, activo) => {
    setIdAlternando(producto.id)
    setErrorAccion('')
    try {
      await actualizarProducto(producto.id, { activo })
      setExito(activo ? 'Producto activado.' : 'Producto desactivado.')
      recargar()
    } catch (fallo) {
      setErrorAccion(fallo?.message || MENSAJE_ESTADO)
    } finally {
      setIdAlternando(null)
      setConfirmandoId(null)
    }
  }

  const limpiarFiltros = () => {
    setFiltros({})
    setClaveFiltros((actual) => actual + 1)
  }

  const renderListado = () => {
    if (cargando) {
      return (
        <div
          className="space-y-3 rounded-lg border border-borde bg-superficie p-4"
          aria-live="polite"
        >
          <p className="sr-only">Cargando productos…</p>
          {[0, 1, 2, 3].map((indice) => (
            <div
              key={indice}
              className="h-10 animate-pulse rounded bg-superficie-2"
            />
          ))}
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

    if (total === 0) {
      return (
        <div className="rounded-lg border border-dashed border-borde-fuerte bg-superficie px-6 py-14 text-center">
          <span
            className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-superficie-2 text-tinta-suave"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 8 12 3 3 8l9 5 9-5Z" />
              <path d="M3 8v8l9 5 9-5V8" />
              <path d="M12 13v8" />
            </svg>
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
            {hayFiltros ? 'Sin resultados' : 'Tu catálogo está vacío'}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-suave">
            {hayFiltros
              ? 'No encontramos productos con esos filtros. Prueba con otros criterios.'
              : 'Registra tu primer producto para empezar a facturar y controlar el inventario.'}
          </p>
          <div className="mt-6 flex justify-center">
            {hayFiltros ? (
              <Boton variante="secundario" onClick={limpiarFiltros}>
                Limpiar filtros
              </Boton>
            ) : (
              <Boton variante="acento" onClick={abrirNuevo}>
                Nuevo producto
              </Boton>
            )}
          </div>
        </div>
      )
    }

    return (
      <ProductosTabla
        productos={datos}
        mapaCategorias={mapaCategorias}
        idAlternando={idAlternando}
        confirmandoId={confirmandoId}
        alEditar={abrirEdicion}
        alActivar={(producto) => alternarEstado(producto, true)}
        alSolicitarDesactivar={(producto) => setConfirmandoId(producto.id)}
        alConfirmarDesactivar={(producto) => alternarEstado(producto, false)}
        alCancelarDesactivar={() => setConfirmandoId(null)}
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={total}
        porPagina={porPagina}
        alAnterior={paginaAnterior}
        alSiguiente={paginaSiguiente}
        alCambiarPorPagina={cambiarPorPagina}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-borde pb-3 font-mono text-xs text-tinta-suave">
        <span>Catálogo de productos</span>
        <span>
          {cargando
            ? '…'
            : `${formatearNumero(total)} ${total === 1 ? 'producto' : 'productos'}`}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Productos
          </h1>
          <p className="mt-2 max-w-prose text-base text-tinta-suave">
            Administra los artículos que vendes: créalos, edítalos y actívalos
            o desactívalos sin perder su historial.
          </p>
        </div>
        <Boton variante="acento" onClick={abrirNuevo}>
          Nuevo producto
        </Boton>
      </div>

      <div className="mt-8 grid gap-8 2xl:grid-cols-[minmax(0,1fr)_340px] 2xl:items-start">
        <section
          ref={refFormulario}
          aria-label={productoEditando ? 'Editar producto' : 'Nuevo producto'}
          className={`${
            formularioAbierto ? 'block' : 'hidden'
          } 2xl:sticky 2xl:top-6 2xl:order-2 2xl:block`}
        >
          <FormularioProducto
            key={claveFormulario}
            producto={productoEditando}
            categorias={categorias}
            cargandoCategorias={cargandoCategorias}
            errorCategorias={errorCategorias}
            guardando={guardando}
            errorEnvio={errorFormulario}
            alGuardar={manejarGuardar}
            alCancelar={cerrarFormulario}
          />
        </section>

        <section className="min-w-0 2xl:order-1">
          {exito && (
            <div className="mb-4">
              <Alerta variante="exito">{exito}</Alerta>
            </div>
          )}
          {errorAccion && (
            <div className="mb-4">
              <Alerta variante="error">{errorAccion}</Alerta>
            </div>
          )}

          <div className="mb-5">
            <FiltrosProductos
              key={claveFiltros}
              categorias={categorias}
              alAplicar={setFiltros}
              alLimpiar={limpiarFiltros}
              hayFiltros={hayFiltros}
            />
          </div>

          {renderListado()}
        </section>
      </div>
    </div>
  )
}

export default Productos