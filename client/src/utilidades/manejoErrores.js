export class ErrorApi extends Error {
  constructor(mensaje, estado, codigo) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
    this.codigo = codigo
  }
}

export const esErrorDeRed = (error) =>
  error instanceof ErrorApi && error.codigo === 'RED'

export const mensajeErrorApi = (error) => {
  if (!(error instanceof ErrorApi)) {
    return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
  }
  if (error.estado === 401) {
    return 'Correo o contraseña incorrectos'
  }
  if (error.codigo === 'RED') {
    return 'No pudimos conectar con el servidor. Revisa tu conexión.'
  }
  return error.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}
