import { useCallback, useEffect, useState } from 'react'
import { listarClientes } from '../servicios/clientes'

const MENSAJE_ERROR = 'No pudimos cargar los clientes. Inténtalo de nuevo.'
const POR_PAGINA = 100

const estadoInicial = { clave: null, items: [], error: '' }

/*
 * Catálogo de clientes activos de una sucursal para el selector del POS.
 * Solo carga cuando hay sucursal elegida; al cambiarla, descarta lo previo.
 */
export const useClientesSucursal = (sucursalId) => {
  const [version, setVersion] = useState(0)
  const [resultado, setResultado] = useState(estadoInicial)

  const idNormalizado =
    sucursalId === null || sucursalId === undefined ? null : Number(sucursalId)
  const clave = idNormalizado === null ? null : `${idNormalizado}#${version}`

  const recargar = useCallback(() => {
    setVersion((actual) => actual + 1)
  }, [])

  useEffect(() => {
    if (clave === null) return undefined

    let activo = true
    listarClientes({
      sucursal_id: idNormalizado,
      activo: true,
      por_pagina: POR_PAGINA,
    })
      .then((paginado) => {
        if (!activo) return
        setResultado({ clave, items: paginado.items, error: '' })
      })
      .catch((fallo) => {
        if (!activo) return
        setResultado({
          clave,
          items: [],
          error: fallo?.message || MENSAJE_ERROR,
        })
      })

    return () => {
      activo = false
    }
  }, [clave, idNormalizado])

  const cargando = clave !== null && resultado.clave !== clave
  const error = resultado.clave === clave ? resultado.error : ''
  const clientes = resultado.clave === clave ? resultado.items : []

  return { clientes, cargando, error, recargar }
}
