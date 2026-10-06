import { useEffect, useState } from 'react'
import { verificarSalud } from '../servicios/salud'

export const useEstadoConexion = () => {
  const [estado, setEstado] = useState('verificando')

  useEffect(() => {
    let activo = true
    verificarSalud()
      .then(() => {
        if (activo) setEstado('conectado')
      })
      .catch(() => {
        if (activo) setEstado('sin-conexion')
      })
    return () => {
      activo = false
    }
  }, [])

  return estado
}
