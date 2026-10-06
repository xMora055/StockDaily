import { useCallback, useEffect, useState } from 'react'
import { listarFacturas } from '../servicios/facturas'
import { PAGINA_POR_DEFECTO, acotarPorPagina } from '../utilidades/paginacion'

const MENSAJE_ERROR =
  'No pudimos cargar las facturas. Inténtalo de nuevo.'
const PAGINA_INICIAL = 1

const estadoInicial = {
  clave: null,
  items: [],
  pagina: PAGINA_INICIAL,
  porPagina: PAGINA_POR_DEFECTO,
  total: 0,
  totalPaginas: 0,
  error: '',
}

export const useFacturas = (filtros = {}, opciones = {}) => {
  const [version, setVersion] = useState(0)
  const [pagina, setPagina] = useState(PAGINA_INICIAL)
  const [porPagina, setPorPagina] = useState(() =>
    acotarPorPagina(opciones.porPaginaInicial, PAGINA_POR_DEFECTO),
  )
  const [resultado, setResultado] = useState(estadoInicial)

  const claveFiltros = JSON.stringify(filtros)
  const clavePeticion = `${claveFiltros}#${pagina}#${porPagina}#${version}`

  // Al cambiar los filtros o el tamaño de página, volver a la página 1.
  const [claveFiltrosPrevia, setClaveFiltrosPrevia] = useState(claveFiltros)
  const [porPaginaPrevio, setPorPaginaPrevio] = useState(porPagina)
  if (claveFiltrosPrevia !== claveFiltros) {
    setClaveFiltrosPrevia(claveFiltros)
    setPagina(PAGINA_INICIAL)
  }
  if (porPaginaPrevio !== porPagina) {
    setPorPaginaPrevio(porPagina)
    setPagina(PAGINA_INICIAL)
  }

  const recargar = useCallback(() => {
    setVersion((actual) => actual + 1)
  }, [])

  useEffect(() => {
    let activo = true

    listarFacturas({
      ...JSON.parse(claveFiltros),
      pagina,
      por_pagina: porPagina,
    })
      .then((paginado) => {
        if (!activo) return
        setResultado({
          clave: clavePeticion,
          items: paginado.items,
          pagina: paginado.pagina,
          porPagina: paginado.por_pagina,
          total: paginado.total,
          totalPaginas: paginado.total_paginas,
          error: '',
        })
      })
      .catch((fallo) => {
        if (!activo) return
        setResultado({
          clave: clavePeticion,
          items: [],
          pagina,
          porPagina,
          total: 0,
          totalPaginas: 0,
          error: fallo?.message || MENSAJE_ERROR,
        })
      })

    return () => {
      activo = false
    }
  }, [claveFiltros, clavePeticion, pagina, porPagina])

  const totalPaginas = resultado.totalPaginas || 1

  const irAPagina = useCallback(
    (destino) => {
      const numero = Number(destino)
      if (!Number.isFinite(numero)) return
      setPagina(Math.min(Math.max(Math.trunc(numero), 1), totalPaginas))
    },
    [totalPaginas],
  )

  const paginaSiguiente = useCallback(() => {
    setPagina((actual) => Math.min(actual + 1, totalPaginas))
  }, [totalPaginas])

  const paginaAnterior = useCallback(() => {
    setPagina((actual) => Math.max(actual - 1, PAGINA_INICIAL))
  }, [])

  const cambiarPorPagina = useCallback((valor) => {
    const numero = Number(valor)
    if (!Number.isFinite(numero)) return
    setPorPagina(acotarPorPagina(numero, PAGINA_POR_DEFECTO))
  }, [])

  const cargando = resultado.clave !== clavePeticion
  const error = resultado.clave === clavePeticion ? resultado.error : ''

  return {
    datos: resultado.items,
    cargando,
    error,
    recargar,
    pagina,
    porPagina,
    total: resultado.total,
    totalPaginas: resultado.totalPaginas,
    irAPagina,
    paginaSiguiente,
    paginaAnterior,
    cambiarPorPagina,
  }
}
