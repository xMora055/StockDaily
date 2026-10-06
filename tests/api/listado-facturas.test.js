/*
 * SD-009 / listado-facturas-001 (T-005) - Verificacion independiente del
 * listado y la consulta de facturas:
 *   GET /api/v1/facturas
 *   GET /api/v1/facturas/:id
 *
 * Runner nativo de Node + fetch; la app se levanta en un puerto efimero de
 * `tests/utilidades/servidor.js` (nunca el 3000, que puede estar ocupado).
 *
 * Aislamiento: `node --test` corre los archivos en paralelo. Para que los
 * conteos de `total` sean deterministas, TODAS las aserciones de listado se
 * acotan por `sucursal_id` de una sucursal `QA-*` creada por esta suite; asi no
 * interfieren las facturas que emiten otras suites. Los filtros se cotejan
 * contra consultas SELECT de control con el mismo WHERE/ORDER BY del
 * repositorio.
 *
 * Datos: se crean productos y sucursales `QA-*` y se dejan INACTIVOS al
 * terminar (borrado logico); el stock de los fixtures se restaura a 0. Las
 * facturas NO se borran (el dominio no lo permite): quedan como evidencia
 * historica, igual que en las suites SD-006/SD-007. Nunca se hace DELETE.
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
const { assertSobrePagina, recorrerPaginas } = require('../utilidades/paginacion')

const { pool } = requerirServidor('./db/pool')

// Ordenadas para comparar la forma exacta de cada contrato.
const CLAVES_RESUMEN = [
  'id',
  'numero_factura',
  'sucursal_id',
  'sucursal_nombre',
  'cliente_nombre',
  'total',
  'estado',
  'fecha',
  'anulada_en',
].sort()

const CLAVES_DETALLE = [
  'id',
  'producto_id',
  'producto_codigo',
  'producto_nombre',
  'cantidad',
  'precio_unitario',
  'descuento_porcentaje',
  'impuesto_porcentaje',
  'subtotal',
  'impuesto',
  'total',
].sort()

const CLAVES_FACTURA_DETALLE = [
  'id',
  'numero_factura',
  'sucursal_id',
  'sucursal_nombre',
  'usuario_id',
  'cliente_id',
  'cliente_nombre',
  'cliente_documento',
  'metodo_pago_id',
  'estado',
  'fecha',
  'anulada_en',
  'anulada_por',
  'subtotal',
  'descuento',
  'impuesto',
  'total',
  'detalles',
].sort()

// POST /facturas (SD-006): emite sin campos de anulacion.
const CLAVES_FACTURA_EMITIDA = [
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

// PATCH /facturas/:id/anular (SD-007): agrega la auditoria de anulacion.
const CLAVES_FACTURA_ANULADA = [
  ...CLAVES_FACTURA_EMITIDA,
  'anulada_en',
  'anulada_por',
].sort()

let servidor
let base
let token
let tokenSuper
let tokenAjeno
let tokenEmpresa3

let sucursalListado
let sucursalRegresion
let sucursalAjena
let productoA
let productoB

// Recursos QA creados (se desactivan al final; nunca se borran).
const productosCreados = []
const sucursalesCreadas = [] // { id, token } para desactivar con el token correcto

// Facturas emitidas como fixtures (persisten; no se borran).
let facturaUno
let facturaDos
let facturaDetalle
let facturaPorcentaje
let facturaGuionBajo
let facturaAnulada

// Numero total de facturas del fixture en `sucursalListado`.
const N_LISTA = 6
const ESTADOS_VALIDOS = ['emitida', 'anulada']

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

// Codifica un objeto de query de forma segura (buscar puede traer % o _).
function urlListado(parametros = {}) {
  const qs = new URLSearchParams()
  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined) qs.set(clave, String(valor))
  }
  const cadena = qs.toString()
  return `/facturas${cadena ? `?${cadena}` : ''}`
}

function listar(parametros = {}, opciones = {}) {
  return peticion(base, urlListado(parametros), {
    token: 'token' in opciones ? opciones.token : token,
  })
}

function verDetalle(id, opciones = {}) {
  return peticion(base, `/facturas/${id}`, {
    token: 'token' in opciones ? opciones.token : token,
  })
}

async function crearSucursal(nombre, tokenSucursal) {
  const r = await peticion(base, '/sucursales', {
    metodo: 'POST',
    token: tokenSucursal,
    cuerpo: { nombre },
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  const id = r.cuerpo.data.sucursal.id
  sucursalesCreadas.push({ id, token: tokenSucursal })
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

// Emite una venta exigiendo 201 y devuelve la factura del sobre.
async function vender(datos, opciones = {}) {
  const r = await peticion(base, '/facturas', {
    metodo: 'POST',
    token: 'token' in opciones ? opciones.token : token,
    cuerpo: datos,
  })
  assert.equal(r.status, 201, `venta no emitida: ${JSON.stringify(r.cuerpo)}`)
  return r.cuerpo.data.factura
}

function anular(id, opciones = {}) {
  return peticion(base, `/facturas/${id}/anular`, {
    metodo: 'PATCH',
    token: 'token' in opciones ? opciones.token : token,
  })
}

// Replica exacta del WHERE/ORDER BY de `repositorios/facturas.listarFacturas`
// para cotejar `total` y el orden del API contra la BD. Devuelve los ids
// ordenados por `fecha DESC, id DESC`.
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`)
}

async function controlFacturas({ sucursal, estado, desde, hasta, buscar } = {}) {
  const condiciones = ['s.empresa_id = $1']
  const valores = [1]
  if (sucursal !== undefined) {
    valores.push(sucursal)
    condiciones.push(`f.sucursal_id = $${valores.length}`)
  }
  if (estado !== undefined) {
    valores.push(estado)
    condiciones.push(`f.estado = $${valores.length}`)
  }
  if (desde !== undefined) {
    valores.push(desde)
    condiciones.push(`f.fecha >= $${valores.length}::timestamptz`)
  }
  if (hasta !== undefined) {
    valores.push(hasta)
    condiciones.push(`f.fecha <= $${valores.length}::timestamptz`)
  }
  if (buscar !== undefined) {
    valores.push(`%${escaparLike(buscar)}%`)
    const parametro = valores.length
    condiciones.push(
      `(CAST(f.numero_factura AS text) ILIKE $${parametro} ESCAPE '\\' ` +
        `OR f.cliente_nombre ILIKE $${parametro} ESCAPE '\\')`,
    )
  }

  const { rows } = await pool.query(
    `SELECT f.id
       FROM factura f
       JOIN sucursal s ON s.id = f.sucursal_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY f.fecha DESC, f.id DESC`,
    valores,
  )
  return rows.map((fila) => Number(fila.id))
}

async function rangoFechasSucursal(sucursalId) {
  const { rows } = await pool.query(
    `SELECT min(f.fecha) AS minima, max(f.fecha) AS maxima
       FROM factura f
       JOIN sucursal s ON s.id = f.sucursal_id
      WHERE s.empresa_id = $1 AND f.sucursal_id = $2`,
    [1, sucursalId],
  )
  return { minima: rows[0].minima, maxima: rows[0].maxima }
}

before(async () => {
  servidor = await iniciarServidor()
  base = servidor.urlBase
  token = tokenAdmin()
  tokenSuper = tokenSuperadmin()
  tokenAjeno = tokenOtraEmpresa()
  // Usuario real 9 de la empresa 3 (tenant ajeno ya sembrado).
  tokenEmpresa3 = firmarToken({
    id: 9,
    empresa_id: 3,
    nombre: 'QA Listado Empresa Ajena',
    correo: 'qa.listado.empresa3@stockdaily.test',
    rol: 'administrador',
  })

  sucursalListado = await crearSucursal(nombreUnico('QA-LIS-VENTAS'), token)
  sucursalRegresion = await crearSucursal(nombreUnico('QA-LIS-REGRESION'), token)
  // Empresa 3: sirve para probar EC-006 (sucursal_id ajeno = filtro vacio).
  sucursalAjena = await crearSucursal(nombreUnico('QA-LIS-AJENA'), tokenEmpresa3)

  productoA = await crearProducto({
    codigo: codigoUnico('QA-LIS-A'),
    nombre: 'Producto Listado QA A',
    precio_unitario: 1000.25,
    impuesto_porcentaje: 19,
  })
  productoB = await crearProducto({
    codigo: codigoUnico('QA-LIS-B'),
    nombre: 'Producto Listado QA B',
    precio_unitario: 500,
    impuesto_porcentaje: 0,
  })

  // 6 facturas en la sucursal aislada del listado.
  facturaUno = await vender({
    sucursal_id: sucursalListado,
    cliente_nombre: 'QA-FAC Cliente Uno',
    lineas: [{ producto_id: productoA, cantidad: 1, descuento_porcentaje: 0 }],
  })
  facturaDos = await vender({
    sucursal_id: sucursalListado,
    cliente_nombre: 'QA-FAC Cliente Dos',
    lineas: [{ producto_id: productoB, cantidad: 2, descuento_porcentaje: 0 }],
  })
  // Factura multi-linea para el detalle (EC-002).
  facturaDetalle = await vender({
    sucursal_id: sucursalListado,
    lineas: [
      { producto_id: productoA, cantidad: 1, descuento_porcentaje: 0 },
      { producto_id: productoB, cantidad: 1, descuento_porcentaje: 10 },
    ],
  })
  // Nombres con comodines literales para EC-007.
  facturaPorcentaje = await vender({
    sucursal_id: sucursalListado,
    cliente_nombre: 'QA LITERAL 100%',
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  facturaGuionBajo = await vender({
    sucursal_id: sucursalListado,
    cliente_nombre: 'QA_BAJO',
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  facturaAnulada = await vender({
    sucursal_id: sucursalListado,
    cliente_nombre: 'QA-FAC Anulada',
    lineas: [{ producto_id: productoA, cantidad: 1, descuento_porcentaje: 0 }],
  })
  const anulacion = await anular(facturaAnulada.id)
  assert.equal(anulacion.status, 200, JSON.stringify(anulacion.cuerpo))
})

after(async () => {
  // Restaurar el stock de los fixtures a 0 (las filas se conservan).
  for (const [productoId, sucursalId] of [
    [productoA, sucursalListado],
    [productoB, sucursalListado],
    [productoA, sucursalRegresion],
    [productoB, sucursalRegresion],
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

  // Borrado logico de lo creado: activo=false. Nunca se borra.
  if (base) {
    for (const { id, token: tokenSucursal } of sucursalesCreadas) {
      try {
        await peticion(base, `/sucursales/${id}`, {
          metodo: 'PATCH',
          token: tokenSucursal,
          cuerpo: { activo: false },
        })
      } catch {
        /* mejor esfuerzo */
      }
    }
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
  }

  if (servidor) await servidor.cerrar()
})

