import { useCallback, useEffect, useMemo, useState } from 'react'
import { listarCategorias } from '../servicios/categorias'

const MENSAJE_ERROR = 'No pudimos cargar las categorías. Inténtalo de nuevo.'
const POR_PAGINA = 100

const estadoInicial = { clave: null, categorias: [], error: '' }

/*
 * Catálogo de categorías activas para selectores y para mapear `id -> nombre`
 * en las tablas. Trae hasta 100 (deuda conocida del MVP: catálogos mayores
 * requerirían búsqueda paginada).
 */
export const useCategoriasCatalogo = () => {
  const [version, setVersion] = useState(0)
  const [resultado, setResultado] = useState(estadoInicial)

  const clave = `catalogo#${version}`

  const recargar = useCallback(() => {
    setVersion((actual) => actual + 1)
  }, [])

  useEffect(() => {
    let activo = true

    listarCategorias({ activo: true, por_pagina: POR_PAGINA })
      .then((paginado) => {
        if (!activo) return
        setResultado({ clave, categorias: paginado.items, error: '' })
      })
      .catch((fallo) => {
        if (!activo) return
        setResultado({
          clave,
          categorias: [],
          error: fallo?.message || MENSAJE_ERROR,
        })
      })

    return () => {
      activo = false
    }
  }, [clave])

  const cargando = resultado.clave !== clave
  const categorias = resultado.clave === clave ? resultado.categorias : []
  const error = resultado.clave === clave ? resultado.error : ''

  const mapa = useMemo(() => {
    const acumulado = {}
    if (resultado.clave === clave) {
      for (const categoria of resultado.categorias) {
        acumulado[categoria.id] = categoria.nombre
      }
    }
    return acumulado
  }, [resultado.clave, resultado.categorias, clave])

  return { categorias, mapa, cargando, error, recargar }
}
