import { useId } from 'react'
import { formatearMoneda, formatearNumero } from '../utilidades/formatoMoneda'

const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

/* Etiqueta compacta "05 oct" a partir de "YYYY-MM-DD" (sin desfase horario). */
const etiquetaFecha = (fecha) => {
  if (typeof fecha !== 'string') return ''
  const partes = fecha.split('-')
  if (partes.length !== 3) return fecha

  const numeroMes = Number(partes[1])
  const numeroDia = Number(partes[2])
  if (
    !Number.isFinite(numeroMes) ||
    numeroMes < 1 ||
    numeroMes > 12 ||
    !Number.isFinite(numeroDia)
  ) {
    return fecha
  }
  return `${numeroDia} ${MESES[numeroMes - 1]}`
}

const ANCHO = 720
const ALTO = 200
const TOPE = 4
const BASE = ALTO - 6
const LATERAL = 10

const GraficoVentas = ({ serie = [], titulo = 'Ventas por día', moneda = 'COP' }) => {
  const idBase = useId().replace(/:/g, '')
  const idGradiente = `${idBase}-gradiente`

  const puntos = (Array.isArray(serie) ? serie : [])
    .filter((punto) => punto && typeof punto === 'object')
    .map((punto) => ({
      fecha: punto.fecha,
      total: Number(punto.total) || 0,
      tickets: Number(punto.tickets) || 0,
    }))

  if (puntos.length === 0) {
    return (
      <figure className="rounded-lg border border-dashed border-borde-fuerte bg-superficie p-5">
        <figcaption className="font-display text-base font-semibold tracking-tight">
          {titulo}
        </figcaption>
        <p className="mt-3 text-sm text-tinta-suave">
          Todavía no hay ventas registradas en el periodo.
        </p>
      </figure>
    )
  }

  const totalSerie = puntos.reduce((acumulado, punto) => acumulado + punto.total, 0)
  const maximo = puntos.reduce(
    (mayor, punto) => Math.max(mayor, punto.total),
    0,
  )
  const hayVentas = maximo > 0

  const xInicio = LATERAL
  const xFin = ANCHO - LATERAL
  const anchoPlot = xFin - xInicio
  const altoPlot = BASE - TOPE

  const posicionX = (indice) =>
    puntos.length === 1
      ? ANCHO / 2
      : xInicio + (indice / (puntos.length - 1)) * anchoPlot
  const posicionY = (total) =>
    hayVentas ? BASE - (total / maximo) * altoPlot : BASE

  const coordenadas = puntos.map((punto, indice) => ({
    ...punto,
    x: posicionX(indice),
    y: posicionY(punto.total),
  }))

  const dLinea = coordenadas
    .map(
      (punto, indice) =>
        `${indice === 0 ? 'M' : 'L'}${punto.x.toFixed(2)},${punto.y.toFixed(2)}`,
    )
    .join(' ')

  const ultimo = coordenadas[coordenadas.length - 1]
  const primero = coordenadas[0]
  const dArea = `${dLinea} L${ultimo.x.toFixed(2)},${BASE} L${primero.x.toFixed(
    2,
  )},${BASE} Z`

  const indicesEtiquetas = [
    ...new Set([
      0,
      Math.round((puntos.length - 1) * 0.25),
      Math.round((puntos.length - 1) * 0.5),
      Math.round((puntos.length - 1) * 0.75),
      puntos.length - 1,
    ]),
  ].sort((a, b) => a - b)

  const resumen = `Serie de ventas de ${formatearNumero(
    puntos.length,
  )} días. Total ${formatearMoneda(totalSerie, moneda)}. Día de mayor venta ${formatearMoneda(
    maximo,
    moneda,
  )}.`

  return (
    <figure className="overflow-hidden rounded-lg border border-borde bg-superficie shadow-impresa">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-borde px-5 py-4">
        <span className="font-display text-base font-semibold tracking-tight">
          {titulo}
        </span>
        <span className="font-mono text-xs text-tinta-suave">
          Total {formatearMoneda(totalSerie, moneda)}
        </span>
      </figcaption>

      <div className="px-4 pb-3 pt-6">
        <div className="relative">
          <span className="pointer-events-none absolute left-0 top-0 -translate-y-full font-mono text-[11px] tabular-nums text-tinta-suave">
            {formatearMoneda(maximo, moneda)}
          </span>

          {!hayVentas && (
            <p className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-xs text-tinta-suave">
              Sin ventas registradas en el periodo
            </p>
          )}

          <svg
            viewBox={`0 0 ${ANCHO} ${ALTO}`}
            role="img"
            aria-label={resumen}
            className="h-auto w-full"
          >
            <defs>
              <linearGradient
                id={idGradiente}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  style={{ stopColor: 'var(--color-marca)', stopOpacity: 0.32 }}
                />
                <stop
                  offset="100%"
                  style={{ stopColor: 'var(--color-marca)', stopOpacity: 0.02 }}
                />
              </linearGradient>
            </defs>

            <g aria-hidden="true">
              <line
                x1={xInicio}
                y1={TOPE}
                x2={xFin}
                y2={TOPE}
                style={{ stroke: 'var(--color-borde)' }}
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <line
                x1={xInicio}
                y1={BASE}
                x2={xFin}
                y2={BASE}
                style={{ stroke: 'var(--color-borde-fuerte)' }}
                strokeWidth="1"
              />
            </g>

            <g aria-hidden="true">
              {hayVentas && <path d={dArea} fill={`url(#${idGradiente})`} />}
              <path
                d={dLinea}
                fill="none"
                style={{ stroke: 'var(--color-marca)' }}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>

            {hayVentas && puntos.length <= 31 && (
              <g aria-hidden="true">
                {coordenadas.map((punto, indice) => (
                  <circle
                    key={`${punto.fecha}-${indice}`}
                    cx={punto.x}
                    cy={punto.y}
                    r="2.8"
                    style={{
                      fill: 'var(--color-superficie)',
                      stroke: 'var(--color-marca)',
                    }}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>
                      {`${etiquetaFecha(punto.fecha)} · ${formatearMoneda(
                        punto.total,
                        moneda,
                      )}`}
                    </title>
                  </circle>
                ))}
              </g>
            )}
          </svg>
        </div>

        <div className="relative mt-2 h-4" aria-hidden="true">
          {indicesEtiquetas.map((indice) => {
            const punto = coordenadas[indice]
            if (!punto) return null
            const esPrimero = indice === 0
            const esUltimo = indice === puntos.length - 1
            const transformar = esPrimero
              ? 'translateX(0)'
              : esUltimo
                ? 'translateX(-100%)'
                : 'translateX(-50%)'
            return (
              <span
                key={`${punto.fecha}-${indice}`}
                className="absolute font-mono text-[11px] text-tinta-suave"
                style={{
                  left: `${(punto.x / ANCHO) * 100}%`,
                  transform: transformar,
                }}
              >
                {etiquetaFecha(punto.fecha)}
              </span>
            )
          })}
        </div>
      </div>
    </figure>
  )
}

export default GraficoVentas
