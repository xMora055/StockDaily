import { solicitar } from '../api/clienteApi'
import { RUTA_SALUD, USAR_MOCK_AUTH } from '../utilidades/constantes'

export const verificarSalud = async () => {
  if (USAR_MOCK_AUTH) {
    return { estado: 'ok' }
  }
  return solicitar(RUTA_SALUD, { conAuth: false })
}
