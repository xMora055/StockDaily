/*
 * SD-001 - Verificacion independiente del CRUD de sucursales (/api/v1).
 * Runner nativo de Node 24 + fetch. La app se levanta en un puerto efimero.
 *
 * Datos: se crean sucursales `QA-SUC-*` y se dejan inactivas al terminar
 * (borrado logico via PATCH activo=false). Nada se elimina fisicamente.
 *
 * Multi-tenant: empresa 1 es la unica real; para sondear IDOR se firma un
 * token de la empresa 999 (inexistente), igual que en la suite de productos.
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
const { codigoUnico, nombreUnico, CLAVES_SUCURSAL } = require('../utilidades/datos')
const { assertSobrePagina, recorrerPaginas } = require('../utilidades/paginacion')

const jwt = requerirServidor('jsonwebtoken')
const { pool } = requerirServidor('./db/pool')

let servidor
let base
let token
let tokenSuper
let tokenAjeno
const creados = []

// Fixtures de paginacion: sucursales activas con `marcaPag` en el nombre.
// `GET /sucursales` no tiene filtro por nombre, asi que el aislamiento por
// conteo se hace con el filtro `activo` y el COUNT SQL de control.
const marcaPag = codigoUnico('QAPAGS')
const sucursalesPag = []

before(async () => {
  servidor = await iniciarServidor()
  base = servidor.urlBase
  token = tokenAdmin()
  tokenSuper = tokenSuperadmin()
  tokenAjeno = tokenOtraEmpresa()

  for (let n = 1; n <= 3; n += 1) {
    const c = await crear({ nombre: `${marcaPag} ${String(n).padStart(2, '0')}` })
    sucursalesPag.push(c.cuerpo.data.sucursal.id)
  }
})

// COUNT SQL de control con el mismo filtro que el repositorio.
async function contarSucursalesBd({ activo } = {}) {
  if (activo === undefined) {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM sucursal WHERE empresa_id = $1',
      [1],
    )
    return rows[0].total
  }
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS total FROM sucursal WHERE empresa_id = $1 AND activo = $2',
    [1, activo],
  )
  return rows[0].total
}

// Coteja `total` de la API con el COUNT SQL, reintentando si el catalogo
// cambio entre las dos lecturas por corridas concurrentes de otras suites.
async function cotejarTotal(query, contar) {
  for (let intento = 0; intento < 4; intento += 1) {
    const antes = await contar()
    const r = await peticion(base, `/sucursales?${query}`, { token })
    const data = assertSobrePagina(r.cuerpo)
    const despues = await contar()
    if (antes === despues && data.total === antes) return { data, total: antes }
  }
  throw new Error(`total no estable para ?${query}`)
}

// Recorre las paginas de un filtro y devuelve la sucursal que cumple.
async function buscarSucursalEnPaginas(filtroQuery, predicado) {
  const prefijo = filtroQuery ? `${filtroQuery}&` : ''
  let pagina = 1
  let totalPaginas = 1

  while (pagina <= totalPaginas) {
    const r = await peticion(
      base,
      `/sucursales?${prefijo}pagina=${pagina}&por_pagina=100`,
      { token },
    )
    const data = assertSobrePagina(r.cuerpo, { pagina, por_pagina: 100 })
    const encontrada = data.items.find(predicado)
    if (encontrada) return encontrada
    totalPaginas = data.total_paginas
    pagina += 1
    assert.ok(pagina < 1000, 'guardia contra bucle infinito')
  }
  return null
}

after(async () => {
  // Borrado logico de todo lo creado: queda activo=false. Nunca se borra.
  if (base) {
    for (const id of creados) {
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

// Crea una sucursal y registra su id para la limpieza final.
async function crear(cuerpo, opciones = {}) {
  const r = await peticion(base, '/sucursales', {
    metodo: 'POST',
    token: opciones.token || token,
    cuerpo,
  })
  if (r.status === 201 && r.cuerpo?.data?.sucursal?.id) {
    creados.push(r.cuerpo.data.sucursal.id)
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

function assertSucursal(sucursal) {
  assert.deepEqual(
    Object.keys(sucursal).sort(),
    CLAVES_SUCURSAL,
    `forma exacta de Sucursal, se obtuvo ${JSON.stringify(Object.keys(sucursal).sort())}`,
  )
  assert.equal(typeof sucursal.id, 'number', 'id debe ser Number')
  assert.ok(sucursal.id > 0)
  assert.equal(typeof sucursal.nombre, 'string')
  assert.ok(
    sucursal.direccion === null || typeof sucursal.direccion === 'string',
    'direccion debe ser string o null',
  )
  assert.ok(
    sucursal.telefono === null || typeof sucursal.telefono === 'string',
    'telefono debe ser string o null',
  )
  assert.equal(typeof sucursal.activo, 'boolean')
  assert.equal(typeof sucursal.creado_en, 'string')
  assert.equal(typeof sucursal.actualizado_en, 'string')
  assert.ok(!('empresa_id' in sucursal), 'Sucursal no debe exponer empresa_id')
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

test('GET /sucursales sin token responde 401 con sobre de error', async () => {
  const r = await peticion(base, '/sucursales')
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('GET /sucursales con token malformado responde 401', async () => {
  const r = await peticion(base, '/sucursales', { token: 'esto-no-es-un-jwt' })
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('token firmado con otro secreto responde 401', async () => {
  const falso = jwt.sign({ id: 1, empresa_id: 1, rol: 'administrador' }, 'secreto-ajeno')
  const r = await peticion(base, '/sucursales', { token: falso })
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('superadmin recibe 403 en los 4 endpoints', async () => {
  const casos = [
    ['GET /sucursales', { metodo: 'GET', ruta: '/sucursales' }],
    ['POST /sucursales', { metodo: 'POST', ruta: '/sucursales', cuerpo: { nombre: nombreUnico() } }],
    ['GET /sucursales/:id', { metodo: 'GET', ruta: '/sucursales/1' }],
    ['PATCH /sucursales/:id', { metodo: 'PATCH', ruta: '/sucursales/1', cuerpo: { nombre: 'X' } }],
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
  const r = await peticion(base, '/sucursales', { token: sinEmpresa })
  assert.equal(r.status, 403)
  assertSobreError(r.cuerpo)
})

// ---------------------------------------------------------------------------
// Caso feliz: crear, listar, obtener, editar, activar/desactivar
// ---------------------------------------------------------------------------

test('POST caso feliz: 201, sobre y forma exacta de Sucursal', async () => {
  const nombre = nombreUnico('QA-SUC-CRUD')
  const r = await crear({
    nombre,
    direccion: 'Calle 12 #34-56',
    telefono: '+57 300 123 4567',
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['sucursal'])
  const s = r.cuerpo.data.sucursal
  assertSucursal(s)
  assert.equal(s.nombre, nombre)
  assert.equal(s.direccion, 'Calle 12 #34-56')
  assert.equal(s.telefono, '+57 300 123 4567')
  assert.equal(s.activo, true)
})

test('POST sin direccion ni telefono: se normalizan a null y activo=true', async () => {
  const r = await crear({ nombre: nombreUnico('QA-SUC-DEF') })
  assert.equal(r.status, 201)
  const s = r.cuerpo.data.sucursal
  assert.equal(s.direccion, null)
  assert.equal(s.telefono, null)
  assert.equal(s.activo, true)
})

test('POST direccion/telefono vacios o null -> null', async () => {
  const r = await crear({
    nombre: nombreUnico('QA-SUC-VACIO'),
    direccion: '   ',
    telefono: '',
  })
  assert.equal(r.status, 201)
  assert.equal(r.cuerpo.data.sucursal.direccion, null)
  assert.equal(r.cuerpo.data.sucursal.telefono, null)

  const r2 = await crear({
    nombre: nombreUnico('QA-SUC-NULL'),
    direccion: null,
    telefono: null,
  })
  assert.equal(r2.status, 201)
  assert.equal(r2.cuerpo.data.sucursal.direccion, null)
  assert.equal(r2.cuerpo.data.sucursal.telefono, null)
})

test('POST ignora activo/empresa_id y campos extra (sobre sin campos raiz)', async () => {
  const nombre = nombreUnico('QA-SUC-EXTRA')
  const r = await crear({
    nombre,
    activo: false,
    empresa_id: 999,
    creado_en: '1970-01-01T00:00:00.000Z',
    campo_desconocido: 'x',
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  // `activo` no es parte del contrato POST: la sucursal nace activa.
  assert.equal(r.cuerpo.data.sucursal.activo, true)
})

test('GET /sucursales lista paginada e incluye la creada', async () => {
  const nombre = nombreUnico('QA-SUC-LIST')
  const c = await crear({ nombre })
  const id = c.cuerpo.data.sucursal.id

  // La sucursal creada nace activa; se ubica recorriendo `activo=true` porque
  // el catalogo acumula cientos de filas inactivas de corridas previas.
  let encontrada = null
  for (let intento = 0; intento < 3 && !encontrada; intento += 1) {
    encontrada = await buscarSucursalEnPaginas('activo=true', (s) => s.id === id)
  }
  assert.ok(encontrada, 'la sucursal creada debe aparecer en el listado')
  assertSucursal(encontrada)
})

test('GET /sucursales/:id devuelve la sucursal propia (200)', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-OBT') })
  const id = c.cuerpo.data.sucursal.id

  const r = await peticion(base, `/sucursales/${id}`, { token })
  assert.equal(r.status, 200)
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['sucursal'])
  assert.equal(r.cuerpo.data.sucursal.id, id)
  assertSucursal(r.cuerpo.data.sucursal)
})

test('PATCH /sucursales/:id actualiza solo los campos presentes', async () => {
  const nombre = nombreUnico('QA-SUC-PATCH')
  const c = await crear({ nombre, direccion: 'Original', telefono: '111' })
  const id = c.cuerpo.data.sucursal.id

  const r = await peticion(base, `/sucursales/${id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { direccion: 'Calle Nueva 99', telefono: '222' },
  })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  const s = r.cuerpo.data.sucursal
  assertSucursal(s)
  assert.equal(s.id, id)
  assert.equal(s.nombre, nombre, 'el nombre no enviado debe permanecer igual')
  assert.equal(s.direccion, 'Calle Nueva 99')
  assert.equal(s.telefono, '222')
})

test('PATCH direccion/telefono vacios limpia a null', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-LIMPIAR'), direccion: 'X', telefono: 'Y' })
  const id = c.cuerpo.data.sucursal.id

  const r = await peticion(base, `/sucursales/${id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { direccion: '', telefono: '   ' },
  })
  assert.equal(r.status, 200)
  assert.equal(r.cuerpo.data.sucursal.direccion, null)
  assert.equal(r.cuerpo.data.sucursal.telefono, null)
})

test('PATCH activo:false desactiva (borrado logico), sigue en el listado y activo:true reactiva', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-ESTADO') })
  const id = c.cuerpo.data.sucursal.id

  const off = await peticion(base, `/sucursales/${id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { activo: false },
  })
  assert.equal(off.status, 200)
  assert.equal(off.cuerpo.data.sucursal.activo, false)

  // El borrado es logico: la fila sigue existiendo y visible en el listado.
  let encontrada = null
  for (let intento = 0; intento < 3 && !encontrada; intento += 1) {
    encontrada = await buscarSucursalEnPaginas('activo=false', (s) => s.id === id)
  }
  assert.ok(encontrada, 'la sucursal inactiva debe seguir en el listado')
  assert.equal(encontrada.activo, false)

  const on = await peticion(base, `/sucursales/${id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { activo: true },
  })
  assert.equal(on.status, 200)
  assert.equal(on.cuerpo.data.sucursal.activo, true)
})

test('no existe DELETE: DELETE /sucursales/:id da 404 y la sucursal sigue viva', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-NODEL') })
  const id = c.cuerpo.data.sucursal.id

  const d = await peticion(base, `/sucursales/${id}`, { metodo: 'DELETE', token })
  assert.equal(d.status, 404)
  assertSobreError(d.cuerpo)

  const g = await peticion(base, `/sucursales/${id}`, { token })
  assert.equal(g.status, 200)
})

// ---------------------------------------------------------------------------
// Validaciones (400) - nunca 500
// ---------------------------------------------------------------------------

test('POST /sucursales validaciones 400', async (t) => {
  const casos = [
    ['sin nombre', {}],
    ['nombre ausente con extras', { direccion: 'X', telefono: '1' }],
    ['nombre vacio', { nombre: '   ' }],
    ['nombre no texto', { nombre: 123 }],
    ['nombre mayor a 150', { nombre: 'A'.repeat(151) }],
    ['direccion mayor a 200', { nombre: nombreUnico(), direccion: 'D'.repeat(201) }],
    ['telefono mayor a 30', { nombre: nombreUnico(), telefono: 'T'.repeat(31) }],
    ['direccion no texto', { nombre: nombreUnico(), direccion: 5 }],
    ['telefono no texto', { nombre: nombreUnico(), telefono: [] }],
    ['cuerpo arreglo', [{ nombre: nombreUnico() }]],
    ['cuerpo null', null],
  ]

  for (const [descripcion, cuerpo] of casos) {
    await t.test(descripcion, async () => {
      const r = await peticion(base, '/sucursales', { metodo: 'POST', token, cuerpo })
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

test('POST acepta direccion (200) y telefono (30) en el limite exacto', async () => {
  const c = await crear({
    nombre: nombreUnico('QA-SUC-LIMITE'),
    direccion: 'D'.repeat(200),
    telefono: 'T'.repeat(30),
  })
  assert.equal(c.status, 201, JSON.stringify(c.cuerpo))
  assert.equal(c.cuerpo.data.sucursal.direccion.length, 200)
  assert.equal(c.cuerpo.data.sucursal.telefono.length, 30)
})

test('PATCH sin campos responde 400', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-VACIO-PATCH') })
  const r = await peticion(base, `/sucursales/${c.cuerpo.data.sucursal.id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: {},
  })
  assert.equal(r.status, 400)
  assertSobreError(r.cuerpo)
})

test('PATCH activo no booleano responde 400', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-ACTIVO') })
  for (const activo of [1, 0, 'si', null]) {
    const r = await peticion(base, `/sucursales/${c.cuerpo.data.sucursal.id}`, {
      metodo: 'PATCH',
      token,
      cuerpo: { activo },
    })
    assert.equal(r.status, 400, `activo=${JSON.stringify(activo)} debia ser 400`)
    assertSobreError(r.cuerpo)
  }
})

test('PATCH nombre mayor a 150 responde 400', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-PATCH-LARGO') })
  const r = await peticion(base, `/sucursales/${c.cuerpo.data.sucursal.id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { nombre: 'A'.repeat(151) },
  })
  assert.equal(r.status, 400)
  assertSobreError(r.cuerpo)
})

test('id no numerico, 0, negativo, decimal o fuera de rango bigint responde 400 (GET y PATCH), nunca 500', async () => {
  const invalidos = [
    '/sucursales/abc',
    '/sucursales/1.5',
    '/sucursales/0',
    '/sucursales/-3',
    '/sucursales/1e5',
    '/sucursales/99999999999999999999',
    '/sucursales/9223372036854775808',
  ]
  for (const ruta of invalidos) {
    const g = await peticion(base, ruta, { token })
    assert.notEqual(g.status, 500, `GET ${ruta}: nunca 500 ${JSON.stringify(g.cuerpo)}`)
    assert.equal(g.status, 400, `GET ${ruta}: esperaba 400, obtuve ${g.status}`)
    assertSobreError(g.cuerpo)

    const p = await peticion(base, ruta, {
      metodo: 'PATCH',
      token,
      cuerpo: { nombre: nombreUnico() },
    })
    assert.notEqual(p.status, 500, `PATCH ${ruta}: nunca 500 ${JSON.stringify(p.cuerpo)}`)
    assert.equal(p.status, 400, `PATCH ${ruta}: esperaba 400, obtuve ${p.status}`)
    assertSobreError(p.cuerpo)
  }
})

// ---------------------------------------------------------------------------
// Unicidad (409)
// ---------------------------------------------------------------------------

test('nombre duplicado en la misma empresa responde 409 (POST y PATCH)', async () => {
  const nombre = nombreUnico('QA-SUC-DUP')
  const a = await crear({ nombre })
  assert.equal(a.status, 201)

  const repetido = await crear({ nombre })
  assert.equal(repetido.status, 409, JSON.stringify(repetido.cuerpo))
  assertSobreError(repetido.cuerpo)

  const b = await crear({ nombre: nombreUnico('QA-SUC-DUP2') })
  const patch = await peticion(base, `/sucursales/${b.cuerpo.data.sucursal.id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { nombre },
  })
  assert.equal(patch.status, 409)
  assertSobreError(patch.cuerpo)
})

test('PATCH con el mismo nombre propio no da 409', async () => {
  const nombre = nombreUnico('QA-SUC-MISMO')
  const c = await crear({ nombre })
  const r = await peticion(base, `/sucursales/${c.cuerpo.data.sucursal.id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { nombre, direccion: 'Actualizada' },
  })
  assert.equal(r.status, 200)
  assert.equal(r.cuerpo.data.sucursal.nombre, nombre)
  assert.equal(r.cuerpo.data.sucursal.direccion, 'Actualizada')
})

// ---------------------------------------------------------------------------
// Multi-tenant / IDOR
// ---------------------------------------------------------------------------

test('IDOR: empresa_id falso en el body se ignora al crear', async () => {
  const nombre = nombreUnico('QA-SUC-IDOR-BODY')
  const r = await crear({ nombre, empresa_id: 999 })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  const id = r.cuerpo.data.sucursal.id

  // Un token de la empresa 999 no debe ver la sucursal de la empresa 1.
  const ajeno = await peticion(base, '/sucursales?activo=true', { token: tokenAjeno })
  assert.equal(ajeno.status, 200)
  const dataAjeno = assertSobrePagina(ajeno.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(dataAjeno.items, [], 'no debe verse desde la empresa 999')

  const propio = await peticion(base, `/sucursales/${id}`, { token })
  assert.equal(propio.status, 200)
})

test('IDOR: empresa_id falso en el query se ignora al listar', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-IDOR-Q') })
  const id = c.cuerpo.data.sucursal.id

  // Si se respetara `empresa_id=999`, el total seria 0 (esa empresa no existe);
  // debe seguir contando la empresa 1 del token.
  const { total } = await cotejarTotal('empresa_id=999&activo=true&por_pagina=1', () =>
    contarSucursalesBd({ activo: true }),
  )
  assert.ok(total >= 1, 'el listado debe seguir siendo el de la empresa 1')

  const encontrada = await buscarSucursalEnPaginas(
    'empresa_id=999&activo=true',
    (s) => s.id === id,
  )
  assert.ok(encontrada, 'la sucursal de la empresa 1 debe seguir visible')
})

test('IDOR: token de otra empresa no ve ni afecta una sucursal ajena (404)', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-AJENA') })
  const id = c.cuerpo.data.sucursal.id

  const g = await peticion(base, `/sucursales/${id}`, { token: tokenAjeno })
  assert.equal(g.status, 404, JSON.stringify(g.cuerpo))
  assertSobreError(g.cuerpo)

  const p = await peticion(base, `/sucursales/${id}`, {
    metodo: 'PATCH',
    token: tokenAjeno,
    cuerpo: { nombre: 'Intento ajeno' },
  })
  assert.equal(p.status, 404, JSON.stringify(p.cuerpo))
  assertSobreError(p.cuerpo)

  // La sucursal original no cambio.
  const propia = await peticion(base, `/sucursales/${id}`, { token })
  assert.equal(propia.status, 200)
  assert.notEqual(propia.cuerpo.data.sucursal.nombre, 'Intento ajeno')
})

test('IDOR: empresa_id falso en el body se ignora al editar (el tenant no cambia)', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-IDOR-PATCH') })
  const id = c.cuerpo.data.sucursal.id

  const r = await peticion(base, `/sucursales/${id}`, {
    metodo: 'PATCH',
    token,
    cuerpo: { direccion: 'Editada', empresa_id: 999 },
  })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assert.equal(r.cuerpo.data.sucursal.direccion, 'Editada')

  // Sigue perteneciendo a la empresa del token (empresa 1), no a la 999.
  const propia = await peticion(base, `/sucursales/${id}`, { token })
  assert.equal(propia.status, 200)
  const ajena = await peticion(base, `/sucursales/${id}`, { token: tokenAjeno })
  assert.equal(ajena.status, 404)
  assertSobreError(ajena.cuerpo)
})

test('sucursal inexistente responde 404 (GET y PATCH)', async () => {
  const g = await peticion(base, '/sucursales/99999999', { token })
  assert.equal(g.status, 404)
  assertSobreError(g.cuerpo)

  const p = await peticion(base, '/sucursales/99999999', {
    metodo: 'PATCH',
    token,
    cuerpo: { activo: false },
  })
  assert.equal(p.status, 404)
  assertSobreError(p.cuerpo)
})

// ---------------------------------------------------------------------------
// Paginacion (SD-018): sobre, total = COUNT SQL, sin repetir/omitir, 400
// ---------------------------------------------------------------------------

test('GET /sucursales paginado: defaults pagina=1 y por_pagina=10', async () => {
  const r = await peticion(base, '/sucursales', { token })
  const data = assertSobrePagina(r.cuerpo, { pagina: 1, por_pagina: 10 })
  assert.ok(data.items.length <= 10, 'no puede traer mas que por_pagina')
  for (const s of data.items) assertSucursal(s)
})

test('GET /sucursales total refleja el filtro activo (COUNT SQL de control)', async () => {
  const todos = await cotejarTotal('por_pagina=1', () => contarSucursalesBd())
  assert.equal(todos.data.total, todos.total)

  const activos = await cotejarTotal('activo=true&por_pagina=1', () =>
    contarSucursalesBd({ activo: true }),
  )
  assert.equal(activos.data.total, activos.total)

  const inactivos = await cotejarTotal('activo=false&por_pagina=1', () =>
    contarSucursalesBd({ activo: false }),
  )
  assert.equal(inactivos.data.total, inactivos.total)
  assert.equal(
    activos.total + inactivos.total,
    todos.total,
    'activos + inactivos = total',
  )
})

test('GET /sucursales paginado: activo=false no repite ni omite y respeta el orden', async () => {
  let resultado = null

  // Reintenta si el catalogo cambia entre paginas por corridas concurrentes.
  for (let intento = 0; intento < 4 && !resultado; intento += 1) {
    const antes = await contarSucursalesBd({ activo: false })
    const recorrido = await recorrerPaginas({
      peticion,
      base,
      token,
      ruta: '/sucursales',
      query: 'activo=false',
      porPagina: 100,
    })
    const despues = await contarSucursalesBd({ activo: false })
    const ids = recorrido.items.map((s) => s.id)
    const estable =
      antes === despues &&
      recorrido.total === antes &&
      recorrido.totalPaginas === Math.ceil(antes / 100) &&
      ids.length === antes &&
      new Set(ids).size === antes
    if (estable) resultado = { ...recorrido, ids, sqlTotal: antes }
  }

  assert.ok(
    resultado,
    'no se obtuvo una lectura estable (cambios concurrentes entre paginas)',
  )
  for (const s of resultado.items) assertSucursal(s)

  const control = await pool.query(
    `SELECT id FROM sucursal
      WHERE empresa_id = $1 AND activo = false
      ORDER BY nombre ASC, id ASC`,
    [1],
  )
  assert.deepEqual(
    resultado.ids,
    control.rows.map((f) => Number(f.id)),
    'orden determinista por nombre ASC, id ASC',
  )
})

test('GET /sucursales pagina/por_pagina invalidos -> 400', async (t) => {
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
      const r = await peticion(base, `/sucursales?${caso}`, { token })
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
// Tipos: id Number
// ---------------------------------------------------------------------------

test('id llega como Number en POST, GET y listado', async () => {
  const c = await crear({ nombre: nombreUnico('QA-SUC-NUM') })
  const id = c.cuerpo.data.sucursal.id
  assert.equal(typeof id, 'number')

  const g = await peticion(base, `/sucursales/${id}`, { token })
  assert.equal(typeof g.cuerpo.data.sucursal.id, 'number')
  assert.equal(g.cuerpo.data.sucursal.id, id)

  const lista = await peticion(base, '/sucursales?activo=true&por_pagina=100', { token })
  const data = assertSobrePagina(lista.cuerpo)
  for (const s of data.items) {
    assert.equal(typeof s.id, 'number', `id no numerico en listado: ${JSON.stringify(s.id)}`)
  }
})
