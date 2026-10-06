/*
 * paginacion-listados-002 (T-003) - Verificacion independiente del default
 * `por_pagina = 10` y del selector de tamano 5/10/15/20 en los cuatro listados:
 *   GET /productos, GET /sucursales, GET /inventario/stock,
 *   GET /inventario/movimientos
 *
 * Runner nativo de Node 24 + fetch; la app se levanta en un puerto efimero.
 *
 * Estrategia de aislamiento (node --test corre los archivos en paralelo):
 *   - productos, stock y movimientos se acotan a fixtures propios con una marca
 *     unica (`marcaSweep`) y una sucursal propia (`sucursalSweep`), de modo que
 *     `total` es exactamente N_FILAS y no depende del catalogo acumulado.
 *   - sucursales no admite filtro por nombre; para no alterar las cuentas de la
 *     empresa 1 (otras suites suman activos+inactivos), el barrido se hace en la
 *     empresa 3 ("QA Empresa Ajena") con un token efimero propio y se coteja
 *     cada lectura contra un SELECT de control con reintento de estabilidad.
 *
 * Datos: se crean fixtures `QA-*` claramente identificables; los productos y
 * sucursales se dejan INACTIVOS al terminar (borrado logico) y el stock de la
 * sucursal de prueba se restaura a 0. Los movimientos son inmutables y no se
 * borran. Nunca se hace DELETE/TRUNCATE/DROP.
 */
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')

const { iniciarServidor, requerirServidor } = require('../utilidades/servidor')
const { peticion } = require('../utilidades/http')
const { tokenAdmin, firmarToken } = require('../utilidades/token')
const { codigoUnico, nombreUnico } = require('../utilidades/datos')
const { assertSobrePagina, recorrerPaginas } = require('../utilidades/paginacion')

const { pool } = requerirServidor('./db/pool')

let servidor
let base
let token
// Tenant ajeno (empresa 3, "QA Empresa Ajena"): ahi vive el fixture del barrido
// de sucursales, para no tocar las cuentas de la empresa 1.
let tokenEmpresa3

// Barrido exigido por el criterio de aceptacion 4.
const TAMANOS = [5, 10, 15, 20]
// 23 filas: garantiza mas de una pagina para los cuatro tamanos (20 -> 2 paginas).
const N_FILAS = 23

const marcaSweep = codigoUnico('QASWEEP')

const productosCreados = []
const sucursalesCreadas = []
const productosSweep = []
let sucursalSweep
const sucursalesSweep = []

before(async () => {
  servidor = await iniciarServidor()
  base = servidor.urlBase
  token = tokenAdmin()
  tokenEmpresa3 = firmarToken({
    id: 9,
    empresa_id: 3,
    nombre: 'QA Sweep Empresa Ajena',
    correo: 'qa.sweep.empresa3@stockdaily.test',
    rol: 'administrador',
  })

  // 23 productos propios: filtro `codigo=<marcaSweep>` -> total = N_FILAS.
  for (let n = 1; n <= N_FILAS; n += 1) {
    const sufijo = String(n).padStart(2, '0')
    const r = await peticion(base, '/productos', {
      metodo: 'POST',
      token,
      cuerpo: {
        codigo: `${marcaSweep}-P${sufijo}`,
        nombre: `Paginado ${marcaSweep} ${sufijo}`,
        precio_unitario: 1,
        impuesto_porcentaje: 0,
      },
    })
    assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
    const id = r.cuerpo.data.producto.id
    productosCreados.push(id)
    productosSweep.push(id)
  }

  // Una sucursal propia que concentra el stock y los movimientos del barrido.
  const sucursal = await peticion(base, '/sucursales', {
    metodo: 'POST',
    token,
    cuerpo: { nombre: nombreUnico('QA-SWEEP-INV') },
  })
  assert.equal(sucursal.status, 201, JSON.stringify(sucursal.cuerpo))
  sucursalSweep = sucursal.cuerpo.data.sucursal.id
  sucursalesCreadas.push(sucursalSweep)

  // 23 movimientos carga_inicial -> 23 filas de stock y 23 movimientos.
  for (let i = 0; i < N_FILAS; i += 1) {
    const r = await peticion(base, '/inventario/movimientos', {
      metodo: 'POST',
      token,
      cuerpo: {
        producto_id: productosSweep[i],
        sucursal_id: sucursalSweep,
        tipo: 'carga_inicial',
        cantidad: 1,
      },
    })
    assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  }

  // 23 sucursales activas propias en la empresa 3 para el barrido de
  // GET /sucursales (se desactivan al final; el total real se coteja contra la
  // BD). Se usa el tenant ajeno para no alterar las cuentas de la empresa 1.
  for (let n = 1; n <= N_FILAS; n += 1) {
    const sufijo = String(n).padStart(2, '0')
    const r = await peticion(base, '/sucursales', {
      metodo: 'POST',
      token: tokenEmpresa3,
      cuerpo: { nombre: nombreUnico(`QA-SWEEP-SUC-${sufijo}`) },
    })
    assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
    sucursalesSweep.push(r.cuerpo.data.sucursal.id)
  }
})

