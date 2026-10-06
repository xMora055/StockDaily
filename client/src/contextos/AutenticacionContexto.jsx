/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import {
  cerrarSesion as cerrarSesionServicio,
  iniciarSesion as iniciarSesionServicio,
} from '../servicios/auth'
import { guardarSesion, leerSesion } from '../utilidades/sesion'

export const AutenticacionContexto = createContext(null)

export const ProveedorAutenticacion = ({ children }) => {
  const [sesion, setSesion] = useState(() => leerSesion())
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    const alExpirar = () => setSesion(null)
    window.addEventListener('stockdaily:sesion-expirada', alExpirar)
    return () =>
      window.removeEventListener('stockdaily:sesion-expirada', alExpirar)
  }, [])

  const iniciarSesion = useCallback(async (datos, recordar) => {
    setCargando(true)
    try {
      const nuevaSesion = await iniciarSesionServicio(datos)
      guardarSesion(nuevaSesion, recordar)
      setSesion(nuevaSesion)
      return nuevaSesion.usuario
    } finally {
      setCargando(false)
    }
  }, [])

  const cerrarSesion = useCallback(() => {
    cerrarSesionServicio()
    setSesion(null)
  }, [])

  const valor = useMemo(
    () => ({
      usuario: sesion?.usuario ?? null,
      token: sesion?.token ?? null,
      autenticado: Boolean(sesion?.usuario),
      cargando,
      iniciarSesion,
      cerrarSesion,
    }),
    [sesion, cargando, iniciarSesion, cerrarSesion],
  )

  return (
    <AutenticacionContexto.Provider value={valor}>
      {children}
    </AutenticacionContexto.Provider>
  )
}
