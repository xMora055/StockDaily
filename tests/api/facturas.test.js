/*
 * SD-006 - Verificacion independiente del POS: POST /api/v1/facturas.
 * Runner nativo de Node 24 + fetch. La app se levanta en un puerto efimero.
 *
 * Datos: se crean sucursales y productos `QA-*` claramente identificables y se
 * dejan INACTIVOS al terminar (borrado logico). Nunca se hace DELETE/DROP.
 * Las facturas/movimientos no tienen borrado en el dominio: quedan como
 * evidencia historica, igual que las dejadas por el backend.
 *
 * Multi-tenant: la unica empresa real es la 1. Para sondear IDOR se firma un
 * token con `empresa_id = 999` (inexistente), como en las suites previas.
 *
 * Lecturas directas a la BD (solo SELECT) para verificar snapshot, stock y
 * rollback; se usa el mismo pool de `server/db/pool`.
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

// Recursos QA creados por la suite (se desactivan al final, no se borran).
const sucursalesCreadas = []
const productosCreados = []

// Sucursal/productos aislados para no interferir con la numeracion de la
// sucursal 1 (compartida) ni con otras suites.
let sucursalVentas
let sucursalRollback
let productoA
let productoB
let productoInactivo
let productoRound1
let productoRound2
let productoRollback
let productoLimite

const CLAVES_FACTURA = [
  'id',
  'numero_factura',
  'sucursal_id',
  'usuario_id',
  'cliente_id',
  'cliente_nombre',
  'cliente_documento',
  'metodo_pago_id',
  'estado',
  'fecha',
  'subtotal',
  'descuento',
  'impuesto',
  'total',
  'detalles',
].sort()

const CLAVES_DETALLE = [
  'id',
  'producto_id',
  'cantidad',
  'precio_unitario',
  'descuento_porcentaje',
  'impuesto_porcentaje',
  'subtotal',
  'impuesto',
  'total',
].sort()

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

function assertFactura(factura) {
  assert.deepEqual(
    Object.keys(factura).sort(),
    CLAVES_FACTURA,
    `forma exacta de Factura, se obtuvo ${JSON.stringify(Object.keys(factura).sort())}`,
  )
  assert.equal(typeof factura.id, 'number')
  assert.equal(typeof factura.numero_factura, 'number')
  assert.equal(typeof factura.sucursal_id, 'number')
  assert.equal(typeof factura.usuario_id, 'number')
  assert.ok(
    factura.cliente_id === null || typeof factura.cliente_id === 'number',
    'cliente_id debe ser Number o null',
  )
  assert.ok(
    factura.metodo_pago_id === null || typeof factura.metodo_pago_id === 'number',
    'metodo_pago_id debe ser Number o null',
  )
  assert.equal(factura.estado, 'emitida')
  assert.equal(typeof factura.fecha, 'string')
  for (const campo of ['subtotal', 'descuento', 'impuesto', 'total']) {
    assert.equal(typeof factura[campo], 'number', `${campo} debe ser Number`)
  }
  assert.ok(Array.isArray(factura.detalles), 'detalles debe ser arreglo')
  for (const detalle of factura.detalles) {
    assert.deepEqual(
      Object.keys(detalle).sort(),
      CLAVES_DETALLE,
      `forma exacta de Detalle, se obtuvo ${JSON.stringify(Object.keys(detalle).sort())}`,
    )
    for (const campo of [
      'id',
      'producto_id',
      'cantidad',
      'precio_unitario',
      'descuento_porcentaje',
      'impuesto_porcentaje',
      'subtotal',
      'impuesto',
      'total',
    ]) {
      assert.equal(typeof detalle[campo], 'number', `detalle.${campo} debe ser Number`)
    }
  }
  // Coherencia con el CHECK de la tabla `factura`.
  assert.equal(
    factura.total,
    Number((factura.subtotal - factura.descuento + factura.impuesto).toFixed(2)),
    'total debe ser subtotal - descuento + impuesto',
  )
  assert.ok(factura.total >= 0, 'total no puede ser negativo')
}

async function consultar(sql, parametros = []) {
  const { rows } = await pool.query(sql, parametros)
  return rows
}

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

// Emite una venta y devuelve la respuesta cruda.
function vender(datos, opciones = {}) {
  return peticion(base, '/facturas', {
    metodo: 'POST',
    token: 'token' in opciones ? opciones.token : token,
    cuerpo: datos,
  })
}

before(async () => {
  servidor = await iniciarServidor()
  base = servidor.urlBase
  token = tokenAdmin()
  tokenSuper = tokenSuperadmin()
  tokenAjeno = tokenOtraEmpresa()

  sucursalVentas = await crearSucursal(nombreUnico('QA-POS-VENTAS'))
  sucursalRollback = await crearSucursal(nombreUnico('QA-POS-ROLLBACK'))

  productoA = await crearProducto({
    codigo: codigoUnico('QA-POS-A'),
    nombre: 'Producto POS QA A',
    precio_unitario: 1000.25,
    impuesto_porcentaje: 19,
  })
  productoB = await crearProducto({
    codigo: codigoUnico('QA-POS-B'),
    nombre: 'Producto POS QA B',
    precio_unitario: 500,
    impuesto_porcentaje: 0,
  })
  productoInactivo = await crearProducto({
    codigo: codigoUnico('QA-POS-INACT'),
    nombre: 'Producto POS QA Inactivo',
    precio_unitario: 100,
    impuesto_porcentaje: 0,
  })
  await peticion(base, `/productos/${productoInactivo}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { activo: false },
  })

  // Precios de centavo para el caso de redondeo (fracciones de centavo).
  productoRound1 = await crearProducto({
    codigo: codigoUnico('QA-POS-R1'),
    nombre: 'Producto POS QA Redondeo 1',
    precio_unitario: 0.1,
    impuesto_porcentaje: 0,
  })
  productoRound2 = await crearProducto({
    codigo: codigoUnico('QA-POS-R2'),
    nombre: 'Producto POS QA Redondeo 2',
    precio_unitario: 0.1,
    impuesto_porcentaje: 0,
  })
  // Precio 0 para forzar el fallo de desbordamiento de stock (rollback).
  productoRollback = await crearProducto({
    codigo: codigoUnico('QA-POS-RB'),
    nombre: 'Producto POS QA Rollback',
    precio_unitario: 0,
    impuesto_porcentaje: 0,
  })
  // Precio 0 para el limite de cantidad por linea (R-001): el importe no
  // desborda; se aisla el limite comercial de cantidad.
  productoLimite = await crearProducto({
    codigo: codigoUnico('QA-POS-LIM'),
    nombre: 'Producto POS QA Limite cantidad',
    precio_unitario: 0,
    impuesto_porcentaje: 0,
  })
})

after(async () => {
  // Limpieza de saldos de stock creados por fixtures QA: se restauran a 0.
  // Son filas de productos/sucursales creadas por esta suite; nunca se borran.
  for (const [productoId, sucursalId] of [
    [productoLimite, sucursalVentas],
    [productoRollback, sucursalRollback],
  ]) {
    if (!productoId || !sucursalId) continue
    try {
      await pool.query(
        'UPDATE stock SET cantidad = 0 WHERE producto_id = $1 AND sucursal_id = $2',
        [productoId, sucursalId],
      )
    } catch {
      /* mejor esfuerzo */
    }
  }

  // Borrado logico de lo creado: queda activo=false. Nunca se borra.
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

