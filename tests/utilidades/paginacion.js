/*
 * Helpers de verificacion del sobre paginado de listados (SD-018):
 *   { success: true, data: { items, pagina, por_pagina, total, total_paginas } }
 *
 * Se usan desde las suites de productos y sucursales para no duplicar la
 * validacion de forma ni el recorrido de paginas. El runner es `node --test`
 * con `assert/strict` y `fetch` nativo; no se instala nada.
 */
const assert = require('node:assert/strict')

// Claves exactas del objeto `data` paginado (ordenadas para comparacion).
const CLAVES_PAGINA = ['items', 'pagina', 'por_pagina', 'total', 'total_paginas'].sort()

// Valida el sobre de exito paginado y la coherencia total/total_paginas.
// Devuelve `data` para encadenar aserciones. `esperado` permite fijar campos.
function assertSobrePagina(cuerpo, esperado = {}) {
  assert.deepEqual(
    Object.keys(cuerpo).sort(),
    ['data', 'success'],
    `sobre raiz: se obtuvo ${JSON.stringify(Object.keys(cuerpo).sort())}`,
  )
  assert.equal(cuerpo.success, true)

  const data = cuerpo.data
  assert.ok(
    data !== null && typeof data === 'object' && !Array.isArray(data),
    'data debe ser un objeto paginado (no arreglo)',
  )
  assert.deepEqual(
    Object.keys(data).sort(),
    CLAVES_PAGINA,
    `sobre paginado: se obtuvo ${JSON.stringify(Object.keys(data).sort())}`,
  )
  assert.ok(Array.isArray(data.items), 'data.items debe ser arreglo')

  for (const campo of ['pagina', 'por_pagina', 'total', 'total_paginas']) {
    assert.equal(typeof data[campo], 'number', `data.${campo} debe ser Number`)
  }
  assert.ok(
    Number.isInteger(data.pagina) && data.pagina >= 1,
    `pagina debe ser entero >= 1, se obtuvo ${data.pagina}`,
  )
  assert.ok(
    Number.isInteger(data.por_pagina) && data.por_pagina >= 1 && data.por_pagina <= 100,
    `por_pagina debe ser entero 1..100, se obtuvo ${data.por_pagina}`,
  )
  assert.ok(
    Number.isInteger(data.total) && data.total >= 0,
    `total debe ser entero >= 0, se obtuvo ${data.total}`,
  )
  assert.ok(
    Number.isInteger(data.total_paginas) && data.total_paginas >= 0,
    `total_paginas debe ser entero >= 0, se obtuvo ${data.total_paginas}`,
  )
  assert.equal(
    data.total_paginas,
    Math.ceil(data.total / data.por_pagina),
    'total_paginas debe ser ceil(total / por_pagina)',
  )
  assert.ok(
    data.items.length <= data.por_pagina,
    'items no puede superar por_pagina',
  )

  if (esperado.pagina !== undefined) assert.equal(data.pagina, esperado.pagina, 'pagina')
  if (esperado.por_pagina !== undefined) {
    assert.equal(data.por_pagina, esperado.por_pagina, 'por_pagina')
  }
  if (esperado.total !== undefined) assert.equal(data.total, esperado.total, 'total')
  if (esperado.total_paginas !== undefined) {
    assert.equal(data.total_paginas, esperado.total_paginas, 'total_paginas')
  }

  return data
}

/*
 * Recorre todas las paginas de un listado paginado y devuelve la union de
 * `items` junto con `total` y `totalPaginas` de la ultima lectura.
 *   recorrerPaginas({ peticion, base, token, ruta, query, porPagina })
 * `query` es la cadena de filtros SIN pagina/por_pagina (puede ir vacia).
 */
async function recorrerPaginas({
  peticion,
  base,
  token,
  ruta,
  query = '',
  porPagina = 100,
}) {
  const items = []
  const prefijo = query ? `${query}&` : ''
  let pagina = 1
  let total = 0
  let totalPaginas = 0
  let continuar = true

  while (continuar) {
    const r = await peticion(
      base,
      `${ruta}?${prefijo}pagina=${pagina}&por_pagina=${porPagina}`,
      { token },
    )
    assert.equal(r.status, 200, `GET ${ruta} pagina ${pagina}: ${JSON.stringify(r.cuerpo)}`)
    const data = assertSobrePagina(r.cuerpo, { pagina, por_pagina: porPagina })
    items.push(...data.items)
    total = data.total
    totalPaginas = data.total_paginas
    continuar = pagina < data.total_paginas
    pagina += 1
    assert.ok(pagina < 1000, 'guardia contra bucle infinito')
  }

  return { items, total, totalPaginas }
}

module.exports = { CLAVES_PAGINA, assertSobrePagina, recorrerPaginas }
