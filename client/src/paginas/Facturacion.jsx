import { useState } from 'react'
import Alerta from '../componentes/Alerta'
import Boton from '../componentes/Boton'
import DetalleFactura from '../componentes/DetalleFactura'
import FiltrosFacturas from '../componentes/FiltrosFacturas'
import TablaFacturas from '../componentes/TablaFacturas'
import { useFacturas } from '../hooks/useFacturas'
import { useSucursales } from '../hooks/useSucursales'
import { formatearNumero } from '../utilidades/formatoMoneda'

const fechaDeHoy = () =>
  new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

const Facturacion = () => {
  const [filtros, setFiltros] = useState({})
  const [claveFiltros, setClaveFiltros] = useState(0)
  const [facturaSeleccionadaId, setFacturaSeleccionadaId] = useState(null)

  const {
    datos: facturas,
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
  } = useFacturas(filtros)

  const {
    datos: sucursales,
    cargando: cargandoSucursales,
    error: errorSucursales,
    recargar: recargarSucursales,
  } = useSucursales({}, { porPaginaInicial: 100 })

  const hayFiltros = Object.keys(filtros).length > 0

  const limpiarFiltros = () => {
    setFiltros({})
    setClaveFiltros((actual) => actual + 1)
  }

  const abrirDetalle = (factura) => setFacturaSeleccionadaId(factura.id)

  // Tras anular (o reconciliar un 409) el listado debe reflejar el estado.
  const manejarFacturaAnulada = () => recargar()

  const renderListado = () => {
    if (cargando) {
      return (
        <div
          className="space-y-3 rounded-lg border border-borde bg-superficie p-4"
          aria-live="polite"
        >
          <p className="sr-only">Cargando facturas…</p>
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
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
              <path d="M14 3v5h5" />
              <path d="M9 13h6M9 17h4" />
            </svg>
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
            {hayFiltros ? 'Sin resultados' : 'Aún no hay facturas'}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-suave">
            {hayFiltros
              ? 'No encontramos facturas con esos filtros. Prueba con otros criterios.'
              : 'Cuando emitas ventas desde el punto de venta, aparecerán aquí con su detalle.'}
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
      <TablaFacturas
        facturas={facturas}
        pagina={pagina}
        totalPaginas={totalPaginas}
        total={total}
        porPagina={porPagina}
        alAnterior={paginaAnterior}
        alSiguiente={paginaSiguiente}
        alCambiarPorPagina={cambiarPorPagina}
        alSeleccionar={abrirDetalle}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-borde pb-3 font-mono text-xs text-tinta-suave">
        <span>Facturación · histórico de ventas</span>
        <span>{fechaDeHoy()}</span>
      </div>

      <div className="mt-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Facturación
        </h1>
        <p className="mt-2 max-w-prose text-base text-tinta-suave">
          Consulta el histórico de ventas por sucursal, fecha o cliente, revisa
          el tique completo y anula facturas emitidas cuando haga falta.
        </p>
      </div>

      <section className="mt-8" aria-labelledby="facturacion-listado">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-borde pb-3">
          <h2
            id="facturacion-listado"
            className="font-display text-lg font-semibold tracking-tight"
          >
            Histórico
          </h2>
          <span className="font-mono text-xs text-tinta-suave">
            {cargando
              ? '…'
              : `${formatearNumero(total)} ${
                  total === 1 ? 'factura' : 'facturas'
                }`}
          </span>
        </div>

        <div className="mt-5">
          <FiltrosFacturas
            key={claveFiltros}
            sucursales={sucursales}
            cargandoSucursales={cargandoSucursales}
            errorSucursales={errorSucursales}
            alReintentarSucursales={recargarSucursales}
            alAplicar={setFiltros}
            alLimpiar={limpiarFiltros}
            hayFiltros={hayFiltros}
          />
        </div>

        <div className="mt-5">{renderListado()}</div>
      </section>

      {facturaSeleccionadaId != null && (
        <DetalleFactura
          facturaId={facturaSeleccionadaId}
          alCerrar={() => setFacturaSeleccionadaId(null)}
          alAnular={manejarFacturaAnulada}
        />
      )}
    </div>
  )
}

export default Facturacion
