import { URL_API } from '../utilidades/constantes'
import { ErrorApi } from '../utilidades/manejoErrores'
import { limpiarSesion, obtenerToken } from '../utilidades/sesion'

export const solicitar = async (
  ruta,
  { metodo = 'GET', cuerpo, conAuth = true } = {},
) => {
  const cabeceras = { 'Content-Type': 'application/json' }

  if (conAuth) {
    const token = obtenerToken()
    if (token) {
      cabeceras.Authorization = `Bearer ${token}`
    }
  }

  let respuesta
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    })
  } catch {
    throw new ErrorApi(
      'No pudimos conectar con el servidor. Revisa tu conexión.',
      0,
      'RED',
    )
  }

  const carga = await respuesta.json().catch(() => null)

  if (respuesta.status === 401) {
    limpiarSesion()
    window.dispatchEvent(new Event('stockdaily:sesion-expirada'))
    throw new ErrorApi(
      carga?.error || 'Tu sesión expiró. Inicia sesión de nuevo.',
      401,
      'NO_AUTORIZADO',
    )
  }

  if (!respuesta.ok || !carga?.success) {
    throw new ErrorApi(
      carga?.error || 'Ocurrió un error inesperado. Inténtalo de nuevo.',
      respuesta.status,
      'API',
    )
  }

  return carga.data
}
