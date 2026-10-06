import { solicitar } from '../api/clienteApi'
import {
  RUTA_INVENTARIO_MOVIMIENTOS,
  RUTA_INVENTARIO_STOCK,
} from '../utilidades/constantes'

const PAGINA_POR_DEFECTO = 10
const PAGINA_MAXIMA = 100

const aNumero = (valor) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

const aNumeroODefecto = (valor) => {
  if (valor === null || valor === undefined) return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

const aEntero = (valor, porDefecto = 0) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Math.trunc(numero) : porDefecto
}

const acotarEntero = (valor, porDefecto, minimo, maximo) =>
  Math.min(Math.max(aEntero(valor, porDefecto), minimo), maximo)

const limpiarTexto = (valor) => {
  if (typeof valor !== 'string') return valor
  const texto = valor.trim()
  return texto === '' ? null : texto
}

const normalizarStock = (fila) => {
  if (!fila) return fila
  return {
    ...fila,
    producto_id: aNumero(fila.producto_id),
    sucursal_id: aNumero(fila.sucursal_id),
    cantidad: aNumero(fila.cantidad),
  }
}

const normalizarMovimiento = (movimiento) => {
  if (!movimiento) return movimiento
  return {
    ...movimiento,
    id: aNumero(movimiento.id),
    producto_id: aNumero(movimiento.producto_id),
    sucursal_id: aNumero(movimiento.sucursal_id),
    cantidad: aNumero(movimiento.cantidad),
    usuario_id: aNumeroODefecto(movimiento.usuario_id),
    factura_id: aNumeroODefecto(movimiento.factura_id),
  }
}

/* El backend responde `{ items, pagina, por_pagina, total, total_paginas }`.
   Normalizamos con defaults defensivos por si faltara algún campo. */
const normalizarPaginado = (respuesta, normalizarItem) => {
  const bruto = Array.isArray(respuesta) ? { items: respuesta } : respuesta || {}
  const items = Array.isArray(bruto.items)
    ? bruto.items.map(normalizarItem)
    : []

  const porPagina = acotarEntero(
    bruto.por_pagina,
    PAGINA_POR_DEFECTO,
    1,
    PAGINA_MAXIMA,
  )
  const total = Math.max(0, aEntero(bruto.total, items.length))
  const pagina = Math.max(1, aEntero(bruto.pagina, 1))
  const totalPaginasCalculado = total > 0 ? Math.ceil(total / porPagina) : 0
  const totalPaginas = Math.max(
    0,
    aEntero(bruto.total_paginas, totalPaginasCalculado),
  )

  return {
    items,
    pagina,
    por_pagina: porPagina,
    total,
    total_paginas: totalPaginas,
  }
}

const agregarEntero = (parametros, clave, valor) => {
  if (valor === undefined || valor === null || valor === '') return
  const numero = Number(valor)
  if (Number.isFinite(numero)) parametros.set(clave, String(numero))
}

const agregarPaginacion = (parametros, filtros) => {
  agregarEntero(parametros, 'pagina', filtros.pagina)
  agregarEntero(parametros, 'por_pagina', filtros.por_pagina)
}

const construirConsultaStock = (filtros = {}) => {
  const parametros = new URLSearchParams()

  agregarEntero(parametros, 'sucursal_id', filtros.sucursal_id)
  agregarEntero(parametros, 'producto_id', filtros.producto_id)

  const buscar = filtros.buscar?.trim()
  if (buscar) parametros.set('buscar', buscar)
  if (filtros.solo_faltantes === true) {
    parametros.set('solo_faltantes', 'true')
  }
  agregarPaginacion(parametros, filtros)

  const consulta = parametros.toString()
  return consulta ? `?${consulta}` : ''
}

const construirConsultaMovimientos = (filtros = {}) => {
  const parametros = new URLSearchParams()

  agregarEntero(parametros, 'producto_id', filtros.producto_id)
  agregarEntero(parametros, 'sucursal_id', filtros.sucursal_id)

  const tipo = filtros.tipo?.trim()
  if (tipo) parametros.set('tipo', tipo)
  if (filtros.desde) parametros.set('desde', filtros.desde)
  if (filtros.hasta) parametros.set('hasta', filtros.hasta)
  agregarPaginacion(parametros, filtros)

  const consulta = parametros.toString()
  return consulta ? `?${consulta}` : ''
}

export const listarStock = async (filtros = {}) => {
  const respuesta = await solicitar(
    `${RUTA_INVENTARIO_STOCK}${construirConsultaStock(filtros)}`,
  )
  return normalizarPaginado(respuesta, normalizarStock)
}

export const listarMovimientos = async (filtros = {}) => {
  const respuesta = await solicitar(
    `${RUTA_INVENTARIO_MOVIMIENTOS}${construirConsultaMovimientos(filtros)}`,
  )
  return normalizarPaginado(respuesta, normalizarMovimiento)
}

export const crearMovimiento = async (datos) => {
  const respuesta = await solicitar(RUTA_INVENTARIO_MOVIMIENTOS, {
    metodo: 'POST',
    cuerpo: {
      producto_id: aNumero(datos.producto_id),
      sucursal_id: aNumero(datos.sucursal_id),
      tipo: datos.tipo,
      cantidad: aNumero(datos.cantidad),
      observacion: limpiarTexto(datos.observacion),
    },
  })

  return {
    movimiento: normalizarMovimiento(respuesta?.movimiento),
    stock: normalizarStock(respuesta?.stock),
  }
}