after(async () => {
  // Restaurar el stock de los fixtures a 0 (las filas se conservan).
  if (sucursalSweep) {
    for (const productoId of productosSweep) {
      try {
        await pool.query(
          'UPDATE stock SET cantidad = 0 WHERE producto_id = $1 AND sucursal_id = $2',
          [productoId, sucursalSweep],
        )
      } catch {
        /* mejor esfuerzo */
      }
    }
  }

  // Borrado logico de todo lo creado: queda activo=false.
  if (base) {
    for (const id of productosCreados) {
      try {
        await peticion(base, `/productos/${id}`, {
          metodo: 'PATCH',
          token,
          cuerpo: { activo: false },
        })
      } catch {
        /* mejor esfuerzo */
      }
    }
    for (const id of sucursalesCreadas) {
      try {
        await peticion(base, `/sucursales/${id}`, {
          metodo: 'PATCH',
          token,
          cuerpo: { activo: false },
        })
      } catch {
        /* mejor esfuerzo */
      }
    }
    for (const id of sucursalesSweep) {
      try {
        await peticion(base, `/sucursales/${id}`, {
          metodo: 'PATCH',
          token: tokenEmpresa3,
          cuerpo: { activo: false },
        })
      } catch {
        /* mejor esfuerzo */
      }
    }
  }

  if (servidor) await servidor.cerrar()
})

function assertSobreError(cuerpo) {
  assert.deepEqual(Object.keys(cuerpo).sort(), ['error', 'success'])
  assert.equal(cuerpo.success, false)
  assert.equal(typeof cuerpo.error, 'string')
  assert.ok(cuerpo.error.length > 0, 'el error no debe estar vacio')
}

// Recorre todas las paginas con un tamano y valida total/total_paginas.
async function barrer(ruta, query, porPagina, totalEsperado) {
  const { items, total, totalPaginas } = await recorrerPaginas({
    peticion,
    base,
    token,
    ruta,
    query,
    porPagina,
  })
  assert.equal(
    total,
    totalEsperado,
    `${ruta} ?${query} por_pagina=${porPagina}: total ${total} != ${totalEsperado}`,
  )
  assert.equal(
    totalPaginas,
    Math.ceil(totalEsperado / porPagina),
    `${ruta} por_pagina=${porPagina}: total_paginas ${totalPaginas} != ceil(${totalEsperado}/${porPagina})`,
  )
  assert.equal(
    items.length,
    totalEsperado,
    `${ruta} por_pagina=${porPagina}: la union de paginas debe cubrir todas las filas`,
  )
  return items
}

// IDs activos de la empresa 3 (tenant del fixture) con el mismo ORDER BY del
// repositorio.
async function idsSucursalesActivasBd() {
  const { rows } = await pool.query(
    'SELECT id FROM sucursal WHERE empresa_id = $1 AND activo = true ORDER BY nombre ASC, id ASC',
    [3],
  )
  return rows.map((fila) => Number(fila.id))
}

