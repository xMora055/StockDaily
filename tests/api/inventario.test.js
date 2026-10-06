/*
 * SD-005 + SD-011 - Verificacion independiente de Inventario
 * (movimientos y consulta de stock) sobre /api/v1/inventario.
 *
 * Runner nativo de Node 24 + fetch. La app se levanta en un puerto efimero.
 *
 * Revision 2 (paginacion): `GET /inventario/stock` y
 * `GET /inventario/movimientos` devuelven `data` como objeto paginado
 * `{ items, pagina, por_pagina, total, total_paginas }`; `limite` quedo
 * obsoleto (se ignora) y se reemplazo por `por_pagina` (1..100, default 10).
 * Esta suite verifica el sobre, los filtros (total = COUNT SQL), el orden y
 * que paginar no repita ni omita filas.
 *
 * Datos: se crean productos y sucursales `QA-*` claramente identificables y se
 * dejan INACTIVOS al terminar (borrado logico). El historial de movimientos es
 * inmutable en el dominio: no se borra. El `stock` de los fixtures QA se
 * restaura a 0. Nunca se hace DELETE/TRUNCATE/DROP.
 *
 * Aislamiento del runner: `node --test` ejecuta los archivos en paralelo, asi
 * que todas las aserciones de conteo se acotan a fixtures propios
 * (`marcaPag`/`marcaSalida` o producto/sucursal creados por esta suite) y se
 * contrastan con un COUNT SQL de control. Nunca se cuenta la tabla completa.
 *
 * Multi-tenant: la unica empresa real es la 1. Para sondear IDOR se firma un
 * token con `empresa_id = 999` (inexistente), como en las suites previas.
 *
 * Lecturas directas a la BD (solo SELECT/UPDATE de filas QA) para verificar
 * `stock = suma de movimientos`, el rollback y los COUNT de control; se usa el
 * pool de server/db/pool.
 */
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')

const { iniciarServidor, requerirServidor } = require('../utilidades/servidor')
const { peticion } = require('../utilidades/http')
const {
  tokenAdmin,
  tokenSuperadmin,
  tokenOtraEmpresa,
  firmarToken,
} = require('../utilidades/token')
const { codigoUnico, nombreUnico } = require('../utilidades/datos')

const jwt = requerirServidor('jsonwebtoken')
const { pool } = requerirServidor('./db/pool')

let servidor
let base
let token
let tokenSuper
let tokenAjeno

// Fixtures QA (se desactivan al final; su stock se restaura a 0).
const productosCreados = []
const sucursalesCreadas = []
let sucursalA
let sucursalB
let productoA
let productoB
let productoFaltante
let productoRollback

// Fixtures de paginacion. `marcaPag` es unica por corrida, de modo que
// `buscar=marcaPag` aisla estas filas de cualquier otra suite que corra en
// paralelo (facturas crea `salida_venta` mientras esta suite cuenta filas).
const marcaPag = codigoUnico('QAPAG')
const productosPag = []
let sucursalPagA
let sucursalPagB

// Fixture para un `salida_venta` controlado (via POST /facturas), con su
// propia marca para no contaminar `buscar=marcaPag`.
const marcaSalida = codigoUnico('QAPAGSAL')
let sucursalSalida
let productoSalida

const CLAVES_MOVIMIENTO = [
  'id',
  'producto_id',
  'producto_nombre',
  'sucursal_id',
  'sucursal_nombre',
  'tipo',
  'cantidad',
  'observacion',
  'usuario_id',
  'factura_id',
  'creado_en',
].sort()

const CLAVES_STOCK = [
  'producto_id',
  'producto_codigo',
  'producto_nombre',
  'sucursal_id',
  'sucursal_nombre',
  'cantidad',
  'actualizado_en',
].sort()

const CLAVES_PAGINA = ['items', 'pagina', 'por_pagina', 'total', 'total_paginas'].sort()

function assertSobreExito(cuerpo) {
  assert.deepEqual(Object.keys(cuerpo).sort(), ['data', 'success'])
  assert.equal(cuerpo.success, true)
}

function assertSobreError(cuerpo) {
  assert.deepEqual(Object.keys(cuerpo).sort(), ['error', 'success'])
  assert.equal(cuerpo.success, false)
  assert.equal(typeof cuerpo.error, 'string')
  assert.ok(cuerpo.error.length > 0, 'el error no debe estar vacio')
}

