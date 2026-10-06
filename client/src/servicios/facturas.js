import { solicitar } from '../api/clienteApi'
import { RUTA_FACTURAS } from '../utilidades/constantes'
import { agregarPaginacion, normalizarPaginado } from '../utilidades/paginacion'

const aNumero = (valor) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

const aNumeroODefecto = (valor, defecto = null) =>
  valor === null || valor === undefined ? defecto : aNumero(valor)

const normalizarDetalle = (detalle) => {
  if (!detalle) return detalle
  return {
    ...detalle,
    id: aNumero(detalle.id),
    producto_id: aNumero(detalle.producto_id),
    cantidad: aNumero(detalle.cantidad),
    precio_unitario: aNumero(detalle.precio_unitario),
    descuento_porcentaje: aNumero(detalle.descuento_porcentaje),
    impuesto_porcentaje: aNumero(detalle.impuesto_porcentaje),
    subtotal: aNumero(detalle.subtotal),
    impuesto: aNumero(detalle.impuesto),
    total: aNumero(detalle.total),
  }
}

const normalizarFactura = (factura) => {
  if (!factura) return factura
  return {
    ...factura,
    id: aNumero(factura.id),
    numero_factura: aNumero(factura.numero_factura),
    sucursal_id: aNumero(factura.sucursal_id),
    usuario_id: aNumero(factura.usuario_id),
    cliente_id: aNumeroODefecto(factura.cliente_id),
    metodo_pago_id: aNumeroODefecto(factura.metodo_pago_id),
    anulada_por: aNumeroODefecto(factura.anulada_por),
    subtotal: aNumero(factura.subtotal),
    descuento: aNumero(factura.descuento),
    impuesto: aNumero(factura.impuesto),
    total: aNumero(factura.total),
    detalles: Array.isArray(factura.detalles)
      ? factura.detalles.map(normalizarDetalle)
      : [],
  }
}

/* Fila del listado: solo se castean los campos numéricos de `FacturaResumen`. */
const normalizarFacturaResumen = (factura) => {
  if (!factura) return factura
  return {
    ...factura,
    id: aNumero(factura.id),
    numero_factura: aNumero(factura.numero_factura),
    sucursal_id: aNumero(factura.sucursal_id),
    total: aNumero(factura.total),
  }
}

const agregarTexto = (parametros, clave, valor) => {
  if (typeof valor !== 'string') return
  const texto = valor.trim()
  if (texto) parametros.set(clave, texto)
}

const esFechaSoloDia = (valor) =>
  typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)

const agregarEntero = (parametros, clave, valor) => {
  if (valor === undefined || valor === null || valor === '') return
  const numero = Number(valor)
  if (Number.isFinite(numero)) parametros.set(clave, String(Math.trunc(numero)))
}

const construirConsultaFacturas = (filtros = {}) => {
  const parametros = new URLSearchParams()

  agregarEntero(parametros, 'sucursal_id', filtros.sucursal_id)
  agregarTexto(parametros, 'estado', filtros.estado)
  agregarTexto(parametros, 'desde', filtros.desde)

  // Un `hasta` con solo fecha se expande al fin del día: el backend lo
  // interpreta como 00:00:00Z y excluiría las ventas del propio día.
  if (esFechaSoloDia(filtros.hasta)) {
    parametros.set('hasta', `${filtros.hasta}T23:59:59.999`)
  } else {
    agregarTexto(parametros, 'hasta', filtros.hasta)
  }

  agregarTexto(parametros, 'buscar', filtros.buscar)
  agregarPaginacion(parametros, filtros)

  const consulta = parametros.toString()
  return consulta ? `?${consulta}` : ''
}

/* Emite una venta en el POS. El backend responde { success: true, data: { factura } }. */
export const crearFactura = async (datos) => {
  const { factura } = await solicitar(RUTA_FACTURAS, {
    metodo: 'POST',
    cuerpo: datos,
  })
  return normalizarFactura(factura)
}

/* Listado paginado y filtrable de facturas de la empresa del usuario. */
export const listarFacturas = async (filtros = {}) => {
  const respuesta = await solicitar(
    `${RUTA_FACTURAS}${construirConsultaFacturas(filtros)}`,
  )
  return normalizarPaginado(respuesta, normalizarFacturaResumen)
}

/* Detalle de una factura con sus líneas. */
export const obtenerFactura = async (id) => {
  const { factura } = await solicitar(`${RUTA_FACTURAS}/${id}`)
  return normalizarFactura(factura)
}

/* Anula una factura `emitida` revirtiendo el stock. Solo administradores. */
export const anularFactura = async (id) => {
  const { factura } = await solicitar(`${RUTA_FACTURAS}/${id}/anular`, {
    metodo: 'PATCH',
  })
  return normalizarFactura(factura)
}