// Barre `activo=true` de la empresa 3 cotejando contra la BD y reintentando si
// el catalogo cambio entre paginas.
async function barrerSucursalesActivas(porPagina) {
  for (let intento = 0; intento < 6; intento += 1) {
    const antes = await idsSucursalesActivasBd()
    const recorrido = await recorrerPaginas({
      peticion,
      base,
      token: tokenEmpresa3,
      ruta: '/sucursales',
      query: 'activo=true',
      porPagina,
    })
    const despues = await idsSucursalesActivasBd()
    const ids = recorrido.items.map((s) => s.id)
    const estable =
      antes.length > 0 &&
      antes.length === despues.length &&
      antes.every((valor, i) => valor === despues[i]) &&
      recorrido.total === antes.length &&
      recorrido.totalPaginas === Math.ceil(antes.length / porPagina) &&
      ids.length === antes.length &&
      new Set(ids).size === antes.length &&
      ids.every((valor, i) => valor === antes[i])
    if (estable) return { recorrido, control: antes }
  }
  throw new Error(
    `sucursales: no se obtuvo una lectura estable con por_pagina=${porPagina}`,
  )
}

// ---------------------------------------------------------------------------
// Default por_pagina = 10 en los cuatro listados
// ---------------------------------------------------------------------------

test('default por_pagina=10 en los cuatro listados', async () => {
  const productos = await peticion(
    base,
    `/productos?codigo=${encodeURIComponent(marcaSweep)}`,
    { token },
  )
  assertSobrePagina(productos.cuerpo, {
    pagina: 1,
    por_pagina: 10,
    total: N_FILAS,
    total_paginas: Math.ceil(N_FILAS / 10),
  })

  const sucursales = await peticion(base, '/sucursales?activo=true', {
    token: tokenEmpresa3,
  })
  const dataSucursales = assertSobrePagina(sucursales.cuerpo, {
    pagina: 1,
    por_pagina: 10,
  })
  assert.equal(
    dataSucursales.total_paginas,
    Math.ceil(dataSucursales.total / 10),
    'total_paginas debe ser ceil(total/10)',
  )
  assert.ok(dataSucursales.items.length <= 10)

  const stock = await peticion(
    base,
    `/inventario/stock?sucursal_id=${sucursalSweep}`,
    { token },
  )
  assertSobrePagina(stock.cuerpo, {
    pagina: 1,
    por_pagina: 10,
    total: N_FILAS,
    total_paginas: Math.ceil(N_FILAS / 10),
  })

  const movimientos = await peticion(
    base,
    `/inventario/movimientos?sucursal_id=${sucursalSweep}`,
    { token },
  )
  assertSobrePagina(movimientos.cuerpo, {
    pagina: 1,
    por_pagina: 10,
    total: N_FILAS,
    total_paginas: Math.ceil(N_FILAS / 10),
  })
})

test('por_pagina=0 sigue rechazado con 400 en los cuatro listados', async (t) => {
  const rutas = [
    '/productos?por_pagina=0',
    '/sucursales?por_pagina=0',
    '/inventario/stock?por_pagina=0',
    '/inventario/movimientos?por_pagina=0',
  ]
  for (const ruta of rutas) {
    await t.test(ruta, async () => {
      const r = await peticion(base, ruta, { token })
      assert.equal(r.status, 400, `${ruta}: esperaba 400, obtuve ${r.status}`)
      assertSobreError(r.cuerpo)
    })
  }
})

// ---------------------------------------------------------------------------
// Barrido 5/10/15/20: sin repetir ni omitir filas y total_paginas coherente
// ---------------------------------------------------------------------------

