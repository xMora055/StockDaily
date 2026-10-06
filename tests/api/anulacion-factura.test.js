/*
 * SD-007 - Verificacion independiente de la anulacion de factura:
 *   PATCH /api/v1/facturas/:id/anular
 * Runner nativo de Node 24 + fetch. La app se levanta en un puerto efimero.
 *
 * Datos: se crean sucursales y productos `QA-*` claramente identificables y se
 * dejan INACTIVOS al terminar (borrado logico). Los saldos de `stock` de esos
 * fixtures se restauran a 0. Nunca se hace DELETE/TRUNCATE/DROP. Las facturas
 * y movimientos quedan como evidencia historica (el dominio no los borra).
 *
 * Multi-tenant: la empresa 1 es la real y la empresa 3 existe como "QA Empresa
 * Ajena" (usuario 9 / sucursal 714). Se firman tokens efimeros con el mismo
 * payload del login; el secreto lo resuelve `server/config/entorno` y nunca se
 * imprime. Los ids 7 (admin empresa 1), 8 (superadmin) y 9 (admin empresa 3)
 * corresponden a usuarios reales ya sembrados.
 *
 * Lecturas directas a la BD (solo SELECT) para cotejar stock y movimientos;
 * el unico UPDATE directo es sobre `stock` de productos/sucursales creados por
 * esta suite (rollback y limpieza), nunca sobre datos preexistentes.
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
let tokenAnulador
let tokenSuper
let tokenAjeno

// Tokens adicionales (usuarios reales y sondas).
let tokenCajero
let tokenEmpresa3
let tokenEmpresa999

// Recursos QA creados por la suite (se desactivan al final, no se borran).
const sucursalesCreadas = []
const productosCreados = []

let sucursalAnular
let sucursalRollback
let sucursalConcurrente
let productoA
let productoB
let productoRollback

const CLAVES_FACTURA_ANULADA = [
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
  'anulada_en',
  'anulada_por',
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

const CLAVES_FACTURA_EMITIDA = CLAVES_FACTURA_ANULADA.filter(
  (clave) => clave !== 'anulada_en' && clave !== 'anulada_por',
)

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

// Valida la forma EXACTA del contrato de factura anulada y el casteo a Number.
function assertFacturaAnulada(factura) {
  assert.deepEqual(
    Object.keys(factura).sort(),
    CLAVES_FACTURA_ANULADA,
    `forma exacta de Factura anulada, se obtuvo ${JSON.stringify(Object.keys(factura).sort())}`,
  )
  for (const campo of ['id', 'numero_factura', 'sucursal_id', 'usuario_id']) {
    assert.equal(typeof factura[campo], 'number', `${campo} debe ser Number`)
  }
  assert.equal(typeof factura.anulada_en, 'string', 'anulada_en debe ser string ISO')
  assert.equal(typeof factura.anulada_por, 'number', 'anulada_por debe ser Number')
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
}

async function consultar(sql, parametros = []) {
  const { rows } = await pool.query(sql, parametros)
  return rows
}

async function stockDe(productoId, sucursalId) {
  const filas = await consultar(
    'SELECT cantidad FROM stock WHERE producto_id = $1 AND sucursal_id = $2',
    [productoId, sucursalId],
  )
  return filas.length > 0 ? Number(filas[0].cantidad) : 0
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

// Emite una venta y exige 201; devuelve la factura del sobre.
async function vender(datos, opciones = {}) {
  const r = await peticion(base, '/facturas', {
    metodo: 'POST',
    token: 'token' in opciones ? opciones.token : tokenAnulador,
    cuerpo: datos,
  })
  assert.equal(r.status, 201, `venta no emitida: ${JSON.stringify(r.cuerpo)}`)
  return r.cuerpo.data.factura
}

// Llama al endpoint de anulacion y devuelve `{ status, cuerpo }`.
function anular(id, opciones = {}) {
  return peticion(base, `/facturas/${id}/anular`, {
    metodo: 'PATCH',
    token: 'token' in opciones ? opciones.token : tokenAnulador,
    cuerpo: opciones.cuerpo,
  })
}

before(async () => {
  servidor = await iniciarServidor()
  base = servidor.urlBase
  token = tokenAdmin()
  // Usuario real 7 de la empresa 1: prueba que `anulada_por` sale del token.
  tokenAnulador = firmarToken({
    id: 7,
    empresa_id: 1,
    nombre: 'QA Anulacion Admin',
    correo: 'qa.anulacion@stockdaily.test',
    rol: 'administrador',
  })
  tokenSuper = tokenSuperadmin()
  tokenAjeno = tokenOtraEmpresa()
  tokenCajero = firmarToken({ id: 1, empresa_id: 1, rol: 'cajero' })
  // Usuario real 9 de la empresa 3 (tenant ajeno).
  tokenEmpresa3 = firmarToken({
    id: 9,
    empresa_id: 3,
    nombre: 'QA Ajena Admin',
    correo: 'qa.ajena@stockdaily.test',
    rol: 'administrador',
  })
  tokenEmpresa999 = tokenOtraEmpresa(999)

  sucursalAnular = await crearSucursal(nombreUnico('QA-ANU-VENTAS'))
  sucursalRollback = await crearSucursal(nombreUnico('QA-ANU-ROLLBACK'))
  sucursalConcurrente = await crearSucursal(nombreUnico('QA-ANU-CONC'))

  productoA = await crearProducto({
    codigo: codigoUnico('QA-ANU-A'),
    nombre: 'Producto Anulacion QA A',
    precio_unitario: 1000.25,
    impuesto_porcentaje: 19,
  })
  productoB = await crearProducto({
    codigo: codigoUnico('QA-ANU-B'),
    nombre: 'Producto Anulacion QA B',
    precio_unitario: 500,
    impuesto_porcentaje: 0,
  })
  productoRollback = await crearProducto({
    codigo: codigoUnico('QA-ANU-RB'),
    nombre: 'Producto Anulacion QA Rollback',
    precio_unitario: 0,
    impuesto_porcentaje: 0,
  })
})

after(async () => {
  // Restaurar el stock de los fixtures QA creados por esta suite (nunca borrar).
  for (const [productoId, sucursalId] of [
    [productoA, sucursalAnular],
    [productoB, sucursalAnular],
    [productoA, sucursalConcurrente],
    [productoB, sucursalConcurrente],
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

  // Borrado logico de lo creado.
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

test('PATCH /facturas/:id/anular sin token responde 401', async () => {
  const r = await anular(1, { token: '' })
  assert.equal(r.status, 401, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('PATCH /facturas/:id/anular con token malformado responde 401', async () => {
  const r = await anular(1, { token: 'esto-no-es-un-jwt' })
  assert.equal(r.status, 401, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('PATCH /facturas/:id/anular con token de otro secreto responde 401', async () => {
  const falso = jwt.sign(
    { id: 7, empresa_id: 1, rol: 'administrador' },
    'secreto-ajeno',
  )
  const r = await anular(1, { token: falso })
  assert.equal(r.status, 401, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('PATCH /facturas/:id/anular con superadmin responde 403', async () => {
  const r = await anular(1, { token: tokenSuper })
  assert.equal(r.status, 403, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('PATCH /facturas/:id/anular con rol distinto de administrador responde 403', async () => {
  const r = await anular(1, { token: tokenCajero })
  assert.equal(r.status, 403, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('PATCH /facturas/:id/anular con administrador sin empresa responde 403', async () => {
  const sinEmpresa = firmarToken({ id: 7, empresa_id: null, rol: 'administrador' })
  const r = await anular(1, { token: sinEmpresa })
  assert.equal(r.status, 403, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// Validacion de :id (400, nunca 500)
// ---------------------------------------------------------------------------

test('PATCH /facturas/:id/anular con :id invalido responde 400 (nunca 500)', async (t) => {
  const casos = [
    ['abc', 'abc'],
    ['0', '0'],
    ['negativo', '-1'],
    ['decimal', '1.5'],
    ['fuera de rango bigint', '9223372036854775808'],
    ['entero absurdo', '99999999999999999999999999'],
    ['espacios', ' 1 '],
    ['vacio percent-encoded', '%20'],
  ]

  for (const [descripcion, id] of casos) {
    await t.test(descripcion, async () => {
      const r = await peticion(base, `/facturas/${id}/anular`, {
        metodo: 'PATCH',
        token: tokenAnulador,
      })
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

// ---------------------------------------------------------------------------
// 404: factura inexistente y factura ajena (IDOR)
// ---------------------------------------------------------------------------

test('PATCH factura inexistente responde 404', async () => {
  const r = await anular(999999999)
  assert.equal(r.status, 404, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('IDOR: admin de la empresa 3 no puede anular una factura de la empresa 1 (404)', async () => {
  const factura = await vender({
    sucursal_id: sucursalAnular,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })

  const r = await anular(factura.id, { token: tokenEmpresa3 })
  assert.equal(r.status, 404, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)

  // La factura NO debe haber cambiado.
  const [fila] = await consultar(
    'SELECT estado, anulada_en, anulada_por FROM factura WHERE id = $1',
    [factura.id],
  )
  assert.equal(fila.estado, 'emitida')
  assert.equal(fila.anulada_en, null)
  assert.equal(fila.anulada_por, null)
})

test('IDOR: token de empresa inexistente (999) no puede anular una factura de la empresa 1 (404)', async () => {
  const factura = await vender({
    sucursal_id: sucursalAnular,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  const r = await anular(factura.id, { token: tokenEmpresa999 })
  assert.equal(r.status, 404, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// Caso feliz: contrato, auditoria y stock revertido
// ---------------------------------------------------------------------------

let facturaFeliz = null
// Saldo inmediatamente ANTES de emitir la venta (puede haber ventas previas de
// otras pruebas en la misma sucursal); el saldo tras anular debe igualarlo.
let stockA_previoVenta = null
let stockB_previoVenta = null
let stockA_trasVenta = null
let stockB_trasVenta = null

test('anular caso feliz: 200, sobre exacto, estado/anulada_en/anulada_por y detalles', async () => {
  stockA_previoVenta = await stockDe(productoA, sucursalAnular)
  stockB_previoVenta = await stockDe(productoB, sucursalAnular)

  facturaFeliz = await vender({
    sucursal_id: sucursalAnular,
    cliente_nombre: 'Cliente Anulacion QA',
    lineas: [
      { producto_id: productoA, cantidad: 2, descuento_porcentaje: 0 },
      { producto_id: productoB, cantidad: 3, descuento_porcentaje: 0 },
    ],
  })

  stockA_trasVenta = await stockDe(productoA, sucursalAnular)
  stockB_trasVenta = await stockDe(productoB, sucursalAnular)
  assert.equal(stockA_trasVenta, stockA_previoVenta - 2, 'la salida de venta resta 2')
  assert.equal(stockB_trasVenta, stockB_previoVenta - 3, 'la salida de venta resta 3')

  const movimientosVentaAntes = await consultar(
    `SELECT count(*)::int AS total FROM movimiento_inventario
      WHERE factura_id = $1 AND tipo = 'salida_venta'`,
    [facturaFeliz.id],
  )
  assert.equal(movimientosVentaAntes[0].total, 2)

  const r = await anular(facturaFeliz.id)
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['factura'])

  const factura = r.cuerpo.data.factura
  assertFacturaAnulada(factura)
  assert.equal(factura.id, facturaFeliz.id)
  assert.equal(factura.numero_factura, facturaFeliz.numero_factura)
  assert.equal(factura.sucursal_id, sucursalAnular)
  assert.equal(factura.usuario_id, 7, 'usuario_id sale del token')
  assert.equal(factura.estado, 'anulada')
  assert.ok(factura.anulada_en, 'anulada_en no debe ser nulo')
  assert.ok(
    !Number.isNaN(Date.parse(factura.anulada_en)),
    'anulada_en debe ser una fecha valida',
  )
  assert.equal(factura.anulada_por, 7, 'anulada_por debe ser el usuario del token')
  assert.equal(factura.detalles.length, 2)

  // La cabecera en la BD refleja la auditoria.
  const [cabecera] = await consultar(
    `SELECT estado, anulada_en, anulada_por, usuario_id
       FROM factura WHERE id = $1`,
    [facturaFeliz.id],
  )
  assert.equal(cabecera.estado, 'anulada')
  assert.notEqual(cabecera.anulada_en, null)
  assert.equal(Number(cabecera.anulada_por), 7)
})

test('stock revertido: un movimiento anulacion por linea (+cantidad) y saldo al valor previo', async () => {
  const stockA_despues = await stockDe(productoA, sucursalAnular)
  const stockB_despues = await stockDe(productoB, sucursalAnular)

  console.log(
    '[anulacion] stock A previo/tras venta/tras anular:',
    stockA_previoVenta,
    '/',
    stockA_trasVenta,
    '/',
    stockA_despues,
    '| stock B:',
    stockB_previoVenta,
    '/',
    stockB_trasVenta,
    '/',
    stockB_despues,
  )

  assert.equal(stockA_despues, stockA_previoVenta, 'stock A debe volver al valor previo')
  assert.equal(stockB_despues, stockB_previoVenta, 'stock B debe volver al valor previo')
  assert.equal(stockA_despues, stockA_trasVenta + 2, 'stock A = salida + cantidad vendida')
  assert.equal(stockB_despues, stockB_trasVenta + 3, 'stock B = salida + cantidad vendida')

  const anulaciones = await consultar(
    `SELECT producto_id, sucursal_id, usuario_id, factura_id, tipo, cantidad
       FROM movimiento_inventario
      WHERE factura_id = $1 AND tipo = 'anulacion'
      ORDER BY producto_id`,
    [facturaFeliz.id],
  )
  assert.equal(anulaciones.length, 2, 'debe haber un movimiento anulacion por linea')
  for (const movimiento of anulaciones) {
    assert.equal(movimiento.tipo, 'anulacion')
    assert.equal(Number(movimiento.sucursal_id), sucursalAnular)
    assert.equal(Number(movimiento.usuario_id), 7)
    assert.equal(Number(movimiento.factura_id), facturaFeliz.id)
    assert.ok(Number(movimiento.cantidad) > 0, 'la cantidad de anulacion debe ser positiva')
  }
  const porProducto = new Map(
    anulaciones.map((m) => [Number(m.producto_id), Number(m.cantidad)]),
  )
  assert.equal(porProducto.get(productoA), 2)
  assert.equal(porProducto.get(productoB), 3)
})

// ---------------------------------------------------------------------------
// 409: doble anulacion
// ---------------------------------------------------------------------------

test('409 al reintentar anular la misma factura (sin nuevos movimientos)', async () => {
  const movimientosAntes = await consultar(
    'SELECT count(*)::int AS total FROM movimiento_inventario WHERE factura_id = $1',
    [facturaFeliz.id],
  )

  const r = await anular(facturaFeliz.id)
  assert.equal(r.status, 409, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)

  const movimientosDespues = await consultar(
    'SELECT count(*)::int AS total FROM movimiento_inventario WHERE factura_id = $1',
    [facturaFeliz.id],
  )
  assert.equal(
    movimientosDespues[0].total,
    movimientosAntes[0].total,
    'el 409 no debe insertar movimientos',
  )

  const [fila] = await consultar(
    'SELECT estado, anulada_por FROM factura WHERE id = $1',
    [facturaFeliz.id],
  )
  assert.equal(fila.estado, 'anulada')
  assert.equal(Number(fila.anulada_por), 7, 'anulada_por no debe cambiar')
})

test('doble anulacion concurrente: exactamente un 200 y un 409 (FOR UPDATE)', async () => {
  const factura = await vender({
    sucursal_id: sucursalConcurrente,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })

  const [a, b] = await Promise.all([anular(factura.id), anular(factura.id)])
  const estados = [a.status, b.status].sort((x, y) => x - y)
  console.log('[anulacion] concurrencia ->', JSON.stringify(estados))
  assert.deepEqual(
    estados,
    [200, 409],
    `esperaba exactamente un 200 y un 409, obtuve ${JSON.stringify(estados)} ` +
      `${JSON.stringify([a.cuerpo, b.cuerpo])}`,
  )

  const [fila] = await consultar('SELECT estado FROM factura WHERE id = $1', [factura.id])
  assert.equal(fila.estado, 'anulada')
})

// ---------------------------------------------------------------------------
// Casteo numeric/bigint -> Number
// ---------------------------------------------------------------------------

test('casteo: todos los numericos de la factura anulada son Number', async () => {
  const nueva = await vender({
    sucursal_id: sucursalConcurrente,
    lineas: [{ producto_id: productoA, cantidad: 1, descuento_porcentaje: 10 }],
  })
  const ok = await anular(nueva.id)
  assert.equal(ok.status, 200, JSON.stringify(ok.cuerpo))
  assertFacturaAnulada(ok.cuerpo.data.factura)
  assert.equal(typeof ok.cuerpo.data.factura.anulada_por, 'number')
  assert.equal(typeof ok.cuerpo.data.factura.anulada_en, 'string')
})

// ---------------------------------------------------------------------------
// Transaccion / rollback: fallo a mitad no deja rastro
// ---------------------------------------------------------------------------

test('ROLLBACK: fallo a mitad deja la factura emitida y sin movimientos de anulacion', async () => {
  const AL_BORDE_SUPERIOR = 2147483647 // maximo de `integer`

  const factura = await vender({
    sucursal_id: sucursalRollback,
    lineas: [{ producto_id: productoRollback, cantidad: 2, descuento_porcentaje: 0 }],
  })

  // El saldo se lleva al borde superior para que el movimiento +2 desborde el
  // trigger `aplicar_movimiento_inventario` (22003) DESPUES de actualizar la
  // cabecera. Es un fixture propio de la suite; se restaura en `after`.
  await pool.query(
    `INSERT INTO stock (producto_id, sucursal_id, cantidad)
     VALUES ($1, $2, $3)
     ON CONFLICT (producto_id, sucursal_id)
     DO UPDATE SET cantidad = EXCLUDED.cantidad`,
    [productoRollback, sucursalRollback, AL_BORDE_SUPERIOR],
  )

  const movimientosAntes = await consultar(
    'SELECT count(*)::int AS total FROM movimiento_inventario WHERE factura_id = $1',
    [factura.id],
  )

  const fallo = await anular(factura.id)
  console.log(
    '[anulacion rollback] status:',
    fallo.status,
    'body:',
    JSON.stringify(fallo.cuerpo),
  )
  assert.notEqual(fallo.status, 500, `nunca 500: ${JSON.stringify(fallo.cuerpo)}`)
  assert.equal(fallo.status, 400, `22003 debe mapearse a 400; obtuve ${fallo.status}`)
  assertSobreError(fallo.cuerpo)

  // La cabecera debe seguir emitida y sin auditoria.
  const [cabecera] = await consultar(
    'SELECT estado, anulada_en, anulada_por FROM factura WHERE id = $1',
    [factura.id],
  )
  assert.equal(cabecera.estado, 'emitida')
  assert.equal(cabecera.anulada_en, null)
  assert.equal(cabecera.anulada_por, null)

  // Sin movimientos nuevos: mismo total y ninguno de tipo anulacion.
  const movimientosDespues = await consultar(
    'SELECT count(*)::int AS total FROM movimiento_inventario WHERE factura_id = $1',
    [factura.id],
  )
  assert.equal(movimientosDespues[0].total, movimientosAntes[0].total)
  const anulaciones = await consultar(
    `SELECT count(*)::int AS total FROM movimiento_inventario
      WHERE factura_id = $1 AND tipo = 'anulacion'`,
    [factura.id],
  )
  assert.equal(anulaciones[0].total, 0)

  // El stock no cambio por el intento fallido.
  const stockFinal = await stockDe(productoRollback, sucursalRollback)
  assert.equal(stockFinal, AL_BORDE_SUPERIOR, 'el stock no debe cambiar en el rollback')

  // Restauracion inmediata del fixture.
  await pool.query(
    'UPDATE stock SET cantidad = 0 WHERE producto_id = $1 AND sucursal_id = $2',
    [productoRollback, sucursalRollback],
  )
})

// ---------------------------------------------------------------------------
// IDOR: empresa_id falso en body/query se ignora
// ---------------------------------------------------------------------------

test('IDOR: empresa_id falso en body/query se ignora al anular', async () => {
  const factura = await vender({
    sucursal_id: sucursalAnular,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })

  const r = await peticion(
    base,
    `/facturas/${factura.id}/anular?empresa_id=999&sucursal_id=999`,
    {
      metodo: 'PATCH',
      token: tokenAnulador,
      cuerpo: { empresa_id: 999, sucursal_id: 999 },
    },
  )
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  const devuelta = r.cuerpo.data.factura
  assert.equal(devuelta.sucursal_id, sucursalAnular, 'la sucursal real no debe cambiar')
  assert.equal(devuelta.anulada_por, 7)
})

// ---------------------------------------------------------------------------
// Regresion: POST /facturas sin cambios
// ---------------------------------------------------------------------------

test('REGRESION POST /facturas: 201, sobre exacto y sin campos de anulacion', async () => {
  const r = await peticion(base, '/facturas', {
    metodo: 'POST',
    token: tokenAnulador,
    cuerpo: {
      sucursal_id: sucursalConcurrente,
      lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
    },
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['factura'])
  assert.deepEqual(
    Object.keys(r.cuerpo.data.factura).sort(),
    CLAVES_FACTURA_EMITIDA,
    `POST no debe incluir anulada_en/anulada_por: ${JSON.stringify(
      Object.keys(r.cuerpo.data.factura).sort(),
    )}`,
  )
  assert.equal(r.cuerpo.data.factura.estado, 'emitida')
})
