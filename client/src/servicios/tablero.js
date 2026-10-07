import { solicitar } from '../api/clienteApi'
import { RUTA_TABLERO } from '../utilidades/constantes'

/*
 * El backend ya castea numeric/bigint a Number, pero normalizamos de nuevo en
 * el cliente de forma defensiva: si algún campo llega como string no rompemos
 * los cálculos ni el formato de las tarjetas.
 */
const aNumero = (valor) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

const normalizarResumen = (resumen = {}) => ({
  ventas_hoy: aNumero(resumen.ventas_hoy),
  tickets_hoy: aNumero(resumen.tickets_hoy),
  ticket_promedio_hoy: aNumero(resumen.ticket_promedio_hoy),
  ventas_periodo: aNumero(resumen.ventas_periodo),
  tickets_periodo: aNumero(resumen.tickets_periodo),
})

const normalizarPuntoSerie = (punto = {}) => ({
  fecha: punto.fecha,
  total: aNumero(punto.total),
  tickets: aNumero(punto.tickets),
})

const normalizarTopProducto = (item = {}) => ({
  ...item,
  producto_id: aNumero(item.producto_id),
  unidades: aNumero(item.unidades),
  total: aNumero(item.total),
})

const normalizarVentaSucursal = (item = {}) => ({
  ...item,
  sucursal_id: aNumero(item.sucursal_id),
  total: aNumero(item.total),
  tickets: aNumero(item.tickets),
})

const normalizarFaltante = (item = {}) => ({
  ...item,
  producto_id: aNumero(item.producto_id),
  cantidad: aNumero(item.cantidad),
  faltante: aNumero(item.faltante),
})

const agregarEntero = (parametros, clave, valor) => {
  if (valor === undefined || valor === null || valor === '') return
  const numero = Number(valor)
  if (Number.isFinite(numero)) parametros.set(clave, String(Math.trunc(numero)))
}

/*
 * GET /api/v1/tablero/inicio (Bearer automático). Solo envía los parámetros
 * presentes; el backend aplica sus propios defaults (`dias` = 30).
 */
export const obtenerTablero = async ({ dias, sucursal_id } = {}) => {
  const parametros = new URLSearchParams()
  agregarEntero(parametros, 'dias', dias)
  agregarEntero(parametros, 'sucursal_id', sucursal_id)

  const consulta = parametros.toString()
  const ruta = consulta ? `${RUTA_TABLERO}?${consulta}` : RUTA_TABLERO

  const datos = await solicitar(ruta)
  const stock = datos?.stock_faltante || {}

  return {
    periodo_dias: aNumero(datos?.periodo_dias),
    resumen: normalizarResumen(datos?.resumen),
    serie_ventas: Array.isArray(datos?.serie_ventas)
      ? datos.serie_ventas.map(normalizarPuntoSerie)
      : [],
    top_productos: Array.isArray(datos?.top_productos)
      ? datos.top_productos.map(normalizarTopProducto)
      : [],
    ventas_por_sucursal: Array.isArray(datos?.ventas_por_sucursal)
      ? datos.ventas_por_sucursal.map(normalizarVentaSucursal)
      : [],
    stock_faltante: {
      total: aNumero(stock.total),
      items: Array.isArray(stock.items)
        ? stock.items.map(normalizarFaltante)
        : [],
    },
  }
}
