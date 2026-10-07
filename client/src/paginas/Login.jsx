import { useState } from 'react'
import Alerta from '../componentes/Alerta'
import Boton from '../componentes/Boton'
import CampoEntrada from '../componentes/CampoEntrada'
import Marca from '../componentes/Marca'
import { useAutenticacion } from '../hooks/useAutenticacion'
import { useEstadoConexion } from '../hooks/useEstadoConexion'
import { mensajeErrorApi } from '../utilidades/manejoErrores'

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validarCorreo = (correo) => {
  if (!correo.trim()) return 'Ingresa tu correo.'
  if (!PATRON_CORREO.test(correo.trim())) return 'Ingresa un correo válido.'
  return ''
}

const validarPassword = (password) => {
  if (!password) return 'Ingresa tu contraseña.'
  return ''
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

const beneficios = [
  'Cobra y emite la factura desde el mismo mostrador.',
  'El inventario se descuenta con cada venta.',
  'Cierra la caja sin cuadrar planillas aparte.',
]

const fechaDeHoy = () =>
  new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date())

const EstadoConexion = ({ estado }) => (
  <p
    className="flex items-center gap-2 font-mono text-xs text-white/70"
    aria-live="polite"
  >
    <span
      className={`h-2 w-2 rounded-full ${coloresConexion[estado]} ${estado === 'verificando' ? 'animate-pulse' : ''}`}
      aria-hidden="true"
    />
    {textosConexion[estado]}
  </p>
)

const Login = () => {
  const { iniciarSesion } = useAutenticacion()
  const estadoConexion = useEstadoConexion()

  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [recordar, setRecordar] = useState(true)
  const [tocado, setTocado] = useState({ correo: false, password: false })
  const [errorEnvio, setErrorEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)

  const errorCorreo = tocado.correo ? validarCorreo(correo) : ''
  const errorPassword = tocado.password ? validarPassword(password) : ''

  const manejarEnvio = async (evento) => {
    evento.preventDefault()
    setTocado({ correo: true, password: true })
    if (validarCorreo(correo) || validarPassword(password)) return

    setEnviando(true)
    setErrorEnvio('')
    try {
      await iniciarSesion({ correo: correo.trim(), password }, recordar)
    } catch (error) {
      setErrorEnvio(mensajeErrorApi(error))
      setEnviando(false)
    }
  }

  return (
    <main className="relative min-h-svh w-full bg-fondo lg:grid lg:grid-cols-[minmax(0,11fr)_minmax(0,13fr)]">
      <section className="relative flex flex-col overflow-hidden bg-petroleo px-6 py-7 text-white sm:px-10 lg:justify-between lg:px-12 lg:py-12">
        <div
          className="grano pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(70% 55% at 88% -10%, oklch(0.5 0.082 196 / 0.55), transparent 70%)',
          }}
          aria-hidden="true"
        />
        <div
          className="seam-x absolute inset-x-0 bottom-0 h-px text-fondo/40 lg:seam-y lg:left-auto lg:top-0 lg:h-auto lg:w-px"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-3">
          <Marca tono="claro" />
          <span className="font-display text-lg font-semibold tracking-tight">
            StockDaily
          </span>
        </div>

        <div className="relative mt-10 lg:mt-0">
          <h2 className="max-w-md text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            La caja cuadra sola.
          </h2>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-white/85">
            Factura, descuenta el stock y mira cómo va el día sin salir del
            mostrador.
          </p>

          <ul className="mt-9 hidden max-w-sm flex-col gap-3 lg:flex">
            {beneficios.map((texto) => (
              <li
                key={texto}
                className="flex items-start gap-3 text-sm text-white/90"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="mt-0.5 h-4 w-4 shrink-0 text-acento"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m5 12.5 4.5 4.5L19 7" />
                </svg>
                <span>{texto}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10 lg:mt-0">
          <EstadoConexion estado={estadoConexion} />
        </div>
      </section>

      <section className="flex items-start justify-center px-6 py-12 sm:px-8 lg:px-16 lg:pt-20">
        <div className="anim-aparecer w-full max-w-md">
          <div className="flex items-center justify-between border-b border-borde pb-3 font-mono text-xs text-tinta-suave">
            <span>Acceso</span>
            <span>{fechaDeHoy()}</span>
          </div>

          <h1 className="mt-8 text-balance font-display text-4xl font-semibold tracking-tight">
            Inicia sesión
          </h1>
          <p className="mt-2 text-base text-tinta-suave">
            Entra con el correo de tu empresa.
          </p>

          {errorEnvio && (
            <div className="mt-6">
              <Alerta variante="error">{errorEnvio}</Alerta>
            </div>
          )}

          <form
            className="mt-6 flex flex-col gap-5"
            onSubmit={manejarEnvio}
            noValidate
          >
            <CampoEntrada
              id="correo"
              etiqueta="Correo"
              tipo="email"
              valor={correo}
              alCambiar={setCorreo}
              alSalir={() =>
                setTocado((previo) => ({ ...previo, correo: true }))
              }
              error={errorCorreo}
              valido={tocado.correo && !errorCorreo && Boolean(correo)}
              enviando={enviando}
              autoComplete="email"
              inputMode="email"
              requerido
            />

            <CampoEntrada
              id="password"
              etiqueta="Contraseña"
              tipo="password"
              valor={password}
              alCambiar={setPassword}
              alSalir={() =>
                setTocado((previo) => ({ ...previo, password: true }))
              }
              error={errorPassword}
              valido={tocado.password && !errorPassword && Boolean(password)}
              enviando={enviando}
              autoComplete="current-password"
              requerido
            />

            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-tinta">
              <input
                type="checkbox"
                checked={recordar}
                onChange={(evento) => setRecordar(evento.target.checked)}
                disabled={enviando}
                className="h-5 w-5 rounded border-borde-fuerte accent-marca"
              />
              Recordar sesión en este equipo
            </label>

            <Boton tipo="submit" cargando={enviando} className="w-full">
              {enviando ? 'Entrando…' : 'Entrar'}
            </Boton>
          </form>

          <p className="mt-7 border-t border-borde pt-4 text-sm text-tinta-suave">
            ¿No puedes entrar? Pídele a un administrador que revise tu acceso.
          </p>
        </div>
      </section>
    </main>
  )
}

export default Login
