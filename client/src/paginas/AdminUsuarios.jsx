import { useEffect, useRef, useState } from 'react'
import Alerta from '../componentes/Alerta'
import BannerCredenciales from '../componentes/BannerCredenciales'
import Boton from '../componentes/Boton'
import FormularioUsuario from '../componentes/FormularioUsuario'
import ModalDetalle from '../componentes/ModalDetalle'
import UsuariosTabla from '../componentes/UsuariosTabla'
import { useUsuarios } from '../hooks/useUsuarios'
import {
  actualizarUsuario,
  crearUsuario,
  listarEmpresas,
  obtenerUsuario,
} from '../servicios/admin'
import { formatearFechaHora } from '../utilidades/formatoFecha'
import { formatearNumero } from '../utilidades/formatoMoneda'

const MENSAJE_GUARDAR =
  'No pudimos guardar el administrador. Inténtalo de nuevo.'
const MENSAJE_ESTADO =
  'No pudimos cambiar el estado del administrador. Inténtalo de nuevo.'
const MENSAJE_DETALLE =
  'No pudimos cargar el detalle del administrador. Inténtalo de nuevo.'

const AdminUsuarios = () => {
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
  } = useUsuarios(filtros)

  const [usuarioEditando, setUsuarioEditando] = useState(null)
  const [claveFormulario, setClaveFormulario] = useState(0)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorFormulario, setErrorFormulario] = useState('')
  const [exito, setExito] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [idAlternando, setIdAlternando] = useState(null)
  const [confirmandoId, setConfirmandoId] = useState(null)
  const [credenciales, setCredenciales] = useState(null)

  const [empresas, setEmpresas] = useState([])
  const [cargandoEmpresas, setCargandoEmpresas] = useState(true)
  const [errorEmpresas, setErrorEmpresas] = useState('')

  const [detalle, setDetalle] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  const refFormulario = useRef(null)
  const refFiltroActivo = useRef(null)
  const refFiltroEmpresa = useRef(null)

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

  useEffect(() => {
    let activo = true

    listarEmpresas({ por_pagina: 100 })
      .then((paginado) => {
        if (!activo) return
        setEmpresas(paginado.items)
        setErrorEmpresas('')
      })
      .catch((fallo) => {
        if (!activo) return
        setErrorEmpresas(
          fallo?.message || 'No pudimos cargar las empresas.',
        )
      })
      .finally(() => {
        if (activo) setCargandoEmpresas(false)
      })

    return () => {
      activo = false
    }
  }, [])

  const empresasPorId = empresas.reduce((mapa, empresa) => {
    mapa[empresa.id] = empresa.nombre
    return mapa
  }, {})

  const desplazarAlFormulario = () => {
    window.requestAnimationFrame(() => {
      refFormulario.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const abrirNuevo = () => {
    setUsuarioEditando(null)
    setErrorFormulario('')
    setCredenciales(null)
    setClaveFormulario((actual) => actual + 1)
    setFormularioAbierto(true)
    desplazarAlFormulario()
  }

  const abrirEdicion = (usuario) => {
    setUsuarioEditando(usuario)
    setErrorFormulario('')
    setCredenciales(null)
    setClaveFormulario((actual) => actual + 1)
    setFormularioAbierto(true)
    desplazarAlFormulario()
  }

  const cerrarFormulario = () => {
    setFormularioAbierto(false)
    setUsuarioEditando(null)
    setErrorFormulario('')
    setClaveFormulario((actual) => actual + 1)
  }

  const manejarGuardar = async (payload) => {
    setGuardando(true)
    setErrorFormulario('')
    setErrorAccion('')
    try {
      if (usuarioEditando) {
        await actualizarUsuario(usuarioEditando.id, payload)
        setExito('Administrador actualizado.')
        setFormularioAbierto(false)
        setUsuarioEditando(null)
        recargar()
        return true
      }

      const resultado = await crearUsuario(payload)
      setExito('Administrador creado.')
      setCredenciales({
        entidad: empresasPorId[resultado.usuario.empresa_id] || '—',
        correo: resultado.usuario.correo,
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

  const alternarEstado = async (usuario, activo) => {
    setIdAlternando(usuario.id)
    setErrorAccion('')
    try {
      await actualizarUsuario(usuario.id, { activo })
      setExito(activo ? 'Administrador activado.' : 'Administrador desactivado.')
      recargar()
    } catch (fallo) {
      setErrorAccion(fallo?.message || MENSAJE_ESTADO)
    } finally {
      setIdAlternando(null)
      setConfirmandoId(null)
    }
  }

  const verDetalle = async (usuario) => {
    setCargandoDetalle(true)
    setErrorDetalle('')
    setModalAbierto(true)
    try {
      const data = await obtenerUsuario(usuario.id)
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
    setFiltros((previos) => {
      const actualizados = { ...previos }
      if (valor === '') {
        delete actualizados.activo
      } else {
        actualizados.activo = valor === 'true'
      }
      return actualizados
    })
  }

  const aplicarFiltroEmpresa = (evento) => {
    const valor = evento.target.value
    setFiltros((previos) => {
      const actualizados = { ...previos }
      if (valor === '') {
        delete actualizados.empresa_id
      } else {
        actualizados.empresa_id = Number(valor)
      }
      return actualizados
    })
  }

  const limpiarFiltros = () => {
    setFiltros({})
    if (refFiltroActivo.current) refFiltroActivo.current.value = ''
    if (refFiltroEmpresa.current) refFiltroEmpresa.current.value = ''
  }

  const hayFiltros = Object.keys(filtros).length > 0

  const renderListado = () => {
    if (cargando) {
      return (
        <div
          className="space-y-3 rounded-lg border border-borde bg-superficie p-4"
          aria-live="polite"
        >
          <p className="sr-only">Cargando administradores…</p>
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
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
            Aún no hay administradores
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-suave">
            Crea el primer administrador para una empresa existente.
          </p>
          <div className="mt-6 flex justify-center">
            <Boton variante="acento" onClick={abrirNuevo}>
              Nuevo administrador
            </Boton>
          </div>
        </div>
      )
    }

    return (
      <UsuariosTabla
        usuarios={datos}
        empresasPorId={empresasPorId}
        idAlternando={idAlternando}
        confirmandoId={confirmandoId}
        alVer={verDetalle}
        alEditar={abrirEdicion}
        alActivar={(usuario) => alternarEstado(usuario, true)}
        alSolicitarDesactivar={(usuario) => setConfirmandoId(usuario.id)}
        alConfirmarDesactivar={(usuario) => alternarEstado(usuario, false)}
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
            : `${formatearNumero(total)} ${total === 1 ? 'administrador' : 'administradores'}`}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Administradores
          </h1>
          <p className="mt-2 max-w-prose text-base text-tinta-suave">
            Gestiona los usuarios administradores de cada empresa.
          </p>
        </div>
        <Boton variante="acento" onClick={abrirNuevo}>
          Nuevo administrador
        </Boton>
      </div>

      <div className="mt-6 grid gap-8 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:items-start">
        <section className="min-w-0 2xl:order-1">
          {credenciales && (
            <div className="mb-4">
              <BannerCredenciales
                titulo="Administrador creado"
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="filtro-usuario-empresa"
                  className="text-sm font-medium text-tinta"
                >
                  Empresa
                </label>
                <select
                  id="filtro-usuario-empresa"
                  ref={refFiltroEmpresa}
                  value={filtros.empresa_id ?? ''}
                  onChange={aplicarFiltroEmpresa}
                  disabled={cargandoEmpresas}
                  className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte disabled:opacity-60"
                >
                  <option value="">Todas</option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="filtro-usuario-activo"
                  className="text-sm font-medium text-tinta"
                >
                  Estado
                </label>
                <select
                  id="filtro-usuario-activo"
                  ref={refFiltroActivo}
                  value={
                    filtros.activo === undefined
                      ? ''
                      : String(filtros.activo)
                  }
                  onChange={aplicarFiltroActivo}
                  className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 hover:border-borde-fuerte"
                >
                  <option value="">Todos</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
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
            {errorEmpresas && (
              <p className="mt-2 text-sm text-error">{errorEmpresas}</p>
            )}
          </div>

          {renderListado()}
        </section>

        <section
          ref={refFormulario}
          aria-label={
            usuarioEditando ? 'Editar administrador' : 'Nuevo administrador'
          }
          className={`${
            formularioAbierto ? 'block' : 'hidden'
          } 2xl:sticky 2xl:top-6 2xl:order-2 2xl:block`}
        >
          <FormularioUsuario
            key={claveFormulario}
            usuario={usuarioEditando}
            empresas={empresas}
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
        titulo="Detalle del administrador"
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
                {detalle.nombre}
              </h3>
              <p className="mt-1 font-mono text-xs text-tinta-suave">
                Creado el {formatearFechaHora(detalle.creado_en)}
              </p>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Correo</dt>
                <dd className="mt-0.5 break-words font-mono text-tinta">
                  {detalle.correo}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Empresa</dt>
                <dd className="mt-0.5 text-tinta">
                  {empresasPorId[detalle.empresa_id] || '—'}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Rol</dt>
                <dd className="mt-0.5 inline-flex items-center rounded-full border border-marca/30 bg-marca-suave px-2 py-0.5 text-xs font-medium text-marca-fuerte">
                  {detalle.rol}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-xs text-tinta-suave">Estado</dt>
                <dd className="mt-0.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      detalle.activo
                        ? 'border-exito/40 bg-exito-suave text-exito-fuerte'
                        : 'border-borde bg-superficie-2 text-tinta-suave'
                    }`}
                  >
                    {detalle.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        )}
      </ModalDetalle>
    </div>
  )
}

export default AdminUsuarios