// Sobre paginado exacto de RF-007/RF-009/RF-013.
function assertSobrePagina(cuerpo, esperado = {}) {
  assertSobreExito(cuerpo)
  const data = cuerpo.data
  assert.ok(
    data !== null && typeof data === 'object' && !Array.isArray(data),
    'data debe ser objeto paginado',
  )
  assert.deepEqual(
    Object.keys(data).sort(),
    CLAVES_PAGINA,
    `sobre paginado: se obtuvo ${JSON.stringify(Object.keys(data).sort())}`,
  )
  assert.ok(Array.isArray(data.items), 'data.items debe ser arreglo')
  assert.equal(typeof data.pagina, 'number')
  assert.equal(typeof data.por_pagina, 'number')
  assert.equal(typeof data.total, 'number')
  assert.equal(typeof data.total_paginas, 'number')
  assert.ok(Number.isInteger(data.pagina) && data.pagina >= 1, 'pagina entero >= 1')
  assert.ok(
    Number.isInteger(data.por_pagina) && data.por_pagina >= 1 && data.por_pagina <= 100,
    'por_pagina entero 1..100',
  )
  assert.ok(data.total >= 0, 'total no negativo')
  assert.equal(
    data.total_paginas,
    Math.ceil(data.total / data.por_pagina),
    'total_paginas = ceil(total / por_pagina)',
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

function assertStock(fila) {
  assert.deepEqual(
    Object.keys(fila).sort(),
    CLAVES_STOCK,
    `forma exacta de Stock, se obtuvo ${JSON.stringify(Object.keys(fila).sort())}`,
  )
  for (const campo of ['producto_id', 'sucursal_id', 'cantidad']) {
    assert.equal(typeof fila[campo], 'number', `stock.${campo} debe ser Number`)
  }
  assert.equal(typeof fila.producto_codigo, 'string')
  assert.equal(typeof fila.producto_nombre, 'string')
  assert.equal(typeof fila.sucursal_nombre, 'string')
  assert.equal(typeof fila.actualizado_en, 'string')
}

function assertMovimiento(movimiento) {
  assert.deepEqual(
    Object.keys(movimiento).sort(),
    CLAVES_MOVIMIENTO,
    `forma exacta de Movimiento, se obtuvo ${JSON.stringify(Object.keys(movimiento).sort())}`,
  )
  for (const campo of ['id', 'producto_id', 'sucursal_id', 'cantidad']) {
    assert.equal(typeof movimiento[campo], 'number', `movimiento.${campo} debe ser Number`)
  }
  assert.equal(typeof movimiento.producto_nombre, 'string')
  assert.equal(typeof movimiento.sucursal_nombre, 'string')
  assert.equal(typeof movimiento.tipo, 'string')
  assert.equal(typeof movimiento.creado_en, 'string')
  assert.ok(
    movimiento.usuario_id === null || typeof movimiento.usuario_id === 'number',
    'usuario_id debe ser Number o null',
  )
  assert.ok(
    movimiento.factura_id === null || typeof movimiento.factura_id === 'number',
    'factura_id debe ser Number o null',
  )
}

async function consultar(sql, parametros = []) {
  const { rows } = await pool.query(sql, parametros)
  return rows
}

// ---- Controles SQL (mismo WHERE que el repositorio, para comparar `total`) ----

async function contarStockBd({ sucursalId, productoId, buscar, soloFaltantes = false } = {}) {
  if (soloFaltantes) {
    const condiciones = ['empresa_id = $1']
    const valores = [1]
    if (sucursalId !== undefined) {
      valores.push(sucursalId)
      condiciones.push(`sucursal_id = $${valores.length}`)
    }
    if (productoId !== undefined) {
      valores.push(productoId)
      condiciones.push(`producto_id = $${valores.length}`)
    }
    if (buscar !== undefined) {
      valores.push(`%${buscar}%`)
      condiciones.push(
        `(producto_nombre ILIKE $${valores.length} OR producto_codigo ILIKE $${valores.length})`,
      )
    }
    const filas = await consultar(
      `SELECT count(*)::int AS total FROM vista_stock_faltante WHERE ${condiciones.join(' AND ')}`,
      valores,
    )
    return filas[0].total
  }

  const condiciones = ['p.empresa_id = $1', 's.empresa_id = $1']
  const valores = [1]
  if (sucursalId !== undefined) {
    valores.push(sucursalId)
    condiciones.push(`st.sucursal_id = $${valores.length}`)
  }
  if (productoId !== undefined) {
    valores.push(productoId)
    condiciones.push(`st.producto_id = $${valores.length}`)
  }
  if (buscar !== undefined) {
    valores.push(`%${buscar}%`)
    condiciones.push(`(p.nombre ILIKE $${valores.length} OR p.codigo ILIKE $${valores.length})`)
  }
  const filas = await consultar(
    `SELECT count(*)::int AS total
       FROM stock st
       JOIN producto p ON p.id = st.producto_id
       JOIN sucursal s ON s.id = st.sucursal_id
      WHERE ${condiciones.join(' AND ')}`,
    valores,
  )
  return filas[0].total
}

async function contarMovimientosBd({ productoId, sucursalId, tipo, desde, hasta } = {}) {
  const condiciones = ['p.empresa_id = $1', 's.empresa_id = $1']
  const valores = [1]
  if (productoId !== undefined) {
    valores.push(productoId)
    condiciones.push(`m.producto_id = $${valores.length}`)
  }
  if (sucursalId !== undefined) {
    valores.push(sucursalId)
    condiciones.push(`m.sucursal_id = $${valores.length}`)
  }
  if (tipo !== undefined) {
    valores.push(tipo)
    condiciones.push(`m.tipo = $${valores.length}`)
  }
  if (desde !== undefined) {
    valores.push(desde)
    condiciones.push(`m.creado_en >= $${valores.length}::timestamptz`)
  }
  if (hasta !== undefined) {
    valores.push(hasta)
    condiciones.push(`m.creado_en <= $${valores.length}::timestamptz`)
  }
  const filas = await consultar(
    `SELECT count(*)::int AS total
       FROM movimiento_inventario m
       JOIN producto p ON p.id = m.producto_id
       JOIN sucursal s ON s.id = m.sucursal_id
      WHERE ${condiciones.join(' AND ')}`,
    valores,
  )
  return filas[0].total
}

// ---- Helpers HTTP ----

async function crearSucursal(nombre) {
  const r = await peticion(base, '/sucursales', {
    metodo: 'POST',
    token,
    cuerpo: { nombre },
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  const id = r.cuerpo.data.sucursal.id
  sucursalesCreadas.push(id)
  return id
}

async function crearProducto(cuerpo) {
  const r = await peticion(base, '/productos', {
    metodo: 'POST',
    token,
    cuerpo,
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  const id = r.cuerpo.data.producto.id
  productosCreados.push(id)
  return id
}

// Registra un movimiento y devuelve la respuesta cruda.
function mover(datos, opciones = {}) {
  return peticion(base, '/inventario/movimientos', {
    metodo: 'POST',
    token: 'token' in opciones ? opciones.token : token,
    cuerpo: datos,
  })
}

// Emite una venta (genera `salida_venta`) y devuelve la respuesta cruda.
function vender(datos, opciones = {}) {
  return peticion(base, '/facturas', {
    metodo: 'POST',
    token: 'token' in opciones ? opciones.token : token,
    cuerpo: datos,
  })
}

function listarStock(query = '') {
  return peticion(base, `/inventario/stock${query ? `?${query}` : ''}`, { token })
}

function listarMovimientos(query = '') {
  return peticion(base, `/inventario/movimientos${query ? `?${query}` : ''}`, { token })
}

// Recorre todas las paginas de un listado y devuelve items concatenados.
async function recorrerPagina(ruta, query, porPagina) {
  const items = []
  let pagina = 1
  let total = 0
  let totalPaginas = 0
  let continuar = true
  while (continuar) {
    const prefijo = query ? `${query}&` : ''
    const r = await peticion(
      base,
      `${ruta}?${prefijo}pagina=${pagina}&por_pagina=${porPagina}`,
      { token },
    )
    assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
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

// Saldo actual en la tabla `stock` (lectura directa).
async function saldo(productoId, sucursalId) {
  const filas = await consultar(
    'SELECT cantidad FROM stock WHERE producto_id = $1 AND sucursal_id = $2',
    [productoId, sucursalId],
  )
  return filas[0] ? Number(filas[0].cantidad) : 0
}

// Suma de movimientos (historico) del par producto/sucursal.
async function sumaMovimientos(productoId, sucursalId) {
  const filas = await consultar(
    `SELECT COALESCE(SUM(cantidad), 0)::int AS total
       FROM movimiento_inventario
      WHERE producto_id = $1 AND sucursal_id = $2`,
    [productoId, sucursalId],
  )
  return Number(filas[0].total)
}

before(async () => {
  servidor = await iniciarServidor()
  base = servidor.urlBase
  token = tokenAdmin()
  tokenSuper = tokenSuperadmin()
  tokenAjeno = tokenOtraEmpresa()

  sucursalA = await crearSucursal(nombreUnico('QA-INV-SUC-A'))
  sucursalB = await crearSucursal(nombreUnico('QA-INV-SUC-B'))

  productoA = await crearProducto({
    codigo: codigoUnico('QA-INV-A'),
    nombre: 'Producto Inventario QA A',
    precio_unitario: 1000,
    impuesto_porcentaje: 0,
  })
  productoB = await crearProducto({
    codigo: codigoUnico('QA-INV-B'),
    nombre: 'Producto Inventario QA B',
    precio_unitario: 500,
    impuesto_porcentaje: 0,
  })
  productoFaltante = await crearProducto({
    codigo: codigoUnico('QA-INV-FALT'),
    nombre: 'Producto Inventario QA Faltante',
    precio_unitario: 100,
    impuesto_porcentaje: 0,
  })
  productoRollback = await crearProducto({
    codigo: codigoUnico('QA-INV-RB'),
    nombre: 'Producto Inventario QA Rollback',
    precio_unitario: 0,
    impuesto_porcentaje: 0,
  })

  // Fixtures de paginacion: 5 productos en A y 3 de ellos tambien en B.
  sucursalPagA = await crearSucursal(nombreUnico('QA-INV-PAG-A'))
  sucursalPagB = await crearSucursal(nombreUnico('QA-INV-PAG-B'))
  for (let n = 1; n <= 5; n += 1) {
    const sufijo = String(n).padStart(2, '0')
    const id = await crearProducto({
      codigo: `${marcaPag}-P${sufijo}`,
      nombre: `Inventario ${marcaPag} ${sufijo}`,
      precio_unitario: 100,
      impuesto_porcentaje: 0,
    })
    productosPag.push(id)
  }
  for (let i = 0; i < 5; i += 1) {
    const r = await mover({
      producto_id: productosPag[i],
      sucursal_id: sucursalPagA,
      tipo: 'carga_inicial',
      cantidad: 10,
    })
    assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  }
  for (let i = 0; i < 3; i += 1) {
    const r = await mover({
      producto_id: productosPag[i],
      sucursal_id: sucursalPagB,
      tipo: 'carga_inicial',
      cantidad: 7,
    })
    assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  }

  // Fixture de salida_venta controlada (marca independiente).
  sucursalSalida = await crearSucursal(nombreUnico('QA-INV-PAG-SALIDA'))
  productoSalida = await crearProducto({
    codigo: `${marcaSalida}-SAL`,
    nombre: `Inventario ${marcaSalida} Salida`,
    precio_unitario: 0,
    impuesto_porcentaje: 0,
  })
})

after(async () => {
  // Restaurar saldos QA a 0: cualquier combinacion producto x sucursal creada
  // por esta suite. Son filas de fixtures; nunca se borran.
  for (const productoId of productosCreados) {
    for (const sucursalId of sucursalesCreadas) {
      try {
        await pool.query(
          'UPDATE stock SET cantidad = 0 WHERE producto_id = $1 AND sucursal_id = $2',
          [productoId, sucursalId],
        )
      } catch {
        /* mejor esfuerzo */
      }
    }
  }

  // Borrado logico de lo creado: queda activo=false.
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
  }
  if (servidor) await servidor.cerrar()
})

// ---------------------------------------------------------------------------
// Salud y autenticacion / autorizacion
// ---------------------------------------------------------------------------

test('GET /salud responde {success:true, data:{bd:true}}', async () => {
  const r = await peticion(base, '/salud')
  assert.equal(r.status, 200)
  assertSobreExito(r.cuerpo)
  assert.equal(r.cuerpo.data.bd, true)
})

test('los 3 endpoints de inventario sin token responden 401', async () => {
  const casos = [
    ['POST /inventario/movimientos', '/inventario/movimientos', { metodo: 'POST', cuerpo: {} }],
    ['GET /inventario/stock', '/inventario/stock', {}],
    ['GET /inventario/movimientos', '/inventario/movimientos', {}],
  ]
  for (const [descripcion, ruta, opciones] of casos) {
    const r = await peticion(base, ruta, opciones)
    assert.equal(r.status, 401, `${descripcion}: esperaba 401, obtuve ${r.status}`)
    assertSobreError(r.cuerpo)
  }
})

test('token malformado responde 401', async () => {
  const r = await peticion(base, '/inventario/stock', { token: 'esto-no-es-un-jwt' })
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('token firmado con otro secreto responde 401', async () => {
  const falso = jwt.sign(
    { id: 1, empresa_id: 1, rol: 'administrador' },
    'secreto-ajeno',
  )
  const r = await peticion(base, '/inventario/stock', { token: falso })
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('superadmin recibe 403 en los 3 endpoints', async () => {
  const casos = [
    ['POST /inventario/movimientos', '/inventario/movimientos', { metodo: 'POST', cuerpo: {} }],
    ['GET /inventario/stock', '/inventario/stock', {}],
    ['GET /inventario/movimientos', '/inventario/movimientos', {}],
  ]
  for (const [descripcion, ruta, opciones] of casos) {
    const r = await peticion(base, ruta, { ...opciones, token: tokenSuper })
    assert.equal(r.status, 403, `${descripcion}: esperaba 403, obtuve ${r.status}`)
    assertSobreError(r.cuerpo)
  }
})

test('administrador sin empresa (empresa_id null) responde 403', async () => {
  const sinEmpresa = firmarToken({ id: 1, empresa_id: null, nombre: 'Sin empresa' })
  const casos = [
    ['GET /inventario/stock', '/inventario/stock', {}],
    ['GET /inventario/movimientos', '/inventario/movimientos', {}],
    [
      'POST /inventario/movimientos',
      '/inventario/movimientos',
      // Cuerpo valido: la validacion pasa y el servicio detecta la falta de empresa.
      { metodo: 'POST', cuerpo: { producto_id: productoA, sucursal_id: sucursalA, tipo: 'ajuste', cantidad: 1 } },
    ],
  ]
  for (const [descripcion, ruta, opciones] of casos) {
    const r = await peticion(base, ruta, { ...opciones, token: sinEmpresa })
    assert.equal(r.status, 403, `${descripcion}: esperaba 403, obtuve ${r.status}`)
    assertSobreError(r.cuerpo)
  }
})

// ---------------------------------------------------------------------------
// Caso feliz: carga_inicial, ajuste entrada/salida y stock = suma
// ---------------------------------------------------------------------------

test('POST carga_inicial: 201, sobre exacto, stock y movimiento', async () => {
  const r = await mover({
    producto_id: productoA,
    sucursal_id: sucursalA,
    tipo: 'carga_inicial',
    cantidad: 50,
    observacion: '  Inventario inicial  ',
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data).sort(), ['movimiento', 'stock'])

  const { movimiento, stock } = r.cuerpo.data
  assertMovimiento(movimiento)
  assert.deepEqual(
    Object.keys(stock).sort(),
    ['cantidad', 'producto_id', 'sucursal_id'],
    'el stock del POST expone solo producto, sucursal y saldo',
  )

  assert.equal(movimiento.producto_id, productoA)
  assert.equal(movimiento.sucursal_id, sucursalA)
  assert.equal(movimiento.tipo, 'carga_inicial')
  assert.equal(movimiento.cantidad, 50)
  assert.equal(movimiento.observacion, 'Inventario inicial', 'la observacion se recorta')
  assert.equal(movimiento.usuario_id, 1, 'usuario_id viene del token')
  assert.equal(movimiento.factura_id, null, 'gestion manual no tiene factura')
  assert.equal(stock.producto_id, productoA)
  assert.equal(stock.sucursal_id, sucursalA)
  assert.equal(stock.cantidad, 50)
})

test('POST ajuste entrada (+5) y salida (-20) actualizan el saldo', async () => {
  const entrada = await mover({
    producto_id: productoA,
    sucursal_id: sucursalA,
    tipo: 'ajuste',
    cantidad: 5,
  })
  assert.equal(entrada.status, 201, JSON.stringify(entrada.cuerpo))
  assert.equal(entrada.cuerpo.data.movimiento.tipo, 'ajuste')
  assert.equal(entrada.cuerpo.data.movimiento.observacion, null)
  assert.equal(entrada.cuerpo.data.stock.cantidad, 55)

  const salida = await mover({
    producto_id: productoA,
    sucursal_id: sucursalA,
    tipo: 'ajuste',
    cantidad: -20,
    observacion: 'Merma QA',
  })
  assert.equal(salida.status, 201, JSON.stringify(salida.cuerpo))
  assert.equal(salida.cuerpo.data.movimiento.cantidad, -20)
  assert.equal(salida.cuerpo.data.movimiento.observacion, 'Merma QA')
  assert.equal(salida.cuerpo.data.stock.cantidad, 35)
})

test('el stock resultante es exactamente la suma de movimientos (SQL)', async () => {
  const stockBd = await saldo(productoA, sucursalA)
  const suma = await sumaMovimientos(productoA, sucursalA)
  assert.equal(stockBd, 35, 'saldo en tabla stock')
  assert.equal(suma, 35, 'suma del historico = 35 (50 + 5 - 20)')
  assert.equal(stockBd, suma, 'stock = suma de movimientos')

  const filas = await consultar(
    `SELECT tipo, cantidad, observacion, usuario_id, factura_id
       FROM movimiento_inventario
      WHERE producto_id = $1 AND sucursal_id = $2
      ORDER BY id`,
    [productoA, sucursalA],
  )
  assert.equal(filas.length, 3, 'deben persistir 3 movimientos')
  assert.deepEqual(
    filas.map((f) => Number(f.cantidad)),
    [50, 5, -20],
  )
  assert.ok(filas.every((f) => f.factura_id === null), 'factura_id debe ser null')
  assert.ok(filas.every((f) => Number(f.usuario_id) === 1))
})

// ---------------------------------------------------------------------------
// Validaciones 400
// ---------------------------------------------------------------------------

test('POST movimientos validaciones 400 (nunca 500)', async (t) => {
  const baseCuerpo = () => ({
    producto_id: productoA,
    sucursal_id: sucursalA,
    tipo: 'ajuste',
    cantidad: 1,
  })
  const casos = [
    ['tipo salida_venta', { ...baseCuerpo(), tipo: 'salida_venta' }],
    ['tipo anulacion', { ...baseCuerpo(), tipo: 'anulacion' }],
    ['tipo desconocido', { ...baseCuerpo(), tipo: 'otro' }],
    ['tipo ausente', { producto_id: productoA, sucursal_id: sucursalA, cantidad: 1 }],
    ['tipo no texto', { ...baseCuerpo(), tipo: 5 }],
    ['cantidad 0', { ...baseCuerpo(), cantidad: 0 }],
    ['cantidad decimal', { ...baseCuerpo(), cantidad: 1.5 }],
    ['cantidad no numerica', { ...baseCuerpo(), cantidad: 'abc' }],
    ['cantidad vacia', { ...baseCuerpo(), cantidad: '' }],
    ['cantidad booleana', { ...baseCuerpo(), cantidad: true }],
    ['cantidad 1000001', { ...baseCuerpo(), cantidad: 1000001 }],
    ['cantidad -1000001', { ...baseCuerpo(), cantidad: -1000001 }],
    ['cantidad 2147483647', { ...baseCuerpo(), cantidad: 2147483647 }],
    ['cantidad ausente', { producto_id: productoA, sucursal_id: sucursalA, tipo: 'ajuste' }],
    ['producto_id ausente', { sucursal_id: sucursalA, tipo: 'ajuste', cantidad: 1 }],
    ['sucursal_id ausente', { producto_id: productoA, tipo: 'ajuste', cantidad: 1 }],
    ['producto_id 0', { ...baseCuerpo(), producto_id: 0 }],
    ['producto_id decimal', { ...baseCuerpo(), producto_id: 1.5 }],
    ['producto_id fuera de rango', { ...baseCuerpo(), producto_id: 9223372036854775808 }],
    ['sucursal_id negativo', { ...baseCuerpo(), sucursal_id: -1 }],
    ['observacion 256', { ...baseCuerpo(), observacion: 'A'.repeat(256) }],
    ['observacion no texto', { ...baseCuerpo(), observacion: 123 }],
    ['cuerpo arreglo', [baseCuerpo()]],
    ['cuerpo null', null],
  ]

  for (const [descripcion, cuerpo] of casos) {
    await t.test(descripcion, async () => {
      const r = await mover(cuerpo)
      assert.notEqual(r.status, 500, `${descripcion}: nunca 500 ${JSON.stringify(r.cuerpo)}`)
      assert.equal(
        r.status,
        400,
        `${descripcion}: esperaba 400, obtuve ${r.status} ${JSON.stringify(r.cuerpo)}`,
      )
      assertSobreError(r.cuerpo)
    })
  }
})

test('movimientos invalidos no dejan rastro en la BD (contado por fixture propio)', async () => {
  // Se acota al par producto/sucursal de esta suite: `node --test` corre
  // facturas en paralelo y este inserta `salida_venta` en otras sucursales.
  const antes = await consultar(
    `SELECT count(*)::int AS total FROM movimiento_inventario
      WHERE producto_id = $1 AND sucursal_id = $2`,
    [productoA, sucursalA],
  )
  const r = await mover({
    producto_id: productoA,
    sucursal_id: sucursalA,
    tipo: 'salida_venta',
    cantidad: 5,
  })
  assert.equal(r.status, 400)
  const despues = await consultar(
    `SELECT count(*)::int AS total FROM movimiento_inventario
      WHERE producto_id = $1 AND sucursal_id = $2`,
    [productoA, sucursalA],
  )
  assert.equal(
    despues[0].total,
    antes[0].total,
    'una validacion fallida no debe insertar movimientos',
  )
})

// ---------------------------------------------------------------------------
// Limites exactos
// ---------------------------------------------------------------------------

test('limites exactos: |cantidad| = 1000000 y observacion 255 -> 201', async () => {
  const tope = await mover({
    producto_id: productoB,
    sucursal_id: sucursalB,
    tipo: 'carga_inicial',
    cantidad: 1000000,
    observacion: 'B'.repeat(255),
  })
  assert.equal(tope.status, 201, JSON.stringify(tope.cuerpo))
  assert.equal(tope.cuerpo.data.stock.cantidad, 1000000)
  assert.equal(tope.cuerpo.data.movimiento.observacion.length, 255)

  const bajar = await mover({
    producto_id: productoB,
    sucursal_id: sucursalB,
    tipo: 'ajuste',
    cantidad: -1000000,
  })
  assert.equal(bajar.status, 201, JSON.stringify(bajar.cuerpo))
  assert.equal(bajar.cuerpo.data.stock.cantidad, 0)
})

test('EC-005: se permite mover inventario de un producto inactivo', async () => {
  const off = await peticion(base, `/productos/${productoB}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { activo: false },
  })
  assert.equal(off.status, 200, JSON.stringify(off.cuerpo))
  assert.equal(off.cuerpo.data.producto.activo, false)

  const antes = await saldo(productoB, sucursalB)
  const r = await mover({
    producto_id: productoB,
    sucursal_id: sucursalB,
    tipo: 'ajuste',
    cantidad: 3,
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assert.equal(r.cuerpo.data.stock.cantidad, antes + 3)

  // Se reactiva para no interferir con el resto de la suite.
  await peticion(base, `/productos/${productoB}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { activo: true },
  })
})

// ---------------------------------------------------------------------------
// 404: producto/sucursal inexistente o ajeno
// ---------------------------------------------------------------------------

test('producto_id inexistente responde 404 sin crear movimiento', async () => {
  const antes = await consultar(
    'SELECT count(*)::int AS total FROM movimiento_inventario WHERE producto_id = 99999999',
  )
  const r = await mover({
    producto_id: 99999999,
    sucursal_id: sucursalA,
    tipo: 'ajuste',
    cantidad: 1,
  })
  assert.equal(r.status, 404, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
  const despues = await consultar(
    'SELECT count(*)::int AS total FROM movimiento_inventario WHERE producto_id = 99999999',
  )
  assert.equal(despues[0].total, antes[0].total)
})

test('sucursal_id inexistente responde 404', async () => {
  const r = await mover({
    producto_id: productoA,
    sucursal_id: 99999999,
    tipo: 'ajuste',
    cantidad: 1,
  })
  assert.equal(r.status, 404, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('producto/sucursal de otra empresa responde 404 (IDOR)', async () => {
  const productoAjeno = await mover(
    { producto_id: productoA, sucursal_id: sucursalA, tipo: 'ajuste', cantidad: 1 },
    { token: tokenAjeno },
  )
  assert.equal(productoAjeno.status, 404, JSON.stringify(productoAjeno.cuerpo))
  assertSobreError(productoAjeno.cuerpo)
})

// ---------------------------------------------------------------------------
// Multi-tenant / IDOR
// ---------------------------------------------------------------------------

test('IDOR: empresa_id falso en el body se ignora y el stock queda en la empresa 1', async () => {
  const r = await mover({
    producto_id: productoA,
    sucursal_id: sucursalA,
    tipo: 'ajuste',
    cantidad: 1,
    empresa_id: 999,
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assert.equal(r.cuerpo.data.movimiento.producto_id, productoA)

  const filas = await consultar(
    `SELECT p.empresa_id, s.empresa_id AS sucursal_empresa
       FROM movimiento_inventario m
       JOIN producto p ON p.id = m.producto_id
       JOIN sucursal s ON s.id = m.sucursal_id
      WHERE m.id = $1`,
    [r.cuerpo.data.movimiento.id],
  )
  assert.equal(Number(filas[0].empresa_id), 1, 'empresa del producto = token')
  assert.equal(Number(filas[0].sucursal_empresa), 1, 'empresa de la sucursal = token')
})

test('IDOR: empresa_id falso en el query de stock se ignora', async () => {
  const r = await listarStock(
    `empresa_id=999&producto_id=${productoA}&sucursal_id=${sucursalA}`,
  )
  const data = assertSobrePagina(r.cuerpo)
  assert.equal(data.total, 1, 'debe seguir listando la empresa del token (empresa 1)')
  assert.equal(data.items.length, 1)
  assert.equal(data.items[0].producto_id, productoA)
})

test('IDOR: token de otra empresa no ve stock ni movimientos de la empresa 1', async () => {
  const stock = await peticion(base, '/inventario/stock', { token: tokenAjeno })
  assertSobrePagina(stock.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(stock.cuerpo.data.items, [], 'empresa 999 no tiene existencias')

  const movimientos = await peticion(base, '/inventario/movimientos', { token: tokenAjeno })
  assertSobrePagina(movimientos.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(movimientos.cuerpo.data.items, [], 'empresa 999 no tiene movimientos')
})

// ---------------------------------------------------------------------------
// GET /inventario/stock (sobre paginado)
// ---------------------------------------------------------------------------

test('GET stock: defaults pagina=1 y por_pagina=10 (sobre paginado)', async () => {
  const r = await listarStock()
  assert.equal(r.status, 200)
  assertSobrePagina(r.cuerpo, { pagina: 1, por_pagina: 10 })
})

test('GET stock sin filtros: items con forma exacta y tope de pagina', async () => {
  const r = await listarStock('por_pagina=10')
  const data = assertSobrePagina(r.cuerpo, { pagina: 1, por_pagina: 10 })
  assert.ok(data.items.length > 0)
  assert.ok(data.items.length <= 10, 'no puede traer mas que por_pagina')
  assert.ok(data.total >= data.items.length)
  for (const fila of data.items) assertStock(fila)
})

test('GET stock filtra por sucursal_id y producto_id (total = COUNT SQL)', async () => {
  const porSucursal = await listarStock(`sucursal_id=${sucursalA}&por_pagina=100`)
  const dataSucursal = assertSobrePagina(porSucursal.cuerpo)
  assert.ok(dataSucursal.total > 0)
  assert.ok(
    dataSucursal.items.every((fila) => fila.sucursal_id === sucursalA),
    'solo debe devolver la sucursal filtrada',
  )
  assert.equal(
    dataSucursal.total,
    await contarStockBd({ sucursalId: sucursalA }),
    'total = COUNT de la sucursal',
  )

  const porProducto = await listarStock(
    `producto_id=${productoA}&sucursal_id=${sucursalA}`,
  )
  const dataProducto = assertSobrePagina(porProducto.cuerpo)
  assert.equal(dataProducto.total, 1)
  assert.equal(dataProducto.items.length, 1)
  assert.equal(dataProducto.items[0].producto_id, productoA)
  assert.equal(
    dataProducto.items[0].cantidad,
    await saldo(productoA, sucursalA),
    'la cantidad debe coincidir con el saldo real en la BD',
  )
})

test('GET stock filtra por buscar (nombre y codigo, ILIKE) contra COUNT SQL', async () => {
  const codigo = (await consultar('SELECT codigo FROM producto WHERE id = $1', [productoA]))[0].codigo

  const porNombre = await listarStock(
    `buscar=${encodeURIComponent('Inventario QA A')}&por_pagina=100`,
  )
  const dataNombre = assertSobrePagina(porNombre.cuerpo)
  assert.ok(dataNombre.items.some((f) => f.producto_id === productoA))
  assert.equal(
    dataNombre.total,
    await contarStockBd({ buscar: 'Inventario QA A' }),
    'total del filtro por nombre = COUNT',
  )

  const terminoCodigo = codigo.slice(0, 8)
  const porCodigo = await listarStock(
    `buscar=${encodeURIComponent(terminoCodigo)}&por_pagina=100`,
  )
  const dataCodigo = assertSobrePagina(porCodigo.cuerpo)
  assert.ok(dataCodigo.items.some((f) => f.producto_id === productoA))
  assert.equal(
    dataCodigo.total,
    await contarStockBd({ buscar: terminoCodigo }),
    'total del filtro por codigo = COUNT',
  )
})

test('GET stock con buscar sin coincidencias devuelve items vacio y total 0', async () => {
  const r = await listarStock(`buscar=${encodeURIComponent(`ZZZ-${marcaPag}-NADA`)}`)
  const data = assertSobrePagina(r.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(data.items, [])
})

test('GET stock paginado: total/total_paginas coherentes con COUNT SQL y filtros', async () => {
  const query = `buscar=${encodeURIComponent(marcaPag)}`

  const sinSucursal = await listarStock(`${query}&por_pagina=100`)
  const dataSin = assertSobrePagina(sinSucursal.cuerpo)
  assert.equal(dataSin.total, 8, '5 filas en A + 3 en B')
  assert.equal(dataSin.items.length, 8)
  assert.equal(
    dataSin.total,
    await contarStockBd({ buscar: marcaPag }),
    'total = COUNT SQL con el mismo filtro',
  )

  const porA = await listarStock(
    `${query}&sucursal_id=${sucursalPagA}&por_pagina=100`,
  )
  const dataA = assertSobrePagina(porA.cuerpo)
  assert.equal(dataA.total, 5)
  assert.equal(dataA.total, await contarStockBd({ buscar: marcaPag, sucursalId: sucursalPagA }))
  assert.ok(dataA.items.every((f) => f.sucursal_id === sucursalPagA))

  const porB = await listarStock(
    `${query}&sucursal_id=${sucursalPagB}&por_pagina=100`,
  )
  const dataB = assertSobrePagina(porB.cuerpo)
  assert.equal(dataB.total, 3)
  assert.equal(dataB.total, await contarStockBd({ buscar: marcaPag, sucursalId: sucursalPagB }))
  assert.ok(dataB.items.every((f) => f.sucursal_id === sucursalPagB))
})

test('GET stock paginado: no repite ni omite filas y respeta el orden', async () => {
  const query = `buscar=${encodeURIComponent(marcaPag)}`
  const { items, total, totalPaginas } = await recorrerPagina(
    '/inventario/stock',
    query,
    3,
  )

  assert.equal(total, 8)
  assert.equal(totalPaginas, Math.ceil(8 / 3))
  assert.equal(items.length, 8, 'la union de paginas cubre todas las filas')

  const claves = items.map((f) => `${f.producto_id}-${f.sucursal_id}`)
  assert.equal(new Set(claves).size, 8, 'sin filas repetidas entre paginas')

  // Control SQL con el ORDER BY documentado (producto_nombre, sucursal_nombre).
  const control = await consultar(
    `SELECT st.producto_id, st.sucursal_id
       FROM stock st
       JOIN producto p ON p.id = st.producto_id
       JOIN sucursal s ON s.id = st.sucursal_id
      WHERE p.empresa_id = 1 AND s.empresa_id = 1
        AND (p.nombre ILIKE $1 OR p.codigo ILIKE $1)
      ORDER BY p.nombre ASC, s.nombre ASC`,
    [`%${marcaPag}%`],
  )
  assert.deepEqual(
    claves,
    control.map((f) => `${Number(f.producto_id)}-${Number(f.sucursal_id)}`),
    'orden por producto_nombre ASC, sucursal_nombre ASC',
  )

  for (let i = 1; i < items.length; i += 1) {
    const anterior = items[i - 1]
    const actual = items[i]
    const comparacion =
      anterior.producto_nombre.localeCompare(actual.producto_nombre) ||
      anterior.sucursal_nombre.localeCompare(actual.sucursal_nombre)
    assert.ok(
      comparacion <= 0,
      `orden no decreciente: ${anterior.producto_nombre}/${anterior.sucursal_nombre} antes de ${actual.producto_nombre}/${actual.sucursal_nombre}`,
    )
  }

  // Una pagina mas alla del final no inventa filas ni pierde el total.
  const masAlla = await listarStock(`${query}&por_pagina=3&pagina=4`)
  assertSobrePagina(masAlla.cuerpo, { pagina: 4, por_pagina: 3, total: 8, total_paginas: 3 })
  assert.deepEqual(masAlla.cuerpo.data.items, [])
})

test('solo_faltantes=true devuelve solo negativos y total = COUNT de la vista', async () => {
  // Se deja un faltante real en un fixture QA.
  const cargar = await mover({
    producto_id: productoFaltante,
    sucursal_id: sucursalA,
    tipo: 'carga_inicial',
    cantidad: 5,
  })
  assert.equal(cargar.status, 201, JSON.stringify(cargar.cuerpo))
  const salida = await mover({
    producto_id: productoFaltante,
    sucursal_id: sucursalA,
    tipo: 'ajuste',
    cantidad: -15,
  })
  assert.equal(salida.status, 201, JSON.stringify(salida.cuerpo))
  assert.equal(salida.cuerpo.data.stock.cantidad, -10)

  const porProducto = await listarStock(
    `solo_faltantes=true&producto_id=${productoFaltante}`,
  )
  const dataProducto = assertSobrePagina(porProducto.cuerpo)
  assert.equal(
    dataProducto.total,
    await contarStockBd({ soloFaltantes: true, productoId: productoFaltante }),
    'total = COUNT de vista_stock_faltante',
  )
  assert.equal(dataProducto.items.length, dataProducto.total)
  assert.ok(dataProducto.items.length >= 1)
  for (const fila of dataProducto.items) {
    assertStock(fila)
    assert.ok(fila.cantidad < 0, `solo faltantes: cantidad ${fila.cantidad} no es negativa`)
  }
  assert.ok(
    dataProducto.items.some((f) => f.producto_id === productoFaltante && f.cantidad === -10),
    'el faltante QA debe aparecer',
  )

  const porSucursal = await listarStock(
    `solo_faltantes=true&sucursal_id=${sucursalA}&por_pagina=100`,
  )
  const dataSucursal = assertSobrePagina(porSucursal.cuerpo)
  assert.equal(
    dataSucursal.total,
    await contarStockBd({ soloFaltantes: true, sucursalId: sucursalA }),
  )
  for (const fila of dataSucursal.items) {
    assert.ok(fila.cantidad < 0, 'solo faltantes: toda fila debe ser negativa')
  }
})

test('solo_faltantes acepta 1/0 y rechaza valores invalidos (400)', async () => {
  const uno = await listarStock('solo_faltantes=1&por_pagina=100')
  const dataUno = assertSobrePagina(uno.cuerpo)
  for (const fila of dataUno.items) assert.ok(fila.cantidad < 0)

  const cero = await listarStock(
    `solo_faltantes=0&buscar=${encodeURIComponent(marcaPag)}`,
  )
  const dataCero = assertSobrePagina(cero.cuerpo, { total: 8 })
  assert.ok(dataCero.items.some((f) => f.cantidad >= 0), '0 devuelve todas las existencias')

  const invalido = await listarStock('solo_faltantes=quizas')
  assert.equal(invalido.status, 400)
  assertSobreError(invalido.cuerpo)
})

// ---------------------------------------------------------------------------
// GET /inventario/movimientos (sobre paginado)
// ---------------------------------------------------------------------------

test('GET movimientos: defaults, forma exacta y orden descendente', async () => {
  const r = await listarMovimientos()
  const data = assertSobrePagina(r.cuerpo, { pagina: 1, por_pagina: 10 })
  assert.ok(data.items.length > 0)
  for (const movimiento of data.items) assertMovimiento(movimiento)

  const fechas = data.items.map((m) => new Date(m.creado_en).getTime())
  for (let i = 1; i < fechas.length; i += 1) {
    assert.ok(
      fechas[i - 1] >= fechas[i],
      'los movimientos deben venir de mas reciente a mas antiguo',
    )
  }
})

test('GET movimientos: `limite` obsoleto se ignora a favor de por_pagina', async () => {
  const porDefecto = await listarMovimientos()
  assertSobrePagina(porDefecto.cuerpo, { pagina: 1, por_pagina: 10 })

  const conLimite1 = await listarMovimientos('limite=1')
  const data1 = assertSobrePagina(conLimite1.cuerpo, { por_pagina: 10 })
  assert.ok(data1.items.length <= 10)

  const limiteCero = await listarMovimientos('limite=0')
  assert.equal(limiteCero.status, 200, '`limite` ya no se valida: se ignora')
  assertSobrePagina(limiteCero.cuerpo, { por_pagina: 10 })

  const limiteMil = await listarMovimientos('limite=1000')
  assertSobrePagina(limiteMil.cuerpo, { por_pagina: 10 })
})

test('GET movimientos filtra por producto_id, sucursal_id y tipo (total = COUNT SQL)', async () => {
  const r = await listarMovimientos(
    `producto_id=${productoA}&sucursal_id=${sucursalA}&tipo=ajuste&por_pagina=100`,
  )
  const data = assertSobrePagina(r.cuerpo)
  assert.equal(
    data.total,
    await contarMovimientosBd({ productoId: productoA, sucursalId: sucursalA, tipo: 'ajuste' }),
    'total = COUNT SQL con los mismos filtros',
  )
  assert.ok(data.items.length >= 2)
  for (const m of data.items) {
    assert.equal(m.producto_id, productoA)
    assert.equal(m.sucursal_id, sucursalA)
    assert.equal(m.tipo, 'ajuste')
  }

  // `salida_venta` controlada: una venta real debe generar su movimiento.
  const venta = await vender({
    sucursal_id: sucursalSalida,
    lineas: [{ producto_id: productoSalida, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(venta.status, 201, JSON.stringify(venta.cuerpo))

  const ventas = await listarMovimientos(
    `producto_id=${productoSalida}&sucursal_id=${sucursalSalida}&tipo=salida_venta`,
  )
  const dataVentas = assertSobrePagina(ventas.cuerpo)
  assert.equal(dataVentas.total, 1)
  assert.equal(dataVentas.items.length, 1)
  assert.equal(dataVentas.items[0].tipo, 'salida_venta')
  assert.ok(dataVentas.items[0].cantidad < 0, 'la salida debe ser negativa')
  assert.equal(typeof dataVentas.items[0].factura_id, 'number')

  const invalido = await listarMovimientos('tipo=otro')
  assert.equal(invalido.status, 400)
  assertSobreError(invalido.cuerpo)
})

test('GET movimientos filtra por desde/hasta y valida fechas', async () => {
  const futuro = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const pasado = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const conDesde = await listarMovimientos(
    `producto_id=${productoA}&sucursal_id=${sucursalA}&desde=${encodeURIComponent(pasado)}&por_pagina=100`,
  )
  const dataDesde = assertSobrePagina(conDesde.cuerpo)
  assert.equal(
    dataDesde.total,
    await contarMovimientosBd({ productoId: productoA, sucursalId: sucursalA, desde: pasado }),
    'total de `desde` = COUNT SQL',
  )
  assert.ok(dataDesde.total > 0, 'desde hace 1h debe incluir movimientos recientes')
  for (const m of dataDesde.items) {
    assert.ok(new Date(m.creado_en).getTime() >= new Date(pasado).getTime())
  }

  const conHasta = await listarMovimientos(
    `producto_id=${productoA}&sucursal_id=${sucursalA}&hasta=${encodeURIComponent(pasado)}`,
  )
  assertSobrePagina(conHasta.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(conHasta.cuerpo.data.items, [], 'hasta hace 1h excluye lo reciente')

  const conFuturo = await listarMovimientos(
    `producto_id=${productoA}&sucursal_id=${sucursalA}&desde=${encodeURIComponent(futuro)}`,
  )
  assertSobrePagina(conFuturo.cuerpo, { total: 0 })
  assert.deepEqual(conFuturo.cuerpo.data.items, [])

  const invalida = await listarMovimientos('desde=no-es-fecha')
  assert.equal(invalida.status, 400)
  assertSobreError(invalida.cuerpo)
})

test('GET movimientos paginado: total/total_paginas, sin repetir/omitir y orden DESC', async () => {
  const totalBd = await contarMovimientosBd({ sucursalId: sucursalPagA })
  assert.equal(totalBd, 5)

  const { items, total, totalPaginas } = await recorrerPagina(
    '/inventario/movimientos',
    `sucursal_id=${sucursalPagA}`,
    2,
  )
  assert.equal(total, totalBd)
  assert.equal(totalPaginas, Math.ceil(5 / 2))
  assert.equal(items.length, 5, 'la union de paginas cubre todos los movimientos')

  const ids = items.map((m) => m.id)
  assert.equal(new Set(ids).size, 5, 'sin movimientos repetidos entre paginas')

  // Control SQL con el ORDER BY documentado (creado_en DESC, id DESC).
  const control = await consultar(
    `SELECT m.id
       FROM movimiento_inventario m
       JOIN producto p ON p.id = m.producto_id
       JOIN sucursal s ON s.id = m.sucursal_id
      WHERE p.empresa_id = 1 AND s.empresa_id = 1 AND m.sucursal_id = $1
      ORDER BY m.creado_en DESC, m.id DESC`,
    [sucursalPagA],
  )
  assert.deepEqual(ids, control.map((f) => Number(f.id)), 'orden creado_en DESC, id DESC')

  for (let i = 1; i < items.length; i += 1) {
    const anterior = items[i - 1]
    const actual = items[i]
    const fechaAnterior = new Date(anterior.creado_en).getTime()
    const fechaActual = new Date(actual.creado_en).getTime()
    assert.ok(fechaAnterior >= fechaActual, 'creado_en no creciente')
    if (fechaAnterior === fechaActual) {
      assert.ok(anterior.id > actual.id, 'desempate por id DESC')
    }
  }
})

// ---------------------------------------------------------------------------
// RF-013: validacion de la paginacion
// ---------------------------------------------------------------------------

test('RF-013: paginacion invalida -> 400 en ambos endpoints', async (t) => {
  const casos = [
    ['pagina=0', 'pagina=0'],
    ['pagina=-1', 'pagina=-1'],
    ['pagina=1.5', 'pagina=1.5'],
    ['pagina=abc', 'pagina=abc'],
    ['por_pagina=0', 'por_pagina=0'],
    ['por_pagina=-3', 'por_pagina=-3'],
    ['por_pagina=101', 'por_pagina=101'],
    ['por_pagina=1.5', 'por_pagina=1.5'],
    ['por_pagina=abc', 'por_pagina=abc'],
  ]

  for (const [descripcion, query] of casos) {
    await t.test(`stock ${descripcion}`, async () => {
      const r = await peticion(base, `/inventario/stock?${query}`, { token })
      assert.equal(r.status, 400, `stock ${descripcion}: obtuve ${r.status} ${JSON.stringify(r.cuerpo)}`)
      assertSobreError(r.cuerpo)
    })
    await t.test(`movimientos ${descripcion}`, async () => {
      const r = await peticion(base, `/inventario/movimientos?${query}`, { token })
      assert.equal(
        r.status,
        400,
        `movimientos ${descripcion}: obtuve ${r.status} ${JSON.stringify(r.cuerpo)}`,
      )
      assertSobreError(r.cuerpo)
    })
  }
})

test('RF-013: limites validos de paginacion (1 y 100) -> 200', async () => {
  const stockMin = await listarStock('pagina=1&por_pagina=1')
  assertSobrePagina(stockMin.cuerpo, { pagina: 1, por_pagina: 1 })
  assert.ok(stockMin.cuerpo.data.items.length <= 1)

  const stockMax = await listarStock('por_pagina=100')
  assertSobrePagina(stockMax.cuerpo, { por_pagina: 100 })

  const movMin = await listarMovimientos('pagina=1&por_pagina=1')
  assertSobrePagina(movMin.cuerpo, { pagina: 1, por_pagina: 1 })
  assert.ok(movMin.cuerpo.data.items.length <= 1)

  const movMax = await listarMovimientos('por_pagina=100')
  assertSobrePagina(movMax.cuerpo, { por_pagina: 100 })
})

// ---------------------------------------------------------------------------
// Rollback: fallo a mitad de la transaccion no debe dejar rastro
// ---------------------------------------------------------------------------

test('ROLLBACK: desborde 22003 responde 400 sin movimiento ni cambio de stock', async () => {
  const AL_BORDE = -2147483647 // limite inferior de `integer`

  await pool.query(
    `INSERT INTO stock (producto_id, sucursal_id, cantidad)
     VALUES ($1, $2, $3)
     ON CONFLICT (producto_id, sucursal_id)
     DO UPDATE SET cantidad = EXCLUDED.cantidad`,
    [productoRollback, sucursalB, AL_BORDE],
  )

  const stockAntes = await saldo(productoRollback, sucursalB)
  assert.equal(stockAntes, AL_BORDE)

  const movimientosAntes = await consultar(
    `SELECT count(*)::int AS total FROM movimiento_inventario
      WHERE producto_id = $1 AND sucursal_id = $2`,
    [productoRollback, sucursalB],
  )

  // -2147483647 + (-2) = -2147483649 => 22003 dentro del trigger.
  const fallo = await mover({
    producto_id: productoRollback,
    sucursal_id: sucursalB,
    tipo: 'ajuste',
    cantidad: -2,
  })
  console.log(
    '[rollback inventario] status:',
    fallo.status,
    'body:',
    JSON.stringify(fallo.cuerpo),
  )
  assert.notEqual(fallo.status, 500, 'un desborde no debe ser 500')
  assert.equal(fallo.status, 400, JSON.stringify(fallo.cuerpo))
  assertSobreError(fallo.cuerpo)

  const stockDespues = await saldo(productoRollback, sucursalB)
  const movimientosDespues = await consultar(
    `SELECT count(*)::int AS total FROM movimiento_inventario
      WHERE producto_id = $1 AND sucursal_id = $2`,
    [productoRollback, sucursalB],
  )
  assert.equal(stockDespues, AL_BORDE, 'el stock no debe cambiar tras el rollback')
  assert.equal(
    movimientosDespues[0].total,
    movimientosAntes[0].total,
    'no debe quedar ningun movimiento tras el rollback',
  )

  await pool.query(
    'UPDATE stock SET cantidad = 0 WHERE producto_id = $1 AND sucursal_id = $2',
    [productoRollback, sucursalB],
  )
})

// ---------------------------------------------------------------------------
// Casteo numeric/bigint -> Number
// ---------------------------------------------------------------------------

test('bigint/numeric llegan como Number en stock y movimientos', async () => {
  const stock = await listarStock(
    `producto_id=${productoA}&sucursal_id=${sucursalA}`,
  )
  const dataStock = assertSobrePagina(stock.cuerpo)
  const fila = dataStock.items[0]
  for (const campo of ['producto_id', 'sucursal_id', 'cantidad']) {
    assert.equal(typeof fila[campo], 'number', `stock.${campo}`)
  }

  const movs = await listarMovimientos(
    `producto_id=${productoA}&sucursal_id=${sucursalA}&por_pagina=100`,
  )
  const dataMovs = assertSobrePagina(movs.cuerpo)
  for (const m of dataMovs.items) {
    for (const campo of ['id', 'producto_id', 'sucursal_id', 'cantidad']) {
      assert.equal(typeof m[campo], 'number', `movimiento.${campo}`)
    }
  }
})



