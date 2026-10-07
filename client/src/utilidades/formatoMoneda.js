/* Formato de dinero centralizado. La moneda viene de usuario.empresa.moneda. */

export const MONEDA = 'COP'

/* Formato según moneda: COP sin decimales, otras con 2 decimales. */
export const formatearMoneda = (valor, moneda = 'COP') => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return '—'
  const opciones = {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: moneda === 'COP' ? 0 : 2,
    maximumFractionDigits: moneda === 'COP' ? 0 : 2,
  }
  return new Intl.NumberFormat('es-CO', opciones).format(numero)
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