test('productos: barrido 5/10/15/20 sin repetir ni omitir y orden estable', async () => {
  const query = `codigo=${encodeURIComponent(marcaSweep)}`
  const control = await pool.query(
    `SELECT id FROM producto
      WHERE empresa_id = $1 AND codigo ILIKE $2
      ORDER BY nombre ASC, id ASC`,
    [1, `%${marcaSweep}%`],
  )
  const idsControl = control.rows.map((fila) => Number(fila.id))
  assert.equal(idsControl.length, N_FILAS, 'control SQL del fixture de productos')

  for (const tamano of TAMANOS) {
    const items = await barrer('/productos', query, tamano, N_FILAS)
    const ids = items.map((p) => p.id)
    assert.equal(new Set(ids).size, N_FILAS, `productos por_pagina=${tamano}: sin repetidos`)
    assert.deepEqual(ids, idsControl, `productos por_pagina=${tamano}: orden nombre ASC, id ASC`)
  }
})

test('sucursales: barrido 5/10/15/20 sin repetir ni omitir y orden estable', async () => {
  for (const tamano of TAMANOS) {
    const { recorrido, control } = await barrerSucursalesActivas(tamano)
    const ids = recorrido.items.map((s) => s.id)
    assert.equal(recorrido.total, control.length, `sucursales por_pagina=${tamano}: total != control`)
    assert.equal(
      recorrido.totalPaginas,
      Math.ceil(control.length / tamano),
      `sucursales por_pagina=${tamano}: total_paginas incoherente`,
    )
    assert.equal(new Set(ids).size, control.length, `sucursales por_pagina=${tamano}: sin repetidos`)
  }
})

test('stock: barrido 5/10/15/20 sin repetir ni omitir y orden estable', async () => {
  const query = `sucursal_id=${sucursalSweep}`
  const control = await pool.query(
    `SELECT st.producto_id
       FROM stock st
       JOIN producto p ON p.id = st.producto_id
       JOIN sucursal s ON s.id = st.sucursal_id
      WHERE st.sucursal_id = $1 AND p.empresa_id = 1 AND s.empresa_id = 1
      ORDER BY p.nombre ASC, s.nombre ASC`,
    [sucursalSweep],
  )
  const idsControl = control.rows.map((fila) => Number(fila.producto_id))
  assert.equal(idsControl.length, N_FILAS, 'control SQL del fixture de stock')

  for (const tamano of TAMANOS) {
    const items = await barrer('/inventario/stock', query, tamano, N_FILAS)
    const claves = items.map((fila) => `${fila.producto_id}-${fila.sucursal_id}`)
    assert.equal(new Set(claves).size, N_FILAS, `stock por_pagina=${tamano}: sin repetidos`)
    assert.deepEqual(
      items.map((fila) => fila.producto_id),
      idsControl,
      `stock por_pagina=${tamano}: orden producto_nombre ASC, sucursal_nombre ASC`,
    )
  }
})

test('movimientos: barrido 5/10/15/20 sin repetir ni omitir y orden estable', async () => {
  const query = `sucursal_id=${sucursalSweep}`
  const control = await pool.query(
    `SELECT m.id
       FROM movimiento_inventario m
       JOIN producto p ON p.id = m.producto_id
       JOIN sucursal s ON s.id = m.sucursal_id
      WHERE m.sucursal_id = $1 AND p.empresa_id = 1 AND s.empresa_id = 1
      ORDER BY m.creado_en DESC, m.id DESC`,
    [sucursalSweep],
  )
  const idsControl = control.rows.map((fila) => Number(fila.id))
  assert.equal(idsControl.length, N_FILAS, 'control SQL del fixture de movimientos')

  for (const tamano of TAMANOS) {
    const items = await barrer('/inventario/movimientos', query, tamano, N_FILAS)
    const ids = items.map((m) => m.id)
    assert.equal(new Set(ids).size, N_FILAS, `movimientos por_pagina=${tamano}: sin repetidos`)
    assert.deepEqual(ids, idsControl, `movimientos por_pagina=${tamano}: orden creado_en DESC, id DESC`)
  }
})
