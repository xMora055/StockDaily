import { useAutenticacion } from '../hooks/useAutenticacion'
import { useEstadoConexion } from '../hooks/useEstadoConexion'

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

const Inicio = () => {
  const { usuario } = useAutenticacion()
  const estadoConexion = useEstadoConexion()

  const fecha = formatearFecha(new Date())

  const filas = [
    ['Servidor', textosConexion[estadoConexion]],
    ['Sesión', 'Activa'],
    ['Rol', formatearRol(usuario?.rol)],
    ['Empresa', `#${usuario?.empresa_id ?? '—'}`],
  ]

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

      <div className="mt-10 grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <section className="relative overflow-hidden rounded-lg bg-petroleo p-6 text-white shadow-impresa sm:p-8">
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

            <dl className="mt-6 grid gap-px overflow-hidden rounded-md bg-white/10 sm:grid-cols-2">
              {filas.map(([etiqueta, valor]) => (
                <div key={etiqueta} className="bg-petroleo px-4 py-3.5">
                  <dt className="font-mono text-xs text-white/70">{etiqueta}</dt>
                  <dd className="mt-1 truncate text-sm font-medium">{valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="flex flex-col rounded-lg border border-dashed border-borde-fuerte bg-superficie p-6 sm:p-8">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Movimiento de hoy
          </h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Ventas, cobros y devoluciones del día.
          </p>

          <div className="mt-auto flex flex-col items-start gap-3 pt-8">
            <span
              className="grid h-11 w-11 place-items-center rounded-md bg-superficie-2 text-tinta-suave"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
                <path d="M9 8h6M9 12h6" />
              </svg>
            </span>
            <p className="max-w-xs text-sm text-tinta-suave">
              Todavía no hay nada que mostrar. Cuando actives el punto de venta,
              este panel se llena solo.
            </p>
          </div>
        </section>
      </div>
    </>
  )
}

export default Inicio