import Alerta from '../componentes/Alerta'
import AlertaStockFaltante from '../componentes/AlertaStockFaltante'
import Boton from '../componentes/Boton'
import GraficoBarras from '../componentes/GraficoBarras'
import GraficoVentas from '../componentes/GraficoVentas'
import TarjetaKpi from '../componentes/TarjetaKpi'
import { useAutenticacion } from '../hooks/useAutenticacion'
import { useEstadoConexion } from '../hooks/useEstadoConexion'
import { useTablero } from '../hooks/useTablero'
import { formatearMoneda, formatearNumero } from '../utilidades/formatoMoneda'

const PERIODOS = [7, 30, 90]

const formatearRol = (rol) => {
  if (!rol) return 'Sin rol'
  return rol.charAt(0).toUpperCase() + rol.slice(1)
}

const formatearFecha = (fecha) => {
  const texto = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(fecha)
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const contar = (valor, singular, plural) => {
  const numero = Number(valor) || 0
  return `${formatearNumero(numero)} ${numero === 1 ? singular : plural}`
}

const textosConexion = {
  verificando: 'Verificando el servidor',
  conectado: 'Servidor conectado',
  'sin-conexion': 'Sin conexión con el servidor',
}

const coloresConexion = {
  verificando: 'bg-aviso',
  conectado: 'bg-exito',
  'sin-conexion': 'bg-error',
}

const SelectorPeriodo = ({ dias, alCambiar }) => (
  <div
    role="group"
    aria-label="Periodo del tablero"
    className="inline-flex rounded-md border border-borde bg-superficie p-1"
  >
    {PERIODOS.map((opcion) => {
      const activo = Number(dias) === opcion
      return (
        <button
          key={opcion}
          type="button"
          aria-pressed={activo}
          onClick={() => alCambiar(opcion)}
          className={`h-10 rounded px-3.5 font-mono text-xs tabular-nums transition-colors duration-150 ${
            activo
              ? 'bg-petroleo text-fondo'
              : 'text-tinta-suave hover:bg-superficie-2 hover:text-tinta'
          }`}
        >
          {opcion} días
        </button>
      )
    })}
  </div>
)

const EsqueletoTablero = () => (
  <div className="space-y-6" aria-live="polite">
    <p className="sr-only">Cargando el tablero…</p>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((indice) => (
        <div
          key={indice}
          className="rounded-lg border border-borde bg-superficie p-5"
        >
          <div className="h-3.5 w-24 animate-pulse rounded bg-superficie-2" />
          <div className="mt-4 h-8 w-32 animate-pulse rounded bg-superficie-2" />
          <div className="mt-2.5 h-3 w-20 animate-pulse rounded bg-superficie-2" />
        </div>
      ))}
    </div>

    <div className="h-64 animate-pulse rounded-lg border border-borde bg-superficie" />

    <div className="grid gap-6 xl:grid-cols-2">
      <div className="h-56 animate-pulse rounded-lg border border-borde bg-superficie" />
      <div className="h-56 animate-pulse rounded-lg border border-borde bg-superficie" />
    </div>
  </div>
)

const CardBarras = ({
  titulo,
  subtitulo,
  items,
  mensajeVacio,
  formatearValor,
  formatearSecundario,
  sufijoSecundario,
}) => {
  const cantidad = items.length
  const tieneDatos = cantidad > 0

  return (
    <section className="overflow-hidden rounded-lg border border-borde bg-superficie p-5 shadow-impresa">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-borde pb-3">
        <h3 className="font-display text-base font-semibold tracking-tight">
          {titulo}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {tieneDatos && (
            <span className="font-mono text-xs text-tinta-suave">
              Mostrando {formatearNumero(cantidad)} de{' '}
              {formatearNumero(cantidad)}
            </span>
          )}
          <span className="font-mono text-xs text-tinta-suave">
            {subtitulo}
          </span>
        </div>
      </div>
      <div
        className="mt-5 overflow-y-auto max-h-64 xl:max-h-80"
        tabIndex={0}
        role="region"
        aria-label={`${titulo}: lista desplazable`}
      >
        <GraficoBarras
          items={items}
          formatearValor={formatearValor}
          formatearSecundario={formatearSecundario}
          sufijoSecundario={sufijoSecundario}
          mensajeVacio={mensajeVacio}
        />
      </div>
    </section>
  )
}

