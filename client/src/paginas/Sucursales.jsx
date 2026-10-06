import { useEffect, useRef, useState } from 'react'
import Alerta from '../componentes/Alerta'
import Boton from '../componentes/Boton'
import FormularioSucursal from '../componentes/FormularioSucursal'
import SucursalesTabla from '../componentes/SucursalesTabla'
import { useSucursales } from '../hooks/useSucursales'
import { actualizarSucursal, crearSucursal } from '../servicios/sucursales'
import { formatearNumero } from '../utilidades/formatoMoneda'

const MENSAJE_GUARDAR = 'No pudimos guardar la sucursal. Inténtalo de nuevo.'
const MENSAJE_ESTADO =
  'No pudimos cambiar el estado de la sucursal. Inténtalo de nuevo.'

const Sucursales = () => {
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
  } = useSucursales()

  const [sucursalEditando, setSucursalEditando] = useState(null)
  const [claveFormulario, setClaveFormulario] = useState(0)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [exito, setExito] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [idAlternando, setIdAlternando] = useState(null)
  const [confirmandoId, setConfirmandoId] = useState(null)

  const refFormulario = useRef(null)

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
    setSucursalEditando(null)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
    setFormularioAbierto(true)
    desplazarAlFormulario()
  }

  const abrirEdicion = (sucursal) => {
    setSucursalEditando(sucursal)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
    setFormularioAbierto(true)
    desplazarAlFormulario()
  }

  const cerrarFormulario = () => {
    setFormularioAbierto(false)
    setSucursalEditando(null)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
  }

  const manejarGuardar = async (payload) => {
    setGuardando(true)
    setErrorFormulario('')
    setErrorAccion('')
    try {
      if (sucursalEditando) {
        await actualizarSucursal(sucursalEditando.id, payload)
        setExito('Sucursal actualizada.')
      } else {
        await crearSucursal(payload)
        setExito('Sucursal creada.')
      }
      setFormularioAbierto(false)
      setSucursalEditando(null)
      recargar()
      return true
    } catch (fallo) {
      setErrorFormulario(fallo?.message || MENSAJE_GUARDAR)
      return false
    } finally {
      setGuardando(false)
    }
  }

  const alternarEstado = async (sucursal, activo) => {
    setIdAlternando(sucursal.id)
    setErrorAccion('')
    try {
      await actualizarSucursal(sucursal.id, { activo })
      setExito(activo ? 'Sucursal activada.' : 'Sucursal desactivada.')
      recargar()
    } catch (fallo) {
      setErrorAccion(fallo?.message || MENSAJE_ESTADO)
    } finally {
      setIdAlternando(null)
      setConfirmandoId(null)
    }
  }

  const renderListado = () => {
    if (cargando) {
      return (
        <div
          className="space-y-3 rounded-lg border border-borde bg-superficie p-4"
          aria-live="polite"
        >
          <p className="sr-only">Cargando sucursales…</p>
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
              <path d="M4 9.5 5.5 4h13L20 9.5" />
              <path d="M4 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
              <path d="M5 12v8h14v-8" />
              <path d="M10 20v-5h4v5" />
            </svg>
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
            Aún no tienes sucursales
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-suave">
            Registra tu primera sucursal para asociar el inventario, los
            clientes y las ventas de cada punto de venta.
          </p>
          <div className="mt-6 flex justify-center">
            <Boton variante="acento" onClick={abrirNuevo}>
              Nueva sucursal
            </Boton>
          </div>
        </div>
      )
    }

    return (
      <SucursalesTabla
        sucursales={datos}
        idAlternando={idAlternando}
        confirmandoId={confirmandoId}
        alEditar={abrirEdicion}
        alActivar={(sucursal) => alternarEstado(sucursal, true)}
        alSolicitarDesactivar={(sucursal) => setConfirmandoId(sucursal.id)}
        alConfirmarDesactivar={(sucursal) => alternarEstado(sucursal, false)}
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
        <span>Sucursales de la empresa</span>
        <span>
          {cargando
            ? '…'
            : `${formatearNumero(total)} ${total === 1 ? 'sucursal' : 'sucursales'}`}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Sucursales
          </h1>
          <p className="mt-2 max-w-prose text-base text-tinta-suave">
            Administra las sedes de tu negocio: créalas, edítalas y actívalas o
            desactívalas sin perder su historial.
          </p>
        </div>
        <Boton variante="acento" onClick={abrirNuevo}>
          Nueva sucursal
        </Boton>
      </div>

      <div className="mt-8 grid gap-8 2xl:grid-cols-[minmax(0,1fr)_340px] 2xl:items-start">
        <section
          ref={refFormulario}
          aria-label={sucursalEditando ? 'Editar sucursal' : 'Nueva sucursal'}
          className={`${
            formularioAbierto ? 'block' : 'hidden'
          } 2xl:sticky 2xl:top-6 2xl:order-2 2xl:block`}
        >
          <FormularioSucursal
            key={claveFormulario}
            sucursal={sucursalEditando}
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

          {renderListado()}
        </section>
      </div>
    </div>
  )
}

export default Sucursales
