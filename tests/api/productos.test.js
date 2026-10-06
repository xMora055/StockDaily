/*
 * SD-003 - Verificacion independiente del CRUD de productos (/api/v1).
 * Runner nativo de Node 24 + fetch. La app se levanta en un puerto efimero.
 *
 * Datos: se crean productos `QA-*` y se dejan inactivos al terminar.
 * Nada se elimina; el borrado del dominio es logico (activo=false).
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
const { codigoUnico, CLAVES_PRODUCTO } = require('../utilidades/datos')
const { assertSobrePagina, recorrerPaginas } = require('../utilidades/paginacion')

const jwt = requerirServidor('jsonwebtoken')
const { pool } = requerirServidor('./db/pool')

let servidor
let base
let token
let tokenSuper
let tokenAjeno
const creados = []

// Fixtures de paginacion: todos comparten `marcaPag` en codigo y nombre, de
// modo que `codigo=<marcaPag>` los aisla de cualquier otra suite que corra en
// paralelo (facturas/inventario crean sus propios productos QA). Nada se borra:
// se desactivan al final como el resto.
const marcaPag = codigoUnico('QAPAGP')
const paginados = []

// ID de la categoria "General" de la empresa 1 (existe en el seed). Se usa para
// verificar que `total` refleja el filtro `categoria_id`.
const CATEGORIA_ID = 1

before(async () => {
  servidor = await iniciarServidor()
  base = servidor.urlBase
  token = tokenAdmin()
  tokenSuper = tokenSuperadmin()
  tokenAjeno = tokenOtraEmpresa()

  // 5 productos activos sin categoria.
  for (let n = 1; n <= 5; n += 1) {
    const sufijo = String(n).padStart(2, '0')
    const c = await crear({
      codigo: `${marcaPag}-${sufijo}`,
      nombre: `Producto ${marcaPag} ${sufijo}`,
      precio_unitario: 1,
    })
    paginados.push(c.cuerpo.data.producto.id)
  }
  // 1 producto con categoria (para el filtro categoria_id).
  const conCategoria = await crear({
    codigo: `${marcaPag}-CAT`,
    nombre: `Producto ${marcaPag} con categoria`,
    categoria_id: CATEGORIA_ID,
    precio_unitario: 1,
  })
  paginados.push(conCategoria.cuerpo.data.producto.id)
  // 1 producto inactivo (para el filtro activo=false).
  const inactivo = await crear({
    codigo: `${marcaPag}-OFF`,
    nombre: `Producto ${marcaPag} inactivo`,
    precio_unitario: 1,
  })
  await peticion(base, `/productos/${inactivo.cuerpo.data.producto.id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { activo: false },
  })
  paginados.push(inactivo.cuerpo.data.producto.id)
})

// COUNT SQL de control con los mismos filtros que el repositorio.
async function contarProductosBd(where, valores) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM producto WHERE ${where}`,
    valores,
  )
  return rows[0].total
}

after(async () => {
  // Borrado logico de todo lo creado por la suite: queda activo=false.
  if (base) {
    for (const id of creados) {
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

// Crea un producto y registra su id para la limpieza final.
async function crear(cuerpo, opciones = {}) {
  const r = await peticion(base, '/productos', {
    metodo: 'POST',
    token: opciones.token || token,
    cuerpo,
  })
  if (r.status === 201 && r.cuerpo?.data?.producto?.id) {
    creados.push(r.cuerpo.data.producto.id)
  }
  return r
}

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

function assertProducto(producto) {
  assert.deepEqual(
    Object.keys(producto).sort(),
    CLAVES_PRODUCTO,
    `forma exacta de Producto, se obtuvo ${JSON.stringify(Object.keys(producto).sort())}`,
  )
  assert.equal(typeof producto.id, 'number')
  assert.equal(typeof producto.codigo, 'string')
  assert.equal(typeof producto.nombre, 'string')
  assert.equal(typeof producto.precio_unitario, 'number')
  assert.equal(typeof producto.impuesto_porcentaje, 'number')
  assert.equal(typeof producto.activo, 'boolean')
  assert.equal(typeof producto.creado_en, 'string')
  assert.equal(typeof producto.actualizado_en, 'string')
  assert.ok(!('empresa_id' in producto), 'Producto no debe exponer empresa_id')
}

// ---------------------------------------------------------------------------
// Salud y sobre de la API
// ---------------------------------------------------------------------------

test('GET /salud responde {success:true, data:{bd:true}}', async () => {
  const r = await peticion(base, '/salud')
  assert.equal(r.status, 200)
  assertSobreExito(r.cuerpo)
  assert.equal(r.cuerpo.data.bd, true)
})

// ---------------------------------------------------------------------------
// Autenticacion y autorizacion
// ---------------------------------------------------------------------------

test('GET /productos sin token responde 401 con sobre de error', async () => {
  const r = await peticion(base, '/productos')
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('GET /productos con token malformado responde 401', async () => {
  const r = await peticion(base, '/productos', { token: 'esto-no-es-un-jwt' })
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('token firmado con otro secreto responde 401', async () => {
  const falso = jwt.sign({ id: 1, empresa_id: 1, rol: 'administrador' }, 'secreto-ajeno')
  const r = await peticion(base, '/productos', { token: falso })
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('superadmin recibe 403 en los 4 endpoints', async () => {
  const casos = [
    ['GET /productos', { metodo: 'GET', ruta: '/productos' }],
    ['POST /productos', { metodo: 'POST', ruta: '/productos', cuerpo: { codigo: codigoUnico(), nombre: 'X' } }],
    ['GET /productos/:id', { metodo: 'GET', ruta: '/productos/1' }],
    ['PATCH /productos/:id', { metodo: 'PATCH', ruta: '/productos/1', cuerpo: { nombre: 'X' } }],
  ]
  for (const [descripcion, caso] of casos) {
    const r = await peticion(base, caso.ruta, {
      metodo: caso.metodo,
      token: tokenSuper,
      cuerpo: caso.cuerpo,
    })
    assert.equal(r.status, 403, `${descripcion}: esperaba 403 y obtuve ${r.status}`)
    assertSobreError(r.cuerpo)
  }
})

test('administrador sin empresa (empresa_id null) recibe 403', async () => {
  const sinEmpresa = firmarToken({ id: 77, empresa_id: null, nombre: 'Sin empresa' })
  const r = await peticion(base, '/productos', { token: sinEmpresa })
  assert.equal(r.status, 403)
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// Caso feliz: crear, listar, obtener, editar, activar/desactivar
// ---------------------------------------------------------------------------

test('POST caso feliz: 201, sobre y forma exacta de Producto', async () => {
  const codigo = codigoUnico('QA-CRUD')
  const r = await crear({
    codigo,
    nombre: 'Producto QA CRUD',
    descripcion: 'Descripcion QA',
    precio_unitario: 1200.5,
    impuesto_porcentaje: 19,
    categoria_id: null,
  })
  assert.equal(r.status, 201)
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['producto'])
  const p = r.cuerpo.data.producto
  assertProducto(p)
  assert.equal(p.codigo, codigo)
  assert.equal(p.nombre, 'Producto QA CRUD')
  assert.equal(p.descripcion, 'Descripcion QA')
  assert.equal(p.precio_unitario, 1200.5)
  assert.equal(p.impuesto_porcentaje, 19)
  assert.equal(p.categoria_id, null)
  assert.equal(p.activo, true)
})

test('POST sin impuesto ni categoria usa defaults 0 y null (RF-006/RF-007)', async () => {
  const codigo = codigoUnico('QA-DEF')
  const r = await crear({ codigo, nombre: 'Producto QA Defaults' })
  assert.equal(r.status, 201)
  assert.equal(r.cuerpo.data.producto.impuesto_porcentaje, 0)
  assert.equal(r.cuerpo.data.producto.precio_unitario, 0)
  assert.equal(r.cuerpo.data.producto.categoria_id, null)
})

test('GET /productos lista paginada e incluye el creado con forma correcta', async () => {
  const codigo = codigoUnico('QA-LIST')
  const c = await crear({ codigo, nombre: 'Producto QA Lista', precio_unitario: 10 })
  const id = c.cuerpo.data.producto.id

  // Se acota por codigo (unico) para que el fixture caiga en la pagina 1 sin
  // depender del orden alfabetico frente al catalogo acumulado (600+ filas).
  const r = await peticion(base, `/productos?codigo=${encodeURIComponent(codigo)}`, { token })
  assert.equal(r.status, 200)
  const data = assertSobrePagina(r.cuerpo, { pagina: 1, por_pagina: 10, total: 1, total_paginas: 1 })
  assert.equal(data.items.length, 1)
  for (const p of data.items) assertProducto(p)
  assert.ok(
    data.items.some((p) => p.id === id),
    'el producto creado debe aparecer en el listado',
  )
})

test('GET /productos respeta filtros nombre, codigo y activo', async () => {
  const codigo = codigoUnico('QA-FILTRO')
  const nombre = `Producto QA Filtro ${codigo}`
  await crear({ codigo, nombre, precio_unitario: 5 })

  const porCodigo = await peticion(base, `/productos?codigo=${encodeURIComponent(codigo)}`, { token })
  assert.equal(porCodigo.status, 200)
  const dataCodigo = assertSobrePagina(porCodigo.cuerpo)
  assert.ok(dataCodigo.items.every((p) => p.codigo === codigo))
  assert.ok(dataCodigo.items.length >= 1)
  assert.equal(dataCodigo.total, dataCodigo.items.length)

  // El termino de nombre es el codigo unico (contenido en el nombre) para que
  // el fixture caiga en la pagina 1 sin depender de cuantas corridas previas
  // dejaron productos "QA Filtro".
  const porNombre = await peticion(base, `/productos?nombre=${encodeURIComponent(codigo)}`, { token })
  assert.equal(porNombre.status, 200)
  assert.ok(assertSobrePagina(porNombre.cuerpo).items.some((p) => p.codigo === codigo))

  const inactivos = await peticion(base, '/productos?activo=false', { token })
  assert.equal(inactivos.status, 200)
  assert.ok(assertSobrePagina(inactivos.cuerpo).items.every((p) => p.activo === false))

  const activos = await peticion(base, '/productos?activo=true', { token })
  assert.equal(activos.status, 200)
  assert.ok(assertSobrePagina(activos.cuerpo).items.every((p) => p.activo === true))
})

test('GET /productos/:id devuelve el producto propio (200)', async () => {
  const codigo = codigoUnico('QA-OBT')
  const c = await crear({ codigo, nombre: 'Producto QA Obtener' })
  const id = c.cuerpo.data.producto.id

  const r = await peticion(base, `/productos/${id}`, { token })
  assert.equal(r.status, 200)
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['producto'])
  assert.equal(r.cuerpo.data.producto.id, id)
  assertProducto(r.cuerpo.data.producto)
})

test('PATCH /productos/:id actualiza solo los campos presentes', async () => {
  const codigo = codigoUnico('QA-PATCH')
  const c = await crear({ codigo, nombre: 'Producto QA Patch', precio_unitario: 100 })
  const id = c.cuerpo.data.producto.id

  const r = await peticion(base, `/productos/${id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { nombre: 'Producto QA Patch Editado', precio_unitario: 250.75, impuesto_porcentaje: 5 },
  })
  assert.equal(r.status, 200)
  assertSobreExito(r.cuerpo)
  const p = r.cuerpo.data.producto
  assertProducto(p)
  assert.equal(p.id, id)
  assert.equal(p.nombre, 'Producto QA Patch Editado')
  assert.equal(p.precio_unitario, 250.75)
  assert.equal(p.impuesto_porcentaje, 5)
  assert.equal(p.codigo, codigo, 'el codigo no enviado debe permanecer igual')
})

test('PATCH activo:false desactiva (borrado logico) y activo:true reactiva', async () => {
  const codigo = codigoUnico('QA-ESTADO')
  const c = await crear({ codigo, nombre: 'Producto QA Estado' })
  const id = c.cuerpo.data.producto.id

  const off = await peticion(base, `/productos/${id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { activo: false },
  })
  assert.equal(off.status, 200)
  assert.equal(off.cuerpo.data.producto.activo, false)

  const listaInactivos = await peticion(
    base,
    `/productos?activo=false&codigo=${encodeURIComponent(codigo)}`,
    { token },
  )
  assert.ok(assertSobrePagina(listaInactivos.cuerpo).items.some((p) => p.id === id))

  const on = await peticion(base, `/productos/${id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { activo: true },
  })
  assert.equal(on.status, 200)
  assert.equal(on.cuerpo.data.producto.activo, true)
})

test('no existe DELETE: DELETE /productos/:id da 404 y el producto sigue vivo', async () => {
  const codigo = codigoUnico('QA-DEL')
  const c = await crear({ codigo, nombre: 'Producto QA No Borrar' })
  const id = c.cuerpo.data.producto.id

  const d = await peticion(base, `/productos/${id}`, { metodo: 'DELETE', token })
  assert.equal(d.status, 404)
  assertSobreError(d.cuerpo)

  const g = await peticion(base, `/productos/${id}`, { token })
  assert.equal(g.status, 200)
})

// ---------------------------------------------------------------------------
// Validaciones (400)
// ---------------------------------------------------------------------------

test('POST /productos validaciones 400', async (t) => {
  const casos = [
    ['sin codigo', { nombre: 'X' }],
    ['codigo vacio', { codigo: '   ', nombre: 'X' }],
    ['sin nombre', { codigo: codigoUnico() }],
    ['nombre vacio', { codigo: codigoUnico(), nombre: '  ' }],
    ['precio negativo', { codigo: codigoUnico(), nombre: 'X', precio_unitario: -1 }],
    ['precio no numerico', { codigo: codigoUnico(), nombre: 'X', precio_unitario: 'abc' }],
    ['impuesto negativo', { codigo: codigoUnico(), nombre: 'X', impuesto_porcentaje: -1 }],
    ['impuesto mayor a 100', { codigo: codigoUnico(), nombre: 'X', impuesto_porcentaje: 101 }],
    ['codigo mayor a 50', { codigo: 'A'.repeat(51), nombre: 'X' }],
    ['nombre mayor a 150', { codigo: codigoUnico(), nombre: 'A'.repeat(151) }],
    ['categoria inexistente', { codigo: codigoUnico(), nombre: 'X', categoria_id: 999999 }],
    ['categoria no entera', { codigo: codigoUnico(), nombre: 'X', categoria_id: 1.5 }],
    ['cuerpo arreglo', [{ codigo: codigoUnico(), nombre: 'X' }]],
  ]

  for (const [descripcion, cuerpo] of casos) {
    await t.test(descripcion, async () => {
      const r = await peticion(base, '/productos', { metodo: 'POST', token, cuerpo })
      assert.equal(
        r.status,
        400,
        `${descripcion}: esperaba 400, obtuve ${r.status} ${JSON.stringify(r.cuerpo)}`,
      )
      assertSobreError(r.cuerpo)
    })
  }
})

test('PATCH sin campos responde 400', async () => {
  const c = await crear({ codigo: codigoUnico('QA-VACIO'), nombre: 'Vacio' })
  const r = await peticion(base, `/productos/${c.cuerpo.data.producto.id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: {},
  })
  assert.equal(r.status, 400)
  assertSobreError(r.cuerpo)
})

test('id no numerico o invalido responde 400 (GET y PATCH)', async () => {
  for (const ruta of ['/productos/abc', '/productos/1.5', '/productos/0', '/productos/-3']) {
    const g = await peticion(base, ruta, { token })
    assert.equal(g.status, 400, `GET ${ruta}: esperaba 400, obtuve ${g.status}`)
    assertSobreError(g.cuerpo)

    const p = await peticion(base, ruta, { metodo: 'PATCH', token, cuerpo: { nombre: 'X' } })
    assert.equal(p.status, 400, `PATCH ${ruta}: esperaba 400, obtuve ${p.status}`)
    assertSobreError(p.cuerpo)
  }
})

// ---------------------------------------------------------------------------
// Unicidad (409)
// ---------------------------------------------------------------------------

test('codigo duplicado en la misma empresa responde 409 (POST y PATCH)', async () => {
  const codigo = codigoUnico('QA-DUP')
  const a = await crear({ codigo, nombre: 'Dup A' })
  assert.equal(a.status, 201)

  const repetido = await crear({ codigo, nombre: 'Dup B' })
  assert.equal(repetido.status, 409)
  assertSobreError(repetido.cuerpo)

  const b = await crear({ codigo: codigoUnico('QA-DUP2'), nombre: 'Dup C' })
  const patch = await peticion(base, `/productos/${b.cuerpo.data.producto.id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { codigo },
  })
  assert.equal(patch.status, 409)
  assertSobreError(patch.cuerpo)
})

test('PATCH con el mismo codigo propio no da 409', async () => {
  const codigo = codigoUnico('QA-MISMO')
  const c = await crear({ codigo, nombre: 'Mismo codigo' })
  const r = await peticion(base, `/productos/${c.cuerpo.data.producto.id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { codigo, nombre: 'Mismo codigo editado' },
  })
  assert.equal(r.status, 200)
  assert.equal(r.cuerpo.data.producto.codigo, codigo)
})

// ---------------------------------------------------------------------------
// Multi-tenant / IDOR
// ---------------------------------------------------------------------------

test('IDOR: empresa_id falso en el body se ignora al crear', async () => {
  const codigo = codigoUnico('QA-IDOR-BODY')
  const r = await crear({ codigo, nombre: 'IDOR body', empresa_id: 999 })
  // Si el backend usara empresa_id=999 fallaria por FK (esa empresa no existe).
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  const id = r.cuerpo.data.producto.id

  const ajeno = await peticion(
    base,
    `/productos?codigo=${encodeURIComponent(codigo)}`,
    { token: tokenAjeno },
  )
  assert.equal(ajeno.status, 200)
  const dataAjeno = assertSobrePagina(ajeno.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(dataAjeno.items, [], 'no debe verse desde la empresa 999')

  const propio = await peticion(base, `/productos/${id}`, { token })
  assert.equal(propio.status, 200)
})

test('IDOR: empresa_id falso en el query se ignora al listar', async () => {
  const codigo = codigoUnico('QA-IDOR-Q')
  const c = await crear({ codigo, nombre: 'IDOR query' })
  const id = c.cuerpo.data.producto.id

  const r = await peticion(
    base,
    `/productos?empresa_id=999&codigo=${encodeURIComponent(codigo)}`,
    { token },
  )
  assert.equal(r.status, 200)
  const data = assertSobrePagina(r.cuerpo, { total: 1, total_paginas: 1 })
  assert.equal(data.items.length, 1)
  assert.equal(data.items[0].id, id, 'el listado debe seguir siendo el de la empresa del token (empresa 1)')
})

test('IDOR: token de otra empresa no ve ni afecta un producto ajeno (404)', async () => {
  const g = await peticion(base, '/productos/1', { token: tokenAjeno })
  assert.equal(g.status, 404)
  assertSobreError(g.cuerpo)

  const p = await peticion(base, '/productos/1', {
    metodo: 'PATCH',
    token: tokenAjeno,
    cuerpo: { nombre: 'Intento ajeno' },
  })
  assert.equal(p.status, 404)
  assertSobreError(p.cuerpo)
})

test('producto inexistente responde 404', async () => {
  const r = await peticion(base, '/productos/99999999', { token })
  assert.equal(r.status, 404)
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// Paginacion (SD-018): sobre, total = COUNT SQL, sin repetir/omitir, 400
// ---------------------------------------------------------------------------

test('GET /productos paginado: defaults y total = COUNT SQL (fixtures QA aislados)', async () => {
  const query = `codigo=${encodeURIComponent(marcaPag)}`
  const r = await peticion(base, `/productos?${query}`, { token })
  const data = assertSobrePagina(r.cuerpo, {
    pagina: 1,
    por_pagina: 10,
    total: 7,
    total_paginas: 1,
  })
  assert.equal(data.items.length, 7)
  for (const p of data.items) assertProducto(p)
  assert.equal(
    data.total,
    await contarProductosBd('empresa_id = $1 AND codigo ILIKE $2', [1, `%${marcaPag}%`]),
    'total = COUNT SQL con el mismo filtro y empresa',
  )
})

test('GET /productos total refleja los filtros (count SQL de control)', async () => {
  const codigoQuery = `codigo=${encodeURIComponent(marcaPag)}`
  const whereBase = 'empresa_id = $1 AND codigo ILIKE $2'
  const valoresBase = [1, `%${marcaPag}%`]

  const off = await peticion(base, `/productos?${codigoQuery}&activo=false`, { token })
  const dataOff = assertSobrePagina(off.cuerpo, { total: 1, total_paginas: 1 })
  assert.equal(dataOff.items.length, 1)
  assert.equal(dataOff.items[0].activo, false)
  assert.equal(
    dataOff.total,
    await contarProductosBd(`${whereBase} AND activo = $3`, [...valoresBase, false]),
  )

  const on = await peticion(base, `/productos?${codigoQuery}&activo=true&por_pagina=100`, { token })
  const dataOn = assertSobrePagina(on.cuerpo, { total: 6, total_paginas: 1 })
  assert.equal(dataOn.items.length, 6)
  assert.equal(
    dataOn.total,
    await contarProductosBd(`${whereBase} AND activo = $3`, [...valoresBase, true]),
  )

  const cat = await peticion(base, `/productos?${codigoQuery}&categoria_id=${CATEGORIA_ID}`, { token })
  const dataCat = assertSobrePagina(cat.cuerpo, { total: 1, total_paginas: 1 })
  assert.equal(dataCat.items[0].categoria_id, CATEGORIA_ID)
  assert.equal(
    dataCat.total,
    await contarProductosBd(`${whereBase} AND categoria_id = $3`, [...valoresBase, CATEGORIA_ID]),
  )

  const porNombre = await peticion(
    base,
    `/productos?nombre=${encodeURIComponent(marcaPag)}&por_pagina=100`,
    { token },
  )
  const dataNombre = assertSobrePagina(porNombre.cuerpo, { total: 7 })
  assert.equal(
    dataNombre.total,
    await contarProductosBd('empresa_id = $1 AND nombre ILIKE $2', [1, `%${marcaPag}%`]),
  )
})

test('GET /productos paginado: no repite ni omite filas y respeta el orden', async () => {
  const query = `codigo=${encodeURIComponent(marcaPag)}`
  const { items, total, totalPaginas } = await recorrerPaginas({
    peticion,
    base,
    token,
    ruta: '/productos',
    query,
    porPagina: 2,
  })

  assert.equal(total, 7)
  assert.equal(totalPaginas, Math.ceil(7 / 2))
  assert.equal(items.length, 7, 'la union de paginas cubre todas las filas')

  const ids = items.map((p) => p.id)
  assert.equal(new Set(ids).size, 7, 'sin filas repetidas entre paginas')

  const control = await pool.query(
    `SELECT id FROM producto
      WHERE empresa_id = $1 AND codigo ILIKE $2
      ORDER BY nombre ASC, id ASC`,
    [1, `%${marcaPag}%`],
  )
  assert.deepEqual(
    ids,
    control.rows.map((f) => Number(f.id)),
    'orden determinista por nombre ASC, id ASC',
  )
})

test('GET /productos casos limite: por_pagina>total, pagina fuera de rango y total 0', async () => {
  const query = `codigo=${encodeURIComponent(marcaPag)}`

  const amplia = await peticion(base, `/productos?${query}&por_pagina=100`, { token })
  const dataAmplia = assertSobrePagina(amplia.cuerpo, {
    por_pagina: 100,
    total: 7,
    total_paginas: 1,
  })
  assert.equal(dataAmplia.items.length, 7)

  const masAlla = await peticion(base, `/productos?${query}&por_pagina=2&pagina=5`, { token })
  const dataMas = assertSobrePagina(masAlla.cuerpo, {
    pagina: 5,
    por_pagina: 2,
    total: 7,
    total_paginas: 4,
  })
  assert.deepEqual(dataMas.items, [], 'una pagina mas alla del final no inventa filas')

  const vacio = await peticion(
    base,
    `/productos?codigo=${encodeURIComponent(`ZZZ-${marcaPag}-NADA`)}`,
    { token },
  )
  const dataVacio = assertSobrePagina(vacio.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(dataVacio.items, [])
})

test('GET /productos pagina/por_pagina invalidos -> 400', async (t) => {
  const casos = [
    'pagina=0',
    'pagina=-1',
    'pagina=1.5',
    'pagina=abc',
    'por_pagina=0',
    'por_pagina=101',
    'por_pagina=1.5',
  ]

  for (const caso of casos) {
    await t.test(caso, async () => {
      const r = await peticion(base, `/productos?${caso}`, { token })
      assert.equal(
        r.status,
        400,
        `${caso}: esperaba 400, obtuve ${r.status} ${JSON.stringify(r.cuerpo)}`,
      )
      assertSobreError(r.cuerpo)
    })
  }
})

// ---------------------------------------------------------------------------
// Tipos numericos (casteo numeric -> Number)
// ---------------------------------------------------------------------------

test('precio_unitario e impuesto_porcentaje llegan como Number', async () => {
  const codigo = codigoUnico('QA-NUM')
  const r = await crear({
    codigo,
    nombre: 'Producto QA Numerico',
    precio_unitario: 1200.5,
    impuesto_porcentaje: 19.5,
  })
  assert.equal(r.status, 201)
  const p = r.cuerpo.data.producto
  assert.equal(typeof p.precio_unitario, 'number')
  assert.equal(typeof p.impuesto_porcentaje, 'number')
  assert.equal(p.precio_unitario, 1200.5)
  assert.equal(p.impuesto_porcentaje, 19.5)

  const g = await peticion(base, `/productos/${p.id}`, { token })
  assert.equal(typeof g.cuerpo.data.producto.precio_unitario, 'number')
  assert.equal(typeof g.cuerpo.data.producto.impuesto_porcentaje, 'number')
})

test('acepta numeros enviados como texto y los serializa como Number', async () => {
  const codigo = codigoUnico('QA-TEXTO')
  const r = await crear({
    codigo,
    nombre: 'Producto QA Texto',
    precio_unitario: '1200.50',
    impuesto_porcentaje: '19.00',
  })
  assert.equal(r.status, 201)
  assert.equal(typeof r.cuerpo.data.producto.precio_unitario, 'number')
  assert.equal(r.cuerpo.data.producto.precio_unitario, 1200.5)
  assert.equal(typeof r.cuerpo.data.producto.impuesto_porcentaje, 'number')
  assert.equal(r.cuerpo.data.producto.impuesto_porcentaje, 19)
})