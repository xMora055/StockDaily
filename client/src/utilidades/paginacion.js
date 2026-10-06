export const PAGINA_POR_DEFECTO = 10
export const PAGINA_MAXIMA = 100

// Tamaños ofrecidos por el selector "Por página" de las tablas paginadas.
export const OPCIONES_POR_PAGINA = [5, 10, 15, 20]

const aEntero = (valor, porDefecto = 0) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Math.trunc(numero) : porDefecto
}

const acotarEntero = (valor, porDefecto, minimo, maximo) =>
  Math.min(Math.max(aEntero(valor, porDefecto), minimo), maximo)

/*
 * El backend responde `{ items, pagina, por_pagina, total, total_paginas }`.
 * Normalizamos con defaults defensivos y toleramos por error un array legado.
 */
export const normalizarPaginado = (
  respuesta,
  normalizarItem = (item) => item,
) => {
  const bruto = Array.isArray(respuesta) ? { items: respuesta } : respuesta || {}
  const items = Array.isArray(bruto.items)
    ? bruto.items.map(normalizarItem)
    : []

  const porPagina = acotarEntero(
    bruto.por_pagina,
    PAGINA_POR_DEFECTO,
    1,
    PAGINA_MAXIMA,
  )
  const total = Math.max(0, aEntero(bruto.total, items.length))
  const pagina = Math.max(1, aEntero(bruto.pagina, 1))
  const totalPaginasCalculado = total > 0 ? Math.ceil(total / porPagina) : 0
  const totalPaginas = Math.max(
    0,
    aEntero(bruto.total_paginas, totalPaginasCalculado),
  )

  return {
    items,
    pagina,
    por_pagina: porPagina,
    total,
    total_paginas: totalPaginas,
  }
}

/*
 * Agrega `pagina` y `por_pagina` a un `URLSearchParams` si vienen definidos.
 * El backend aplica sus propios defaults (1 y 10) cuando se omiten.
 */
export const agregarPaginacion = (parametros, filtros = {}) => {
  const agregar = (clave, valor) => {
    if (valor === undefined || valor === null || valor === '') return
    const numero = Number(valor)
    if (Number.isFinite(numero)) parametros.set(clave, String(numero))
  }

  agregar('pagina', filtros.pagina)
  agregar('por_pagina', filtros.por_pagina)
}

export const acotarPorPagina = (valor, porDefecto = PAGINA_POR_DEFECTO) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return porDefecto
  return Math.min(Math.max(Math.trunc(numero), 1), PAGINA_MAXIMA)
}
