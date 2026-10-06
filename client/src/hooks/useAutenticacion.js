import { useContext } from 'react'
import { AutenticacionContexto } from '../contextos/AutenticacionContexto'

export const useAutenticacion = () => {
  const contexto = useContext(AutenticacionContexto)
  if (!contexto) {
    throw new Error(
      'useAutenticacion debe usarse dentro de ProveedorAutenticacion',
    )
  }
  return contexto
}
