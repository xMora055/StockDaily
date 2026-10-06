import { useEffect, useMemo, useState } from 'react'
import Alerta from '../componentes/Alerta'
import Boton from '../componentes/Boton'
import FiltrosInventario from '../componentes/FiltrosInventario'
import FormularioMovimiento from '../componentes/FormularioMovimiento'
import TablaMovimientos from '../componentes/TablaMovimientos'
import TablaStock from '../componentes/TablaStock'
import { useInventario } from '../hooks/useInventario'
import { useMovimientosInventario } from '../hooks/useMovimientosInventario'
import { useProductos } from '../hooks/useProductos'
import { useSucursales } from '../hooks/useSucursales'
import { crearMovimiento } from '../servicios/inventario'
import { formatearNumero } from '../utilidades/formatoMoneda'

const MENSAJE_MOVIMIENTO =
  'No pudimos registrar el movimiento. Inténtalo de nuevo.'

const fechaDeHoy = () =>
  new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

const Inventario = () => {
  const [filtros, setFiltros] = useState({})
  const [claveFiltros, setClaveFiltros] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [errorMovimiento, setErrorMovimiento] = useState('')
  const [exito, setExito] = useState('')

  const {
    datos: existencias,
    cargando,
    error,
    recargar,
    pagina: paginaStock,
    porPagina: porPaginaStock,
    total: totalStock,
    totalPaginas: totalPaginasStock,
    paginaAnterior: stockAnterior,
    paginaSiguiente: stockSiguiente,
    cambiarPorPagina: cambiarPorPaginaStock,
  } = useInventario(filtros)

  const filtrosMovimientos = useMemo(
    () =>
      filtros.sucursal_id ? { sucursal_id: filtros.sucursal_id } : {},
    [filtros.sucursal_id],
  )

  const {
    datos: movimientos,
    cargando: cargandoMovimientos,
    error: errorMovimientos,
    recargar: recargarMovimientos,
    pagina: paginaMovimientos,
    porPagina: porPaginaMovimientos,
    total: totalMovimientos,
    totalPaginas: totalPaginasMovimientos,
    paginaAnterior: movimientosAnterior,
    paginaSiguiente: movimientosSiguiente,
    cambiarPorPagina: cambiarPorPaginaMovimientos,
  } = useMovimientosInventario(filtrosMovimientos)

  const {
    datos: productos,
    cargando: cargandoProductos,
    error: errorProductos,
    recargar: recargarProductos,
  } = useProductos({}, { porPaginaInicial: 100 })

  const {
    datos: sucursales,
    cargando: cargandoSucursales,
    error: errorSucursales,
    recargar: recargarSucursales,
  } = useSucursales({}, { porPaginaInicial: 100 })

  const hayFiltros = Object.keys(filtros).length > 0
  const total = totalStock
  const faltantes = existencias.filter((fila) => fila.cantidad < 0).length

  const cargandoCatalogos = cargandoProductos || cargandoSucursales
  const errorCatalogos = errorProductos || errorSucursales

  useEffect(() => {
    if (!exito) return undefined
    const temporizador = setTimeout(() => setExito(''), 4000)
    return () => clearTimeout(temporizador)
  }, [exito])

  const limpiarFiltros = () => {
    setFiltros({})
    setClaveFiltros((actual) => actual + 1)
  }

  const reintentarCatalogos = () => {
    if (errorProductos) recargarProductos()
    if (errorSucursales) recargarSucursales()
  }

  const manejarMovimiento = async (payload) => {
    setGuardando(true)
    setErrorMovimiento('')
    try {
      await crearMovimiento(payload)
      setExito('Movimiento registrado.')
      recargar()
      recargarMovimientos()
      return true
    } catch (fallo) {
      setErrorMovimiento(fallo?.message || MENSAJE_MOVIMIENTO)
      return false
    } finally {
      setGuardando(false)
    }
  }

  const renderStock = () => {
    if (cargando) {
      return (
        <div
          className="space-y-3 rounded-lg border border-borde bg-superficie p-4"
          aria-live="polite"
        >
          <p className="sr-only">Cargando existencias…</p>
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
          <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">
            {hayFiltros ? 'Sin resultados' : 'Aún no hay existencias'}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-suave">
            {hayFiltros
              ? 'No hay existencias con esos filtros. Prueba con otros criterios.'
              : 'Registra una carga inicial para empezar a controlar el inventario de tus sucursales.'}
          </p>
          {hayFiltros && (
            <div className="mt-6 flex justify-center">
              <Boton variante="secundario" onClick={limpiarFiltros}>
                Limpiar filtros
              </Boton>
            </div>
          )}
        </div>
      )
    }

    return (
      <TablaStock
        existencias={existencias}
        pagina={paginaStock}
        totalPaginas={totalPaginasStock}
        total={totalStock}
        porPagina={porPaginaStock}
        alAnterior={stockAnterior}
        alSiguiente={stockSiguiente}
        alCambiarPorPagina={cambiarPorPaginaStock}
      />
    )
  }

  const renderMovimientos = () => {
    if (cargandoMovimientos) {
      return (
        <div
          className="space-y-3 rounded-lg border border-borde bg-superficie p-4"
          aria-live="polite"
        >
          <p className="sr-only">Cargando movimientos…</p>
          {[0, 1, 2, 3].map((indice) => (
            <div
              key={indice}
              className="h-10 animate-pulse rounded bg-superficie-2"
            />
          ))}
        </div>
      )
    }

    if (errorMovimientos) {
      return (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-error/30 bg-error-suave p-5">
          <Alerta variante="error">{errorMovimientos}</Alerta>
          <Boton variante="secundario" onClick={recargarMovimientos}>
            Reintentar
          </Boton>
        </div>
      )
    }

    if (totalMovimientos === 0) {
      return (
        <div className="rounded-lg border border-dashed border-borde-fuerte bg-superficie px-6 py-12 text-center">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Sin movimientos
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-suave">
            Cuando registres cargas o ajustes, aparecerán aquí con su fecha y
            tipo.
          </p>
        </div>
      )
    }

    return (
      <TablaMovimientos
        movimientos={movimientos}
        pagina={paginaMovimientos}
        totalPaginas={totalPaginasMovimientos}
        total={totalMovimientos}
        porPagina={porPaginaMovimientos}
        alAnterior={movimientosAnterior}
        alSiguiente={movimientosSiguiente}
        alCambiarPorPagina={cambiarPorPaginaMovimientos}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-borde pb-3 font-mono text-xs text-tinta-suave">
        <span>Almacén · existencias y movimientos</span>
        <span>{fechaDeHoy()}</span>
      </div>

      <div className="mt-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Inventario
        </h1>
        <p className="mt-2 max-w-prose text-base text-tinta-suave">
          Consulta las existencias por sucursal, registra cargas iniciales y
          ajustes, y revisa el historial de movimientos del negocio.
        </p>
      </div>

      <section className="mt-8" aria-labelledby="inventario-existencias">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-borde pb-3">
          <h2
            id="inventario-existencias"
            className="font-display text-lg font-semibold tracking-tight"
          >
            Existencias
          </h2>
          <span className="font-mono text-xs text-tinta-suave">
            {cargando
              ? '…'
              : `${formatearNumero(total)} ${
                  total === 1 ? 'referencia' : 'referencias'
                }${
                  faltantes > 0
                    ? ` · ${formatearNumero(faltantes)} en faltante${
                        totalPaginasStock > 1 ? ' (esta página)' : ''
                      }`
                    : ''
                }`}
          </span>
        </div>

        <div className="mt-5">
          <FiltrosInventario
            key={claveFiltros}
            sucursales={sucursales}
            alAplicar={setFiltros}
            alLimpiar={limpiarFiltros}
            hayFiltros={hayFiltros}
          />
        </div>

        <div className="mt-5">{renderStock()}</div>
      </section>

      <div className="mt-10 grid gap-8 2xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)] 2xl:items-start">
        <aside className="2xl:sticky 2xl:top-6 2xl:order-2">
          {exito && (
            <div className="mb-4">
              <Alerta variante="exito">{exito}</Alerta>
            </div>
          )}
          <FormularioMovimiento
            productos={productos}
            sucursales={sucursales}
            cargando={cargandoCatalogos}
            errorCatalogos={errorCatalogos}
            alReintentar={reintentarCatalogos}
            guardando={guardando}
            errorEnvio={errorMovimiento}
            alGuardar={manejarMovimiento}
          />
        </aside>

        <section
          className="min-w-0 2xl:order-1"
          aria-labelledby="inventario-historial"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-borde pb-3">
            <h2
              id="inventario-historial"
              className="font-display text-lg font-semibold tracking-tight"
            >
              Historial de movimientos
            </h2>
            <span className="font-mono text-xs text-tinta-suave">
              {cargandoMovimientos
                ? '…'
                : `${formatearNumero(totalMovimientos)} ${
                    totalMovimientos === 1 ? 'movimiento' : 'movimientos'
                  }`}
            </span>
          </div>

          <div className="mt-5">{renderMovimientos()}</div>
        </section>
      </div>
    </div>
  )
}

export default Inventario
