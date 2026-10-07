import { useCallback, useEffect, useState } from 'react'
import { obtenerTablero } from '../servicios/tablero'

const MENSAJE_ERROR = 'No pudimos cargar el tablero. Inténtalo de nuevo.'
const DIAS_POR_DEFECTO = 30

const estadoInicial = {
  clave: null,
  datos: null,
  error: '',
}

const aDias = (valor, porDefecto) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return porDefecto
  const entero = Math.trunc(numero)
  return entero > 0 ? entero : porDefecto
}

/*
 * Carga el tablero de Inicio. Patrón de `useFacturas`: clave de petición con
 * version para forzar recarga y bandera `activo` para descartar respuestas
 * tardías. Al cambiar `dias` la clave cambia y se recarga.
 */
export const useTablero = (opciones = {}) => {
  const [version, setVersion] = useState(0)
  const [dias, setDias] = useState(() =>
    aDias(opciones.diasInicial, DIAS_POR_DEFECTO),
  )
  const [resultado, setResultado] = useState(estadoInicial)

  const clavePeticion = `${dias}#${version}`

  const recargar = useCallback(() => {
    setVersion((actual) => actual + 1)
  }, [])

  const cambiarDias = useCallback((valor) => {
    const numero = Number(valor)
    if (!Number.isFinite(numero)) return
    const entero = Math.trunc(numero)
    if (entero <= 0) return
    setDias((actual) => (actual === entero ? actual : entero))
  }, [])

  useEffect(() => {
    let activo = true

    obtenerTablero({ dias })
      .then((datos) => {
        if (!activo) return
        setResultado({ clave: clavePeticion, datos, error: '' })
      })
      .catch((fallo) => {
        if (!activo) return
        setResultado({
          clave: clavePeticion,
          datos: null,
          error: fallo?.message || MENSAJE_ERROR,
        })
      })

    return () => {
      activo = false
    }
  }, [clavePeticion, dias])

  const cargando = resultado.clave !== clavePeticion
  const error = resultado.clave === clavePeticion ? resultado.error : ''

  return {
    datos: resultado.datos,
    cargando,
    error,
    recargar,
    dias,
    cambiarDias,
  }
}
