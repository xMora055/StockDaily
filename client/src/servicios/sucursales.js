import { solicitar } from '../api/clienteApi'
import { RUTA_SUCURSALES } from '../utilidades/constantes'
import {
  agregarPaginacion,
  normalizarPaginado,
} from '../utilidades/paginacion'

const aNumero = (valor) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

const normalizarSucursal = (sucursal) => {
  if (!sucursal) return sucursal
  return {
    ...sucursal,
    id: aNumero(sucursal.id),
    activo: Boolean(sucursal.activo),
  }
}

const limpiarTexto = (valor) => {
  if (typeof valor !== 'string') return valor
  const texto = valor.trim()
  return texto === '' ? null : texto
}

const prepararPayload = (datos, { requiereObligatorios }) => {
  const payload = {}

  if (requiereObligatorios || datos.nombre !== undefined) {
    payload.nombre = datos.nombre?.trim() ?? ''
  }
  if (datos.direccion !== undefined) {
    payload.direccion = limpiarTexto(datos.direccion)
  }
  if (datos.telefono !== undefined) {
    payload.telefono = limpiarTexto(datos.telefono)
  }
  if (datos.activo !== undefined) {
    payload.activo = Boolean(datos.activo)
  }

  return payload
}

const construirConsulta = (filtros = {}) => {
  const parametros = new URLSearchParams()

  if (typeof filtros.activo === 'boolean') {
    parametros.set('activo', String(filtros.activo))
  }

  agregarPaginacion(parametros, filtros)

  const consulta = parametros.toString()
  return consulta ? `?${consulta}` : ''
}

export const listarSucursales = async (filtros = {}) => {
  const respuesta = await solicitar(
    `${RUTA_SUCURSALES}${construirConsulta(filtros)}`,
  )
  return normalizarPaginado(respuesta, normalizarSucursal)
}

export const crearSucursal = async (datos) => {
  const { sucursal } = await solicitar(RUTA_SUCURSALES, {
    metodo: 'POST',
    cuerpo: prepararPayload(datos, { requiereObligatorios: true }),
  })
  return normalizarSucursal(sucursal)
}

export const obtenerSucursal = async (id) => {
  const { sucursal } = await solicitar(`${RUTA_SUCURSALES}/${id}`)
  return normalizarSucursal(sucursal)
}

export const actualizarSucursal = async (id, datos) => {
  const { sucursal } = await solicitar(`${RUTA_SUCURSALES}/${id}`, {
    metodo: 'PATCH',
    cuerpo: prepararPayload(datos, { requiereObligatorios: false }),
  })
  return normalizarSucursal(sucursal)
}
