import { useEffect, useRef, useState } from 'react'
import Alerta from '../componentes/Alerta'
import Boton from '../componentes/Boton'
import ClientesTabla from '../componentes/ClientesTabla'
import FiltrosClientes from '../componentes/FiltrosClientes'
import FormularioCliente from '../componentes/FormularioCliente'
import { useClientes } from '../hooks/useClientes'
import { useSucursales } from '../hooks/useSucursales'
import { actualizarCliente, crearCliente } from '../servicios/clientes'
import { formatearNumero } from '../utilidades/formatoMoneda'

const MENSAJE_GUARDAR = 'No pudimos guardar el cliente. Inténtalo de nuevo.'
const MENSAJE_ESTADO =
  'No pudimos cambiar el estado del cliente. Inténtalo de nuevo.'

const MENSAJES_POR_ESTADO = {
  400: 'Revisa los datos del cliente e inténtalo de nuevo.',
  404: 'La sucursal elegida no existe o no pertenece a tu empresa.',
  409: 'Ya existe un cliente con ese documento en la sucursal.',
}

const resolverMensaje = (fallo, porDefecto) => {
  if (fallo?.message) return fallo.message
  const porEstado = fallo?.estado ? MENSAJES_POR_ESTADO[fallo.estado] : ''
  return porEstado || porDefecto
}

const Clientes = () => {
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
  } = useClientes(filtros)

  const {
    datos: sucursales,
    cargando: cargandoSucursales,
    error: errorSucursales,
    recargar: recargarSucursales,
  } = useSucursales({}, { porPaginaInicial: 100 })

  const [clienteEditando, setClienteEditando] = useState(null)
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

  const sucursalesParaFormulario = sucursales.filter(
    (sucursal) => sucursal.activo,
  )

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
    setClienteEditando(null)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
    setFormularioAbierto(true)
    desplazarAlFormulario()
  }

  const abrirEdicion = (cliente) => {
    setClienteEditando(cliente)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
    setFormularioAbierto(true)
    desplazarAlFormulario()
  }

  const cerrarFormulario = () => {
    setFormularioAbierto(false)
    setClienteEditando(null)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
  }

  const manejarGuardar = async (payload) => {
    setGuardando(true)
    setErrorFormulario('')
    setErrorAccion('')
    try {
      if (clienteEditando) {
        await actualizarCliente(clienteEditando.id, payload)
        setExito('Cliente actualizado.')
      } else {
        await crearCliente(payload)
        setExito('Cliente creado.')
      }
      setFormularioAbierto(false)
      setClienteEditando(null)
      recargar()
      return true
    } catch (fallo) {
      setErrorFormulario(resolverMensaje(fallo, MENSAJE_GUARDAR))
      return false
    } finally {
      setGuardando(false)
    }
  }

  const alternarEstado = async (cliente, activo) => {
    setIdAlternando(cliente.id)
    setErrorAccion('')
    try {
      await actualizarCliente(cliente.id, { activo })
      setExito(activo ? 'Cliente activado.' : 'Cliente desactivado.')
      recargar()
    } catch (fallo) {
      setErrorAccion(resolverMensaje(fallo, MENSAJE_ESTADO))
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
          <p className="sr-only">Cargando clientes…</p>
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
              <path d="M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
              <circle cx="9.5" cy="7" r="3.5" />
              <path d="M17 11h5M19.5 8.5v5" />
            </svg>
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
            {hayFiltros ? 'Sin resultados' : 'Aún no tienes clientes'}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-suave">
            {hayFiltros
              ? 'No encontramos clientes con esos filtros. Prueba con otros criterios.'
              : 'Registra tu primer cliente para asociarlo a sus compras y conservar el histórico.'}
          </p>
          <div className="mt-6 flex justify-center">
            {hayFiltros ? (
              <Boton variante="secundario" onClick={limpiarFiltros}>
                Limpiar filtros
              </Boton>
            ) : (
              <Boton variante="acento" onClick={abrirNuevo}>
                Nuevo cliente
              </Boton>
            )}
          </div>
        </div>
      )
    }

    return (
      <ClientesTabla
        clientes={datos}
        idAlternando={idAlternando}
        confirmandoId={confirmandoId}
        alEditar={abrirEdicion}
        alActivar={(cliente) => alternarEstado(cliente, true)}
        alSolicitarDesactivar={(cliente) => setConfirmandoId(cliente.id)}
        alConfirmarDesactivar={(cliente) => alternarEstado(cliente, false)}
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
        <span>Clientes de la empresa</span>
        <span>
          {cargando
            ? '…'
            : `${formatearNumero(total)} ${total === 1 ? 'cliente' : 'clientes'}`}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Clientes
          </h1>
          <p className="mt-2 max-w-prose text-base text-tinta-suave">
            Registra los clientes de cada sede para asociarlos a sus ventas y
            conservar el histórico de compras.
          </p>
        </div>
        <Boton variante="acento" onClick={abrirNuevo}>
          Nuevo cliente
        </Boton>
      </div>

      <div className="mt-8 grid gap-8 2xl:grid-cols-[minmax(0,1fr)_340px] 2xl:items-start">
        <section
          ref={refFormulario}
          aria-label={clienteEditando ? 'Editar cliente' : 'Nuevo cliente'}
          className={`${
            formularioAbierto ? 'block' : 'hidden'
          } 2xl:sticky 2xl:top-6 2xl:order-2 2xl:block`}
        >
          <FormularioCliente
            key={claveFormulario}
            cliente={clienteEditando}
            sucursales={sucursalesParaFormulario}
            cargandoSucursales={cargandoSucursales}
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
            <FiltrosClientes
              key={claveFiltros}
              alAplicar={setFiltros}
              alLimpiar={limpiarFiltros}
              hayFiltros={hayFiltros}
            />
          </div>

          {!cargandoSucursales && errorSucursales && (
            <div className="mb-5 flex flex-col items-start gap-3">
              <Alerta variante="error" className="w-full">
                {errorSucursales}
              </Alerta>
              <Boton variante="secundario" onClick={recargarSucursales}>
                Reintentar sucursales
              </Boton>
            </div>
          )}

          {renderListado()}
        </section>
      </div>
    </div>
  )
}

export default Clientes
