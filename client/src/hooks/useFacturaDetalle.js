import { useCallback, useEffect, useState } from 'react'
import { obtenerFactura } from '../servicios/facturas'

const MENSAJE_ERROR = 'No pudimos cargar la factura. Inténtalo de nuevo.'

const estadoInicial = { clave: null, factura: null, error: '' }

export const useFacturaDetalle = (id) => {
  const [version, setVersion] = useState(0)
  const [resultado, setResultado] = useState(estadoInicial)

  const idNumerico = Number(id)
  const activo = Number.isFinite(idNumerico) && idNumerico > 0
  const clavePeticion = activo ? `${idNumerico}#${version}` : null

  useEffect(() => {
    if (!activo) return undefined

    let vigente = true

    obtenerFactura(idNumerico)
      .then((detalle) => {
        if (!vigente) return
        setResultado({ clave: clavePeticion, factura: detalle, error: '' })
      })
      .catch((fallo) => {
        if (!vigente) return
        setResultado({
          clave: clavePeticion,
          factura: null,
          error: fallo?.message || MENSAJE_ERROR,
        })
      })

    return () => {
      vigente = false
    }
  }, [activo, idNumerico, clavePeticion])

  const recargar = useCallback(() => {
    setVersion((actual) => actual + 1)
  }, [])

  // Permite reconciliar el detalle tras una anulación sin volver a pedirlo.
  const actualizarFactura = useCallback((nueva) => {
    setResultado((actual) =>
      actual.clave === null
        ? actual
        : { ...actual, factura: nueva, error: '' },
    )
  }, [])

  const alDia = resultado.clave === clavePeticion

  return {
    factura: activo && alDia ? resultado.factura : null,
    cargando: activo && !alDia,
    error: activo && alDia ? resultado.error : '',
    recargar,
    actualizarFactura,
  }
}
