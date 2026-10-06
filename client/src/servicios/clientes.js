import { solicitar } from '../api/clienteApi'
import { RUTA_CLIENTES } from '../utilidades/constantes'
import {
  agregarPaginacion,
  normalizarPaginado,
} from '../utilidades/paginacion'

const aNumero = (valor) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

const normalizarCliente = (cliente) => {
  if (!cliente) return cliente
  return {
    ...cliente,
    id: aNumero(cliente.id),
    sucursal_id: aNumero(cliente.sucursal_id),
    documento: cliente.documento ?? null,
    telefono: cliente.telefono ?? null,
    correo: cliente.correo ?? null,
    direccion: cliente.direccion ?? null,
    activo: Boolean(cliente.activo),
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
  if (requiereObligatorios) {
    payload.sucursal_id = aNumero(datos.sucursal_id)
  }
  if (datos.documento !== undefined) {
    payload.documento = limpiarTexto(datos.documento)
  }
  if (datos.telefono !== undefined) {
    payload.telefono = limpiarTexto(datos.telefono)
  }
  if (datos.correo !== undefined) {
    payload.correo = limpiarTexto(datos.correo)
  }
  if (datos.direccion !== undefined) {
    payload.direccion = limpiarTexto(datos.direccion)
  }
  if (datos.activo !== undefined) {
    payload.activo = Boolean(datos.activo)
  }

  return payload
}

const construirConsulta = (filtros = {}) => {
  const parametros = new URLSearchParams()

  if (
    filtros.sucursal_id !== undefined &&
    filtros.sucursal_id !== null &&
    filtros.sucursal_id !== ''
  ) {
    parametros.set('sucursal_id', String(filtros.sucursal_id))
  }

  if (typeof filtros.activo === 'boolean') {
    parametros.set('activo', String(filtros.activo))
  }

  const buscar = filtros.buscar?.trim()
  if (buscar) parametros.set('buscar', buscar)

  agregarPaginacion(parametros, filtros)

  const consulta = parametros.toString()
  return consulta ? `?${consulta}` : ''
}

export const listarClientes = async (filtros = {}) => {
  const respuesta = await solicitar(
    `${RUTA_CLIENTES}${construirConsulta(filtros)}`,
  )
  return normalizarPaginado(respuesta, normalizarCliente)
}

export const crearCliente = async (datos) => {
  const { cliente } = await solicitar(RUTA_CLIENTES, {
    metodo: 'POST',
    cuerpo: prepararPayload(datos, { requiereObligatorios: true }),
  })
  return normalizarCliente(cliente)
}

export const obtenerCliente = async (id) => {
  const { cliente } = await solicitar(`${RUTA_CLIENTES}/${id}`)
  return normalizarCliente(cliente)
}

export const actualizarCliente = async (id, datos) => {
  const { cliente } = await solicitar(`${RUTA_CLIENTES}/${id}`, {
    metodo: 'PATCH',
    cuerpo: prepararPayload(datos, { requiereObligatorios: false }),
  })
  return normalizarCliente(cliente)
}
