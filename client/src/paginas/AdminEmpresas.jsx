import { useEffect, useRef, useState } from 'react'
import Alerta from '../componentes/Alerta'
import BannerCredenciales from '../componentes/BannerCredenciales'
import Boton from '../componentes/Boton'
import EmpresasTabla from '../componentes/EmpresasTabla'
import FormularioEmpresa from '../componentes/FormularioEmpresa'
import ModalDetalle from '../componentes/ModalDetalle'
import { useEmpresas } from '../hooks/useEmpresas'
import {
  actualizarEmpresa,
  crearEmpresa,
  obtenerEmpresa,
} from '../servicios/admin'
import { formatearFechaHora } from '../utilidades/formatoFecha'
import { formatearNumero } from '../utilidades/formatoMoneda'

const MENSAJE_GUARDAR = 'No pudimos guardar la empresa. Inténtalo de nuevo.'
const MENSAJE_ESTADO =
  'No pudimos cambiar el estado de la empresa. Inténtalo de nuevo.'
const MENSAJE_DETALLE =
  'No pudimos cargar el detalle de la empresa. Inténtalo de nuevo.'

const AdminEmpresas = () => {
  const [filtros, setFiltros] = useState({})
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
  } = useEmpresas(filtros)

  const [empresaEditando, setEmpresaEditando] = useState(null)
  const [claveFormulario, setClaveFormulario] = useState(0)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [exito, setExito] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [idAlternando, setIdAlternando] = useState(null)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [credenciales, setCredenciales] = useState(null)

  const [detalle, setDetalle] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  const refFormulario = useRef(null)
  const refFiltroActivo = useRef(null)

  useEffect(() => {
    if (!exito) return undefined
    const temporizador = setTimeout(() => setExito(''), 4000)
    return () => clearTimeout(temporizador)
  }, [exito])

  useEffect(() => {
    if (!credenciales) return undefined
    const temporizador = setTimeout(() => setCredenciales(null), 30000)
    return () => clearTimeout(temporizador)
  }, [credenciales])

  const desplazarAlFormulario = () => {
    window.requestAnimationFrame(() => {
      refFormulario.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const abrirNuevo = () => {
    setEmpresaEditando(null)
    setErrorFormulario('')
    setCredenciales(null)
    setClaveFormulario((actual) => actual + 1)
    setFormularioAbierto(true)
    desplazarAlFormulario()
  }

  const abrirEdicion = (empresa) => {
    setEmpresaEditando(empresa)
    setErrorFormulario('')
    setCredenciales(null)
    setClaveFormulario((actual) => actual + 1)
    setFormularioAbierto(true)
    desplazarAlFormulario()
  }

  const cerrarFormulario = () => {
    setFormularioAbierto(false)
    setEmpresaEditando(null)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
  }

  const manejarGuardar = async (payload) => {
    setGuardando(true)
    setErrorFormulario('')
    setErrorAccion('')
    try {
      if (empresaEditando) {
        await actualizarEmpresa(empresaEditando.id, payload)
        setExito('Empresa actualizada.')
        setFormularioAbierto(false)
        setEmpresaEditando(null)
        recargar()
        return true
      }

      const resultado = await crearEmpresa(payload)
      setExito('Empresa creada.')
      setCredenciales({
        entidad: resultado.empresa.nombre,
        correo: resultado.administrador.correo,
        password: resultado.password,
      })
      setFormularioAbierto(false)
      recargar()
      return true
    } catch (fallo) {
      setErrorFormulario(fallo?.message || MENSAJE_GUARDAR)
      return false
    } finally {
      setGuardando(false)
    }
  }

  const alternarEstado = async (empresa, activo) => {
    setIdAlternando(empresa.id)
    setErrorAccion('')
    try {
      await actualizarEmpresa(empresa.id, { activo })
      setExito(activo ? 'Empresa activada.' : 'Empresa desactivada.')
      recargar()
    } catch (fallo) {
      setErrorAccion(fallo?.message || MENSAJE_ESTADO)
    } finally {
      setIdAlternando(null)
      setConfirmandoId(null)
    }
  }

  const verDetalle = async (empresa) => {
    setCargandoDetalle(true)
    setErrorDetalle('')
    setModalAbierto(true)
    try {
      const data = await obtenerEmpresa(empresa.id)
      setDetalle(data)
    } catch (fallo) {
      setErrorDetalle(fallo?.message || MENSAJE_DETALLE)
      setDetalle(null)
    } finally {
      setCargandoDetalle(false)
    }
  }

  const cerrarDetalle = () => {
    setModalAbierto(false)
    setDetalle(null)
    setErrorDetalle('')
  }

  const aplicarFiltroActivo = (evento) => {
    const valor = evento.target.value
    if (valor === '') {
      setFiltros((previos) => {
        const actualizados = { ...previos }
        delete actualizados.activo
        return actualizados
      })
    } else {
      setFiltros((previos) => ({ ...previos, activo: valor === 'true' }))
    }
  }

  const limpiarFiltros = () => {
    setFiltros({})
    if (refFiltroActivo.current) refFiltroActivo.current.value = ''
  }

  const hayFiltros = Object.keys(filtros).length > 0

  const renderListado = () => {
    if (cargando) {
      return (
        <div
          className="space-y-3 rounded-lg border border-borde bg-superficie p-4"
          aria-live="polite"
        >
          <p className="sr-only">Cargando empresas…</p>
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
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4 8 4v14" />
              <path d="M14 10h-4v4h4z" />
            </svg>
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
            Aún no hay empresas
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-suave">
            Crea la primera empresa para empezar a gestionar administradores y
            operaciones.
          </p>
          <div className="mt-6 flex justify-center">
            <Boton variante="acento" onClick={abrirNuevo}>
              Nueva empresa
            </Boton>
          </div>
        </div>
      )
    }

    return (
      <EmpresasTabla
        empresas={datos}
        idAlternando={idAlternando}
        confirmandoId={confirmandoId}
        alVer={verDetalle}
        alEditar={abrirEdicion}
        alActivar={(empresa) => alternarEstado(empresa, true)}
        alSolicitarDesactivar={(empresa) => setConfirmandoId(empresa.id)}
        alConfirmarDesactivar={(empresa) => alternarEstado(empresa, false)}
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
        <span>Administración de plataforma</span>
        <span>
          {cargando
            ? '…'
            : `${formatearNumero(total)} ${total === 1 ? 'empresa' : 'empresas'}`}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Empresas
          </h1>
          <p className="mt-2 max-w-prose text-base text-tinta-suave">
            Crea y gestiona las empresas que operan en la plataforma. Cada una
            requiere un administrador inicial.
          </p>
        </div>
        <Boton variante="acento" onClick={abrirNuevo}>
          Nueva empresa
        </Boton>
      </div>

      <div className="mt-6 grid gap-8 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:items-start">
        <section className="min-w-0 2xl:order-1">
          {credenciales && (
            <div className="mb-4">
              <BannerCredenciales
                titulo="Empresa creada"
                entidad={credenciales.entidad}
                entidadLabel="Empresa"
                correo={credenciales.correo}
                password={credenciales.password}
                alCerrar={() => setCredenciales(null)}
              />
            </div>
          )}

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

          <div className="mb-4 rounded-lg border border-borde bg-superficie p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="filtro-empresa-activo"
                  className="text-sm font-medium text-tinta"
                >
                  Estado
                </label>
                <select
                  id="filtro-empresa-activo"
                  ref={refFiltroActivo}
                  value={
                    filtros.activo === undefined
                      ? ''
                      : String(filtros.activo)
                  }
                  onChange={aplicarFiltroActivo}
                  className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte"
                >
                  <option value="">Todas</option>
                  <option value="true">Activas</option>
                  <option value="false">Inactivas</option>
                </select>
              </div>

              {hayFiltros && (
                <Boton
                  tipo="button"
                  variante="sutil"
                  className="w-full px-3 sm:w-auto"
                  onClick={limpiarFiltros}
                >
                  Limpiar filtros
                </Boton>
              )}
            </div>
          </div>

          {renderListado()}
        </section>

        <section
          ref={refFormulario}
          aria-label={empresaEditando ? 'Editar empresa' : 'Nueva empresa'}
          className={`${
            formularioAbierto ? 'block' : 'hidden'
          } 2xl:sticky 2xl:top-6 2xl:order-2 2xl:block`}
        >
          <FormularioEmpresa
            key={claveFormulario}
            empresa={empresaEditando}
            guardando={guardando}
            errorEnvio={errorFormulario}
            alGuardar={manejarGuardar}
            alCancelar={cerrarFormulario}
          />
        </section>
      </div>

      <ModalDetalle
        abierto={modalAbierto}
        alCerrar={cerrarDetalle}
        titulo="Detalle de la empresa"
      >
        {cargandoDetalle && (
          <div className="space-y-3" aria-live="polite">
            <p className="sr-only">Cargando detalle…</p>
            {[0, 1, 2].map((indice) => (
              <div
                key={indice}
                className="h-10 animate-pulse rounded bg-superficie-2"
              />
            ))}
          </div>
        )}

        {!cargandoDetalle && errorDetalle && (
          <Alerta variante="error">{errorDetalle}</Alerta>
        )}

        {!cargandoDetalle && detalle && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="font-display text-base font-semibold text-tinta">
                {detalle.empresa.nombre}
              </h3>
              <p className="mt-1 font-mono text-xs text-tinta-suave">
                Creada el {formatearFechaHora(detalle.empresa.creado_en)}
              </p>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-mono text-xs text-tinta-suave">
                  Documento
                </dt>
                <dd className="mt-0.5 font-mono text-tinta">
                  {detalle.empresa.documento?.trim() || '—'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Moneda</dt>
                <dd className="mt-0.5 font-mono text-tinta">
                  {detalle.empresa.moneda?.trim() || '—'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Teléfono</dt>
                <dd className="mt-0.5 font-mono text-tinta">
                  {detalle.empresa.telefono?.trim() || '—'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Correo</dt>
                <dd className="mt-0.5 break-words text-tinta">
                  {detalle.empresa.correo?.trim() || '—'}
                </dd>
              </div>
            </dl>

            <div>
              <dt className="font-mono text-xs text-tinta-suave">Dirección</dt>
              <dd className="mt-0.5 break-words text-sm text-tinta">
                {detalle.empresa.direccion?.trim() || '—'}
              </dd>
            </div>

            <div className="border-t border-borde pt-4">
              <h4 className="font-display text-sm font-semibold text-tinta">
                Administradores ({formatearNumero(detalle.administradores.length)})
              </h4>
              {detalle.administradores.length === 0 ? (
                <p className="mt-2 text-sm text-tinta-suave">
                  No hay administradores registrados.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {detalle.administradores.map((admin) => (
                    <li
                      key={admin.id}
                      className="flex items-center justify-between rounded-md border border-borde bg-fondo px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-tinta">
                          {admin.nombre}
                        </p>
                        <p className="font-mono text-xs text-tinta-suave">
                          {admin.correo}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          admin.activo
                            ? 'border-exito/40 bg-exito-suave text-exito-fuerte'
                            : 'border-borde bg-superficie-2 text-tinta-suave'
                        }`}
                      >
                        {admin.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </ModalDetalle>
    </div>
  )
}

export default AdminEmpresas
