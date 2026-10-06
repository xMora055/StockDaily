/* Formato de dinero centralizado. El backend opera en pesos colombianos (COP). */

export const MONEDA = 'COP'

/* COP no usa centavos: se muestra sin decimales, con separador de miles (punto). */
const formateador = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: MONEDA,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export const formatearMoneda = (valor) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'
  return formateador.format(numero)
}

/* Cantidades/contadores: enteros con separador de miles (punto) y sin decimales. */
const formateadorNumero = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
})

export const formatearNumero = (valor) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'
  return formateadorNumero.format(numero)
}