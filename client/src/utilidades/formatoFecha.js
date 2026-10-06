/* Formato de fechas centralizado (es-CO). Devuelve "—" si el valor no es válido. */

const aFecha = (valor) => {
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

const formateadorFecha = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const formateadorHora = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
})

/* "05 oct 2026" (sin el "de" que alarga la fecha y provoca recortes). */
const fechaCompacta = (fecha) => {
  const partes = formateadorFecha.formatToParts(fecha)
  const valor = (tipo) =>
    partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${valor('day')} ${valor('month')} ${valor('year')}`
}

export const formatearFecha = (valor) => {
  const fecha = aFecha(valor)
  if (!fecha) return '—'
  return fechaCompacta(fecha)
}

export const formatearFechaHora = (valor) => {
  const fecha = aFecha(valor)
  if (!fecha) return '—'
  return `${fechaCompacta(fecha)}, ${formateadorHora.format(fecha)}`
}
