import { solicitar } from '../api/clienteApi'
import { limpiarSesion } from '../utilidades/sesion'
import {
  RUTA_LOGIN,
  RUTA_PERFIL,
  USAR_MOCK_AUTH,
} from '../utilidades/constantes'
import { ErrorApi } from '../utilidades/manejoErrores'

const retraso = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

const iniciarSesionSimulada = async ({ correo }) => {
  await retraso(600)
  if (correo.toLowerCase().includes('incorrecto')) {
    throw new ErrorApi('Correo o contraseña incorrectos', 401, 'NO_AUTORIZADO')
  }
  return {
    token: 'token-de-prueba-solo-desarrollo',
    usuario: {
      id: 1,
      nombre: 'Usuaria de Prueba',
      correo,
      rol: 'administrador',
      empresa_id: 1,
      empresa: {
        id: 1,
        moneda: 'COP',
      },
    },
  }
}

export const iniciarSesion = async (datos) => {
  if (USAR_MOCK_AUTH) {
    return iniciarSesionSimulada(datos)
  }
  return solicitar(RUTA_LOGIN, { metodo: 'POST', cuerpo: datos, conAuth: false })
}

export const obtenerPerfil = async () => {
  if (USAR_MOCK_AUTH) {
    await retraso(150)
    return {
      usuario: {
        id: 1,
        nombre: 'Usuaria de Prueba',
        correo: 'prueba@stockdaily.test',
        rol: 'administrador',
        empresa_id: 1,
        empresa: {
          id: 1,
          moneda: 'COP',
        },
      },
    }
  }
  return solicitar(RUTA_PERFIL)
}

export const cerrarSesion = () => {
  limpiarSesion()
}