// ---------------------------------------------------------------------------
// Seguridad: 401 / 403
// ---------------------------------------------------------------------------

test('GET /facturas sin token responde 401', async () => {
  const r = await listar({}, { token: '' })
  assert.equal(r.status, 401, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('GET /facturas con token malformado responde 401', async () => {
  const r = await listar({}, { token: 'esto-no-es-un-jwt' })
  assert.equal(r.status, 401, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('GET /facturas con superadmin responde 403', async () => {
  const r = await listar({}, { token: tokenSuper })
  assert.equal(r.status, 403, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('GET /facturas con administrador sin empresa responde 403', async () => {
  const sinEmpresa = firmarToken({ id: 1, empresa_id: null, rol: 'administrador' })
  const r = await listar({}, { token: sinEmpresa })
  assert.equal(r.status, 403, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('GET /facturas/:id sin token responde 401', async () => {
  const r = await verDetalle(facturaDetalle.id, { token: '' })
  assert.equal(r.status, 401, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('GET /facturas/:id con superadmin responde 403', async () => {
  const r = await verDetalle(facturaDetalle.id, { token: tokenSuper })
  assert.equal(r.status, 403, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// IDOR / multi-tenant
// ---------------------------------------------------------------------------

test('IDOR: empresa_id falso en el query se ignora en el listado', async () => {
  const control = await controlFacturas({ sucursal: sucursalListado })
  const r = await listar({ sucursal_id: sucursalListado, empresa_id: 999 })
  const data = assertSobrePagina(r.cuerpo, { total: control.length })
  assert.deepEqual(
    data.items.map((item) => item.id),
    control,
    'el listado debe seguir siendo el de la empresa del token',
  )
})

test('EC-006: sucursal_id de otra empresa devuelve lista vacia (200)', async () => {
  const r = await listar({ sucursal_id: sucursalAjena })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  const data = assertSobrePagina(r.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(data.items, [])
})

test('EC-005/IDOR: GET /facturas/:id de otra empresa responde 404', async () => {
  for (const [descripcion, tokenAjenoActual] of [
    ['empresa 3', tokenEmpresa3],
    ['empresa 999', tokenAjeno],
  ]) {
    const r = await verDetalle(facturaDetalle.id, { token: tokenAjenoActual })
    assert.equal(r.status, 404, `${descripcion}: ${JSON.stringify(r.cuerpo)}`)
    assertSobreError(r.cuerpo)
  }
})

// ---------------------------------------------------------------------------
// Listado: defaults, sobre, forma y orden
// ---------------------------------------------------------------------------

test('defaults pagina=1/por_pagina=10 y sobre paginado exacto', async () => {
  const r = await listar({ sucursal_id: sucursalListado })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assertSobrePagina(r.cuerpo, {
    pagina: 1,
    por_pagina: 10,
    total: N_LISTA,
    total_paginas: Math.ceil(N_LISTA / 10),
  })
})

test('FacturaResumen: forma exacta, campos de mas ausentes y casteo a Number', async () => {
  const control = await controlFacturas({ sucursal: sucursalListado })
  const r = await listar({ sucursal_id: sucursalListado, por_pagina: 100 })
  const data = assertSobrePagina(r.cuerpo, { total: N_LISTA })

  const estadosVistos = new Set()
  let hayAnuladaEn = false
  let hayAnuladaEnNull = false

  for (const item of data.items) {
    assert.deepEqual(
      Object.keys(item).sort(),
      CLAVES_RESUMEN,
      `FacturaResumen no debe exponer campos de mas: ${JSON.stringify(Object.keys(item).sort())}`,
    )
    // Campos internos del detalle que NO deben aparecer en el resumen.
    for (const prohibido of [
      'usuario_id',
      'cliente_id',
      'cliente_documento',
      'metodo_pago_id',
      'anulada_por',
      'subtotal',
      'descuento',
      'impuesto',
      'detalles',
    ]) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(item, prohibido),
        false,
        `FacturaResumen no debe incluir ${prohibido}`,
      )
    }

    assert.equal(typeof item.id, 'number', 'id debe ser Number')
    assert.equal(typeof item.numero_factura, 'number', 'numero_factura debe ser Number')
    assert.equal(typeof item.sucursal_id, 'number', 'sucursal_id debe ser Number')
    assert.equal(typeof item.total, 'number', 'total debe ser Number')
    assert.equal(typeof item.sucursal_nombre, 'string', 'sucursal_nombre debe ser string')
    assert.equal(typeof item.fecha, 'string', 'fecha debe ser string ISO')
    assert.ok(
      item.cliente_nombre === null || typeof item.cliente_nombre === 'string',
      'cliente_nombre debe ser string o null',
    )
    assert.ok(ESTADOS_VALIDOS.includes(item.estado), `estado invalido: ${item.estado}`)
    assert.ok(
      item.anulada_en === null || typeof item.anulada_en === 'string',
      'anulada_en debe ser string ISO o null',
    )
    if (item.anulada_en === null) hayAnuladaEnNull = true
    else hayAnuladaEn = true
    estadosVistos.add(item.estado)
  }

  assert.deepEqual(
    data.items.map((item) => item.id),
    control,
    'el orden debe ser fecha DESC, id DESC',
  )
  assert.ok(estadosVistos.has('emitida') && estadosVistos.has('anulada'))
  assert.ok(hayAnuladaEn, 'la factura anulada debe traer anulada_en')
  assert.ok(hayAnuladaEnNull, 'las facturas emitidas deben traer anulada_en null')
})

test('paginacion: recorrido por paginas sin repetir ni omitir filas', async () => {
  const control = await controlFacturas({ sucursal: sucursalListado })
  const { items, total, totalPaginas } = await recorrerPaginas({
    peticion,
    base,
    token,
    ruta: '/facturas',
    query: `sucursal_id=${sucursalListado}`,
    porPagina: 2,
  })
  assert.equal(total, N_LISTA)
  assert.equal(totalPaginas, Math.ceil(N_LISTA / 2))
  assert.equal(items.length, N_LISTA)
  assert.equal(new Set(items.map((item) => item.id)).size, N_LISTA, 'sin repetidos')
  assert.deepEqual(items.map((item) => item.id), control, 'orden estable entre paginas')
})

test('total = COUNT de las filas aunque la pagina traiga menos items', async () => {
  const r = await listar({ sucursal_id: sucursalListado, por_pagina: 1 })
  const data = assertSobrePagina(r.cuerpo, {
    pagina: 1,
    por_pagina: 1,
    total: N_LISTA,
    total_paginas: N_LISTA,
  })
  assert.equal(data.items.length, 1)
})

test('pagina fuera de rango devuelve items vacio pero total real (200)', async () => {
  const r = await listar({ sucursal_id: sucursalListado, pagina: 999 })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  const data = assertSobrePagina(r.cuerpo, {
    pagina: 999,
    por_pagina: 10,
    total: N_LISTA,
    total_paginas: Math.ceil(N_LISTA / 10),
  })
  assert.deepEqual(data.items, [])
})

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

test('filtro estado=emitida y estado=anulada con totales de COUNT', async () => {
  const emitidas = await listar({ sucursal_id: sucursalListado, estado: 'emitida', por_pagina: 100 })
  const dataEmitidas = assertSobrePagina(emitidas.cuerpo, { total: 5 })
  assert.ok(dataEmitidas.items.every((item) => item.estado === 'emitida'))

  const anuladas = await listar({ sucursal_id: sucursalListado, estado: 'anulada', por_pagina: 100 })
  const dataAnuladas = assertSobrePagina(anuladas.cuerpo, { total: 1 })
  assert.equal(dataAnuladas.items.length, 1)
  assert.equal(dataAnuladas.items[0].id, facturaAnulada.id)
  assert.equal(dataAnuladas.items[0].estado, 'anulada')

  // Cotejo contra la BD con los mismos filtros.
  assert.deepEqual(
    dataEmitidas.items.map((item) => item.id),
    await controlFacturas({ sucursal: sucursalListado, estado: 'emitida' }),
  )
  assert.deepEqual(
    dataAnuladas.items.map((item) => item.id),
    await controlFacturas({ sucursal: sucursalListado, estado: 'anulada' }),
  )
})

test('filtro buscar por numero_factura y por cliente_nombre', async () => {
  const porNumero = await listar({
    sucursal_id: sucursalListado,
    buscar: String(facturaDetalle.numero_factura),
    por_pagina: 100,
  })
  const dataNumero = assertSobrePagina(porNumero.cuerpo)
  const controlNumero = await controlFacturas({
    sucursal: sucursalListado,
    buscar: String(facturaDetalle.numero_factura),
  })
  assert.equal(dataNumero.total, controlNumero.length)
  assert.deepEqual(dataNumero.items.map((item) => item.id), controlNumero)
  assert.ok(
    dataNumero.items.some((item) => item.id === facturaDetalle.id),
    'debe incluir la factura buscada por numero',
  )

  const porCliente = await listar({
    sucursal_id: sucursalListado,
    buscar: 'QA-FAC Cliente Uno',
    por_pagina: 100,
  })
  const dataCliente = assertSobrePagina(porCliente.cuerpo, { total: 1 })
  assert.equal(dataCliente.items[0].id, facturaUno.id)
})

test('filtros combinados (sucursal + estado + buscar) y total de COUNT', async () => {
  const r = await listar({
    sucursal_id: sucursalListado,
    estado: 'emitida',
    buscar: 'QA-FAC',
    por_pagina: 100,
  })
  const control = await controlFacturas({
    sucursal: sucursalListado,
    estado: 'emitida',
    buscar: 'QA-FAC',
  })
  const data = assertSobrePagina(r.cuerpo, { total: control.length })
  assert.deepEqual(data.items.map((item) => item.id), control)
  assert.ok(data.total < N_LISTA, 'los filtros combinados deben acotar el total')
})

test('EC-003: buscar sin coincidencias -> items [], total 0, total_paginas 0', async () => {
  const r = await listar({ buscar: `QA-NO-EXISTE-${codigoUnico('X')}` })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  const data = assertSobrePagina(r.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(data.items, [])
})

test('EC-007: buscar con % y _ se trata como texto literal, no comodin', async () => {
  const todos = await controlFacturas({ sucursal: sucursalListado })

  for (const [comodin, facturaEsperada] of [
    ['%', facturaPorcentaje],
    ['_', facturaGuionBajo],
  ]) {
    const r = await listar({ sucursal_id: sucursalListado, buscar: comodin, por_pagina: 100 })
    const data = assertSobrePagina(r.cuerpo)
    const control = await controlFacturas({ sucursal: sucursalListado, buscar: comodin })

    assert.equal(
      data.total,
      control.length,
      `buscar=${comodin}: el total debe contar solo coincidencias literales`,
    )
    assert.ok(
      data.total < todos.length,
      `buscar=${comodin}: sin escapar, devolveria todas las filas (${data.total} < ${todos.length})`,
    )
    assert.ok(
      data.items.some((item) => item.id === facturaEsperada.id),
      `buscar=${comodin}: debe incluir la factura con el comodin literal`,
    )
  }
})

test('filtro desde/hasta acota el rango de fechas', async () => {
  const { minima, maxima } = await rangoFechasSucursal(sucursalListado)

  // Buffer de 1s: `pg` trunca timestamptz a milisegundos, asi que el borde
  // superior se amplia para no perder la factura mas reciente por los microseg.
  const dentro = await listar({
    sucursal_id: sucursalListado,
    desde: new Date(minima.getTime() - 1000).toISOString(),
    hasta: new Date(maxima.getTime() + 1000).toISOString(),
    por_pagina: 100,
  })
  assertSobrePagina(dentro.cuerpo, { total: N_LISTA })

  const desdeFuturo = await listar({
    sucursal_id: sucursalListado,
    desde: new Date(maxima.getTime() + 3600000).toISOString(),
  })
  assertSobrePagina(desdeFuturo.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(desdeFuturo.cuerpo.data.items, [])

  const hastaPasado = await listar({
    sucursal_id: sucursalListado,
    hasta: new Date(minima.getTime() - 3600000).toISOString(),
  })
  assertSobrePagina(hastaPasado.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(hastaPasado.cuerpo.data.items, [])
})

test('EC-004: desde mayor que hasta -> lista vacia (200, no error)', async () => {
  const { minima, maxima } = await rangoFechasSucursal(sucursalListado)
  const r = await listar({
    sucursal_id: sucursalListado,
    desde: new Date(maxima.getTime() + 3600000).toISOString(),
    hasta: new Date(minima.getTime() - 3600000).toISOString(),
  })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  const data = assertSobrePagina(r.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(data.items, [])
})

// ---------------------------------------------------------------------------
// Validacion de filtros (400, nunca 500)
// ---------------------------------------------------------------------------

test('400 en paginacion, estado, sucursal_id, fechas y buscar invalidos', async (t) => {
  const casos = [
    ['pagina=0', { pagina: 0 }],
    ['pagina=1.5', { pagina: 1.5 }],
    ['pagina=abc', { pagina: 'abc' }],
    ['por_pagina=0', { por_pagina: 0 }],
    ['por_pagina=101', { por_pagina: 101 }],
    ['por_pagina=1.5', { por_pagina: 1.5 }],
    ['por_pagina=abc', { por_pagina: 'abc' }],
    ['estado invalido', { estado: 'pagada' }],
    ['estado mayusculas', { estado: 'EMITIDA' }],
    ['sucursal_id=0', { sucursal_id: 0 }],
    ['sucursal_id=1.5', { sucursal_id: 1.5 }],
    ['sucursal_id=abc', { sucursal_id: 'abc' }],
    ['desde invalido', { desde: 'abc' }],
    ['hasta invalido', { hasta: '2026-99-99' }],
    ['buscar >150', { buscar: 'B'.repeat(151) }],
  ]

  for (const [descripcion, parametros] of casos) {
    await t.test(descripcion, async () => {
      const r = await listar(parametros)
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
// Detalle GET /facturas/:id
// ---------------------------------------------------------------------------

test('GET /facturas/:id 200: FacturaDetalle con detalles orden id ASC y casteo', async () => {
  const r = await verDetalle(facturaDetalle.id)
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['factura'])

  const factura = r.cuerpo.data.factura
  assert.deepEqual(
    Object.keys(factura).sort(),
    CLAVES_FACTURA_DETALLE,
    `forma exacta de FacturaDetalle: ${JSON.stringify(Object.keys(factura).sort())}`,
  )

  assert.equal(factura.id, facturaDetalle.id)
  assert.equal(factura.numero_factura, facturaDetalle.numero_factura)
  assert.equal(factura.sucursal_id, sucursalListado)
  assert.equal(typeof factura.sucursal_nombre, 'string')
  assert.equal(factura.estado, 'emitida')
  assert.equal(factura.anulada_en, null)
  assert.equal(factura.anulada_por, null)
  for (const campo of [
    'id',
    'numero_factura',
    'sucursal_id',
    'usuario_id',
    'subtotal',
    'descuento',
    'impuesto',
    'total',
  ]) {
    assert.equal(typeof factura[campo], 'number', `${campo} debe ser Number`)
  }
  for (const campo of ['cliente_id', 'metodo_pago_id']) {
    assert.ok(
      factura[campo] === null || typeof factura[campo] === 'number',
      `${campo} debe ser Number o null`,
    )
  }
  assert.equal(
    factura.total,
    Number((factura.subtotal - factura.descuento + factura.impuesto).toFixed(2)),
    'total = subtotal - descuento + impuesto',
  )

  // Detalle: forma, orden id ASC y casteo.
  assert.ok(Array.isArray(factura.detalles))
  assert.equal(factura.detalles.length, 2, 'EC-002: deben venir todas las lineas')

  const { rows: controlLineas } = await pool.query(
    `SELECT d.id AS id, d.producto_id AS producto_id,
            p.codigo AS producto_codigo, p.nombre AS producto_nombre
       FROM detalle_factura d
       JOIN producto p ON p.id = d.producto_id
      WHERE d.factura_id = $1
      ORDER BY d.id ASC`,
    [facturaDetalle.id],
  )
  assert.deepEqual(
    factura.detalles.map((detalle) => detalle.id),
    controlLineas.map((fila) => Number(fila.id)),
    'los detalles deben venir en orden id ASC',
  )

  for (let i = 0; i < factura.detalles.length; i += 1) {
    const detalle = factura.detalles[i]
    const control = controlLineas[i]
    assert.deepEqual(
      Object.keys(detalle).sort(),
      CLAVES_DETALLE,
      `forma exacta de Detalle: ${JSON.stringify(Object.keys(detalle).sort())}`,
    )
    assert.equal(detalle.producto_id, Number(control.producto_id))
    assert.equal(detalle.producto_codigo, control.producto_codigo)
    assert.equal(detalle.producto_nombre, control.producto_nombre)
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
    assert.equal(
      detalle.total,
      Number((detalle.subtotal + detalle.impuesto).toFixed(2)),
      'detalle.total = subtotal + impuesto',
    )
  }
})

test('GET /facturas/:id de una factura anulada: estado y auditoria', async () => {
  const r = await verDetalle(facturaAnulada.id)
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  const factura = r.cuerpo.data.factura
  assert.deepEqual(Object.keys(factura).sort(), CLAVES_FACTURA_DETALLE)
  assert.equal(factura.estado, 'anulada')
  assert.equal(typeof factura.anulada_en, 'string')
  assert.equal(typeof factura.anulada_por, 'number')
  assert.ok(!Number.isNaN(Date.parse(factura.anulada_en)))
})

test('GET /facturas/:id inexistente responde 404', async () => {
  const r = await verDetalle(999999999)
  assert.equal(r.status, 404, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('400 :id invalido (abc/0/negativo/decimal/fuera de rango, nunca 500)', async (t) => {
  const casos = [
    ['abc', 'abc'],
    ['0', '0'],
    ['negativo', '-1'],
    ['decimal', '1.5'],
    ['fuera de rango bigint', '9223372036854775808'],
    ['entero absurdo', '99999999999999999999999999'],
    ['espacios', '%20'],
    ['con letras', '12ab'],
  ]

  for (const [descripcion, id] of casos) {
    await t.test(descripcion, async () => {
      const r = await verDetalle(id)
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

test('IDOR: empresa_id falso en el query se ignora en el detalle', async () => {
  const r = await peticion(base, `/facturas/${facturaDetalle.id}?empresa_id=999`, {
    metodo: 'GET',
    token,
  })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assert.equal(r.cuerpo.data.factura.id, facturaDetalle.id)
  assert.equal(r.cuerpo.data.factura.sucursal_id, sucursalListado)
})

test('IDOR: empresa_id falso en el body se ignora (POST + GET detectan el tenant del token)', async () => {
  // El tenant de la factura sale del token, no del body (que no se lee).
  const factura = await vender({
    sucursal_id: sucursalRegresion,
    empresa_id: 999,
    cliente_nombre: 'QA IDOR Body',
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  const r = await verDetalle(factura.id)
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assert.equal(r.cuerpo.data.factura.sucursal_id, sucursalRegresion)

  const { rows } = await pool.query(
    `SELECT s.empresa_id
       FROM factura f
       JOIN sucursal s ON s.id = f.sucursal_id
      WHERE f.id = $1`,
    [factura.id],
  )
  assert.equal(Number(rows[0].empresa_id), 1, 'la factura debe quedar en la empresa del token')
})

// ---------------------------------------------------------------------------
// Regresion SD-006 (POST) y SD-007 (PATCH anular)
// ---------------------------------------------------------------------------

test('REGRESION SD-006: POST /facturas sigue respondiendo 201 sin campos de anulacion', async () => {
  const factura = await vender({
    sucursal_id: sucursalRegresion,
    cliente_nombre: 'QA Listado Regresion POST',
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  assert.deepEqual(
    Object.keys(factura).sort(),
    CLAVES_FACTURA_EMITIDA,
    `POST no debe incluir anulada_en/anulada_por: ${JSON.stringify(Object.keys(factura).sort())}`,
  )
  assert.equal(factura.estado, 'emitida')
})

test('REGRESION SD-007: PATCH /facturas/:id/anular sigue respondiendo 200 con auditoria', async () => {
  const factura = await vender({
    sucursal_id: sucursalRegresion,
    lineas: [{ producto_id: productoB, cantidad: 1, descuento_porcentaje: 0 }],
  })
  const r = await anular(factura.id)
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['factura'])
  assert.deepEqual(
    Object.keys(r.cuerpo.data.factura).sort(),
    CLAVES_FACTURA_ANULADA,
    `la anulacion debe exponer la auditoria: ${JSON.stringify(Object.keys(r.cuerpo.data.factura).sort())}`,
  )
  assert.equal(r.cuerpo.data.factura.estado, 'anulada')
  assert.equal(typeof r.cuerpo.data.factura.anulada_en, 'string')
  assert.equal(typeof r.cuerpo.data.factura.anulada_por, 'number')
})
