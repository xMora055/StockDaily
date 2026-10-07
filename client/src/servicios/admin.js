import { solicitar } from '../api/clienteApi'
import { RUTA_ADMIN } from '../utilidades/constantes'
import {
  agregarPaginacion,
  normalizarPaginado,
} from '../utilidades/paginacion'

const aNumero = (valor) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

const normalizarEmpresa = (empresa) => {
  if (!empresa) return empresa
  return {
    ...empresa,
    id: aNumero(empresa.id),
    activo: Boolean(empresa.activo),
  }
}

const normalizarUsuario = (usuario) => {
  if (!usuario) return usuario
  return {
    ...usuario,
    id: aNumero(usuario.id),
    empresa_id: aNumero(usuario.empresa_id),
    activo: Boolean(usuario.activo),
  }
}

const limpiarTexto = (valor) => {
  if (typeof valor !== 'string') return valor
  const texto = valor.trim()
  return texto === '' ? null : texto
}

const construirConsultaEmpresas = (filtros = {}) => {
  const parametros = new URLSearchParams()

  if (typeof filtros.activo === 'boolean') {
    parametros.set('activo', String(filtros.activo))
  }

  agregarPaginacion(parametros, filtros)

  const consulta = parametros.toString()
  return consulta ? `?${consulta}` : ''
}

const construirConsultaUsuarios = (filtros = {}) => {
  const parametros = new URLSearchParams()

  if (typeof filtros.activo === 'boolean') {
    parametros.set('activo', String(filtros.activo))
  }
  if (filtros.empresa_id !== undefined && filtros.empresa_id !== null) {
    const numero = Number(filtros.empresa_id)
    if (Number.isFinite(numero)) parametros.set('empresa_id', String(numero))
  }

  agregarPaginacion(parametros, filtros)

  const consulta = parametros.toString()
  return consulta ? `?${consulta}` : ''
}

export const listarEmpresas = async (filtros = {}) => {
  const respuesta = await solicitar(
    `${RUTA_ADMIN}/empresas${construirConsultaEmpresas(filtros)}`,
  )
  return normalizarPaginado(respuesta, normalizarEmpresa)
}

export const crearEmpresa = async (datos) => {
  const payload = {
    nombre: datos.nombre?.trim() ?? '',
    admin: {
      nombre: datos.admin?.nombre?.trim() ?? '',
      correo: datos.admin?.correo?.trim()?.toLowerCase() ?? '',
    },
  }

  if (datos.documento !== undefined) {
    payload.documento = limpiarTexto(datos.documento)
  }
  if (datos.moneda !== undefined) {
    payload.moneda = datos.moneda?.trim()?.toUpperCase() || 'COP'
  }
  if (datos.direccion !== undefined) {
    payload.direccion = limpiarTexto(datos.direccion)
  }
  if (datos.telefono !== undefined) {
    payload.telefono = limpiarTexto(datos.telefono)
  }
  if (datos.correo !== undefined) {
    payload.correo = limpiarTexto(datos.correo)?.toLowerCase()
  }

  const respuesta = await solicitar(`${RUTA_ADMIN}/empresas`, {
    metodo: 'POST',
    cuerpo: payload,
  })

  return {
    empresa: normalizarEmpresa(respuesta.empresa),
    administrador: normalizarUsuario(respuesta.administrador),
    password: respuesta.password,
  }
}

export const obtenerEmpresa = async (id) => {
  const respuesta = await solicitar(`${RUTA_ADMIN}/empresas/${id}`)
  return {
    empresa: normalizarEmpresa(respuesta.empresa),
    administradores: Array.isArray(respuesta.administradores)
      ? respuesta.administradores.map(normalizarUsuario)
      : [],
  }
}

export const actualizarEmpresa = async (id, datos) => {
  const payload = {}

  if (datos.nombre !== undefined) {
    payload.nombre = datos.nombre?.trim() ?? ''
  }
  if (datos.documento !== undefined) {
    payload.documento = limpiarTexto(datos.documento)
  }
  if (datos.moneda !== undefined) {
    payload.moneda = datos.moneda?.trim()?.toUpperCase() || 'COP'
  }
  if (datos.direccion !== undefined) {
    payload.direccion = limpiarTexto(datos.direccion)
  }
  if (datos.telefono !== undefined) {
    payload.telefono = limpiarTexto(datos.telefono)
  }
  if (datos.correo !== undefined) {
    payload.correo = limpiarTexto(datos.correo)?.toLowerCase()
  }
  if (datos.activo !== undefined) {
    payload.activo = Boolean(datos.activo)
  }

  const respuesta = await solicitar(`${RUTA_ADMIN}/empresas/${id}`, {
    metodo: 'PATCH',
    cuerpo: payload,
  })
  return normalizarEmpresa(respuesta.empresa)
}

export const listarUsuarios = async (filtros = {}) => {
  const respuesta = await solicitar(
    `${RUTA_ADMIN}/usuarios${construirConsultaUsuarios(filtros)}`,
  )
  return normalizarPaginado(respuesta, normalizarUsuario)
}

export const crearUsuario = async (datos) => {
  const payload = {
    empresa_id: aNumero(datos.empresa_id),
    nombre: datos.nombre?.trim() ?? '',
    correo: datos.correo?.trim()?.toLowerCase() ?? '',
  }

  const respuesta = await solicitar(`${RUTA_ADMIN}/usuarios`, {
    metodo: 'POST',
    cuerpo: payload,
  })

  return {
    usuario: normalizarUsuario(respuesta.usuario),
    password: respuesta.password,
  }
}

export const obtenerUsuario = async (id) => {
  const respuesta = await solicitar(`${RUTA_ADMIN}/usuarios/${id}`)
  return normalizarUsuario(respuesta.usuario)
}

export const actualizarUsuario = async (id, datos) => {
  const payload = {}

  if (datos.nombre !== undefined) {
    payload.nombre = datos.nombre?.trim() ?? ''
  }
  if (datos.correo !== undefined) {
    payload.correo = datos.correo?.trim()?.toLowerCase() ?? ''
  }
  if (datos.activo !== undefined) {
    payload.activo = Boolean(datos.activo)
  }

  const respuesta = await solicitar(`${RUTA_ADMIN}/usuarios/${id}`, {
    metodo: 'PATCH',
    cuerpo: payload,
  })
  return normalizarUsuario(respuesta.usuario)
}
