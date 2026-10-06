import { CLAVE_TOKEN, CLAVE_USUARIO } from './constantes'

const obtenerAlmacenes = () => [window.localStorage, window.sessionStorage]

export const leerSesion = () => {
  for (const almacen of obtenerAlmacenes()) {
    const token = almacen.getItem(CLAVE_TOKEN)
    const usuario = almacen.getItem(CLAVE_USUARIO)
    if (token && usuario) {
      try {
        return { token, usuario: JSON.parse(usuario) }
      } catch {
        almacen.removeItem(CLAVE_TOKEN)
        almacen.removeItem(CLAVE_USUARIO)
      }
    }
  }
  return null
}

export const guardarSesion = ({ token, usuario }, recordar) => {
  limpiarSesion()
  const almacen = recordar ? window.localStorage : window.sessionStorage
  almacen.setItem(CLAVE_TOKEN, token)
  almacen.setItem(CLAVE_USUARIO, JSON.stringify(usuario))
}

export const limpiarSesion = () => {
  for (const almacen of obtenerAlmacenes()) {
    almacen.removeItem(CLAVE_TOKEN)
    almacen.removeItem(CLAVE_USUARIO)
  }
}

export const obtenerToken = () => leerSesion()?.token ?? null