const Inicio = () => {
  const { usuario } = useAutenticacion()
  const moneda = usuario?.empresa?.moneda || 'COP'
  const estadoConexion = useEstadoConexion()
  const { datos, cargando, error, recargar, dias, cambiarDias } = useTablero()

  const fecha = formatearFecha(new Date())
  const hayDatos = Boolean(datos)
  const cargandoInicial = cargando && !hayDatos

  const filas = [
    ['Servidor', textosConexion[estadoConexion]],
    ['Sesión', 'Activa'],
    ['Rol', formatearRol(usuario?.rol)],
    ['Empresa', `#${usuario?.empresa_id ?? '—'}`],
  ]

  const renderTablero = () => {
    const { resumen, serie_ventas: serie, top_productos: topProductos } = datos

    const itemsTopProductos = topProductos.map((producto) => ({
      etiqueta: producto.producto_nombre,
      valor: producto.unidades,
      secundario: producto.total,
    }))

    const itemsSucursales = datos.ventas_por_sucursal.map((sucursal) => ({
      etiqueta: sucursal.sucursal_nombre,
      valor: sucursal.total,
      secundario: sucursal.tickets,
    }))

    const diasPeriodo = datos.periodo_dias || dias

    return (
      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TarjetaKpi
            titulo="Ventas de hoy"
            valor={formatearMoneda(resumen.ventas_hoy, moneda)}
            detalle={`${contar(resumen.tickets_hoy, 'ticket', 'tickets')} hoy`}
          />
          <TarjetaKpi
            titulo="Tickets de hoy"
            valor={formatearNumero(resumen.tickets_hoy)}
            detalle="Ventas cerradas hoy"
          />
          <TarjetaKpi
            titulo="Ticket promedio"
            valor={formatearMoneda(resumen.ticket_promedio_hoy, moneda)}
            detalle="Promedio de las ventas de hoy"
          />
          <TarjetaKpi
            titulo="Ventas del periodo"
            valor={formatearMoneda(resumen.ventas_periodo, moneda)}
            detalle={`${contar(
              resumen.tickets_periodo,
              'ticket',
              'tickets',
            )} en ${formatearNumero(diasPeriodo)} días`}
          />
        </div>

        <GraficoVentas
          serie={serie}
          titulo={`Ventas de los últimos ${formatearNumero(diasPeriodo)} días`}
          moneda={moneda}
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <CardBarras
            titulo="Top productos"
            subtitulo="Por unidades vendidas"
            items={itemsTopProductos}
            formatearValor={formatearNumero}
            formatearSecundario={(valor) => formatearMoneda(valor, moneda)}
            mensajeVacio="Aún no hay ventas de productos en el periodo."
          />

          <CardBarras
            titulo="Ventas por sucursal"
            subtitulo="Total del periodo"
            items={itemsSucursales}
            formatearValor={(valor) => formatearMoneda(valor, moneda)}
            formatearSecundario={formatearNumero}
            sufijoSecundario="tickets"
            mensajeVacio="No hay sucursales con ventas en el periodo."
          />
        </div>

        <AlertaStockFaltante
          total={datos.stock_faltante.total}
          items={datos.stock_faltante.items}
        />
      </div>
    )
  }

  const renderContenido = () => {
    if (cargandoInicial) return <EsqueletoTablero />

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

    if (hayDatos) return renderTablero()

    return (
      <div className="rounded-lg border border-dashed border-borde-fuerte bg-superficie px-6 py-14 text-center">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Todavía no hay movimiento
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-tinta-suave">
          Cuando registres ventas desde el punto de venta, este tablero se
          llena solo.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-tinta-suave">{fecha}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Hola, {usuario?.nombre}
          </h1>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-borde bg-superficie px-3 py-1.5 font-mono text-xs text-tinta-suave">
          <span
            className={`h-2 w-2 rounded-full ${
              coloresConexion[estadoConexion]
            } ${estadoConexion === 'verificando' ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          />
          {textosConexion[estadoConexion]}
        </span>
      </div>

      <p className="mt-4 max-w-prose text-base text-tinta-suave">
        Este es el punto de partida del panel. Desde aquí administras tus
        productos, el inventario, el punto de venta y la facturación.
      </p>

      <section
        aria-labelledby="titulo-movimiento"
        className="mt-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="titulo-movimiento"
              className="font-display text-2xl font-semibold tracking-tight"
            >
              Movimiento del negocio
            </h2>
            <p className="mt-1 text-sm text-tinta-suave">
              Ventas, tickets, productos y alertas del periodo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {cargando && hayDatos && (
              <span
                className="font-mono text-xs text-tinta-suave"
                aria-live="polite"
              >
                Actualizando…
              </span>
            )}
            <SelectorPeriodo dias={dias} alCambiar={cambiarDias} />
          </div>
        </div>

        <div className="mt-6">{renderContenido()}</div>
      </section>

      <section className="relative mt-10 overflow-hidden rounded-lg bg-petroleo p-6 text-white shadow-impresa sm:p-8">
        <div
          className="grano pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(60% 60% at 100% 0%, oklch(0.5 0.082 196 / 0.5), transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Estado del sistema
          </h2>
          <p className="mt-1 text-sm text-white/70">
            Lo que ya está listo en tu cuenta.
          </p>

          <dl className="mt-6 grid gap-px overflow-hidden rounded-md bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {filas.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="bg-petroleo px-4 py-3.5">
                <dt className="font-mono text-xs text-white/70">{etiqueta}</dt>
                <dd className="mt-1 truncate text-sm font-medium">{valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  )
}

export default Inicio
