import { solicitar } from '../api/clienteApi'
import { RUTA_PRODUCTOS } from '../utilidades/constantes'
import {
  agregarPaginacion,
  normalizarPaginado,
} from '../utilidades/paginacion'

const aNumero = (valor) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

const normalizarProducto = (producto) => {
  if (!producto) return producto
  return {
    ...producto,
    precio_unitario: aNumero(producto.precio_unitario),
    impuesto_porcentaje: aNumero(producto.impuesto_porcentaje),
    categoria_id:
      producto.categoria_id === null || producto.categoria_id === undefined
        ? null
        : aNumero(producto.categoria_id),
  }
}

const construirConsulta = (filtros = {}) => {
  const parametros = new URLSearchParams()
  const nombre = filtros.nombre?.trim()
  const codigo = filtros.codigo?.trim()

  if (nombre) parametros.set('nombre', nombre)
  if (codigo) parametros.set('codigo', codigo)

  if (
    filtros.categoria_id !== undefined &&
    filtros.categoria_id !== null &&
    filtros.categoria_id !== ''
  ) {
    parametros.set('categoria_id', String(filtros.categoria_id))
  }

  if (typeof filtros.activo === 'boolean') {
    parametros.set('activo', String(filtros.activo))
  }

  agregarPaginacion(parametros, filtros)

  const consulta = parametros.toString()
  return consulta ? `?${consulta}` : ''
}

const limpiarTexto = (valor) => {
  if (typeof valor !== 'string') return valor
  const texto = valor.trim()
  return texto === '' ? null : texto
}

const prepararPayload = (datos, { requiereObligatorios }) => {
  const payload = {}

  if (requiereObligatorios || datos.codigo !== undefined) {
    payload.codigo = limpiarTexto(datos.codigo) ?? ''
  }
  if (requiereObligatorios || datos.nombre !== undefined) {
    payload.nombre = limpiarTexto(datos.nombre) ?? ''
  }
  if (datos.descripcion !== undefined) {
    payload.descripcion = limpiarTexto(datos.descripcion)
  }
  if (datos.precio_unitario !== undefined && datos.precio_unitario !== '') {
    payload.precio_unitario = aNumero(datos.precio_unitario)
  }
  if (
    datos.impuesto_porcentaje !== undefined &&
    datos.impuesto_porcentaje !== ''
  ) {
    payload.impuesto_porcentaje = aNumero(datos.impuesto_porcentaje)
  }
  if (datos.categoria_id !== undefined) {
    payload.categoria_id =
      datos.categoria_id === '' || datos.categoria_id === null
        ? null
        : aNumero(datos.categoria_id)
  }
  if (datos.activo !== undefined) {
    payload.activo = Boolean(datos.activo)
  }

  return payload
}

export const listarProductos = async (filtros = {}) => {
  const respuesta = await solicitar(
    `${RUTA_PRODUCTOS}${construirConsulta(filtros)}`,
  )
  return normalizarPaginado(respuesta, normalizarProducto)
}

export const crearProducto = async (datos) => {
  const { producto } = await solicitar(RUTA_PRODUCTOS, {
    metodo: 'POST',
    cuerpo: prepararPayload(datos, { requiereObligatorios: true }),
  })
  return normalizarProducto(producto)
}

export const obtenerProducto = async (id) => {
  const { producto } = await solicitar(`${RUTA_PRODUCTOS}/${id}`)
  return normalizarProducto(producto)
}

export const actualizarProducto = async (id, datos) => {
  const { producto } = await solicitar(`${RUTA_PRODUCTOS}/${id}`, {
    metodo: 'PATCH',
    cuerpo: prepararPayload(datos, { requiereObligatorios: false }),
  })
  return normalizarProducto(producto)
}