test('POST /facturas sin token responde 401 con sobre de error', async () => {
  const r = await vender({ sucursal_id: sucursalVentas, lineas: [] }, { token: '' })
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('POST /facturas con token malformado responde 401', async () => {
  const r = await vender(
    { sucursal_id: sucursalVentas, lineas: [] },
    { token: 'esto-no-es-un-jwt' },
  )
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('token firmado con otro secreto responde 401', async () => {
  const falso = jwt.sign(
    { id: 1, empresa_id: 1, rol: 'administrador' },
    'secreto-ajeno',
  )
  const r = await vender(
    { sucursal_id: sucursalVentas, lineas: [] },
    { token: falso },
  )
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('superadmin responde 403', async () => {
  const r = await vender(
    {
      sucursal_id: sucursalVentas,
      lineas: [{ producto_id: productoA, cantidad: 1, descuento_porcentaje: 0 }],
    },
    { token: tokenSuper },
  )
  assert.equal(r.status, 403)
  assertSobreError(r.cuerpo)
})

test('rol distinto de administrador responde 403', async () => {
  const cajero = firmarToken({ id: 1, empresa_id: 1, rol: 'cajero' })
  const r = await vender(
    {
      sucursal_id: sucursalVentas,
      lineas: [{ producto_id: productoA, cantidad: 1, descuento_porcentaje: 0 }],
    },
    { token: cajero },
  )
  assert.equal(r.status, 403)
  assertSobreError(r.cuerpo)
})

test('administrador sin empresa (empresa_id null) responde 403', async () => {
  const sinEmpresa = firmarToken({ id: 1, empresa_id: null, nombre: 'Sin empresa' })
  const r = await vender(
    {
      sucursal_id: sucursalVentas,
      lineas: [{ producto_id: productoA, cantidad: 1, descuento_porcentaje: 0 }],
    },
    { token: sinEmpresa },
  )
  assert.equal(r.status, 403)
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// Caso feliz: contrato, totales, snapshot, numeracion, stock y movimientos
// ---------------------------------------------------------------------------

let numeroPrimeraVenta = null
let idPrimeraVenta = null

test('POST caso feliz: 201, sobre exacto, totales y snapshot', async () => {
  const r = await vender({
    sucursal_id: sucursalVentas,
    metodo_pago_id: null,
    cliente_id: null,
    cliente_nombre: null,
    cliente_documento: null,
    descuento: 0,
    lineas: [
      { producto_id: productoA, cantidad: 2, descuento_porcentaje: 0 },
      { producto_id: productoB, cantidad: 1, descuento_porcentaje: 10 },
    ],
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['factura'])

  const factura = r.cuerpo.data.factura
  assertFactura(factura)
  assert.equal(factura.sucursal_id, sucursalVentas)
  assert.equal(factura.usuario_id, 1, 'usuario_id debe venir del token')
  assert.equal(factura.cliente_id, null)
  assert.equal(factura.cliente_nombre, null)
  assert.equal(factura.cliente_documento, null)
  assert.equal(factura.metodo_pago_id, null)
  assert.equal(factura.detalles.length, 2)

  // Linea A: 2 * 1000.25 = 2000.50 ; impuesto 19% = 380.10 ; total 2380.60
  const detalleA = factura.detalles.find((d) => d.producto_id === productoA)
  assert.equal(detalleA.cantidad, 2)
  assert.equal(detalleA.precio_unitario, 1000.25)
  assert.equal(detalleA.impuesto_porcentaje, 19)
  assert.equal(detalleA.subtotal, 2000.5)
  assert.equal(detalleA.impuesto, 380.1)
  assert.equal(detalleA.total, 2380.6)

  // Linea B: 1 * 500 * (1 - 0.10) = 450 ; impuesto 0 ; total 450
  const detalleB = factura.detalles.find((d) => d.producto_id === productoB)
  assert.equal(detalleB.cantidad, 1)
  assert.equal(detalleB.descuento_porcentaje, 10)
  assert.equal(detalleB.subtotal, 450)
  assert.equal(detalleB.impuesto, 0)
  assert.equal(detalleB.total, 450)

  // Cabecera = suma de lineas; descuento global 0.
  assert.equal(factura.subtotal, 2450.5)
  assert.equal(factura.impuesto, 380.1)
  assert.equal(factura.descuento, 0)
  assert.equal(factura.total, 2830.6)

  numeroPrimeraVenta = factura.numero_factura
  idPrimeraVenta = factura.id
})

test('la BD persiste cabecera, detalle (snapshot) y movimiento salida_venta', async () => {
  const [cabecera] = await consultar(
    'SELECT id, numero_factura, usuario_id, sucursal_id FROM factura WHERE id = $1',
    [idPrimeraVenta],
  )
  assert.ok(cabecera, 'la factura debe existir en la BD')
  assert.equal(Number(cabecera.numero_factura), numeroPrimeraVenta)
  assert.equal(Number(cabecera.sucursal_id), sucursalVentas)

  const detalles = await consultar(
    'SELECT producto_id, cantidad, precio_unitario, subtotal, impuesto, total FROM detalle_factura WHERE factura_id = $1 ORDER BY producto_id',
    [idPrimeraVenta],
  )
  assert.equal(detalles.length, 2)

  const movimientos = await consultar(
    'SELECT producto_id, tipo, cantidad FROM movimiento_inventario WHERE factura_id = $1 ORDER BY producto_id',
    [idPrimeraVenta],
  )
  assert.equal(movimientos.length, 2, 'cada linea genera un movimiento')
  for (const movimiento of movimientos) {
    assert.equal(movimiento.tipo, 'salida_venta')
    assert.ok(
      Number(movimiento.cantidad) < 0,
      'la cantidad de la salida debe ser negativa',
    )
  }
})

test('la numeracion es consecutiva y unica por sucursal', async () => {
  const segunda = await vender({
    sucursal_id: sucursalVentas,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(segunda.status, 201, JSON.stringify(segunda.cuerpo))
  const numero2 = segunda.cuerpo.data.factura.numero_factura
  assert.equal(
    numero2,
    numeroPrimeraVenta + 1,
    'el numero debe ser el siguiente de la sucursal',
  )

  const filas = await consultar(
    'SELECT numero_factura FROM factura WHERE sucursal_id = $1 ORDER BY numero_factura',
    [sucursalVentas],
  )
  const numeros = filas.map((f) => Number(f.numero_factura))
  assert.deepEqual(
    numeros,
    [...new Set(numeros)],
    'no debe haber numeros repetidos en la sucursal',
  )
  assert.deepEqual(numeros, [numeroPrimeraVenta, numero2])
})

test('numeracion concurrente en la misma sucursal: numeros distintos y consecutivos', async () => {
  const sucursalConcurrente = await crearSucursal(nombreUnico('QA-POS-CONC'))
  const peticiones = [0, 1, 2].map(() =>
    vender({
      sucursal_id: sucursalConcurrente,
      lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
    }),
  )
  const respuestas = await Promise.all(peticiones)
  for (const r of respuestas) {
    assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  }
  const numeros = respuestas.map((r) => r.cuerpo.data.factura.numero_factura).sort((a, b) => a - b)
  assert.deepEqual(numeros, [1, 2, 3], 'debe asignar 1,2,3 sin repetir ni saltar')
})

test('snapshot: cambiar el precio del producto no altera la factura emitida', async () => {
  const patch = await peticion(base, `/productos/${productoA}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { precio_unitario: 9999 },
  })
  assert.equal(patch.status, 200, JSON.stringify(patch.cuerpo))

  const detalles = await consultar(
    'SELECT precio_unitario FROM detalle_factura WHERE factura_id = $1 AND producto_id = $2',
    [idPrimeraVenta, productoA],
  )
  assert.equal(
    Number(detalles[0].precio_unitario),
    1000.25,
    'el precio congelado no debe cambiar',
  )
})

// ---------------------------------------------------------------------------
// Descuento global: limite inferior y superior
// ---------------------------------------------------------------------------

test('descuento global igual al total (subtotal+impuesto) deja total 0 y responde 201', async () => {
  // productoB: 500 al 0% de impuesto -> subtotal 500, impuesto 0, total 500.
  const r = await vender({
    sucursal_id: sucursalVentas,
    descuento: 500,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  const factura = r.cuerpo.data.factura
  assert.equal(factura.subtotal, 500)
  assert.equal(factura.impuesto, 0)
  assert.equal(factura.descuento, 500)
  assert.equal(factura.total, 0, 'total debe quedar exactamente en 0')
})

test('descuento global mayor que subtotal+impuesto responde 400', async () => {
  const r = await vender({
    sucursal_id: sucursalVentas,
    descuento: 500.01,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 400, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('descuento global absurdo responde 400 (no 500)', async () => {
  const r = await vender({
    sucursal_id: sucursalVentas,
    descuento: 99999999,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 400, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('descuento global negativo responde 400', async () => {
  const r = await vender({
    sucursal_id: sucursalVentas,
    descuento: -1,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 400)
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// Cliente (snapshot) y metodo de pago
// ---------------------------------------------------------------------------

test('cliente con snapshot: guarda nombre/documento y cliente_id null', async () => {
  const r = await vender({
    sucursal_id: sucursalVentas,
    cliente_nombre: 'Cliente QA Prueba',
    cliente_documento: '900123456',
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  const factura = r.cuerpo.data.factura
  assert.equal(factura.cliente_id, null)
  assert.equal(factura.cliente_nombre, 'Cliente QA Prueba')
  assert.equal(factura.cliente_documento, '900123456')
})

test('cliente_id inexistente/ajeno responde 400', async () => {
  const r = await vender({
    sucursal_id: sucursalVentas,
    cliente_id: 99999999,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 400, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('cliente_nombre mayor a 150 responde 400', async () => {
  const r = await vender({
    sucursal_id: sucursalVentas,
    cliente_nombre: 'A'.repeat(151),
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 400)
  assertSobreError(r.cuerpo)
})

test('metodo_pago_id valido de la empresa responde 201', async () => {
  const r = await vender({
    sucursal_id: sucursalVentas,
    metodo_pago_id: 1,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assert.equal(r.cuerpo.data.factura.metodo_pago_id, 1)
})

test('metodo_pago_id ajeno/inexistente responde 400', async () => {
  const r = await vender({
    sucursal_id: sucursalVentas,
    metodo_pago_id: 99999999,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 400, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// Validaciones (400) y sucursal inexistente (404)
// ---------------------------------------------------------------------------

test('POST /facturas validaciones 400', async (t) => {
  const linea = (extra = {}) => ({
    producto_id: productoB,
    cantidad: 1,
    descuento_porcentaje: 0,
    ...extra,
  })
  const casos = [
    ['lineas ausente', { sucursal_id: sucursalVentas }],
    ['lineas vacio', { sucursal_id: sucursalVentas, lineas: [] }],
    ['lineas no arreglo', { sucursal_id: sucursalVentas, lineas: 'x' }],
    ['cantidad 0', { sucursal_id: sucursalVentas, lineas: [linea({ cantidad: 0 })] }],
    ['cantidad negativa', { sucursal_id: sucursalVentas, lineas: [linea({ cantidad: -2 })] }],
    ['cantidad decimal', { sucursal_id: sucursalVentas, lineas: [linea({ cantidad: 1.5 })] }],
    ['cantidad no numerica', { sucursal_id: sucursalVentas, lineas: [linea({ cantidad: 'abc' })] }],
    ['descuento_porcentaje -1', { sucursal_id: sucursalVentas, lineas: [linea({ descuento_porcentaje: -1 })] }],
    ['descuento_porcentaje 101', { sucursal_id: sucursalVentas, lineas: [linea({ descuento_porcentaje: 101 })] }],
    ['descuento_porcentaje no numerico', { sucursal_id: sucursalVentas, lineas: [linea({ descuento_porcentaje: 'x' })] }],
    ['producto repetido', { sucursal_id: sucursalVentas, lineas: [linea(), linea()] }],
    ['producto inexistente', { sucursal_id: sucursalVentas, lineas: [linea({ producto_id: 99999999 })] }],
    ['producto inactivo', { sucursal_id: sucursalVentas, lineas: [linea({ producto_id: productoInactivo })] }],
    ['producto_id fuera de rango', { sucursal_id: sucursalVentas, lineas: [linea({ producto_id: 9223372036854775808 })] }],
    ['sin sucursal_id', { lineas: [linea()] }],
    ['sucursal_id 0', { sucursal_id: 0, lineas: [linea()] }],
    ['sucursal_id fuera de rango', { sucursal_id: 9223372036854775808, lineas: [linea()] }],
    ['descuento no numerico', { sucursal_id: sucursalVentas, descuento: 'x', lineas: [linea()] }],
    ['cliente_documento mayor a 30', { sucursal_id: sucursalVentas, cliente_documento: 'D'.repeat(31), lineas: [linea()] }],
    ['cuerpo arreglo', [linea()]],
    ['cuerpo null', null],
  ]

  for (const [descripcion, cuerpo] of casos) {
    await t.test(descripcion, async () => {
      const r = await vender(cuerpo)
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

test('sucursal_id inexistente responde 404', async () => {
  const r = await vender({
    sucursal_id: 99999999,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 404, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// Multi-tenant / IDOR
// ---------------------------------------------------------------------------

test('IDOR: empresa_id falso en el body se ignora', async () => {
  const r = await vender({
    sucursal_id: sucursalVentas,
    empresa_id: 999,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assert.equal(r.cuerpo.data.factura.sucursal_id, sucursalVentas)

  // La sucursal pertenece a la empresa 1; la factura quedo ligada a ella.
  const [fila] = await consultar(
    'SELECT s.empresa_id FROM factura f JOIN sucursal s ON s.id = f.sucursal_id WHERE f.id = $1',
    [r.cuerpo.data.factura.id],
  )
  assert.equal(Number(fila.empresa_id), 1)
})

test('IDOR: empresa_id falso en el query se ignora', async () => {
  const r = await peticion(base, '/facturas?empresa_id=999', {
    metodo: 'POST',
    token,
    cuerpo: {
      sucursal_id: sucursalVentas,
      lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
    },
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assert.equal(r.cuerpo.data.factura.sucursal_id, sucursalVentas)
})

test('IDOR: token de otra empresa no puede facturar con sucursal ajena (404)', async () => {
  const r = await vender(
    {
      sucursal_id: sucursalVentas,
      lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
    },
    { token: tokenAjeno },
  )
  assert.equal(r.status, 404, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('IDOR: token de otra empresa no puede vender un producto ajeno (400)', async () => {
  const r = await vender(
    {
      sucursal_id: sucursalVentas,
      lineas: [{ producto_id: productoA, cantidad: 1, descuento_porcentaje: 0 }],
    },
    { token: tokenAjeno },
  )
  // La sucursal ajena se valida primero (404); para aislar el producto se usa
  // la firma con empresa_id=999 pero se verifica que NUNCA responda 201.
  assert.ok(
    r.status === 400 || r.status === 404,
    `esperaba 400/404, obtuve ${r.status} ${JSON.stringify(r.cuerpo)}`,
  )
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// Redondeo: backend redondea por linea; el hook del frontend suma crudo
// ---------------------------------------------------------------------------

/*
 * Reimplementacion FAITHFUL de la logica CORREGIDA del frontend (no ejecutable
 * aqui por depender de React/import.meta). Fuente:
 *   client/src/hooks/usePuntoDeVenta.js
 *     - `redondear2` (lineas 6-11)
 *     - `calcularLinea` (lineas 40-49): redondea subtotal, luego el impuesto
 *       sobre el subtotal YA redondeado, y el total.
 *     - `totales` (lineas 218-244): suma los importes YA redondeados de cada
 *       linea (misma base que la cabecera del backend).
 * El backend (server/servicios/facturas.js, `calcularLinea`/`calcularTotales`)
 * usa exactamente la misma base: redondeo por linea y luego suma.
 */
const redondear2Frontend = (valor) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 0
  return Math.round((numero + Number.EPSILON) * 100) / 100
}
const limitarFrontend = (valor, minimo, maximo) =>
  Math.min(Math.max(valor, minimo), maximo)
const aDecimalFrontend = (valor) => {
  const numero = Number.parseFloat(valor)
  return Number.isFinite(numero) ? numero : 0
}
const calcularLineaFrontend = (linea) => {
  const descuento = limitarFrontend(aDecimalFrontend(linea.descuento_porcentaje), 0, 100)
  const subtotal = redondear2Frontend(
    linea.cantidad * linea.precio_unitario * (1 - descuento / 100),
  )
  const impuesto = redondear2Frontend(
    (subtotal *
      limitarFrontend(aDecimalFrontend(linea.impuesto_porcentaje), 0, 100)) /
      100,
  )
  return { subtotal, impuesto, total: redondear2Frontend(subtotal + impuesto) }
}
const totalesFrontend = (lineas, descuentoGlobal) => {
  const subtotal = redondear2Frontend(
    lineas.reduce((suma, linea) => suma + calcularLineaFrontend(linea).subtotal, 0),
  )
  const impuesto = redondear2Frontend(
    lineas.reduce((suma, linea) => suma + calcularLineaFrontend(linea).impuesto, 0),
  )
  const descuento = redondear2Frontend(Math.max(0, aDecimalFrontend(descuentoGlobal)))
  return {
    subtotal,
    impuesto,
    descuento,
    total: redondear2Frontend(subtotal - descuento + impuesto),
  }
}

test('redondeo con fracciones de centavo: el total del frontend debe coincidir con el backend', async () => {
  // Dos lineas de 0.10 con 95% de descuento: 0.10 * 0.05 = 0.005 cada una.
  // Con la formula CORREGIDA, cada linea se redondea a 0.01 ANTES de sumar, por
  // lo que la cabecera es 0.02 (no 0.01 como daria la suma cruda + redondeo final).
  const lineas = [
    { producto_id: productoRound1, cantidad: 1, descuento_porcentaje: 95, precio_unitario: 0.1, impuesto_porcentaje: 0 },
    { producto_id: productoRound2, cantidad: 1, descuento_porcentaje: 95, precio_unitario: 0.1, impuesto_porcentaje: 0 },
  ]

  const r = await vender({
    sucursal_id: sucursalVentas,
    descuento: 0,
    lineas: lineas.map(({ producto_id, cantidad, descuento_porcentaje }) => ({
      producto_id,
      cantidad,
      descuento_porcentaje,
    })),
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  const factura = r.cuerpo.data.factura
  assertFactura(factura)

  const frontend = totalesFrontend(lineas, 0)

  console.log(
    '[redondeo] backend:',
    JSON.stringify({
      subtotal: factura.subtotal,
      impuesto: factura.impuesto,
      total: factura.total,
    }),
    '| frontend:',
    JSON.stringify({
      subtotal: frontend.subtotal,
      impuesto: frontend.impuesto,
      total: frontend.total,
    }),
  )

  // Backend: redondeo por linea (0.005 -> 0.01) y luego suma => 0.02.
  assert.equal(factura.detalles.length, 2)
  for (const detalle of factura.detalles) {
    assert.equal(
      detalle.subtotal,
      0.01,
      'cada linea debe redondearse a 0.01 en el backend',
    )
  }
  assert.equal(factura.subtotal, 0.02, 'subtotal backend = 0.01 + 0.01')
  assert.equal(factura.impuesto, 0)
  assert.equal(factura.total, 0.02, 'total backend con la formula corregida')

  assert.equal(
    redondear2Frontend(factura.subtotal - factura.descuento + factura.impuesto),
    factura.total,
    'la cabecera del backend debe ser coherente',
  )

  assert.equal(
    frontend.subtotal,
    factura.subtotal,
    `el subtotal del frontend (${frontend.subtotal}) debe coincidir con el del backend (${factura.subtotal})`,
  )
  assert.equal(
    frontend.total,
    factura.total,
    `el total del frontend (${frontend.total}) debe coincidir con el del backend (${factura.total})`,
  )
  assert.equal(
    frontend.total,
    0.02,
    'el frontend corregido suma importes ya redondeados por linea',
  )
})

// ---------------------------------------------------------------------------
// R-001: limite comercial de cantidad por linea (defensa ante 500 por 22003)
// ---------------------------------------------------------------------------

test('R-001: la cantidad por linea respeta el limite (400, nunca 500)', async (t) => {
  await t.test('cantidad 2147483647 (maximo de integer) -> 400', async () => {
    const r = await vender({
      sucursal_id: sucursalVentas,
      lineas: [
        { producto_id: productoLimite, cantidad: 2147483647, descuento_porcentaje: 0 },
      ],
    })
    assert.notEqual(r.status, 500, `nunca 500: ${JSON.stringify(r.cuerpo)}`)
    assert.equal(r.status, 400, JSON.stringify(r.cuerpo))
    assertSobreError(r.cuerpo)
  })

  await t.test('cantidad 1000001 (por encima del limite) -> 400', async () => {
    const r = await vender({
      sucursal_id: sucursalVentas,
      lineas: [
        { producto_id: productoLimite, cantidad: 1000001, descuento_porcentaje: 0 },
      ],
    })
    assert.notEqual(r.status, 500, `nunca 500: ${JSON.stringify(r.cuerpo)}`)
    assert.equal(r.status, 400, JSON.stringify(r.cuerpo))
    assertSobreError(r.cuerpo)
  })

  await t.test('cantidad 1000000 (limite exacto) -> 201', async () => {
    const r = await vender({
      sucursal_id: sucursalVentas,
      lineas: [
        { producto_id: productoLimite, cantidad: 1000000, descuento_porcentaje: 0 },
      ],
    })
    assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
    assertSobreExito(r.cuerpo)
    assert.equal(r.cuerpo.data.factura.detalles[0].cantidad, 1000000)
  })
})

// ---------------------------------------------------------------------------
// Rollback: fallo a mitad de la transaccion no debe dejar rastro
// ---------------------------------------------------------------------------

/*
 * Tras el limite CANTIDAD_MAX (R-001) ya no se puede forzar el 22003 desde el
 * cuerpo. Para seguir probando el ROLLBACK REAL (criterio 4) se prepara un
 * fixture en la BD: el saldo de `stock` del producto QA se lleva al borde
 * inferior del entero, de modo que la SIGUIENTE salida desborde el trigger
 * `aplicar_movimiento_inventario` DESPUES de insertar cabecera y detalle. Es
 * una fila de un producto/sucursal creados por esta suite y se restaura a 0 en
 * `after`. No se altera ningun dato preexistente.
 */
test('ROLLBACK: un fallo a mitad no deja factura, movimiento ni stock alterado', async () => {
  const AL_BORDE = -2147483647 // limite inferior de `integer`

  await pool.query(
    `INSERT INTO stock (producto_id, sucursal_id, cantidad)
     VALUES ($1, $2, $3)
     ON CONFLICT (producto_id, sucursal_id)
     DO UPDATE SET cantidad = EXCLUDED.cantidad`,
    [productoRollback, sucursalRollback, AL_BORDE],
  )

  const stockAntes = await consultar(
    'SELECT cantidad FROM stock WHERE producto_id = $1 AND sucursal_id = $2',
    [productoRollback, sucursalRollback],
  )
  assert.equal(Number(stockAntes[0].cantidad), AL_BORDE)

  const facturasAntes = await consultar(
    'SELECT count(*)::int AS total FROM factura WHERE sucursal_id = $1',
    [sucursalRollback],
  )
  const movimientosAntes = await consultar(
    'SELECT count(*)::int AS total FROM movimiento_inventario WHERE producto_id = $1 AND sucursal_id = $2',
    [productoRollback, sucursalRollback],
  )

  // 2) La venta inserta factura y detalle, pero al descontar stock el trigger
  //    desborda el integer (-2147483647 + (-2) = -2147483649 => 22003) y la
  //    transaccion debe revertirse por completo (no debe quedar nada).
  const fallo = await vender({
    sucursal_id: sucursalRollback,
    lineas: [{ producto_id: productoRollback, cantidad: 2, descuento_porcentaje: 0 }],
  })
  console.log(
    '[rollback] fallo a mitad -> status:',
    fallo.status,
    'body:',
    JSON.stringify(fallo.cuerpo),
  )
  assert.notEqual(fallo.status, 201, 'no debe emitirse la factura')
  assert.equal(
    fallo.status,
    400,
    `22003 debe mapearse a 400 (no 500), obtuve ${fallo.status}`,
  )
  assertSobreError(fallo.cuerpo)

  // 3) Sin rastro: mismos conteos y mismo stock.
  const stockDespues = await consultar(
    'SELECT cantidad FROM stock WHERE producto_id = $1 AND sucursal_id = $2',
    [productoRollback, sucursalRollback],
  )
  const facturasDespues = await consultar(
    'SELECT count(*)::int AS total FROM factura WHERE sucursal_id = $1',
    [sucursalRollback],
  )
  const movimientosDespues = await consultar(
    'SELECT count(*)::int AS total FROM movimiento_inventario WHERE producto_id = $1 AND sucursal_id = $2',
    [productoRollback, sucursalRollback],
  )

  assert.equal(
    facturasDespues[0].total,
    facturasAntes[0].total,
    'no debe quedar ninguna factura tras el rollback',
  )
  assert.equal(
    movimientosDespues[0].total,
    movimientosAntes[0].total,
    'no debe quedar ningun movimiento tras el rollback',
  )
  assert.equal(
    Number(stockDespues[0].cantidad),
    Number(stockAntes[0].cantidad),
    'el stock no debe cambiar tras el rollback',
  )

  await pool.query(
    'UPDATE stock SET cantidad = 0 WHERE producto_id = $1 AND sucursal_id = $2',
    [productoRollback, sucursalRollback],
  )
})
