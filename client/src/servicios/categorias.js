import { solicitar } from '../api/clienteApi'
import { RUTA_CATEGORIAS } from '../utilidades/constantes'
import {
  agregarPaginacion,
  normalizarPaginado,
} from '../utilidades/paginacion'

const aNumero = (valor) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

const normalizarCategoria = (categoria) => {
  if (!categoria) return categoria
  return {
    ...categoria,
    id: aNumero(categoria.id),
    activo: Boolean(categoria.activo),
  }
}

/*
 * Solo enviamos los campos presentes. En creación `nombre` siempre va; en
 * edición se omiten los no provistos para respetar el PATCH parcial.
 */
const prepararPayload = (datos, { requiereObligatorios }) => {
  const payload = {}

  if (requiereObligatorios || datos.nombre !== undefined) {
    payload.nombre = datos.nombre?.trim() ?? ''
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

  const buscar = filtros.buscar?.trim()
  if (buscar) parametros.set('buscar', buscar)

  agregarPaginacion(parametros, filtros)

  const consulta = parametros.toString()
  return consulta ? `?${consulta}` : ''
}

export const listarCategorias = async (filtros = {}) => {
  const respuesta = await solicitar(
    `${RUTA_CATEGORIAS}${construirConsulta(filtros)}`,
  )
  return normalizarPaginado(respuesta, normalizarCategoria)
}

export const crearCategoria = async (datos) => {
  const { categoria } = await solicitar(RUTA_CATEGORIAS, {
    metodo: 'POST',
    cuerpo: prepararPayload(datos, { requiereObligatorios: true }),
  })
  return normalizarCategoria(categoria)
}

export const obtenerCategoria = async (id) => {
  const { categoria } = await solicitar(`${RUTA_CATEGORIAS}/${id}`)
  return normalizarCategoria(categoria)
}

export const actualizarCategoria = async (id, datos) => {
  const { categoria } = await solicitar(`${RUTA_CATEGORIAS}/${id}`, {
    metodo: 'PATCH',
    cuerpo: prepararPayload(datos, { requiereObligatorios: false }),
  })
  return normalizarCategoria(categoria)
}
