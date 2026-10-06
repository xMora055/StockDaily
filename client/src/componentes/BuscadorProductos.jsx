import { useMemo, useState } from 'react'
import Alerta from './Alerta'
import Boton from './Boton'
import { formatearMoneda, formatearNumero } from '../utilidades/formatoMoneda'

const MENSAJE_CATALOGO =
  'No hay productos activos. Actívalos en la sección Productos para venderlos.'

const normalizar = (texto) =>
  (texto ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const BuscadorProductos = ({
  productos,
  cargando = false,
  error = '',
  alAgregar,
  alReintentar,
}) => {
  const [consulta, setConsulta] = useState('')

  const termino = normalizar(consulta.trim())
  const resultados = useMemo(() => {
    if (!termino) return productos
    return productos.filter(
      (producto) =>
        normalizar(producto.nombre).includes(termino) ||
        normalizar(producto.codigo).includes(termino),
    )
  }, [productos, termino])

  const manejarEnvio = (evento) => {
    evento.preventDefault()
    if (resultados.length === 0) return
    alAgregar(resultados[0])
    setConsulta('')
  }

  const renderResultados = () => {
    if (cargando) {
      return (
        <div className="space-y-2 p-4" aria-live="polite">
          <p className="sr-only">Cargando productos…</p>
          {[0, 1, 2, 3, 4].map((indice) => (
            <div
              key={indice}
              className="h-12 animate-pulse rounded bg-superficie-2"
            />
          ))}
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-start gap-4 p-5">
          <Alerta variante="error">{error}</Alerta>
          <Boton variante="secundario" onClick={alReintentar}>
            Reintentar
          </Boton>
        </div>
      )
    }

    if (productos.length === 0) {
      return (
        <p className="px-4 py-10 text-center text-sm text-tinta-suave">
          {MENSAJE_CATALOGO}
        </p>
      )
    }

    if (resultados.length === 0) {
      return (
        <p className="px-4 py-10 text-center text-sm text-tinta-suave">
          Sin coincidencias para «{consulta.trim()}». Prueba con otro nombre o
          código.
        </p>
      )
    }

    return (
      <ul className="max-h-[24rem] overflow-y-auto">
        {resultados.map((producto) => (
          <li key={producto.id}>
            <button
              type="button"
              onClick={() => alAgregar(producto)}
              className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-borde px-4 py-3 text-left transition-colors duration-150 hover:bg-superficie-2 focus-visible:bg-superficie-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-tinta">
                  {producto.nombre}
                </span>
                <span className="mt-0.5 block truncate font-mono text-xs text-tinta-suave">
                  {producto.codigo || 'Sin código'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-sm tabular-nums text-tinta">
                  {formatearMoneda(producto.precio_unitario)}
                </span>
                <span
                  className="grid h-8 w-8 place-items-center rounded border border-borde-fuerte text-tinta-suave"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-borde bg-superficie">
      <div className="border-b border-borde p-4">
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor="pos-buscar"
            className="text-sm font-medium text-tinta"
          >
            Buscar producto
          </label>
          {!cargando && !error && (
            <span className="font-mono text-xs text-tinta-suave">
              {formatearNumero(resultados.length)} de{' '}
              {formatearNumero(productos.length)}
            </span>
          )}
        </div>
        <form role="search" onSubmit={manejarEnvio} className="mt-1.5">
          <input
            id="pos-buscar"
            type="search"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Nombre o código…"
            autoComplete="off"
            spellCheck="false"
            autoFocus
            className="h-11 w-full rounded-md border border-borde bg-superficie px-3 text-base text-tinta transition-colors duration-150 placeholder:text-tinta-suave/70 hover:border-borde-fuerte"
          />
        </form>
        <p className="mt-2 text-xs text-tinta-suave">
          Pulsa Enter para agregar el primer resultado.
        </p>
      </div>

      {renderResultados()}
    </div>
  )
}

export default BuscadorProductos
