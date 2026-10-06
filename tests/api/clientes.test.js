/*
 * SD-004 - Verificacion independiente de la gestion de clientes (/api/v1/clientes).
 * Runner nativo de Node 24 + fetch. La app se levanta en un puerto efimero.
 *
 * Estrategia de aislamiento (node --test corre los archivos en paralelo):
 *   - Se crean DOS sucursales propias `QA-*` (empresa 1) y TODOS los clientes de
 *     la suite viven en ellas. El listado se acota por `sucursal_id`, de modo que
 *     `total` = COUNT exacto de los fixtures y no depende del catalogo acumulado
 *     de otras suites.
 *   - Las busquedas usan marcas unicas (`codigoUnico`) para no colisionar.
 *
 * Datos: los clientes se crean con `POST /clientes`; los componentes opcionales
 * de unicidad (varios `NULL`, mismo documento en otra sucursal) se prueban con
 * fixtures `QA-*`. Al terminar se hace borrado logico (PATCH `activo=false`) de
 * clientes y sucursales creados; NUNCA DELETE/TRUNCATE/DROP. El endpoint no tiene
 * transaccion ni stock (es catalogo).
 *
 * Multi-tenant: la empresa real es la 1. Para sondear IDOR se firman tokens de
 * la empresa 999 (inexistente) y de la empresa 3 ("QA Empresa Ajena"), reusando
 * las utilidades de las suites previas. El secreto lo resuelve `server/config`.
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
const { assertSobrePagina } = require('../utilidades/paginacion')

const jwt = requerirServidor('jsonwebtoken')
const { pool } = requerirServidor('./db/pool')

let servidor
let base
let token
let tokenSuper
let tokenAjeno
let tokenEmpresa3

// Recursos QA creados por la suite (se desactivan al final, no se borran).
const sucursalesCreadas = []
const clientesCreados = []
const productosCreados = []

let sucursalA
let sucursalB
let nombreA
let nombreB

// Fixture del listado paginado (12 clientes activos en A).
const marcaPag = codigoUnico('QACLIPAG')
const N_PAG = 12
// Fixture de filtros combinados (1 activo A, 1 inactivo A, 1 activo B).
const marcaFiltro = codigoUnico('QACLIFIL')
let clienteActivoA
let clienteInactivoA
let clienteActivoB
// Fixture de busqueda literal (`%` y `_` no deben actuar como comodines).
const marcaEspecial = codigoUnico('QACLIESP')
let clientePorcentaje
let clienteGuionBajo
let clienteNormalEsp

// Claves exactas del contrato `Cliente` (ordenadas; sin empresa_id).
const CLAVES_CLIENTE = [
  'activo',
  'actualizado_en',
  'correo',
  'creado_en',
  'direccion',
  'documento',
  'id',
  'nombre',
  'sucursal_id',
  'sucursal_nombre',
  'telefono',
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

// Valida la forma EXACTA del contrato `Cliente` y el casteo bigint -> Number.
function assertCliente(cliente) {
  assert.deepEqual(
    Object.keys(cliente).sort(),
    CLAVES_CLIENTE,
    `forma exacta de Cliente, se obtuvo ${JSON.stringify(Object.keys(cliente).sort())}`,
  )
  assert.equal(typeof cliente.id, 'number', 'id debe ser Number')
  assert.ok(cliente.id > 0)
  assert.equal(typeof cliente.sucursal_id, 'number', 'sucursal_id debe ser Number')
  assert.ok(cliente.sucursal_id > 0)
  assert.equal(typeof cliente.sucursal_nombre, 'string', 'sucursal_nombre debe ser string')
  assert.ok(cliente.sucursal_nombre.length > 0, 'sucursal_nombre no debe estar vacio')
  assert.equal(typeof cliente.nombre, 'string', 'nombre debe ser string')
  for (const campo of ['documento', 'telefono', 'correo', 'direccion']) {
    assert.ok(
      cliente[campo] === null || typeof cliente[campo] === 'string',
      `${campo} debe ser string o null, se obtuvo ${JSON.stringify(cliente[campo])}`,
    )
  }
  assert.equal(typeof cliente.activo, 'boolean', 'activo debe ser boolean')
  assert.equal(typeof cliente.creado_en, 'string', 'creado_en debe ser string ISO')
  assert.equal(typeof cliente.actualizado_en, 'string', 'actualizado_en debe ser string ISO')
  assert.ok(!('empresa_id' in cliente), 'Cliente no debe exponer empresa_id')
}

// Documento unico y claramente identificable, SIEMPRE <=30 (varchar(30)).
const documentoUnico = () => codigoUnico('D').slice(0, 30)

// COUNT SQL de control con los MISMOS filtros del repositorio.
async function contarClientesBd({ sucursalId, activo, buscar } = {}) {
  const condiciones = ['s.empresa_id = $1']
  const valores = [1]

  if (sucursalId !== undefined) {
    valores.push(sucursalId)
    condiciones.push(`c.sucursal_id = $${valores.length}`)
  }
  if (activo !== undefined) {
    valores.push(activo)
    condiciones.push(`c.activo = $${valores.length}`)
  }
  if (buscar !== undefined) {
    valores.push(`%${buscar.replace(/[\\%_]/g, (caracter) => `\\${caracter}`)}%`)
    condiciones.push(
      `(c.nombre ILIKE $${valores.length} ESCAPE '\\' OR c.documento ILIKE $${valores.length} ESCAPE '\\')`,
    )
  }

  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total
       FROM cliente c
       JOIN sucursal s ON s.id = c.sucursal_id
      WHERE ${condiciones.join(' AND ')}`,
    valores,
  )
  return rows[0].total
}

async function crearSucursal(nombre) {
  const r = await peticion(base, '/sucursales', {
    metodo: 'POST',
    token,
    cuerpo: { nombre },
  })
  assert.equal(r.status, 201, `crear sucursal: ${JSON.stringify(r.cuerpo)}`)
  const sucursal = r.cuerpo.data.sucursal
  sucursalesCreadas.push(sucursal.id)
  return sucursal
}

// Crea un cliente por HTTP y registra su id para la limpieza final.
async function crearCliente(cuerpo, opciones = {}) {
  const r = await peticion(base, '/clientes', {
    metodo: 'POST',
    token: 'token' in opciones ? opciones.token : token,
    cuerpo,
  })
  if (r.status === 201 && r.cuerpo?.data?.cliente?.id) {
    clientesCreados.push(r.cuerpo.data.cliente.id)
  }
  return r
}

function editarCliente(id, cuerpo, opciones = {}) {
  return peticion(base, `/clientes/${id}`, {
    metodo: 'PATCH',
    token: 'token' in opciones ? opciones.token : token,
    cuerpo,
  })
}

before(async () => {
  servidor = await iniciarServidor()
  base = servidor.urlBase
  token = tokenAdmin()
  tokenSuper = tokenSuperadmin()
  tokenAjeno = tokenOtraEmpresa()
  tokenEmpresa3 = firmarToken({
    id: 9,
    empresa_id: 3,
    nombre: 'QA Clientes Empresa Ajena',
    correo: 'qa.clientes.empresa3@stockdaily.test',
    rol: 'administrador',
  })

  sucursalA = await crearSucursal(nombreUnico('QA-CLI-SUC-A'))
  sucursalB = await crearSucursal(nombreUnico('QA-CLI-SUC-B'))
  nombreA = sucursalA.nombre
  nombreB = sucursalB.nombre

  // 12 clientes activos en A para el listado default 1/10 y el orden.
  for (let n = 1; n <= N_PAG; n += 1) {
    const sufijo = String(n).padStart(2, '0')
    const c = await crearCliente({
      sucursal_id: sucursalA.id,
      nombre: `${marcaPag} ${sufijo}`,
    })
    assert.equal(c.status, 201, JSON.stringify(c.cuerpo))
  }

  // Filtros combinados: activo A, inactivo A y activo B con la misma marca.
  const activoA = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre: `${marcaFiltro} Activo`,
    documento: documentoUnico(),
  })
  assert.equal(activoA.status, 201)
  clienteActivoA = activoA.cuerpo.data.cliente.id

  const inactivoA = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre: `${marcaFiltro} Inactivo`,
  })
  assert.equal(inactivoA.status, 201)
  clienteInactivoA = inactivoA.cuerpo.data.cliente.id
  const off = await editarCliente(clienteInactivoA, { activo: false })
  assert.equal(off.status, 200, JSON.stringify(off.cuerpo))

  const activoB = await crearCliente({
    sucursal_id: sucursalB.id,
    nombre: `${marcaFiltro} Activo B`,
  })
  assert.equal(activoB.status, 201)
  clienteActivoB = activoB.cuerpo.data.cliente.id

  // Busqueda literal: nombres con `%`, `_` y un control.
  const porcentaje = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre: `${marcaEspecial} 100%`,
  })
  assert.equal(porcentaje.status, 201)
  clientePorcentaje = porcentaje.cuerpo.data.cliente.id

  const guionBajo = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre: `${marcaEspecial} a_b`,
  })
  assert.equal(guionBajo.status, 201)
  clienteGuionBajo = guionBajo.cuerpo.data.cliente.id

  const normal = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre: `${marcaEspecial} normal`,
  })
  assert.equal(normal.status, 201)
  clienteNormalEsp = normal.cuerpo.data.cliente.id
})

after(async () => {
  // Borrado logico de todo lo creado: activo=false. Nunca se borra.
  if (base) {
    for (const id of clientesCreados) {
      try {
        await editarCliente(id, { activo: false })
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

test('sin token responde 401 en los 4 endpoints', async () => {
  const casos = [
    ['GET /clientes', { metodo: 'GET', ruta: '/clientes' }],
    ['POST /clientes', { metodo: 'POST', ruta: '/clientes', cuerpo: {} }],
    ['GET /clientes/:id', { metodo: 'GET', ruta: '/clientes/1' }],
    ['PATCH /clientes/:id', { metodo: 'PATCH', ruta: '/clientes/1', cuerpo: { nombre: 'X' } }],
  ]
  for (const [descripcion, caso] of casos) {
    const r = await peticion(base, caso.ruta, { metodo: caso.metodo, cuerpo: caso.cuerpo })
    assert.equal(r.status, 401, `${descripcion}: esperaba 401, obtuve ${r.status}`)
    assertSobreError(r.cuerpo)
  }
})

test('token malformado y token de otro secreto responden 401', async () => {
  const malformado = await peticion(base, '/clientes', { token: 'esto-no-es-un-jwt' })
  assert.equal(malformado.status, 401)
  assertSobreError(malformado.cuerpo)

  const falso = jwt.sign({ id: 1, empresa_id: 1, rol: 'administrador' }, 'secreto-ajeno')
  const r = await peticion(base, '/clientes', { token: falso })
  assert.equal(r.status, 401)
  assertSobreError(r.cuerpo)
})

test('superadmin recibe 403 en los 4 endpoints', async () => {
  const casos = [
    ['GET /clientes', { metodo: 'GET', ruta: '/clientes' }],
    ['POST /clientes', { metodo: 'POST', ruta: '/clientes', cuerpo: { sucursal_id: sucursalA.id, nombre: nombreUnico('QA-CLI-403') } }],
    ['GET /clientes/:id', { metodo: 'GET', ruta: '/clientes/1' }],
    ['PATCH /clientes/:id', { metodo: 'PATCH', ruta: '/clientes/1', cuerpo: { nombre: 'X' } }],
  ]
  for (const [descripcion, caso] of casos) {
    const r = await peticion(base, caso.ruta, {
      metodo: caso.metodo,
      token: tokenSuper,
      cuerpo: caso.cuerpo,
    })
    assert.equal(r.status, 403, `${descripcion}: esperaba 403, obtuve ${r.status}`)
    assertSobreError(r.cuerpo)
  }
})

test('rol distinto de administrador y administrador sin empresa responden 403', async () => {
  const cajero = firmarToken({ id: 1, empresa_id: 1, rol: 'cajero' })
  const rCajero = await peticion(base, '/clientes', { token: cajero })
  assert.equal(rCajero.status, 403)
  assertSobreError(rCajero.cuerpo)

  const sinEmpresa = firmarToken({ id: 77, empresa_id: null, rol: 'administrador' })
  const rSin = await peticion(base, '/clientes', { token: sinEmpresa })
  assert.equal(rSin.status, 403)
  assertSobreError(rSin.cuerpo)
})

// ---------------------------------------------------------------------------
// Caso feliz: POST /clientes
// ---------------------------------------------------------------------------

test('POST 201: sobre, forma exacta de Cliente y sucursal_nombre', async () => {
  const nombre = nombreUnico('QA-CLI-CRUD')
  const r = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre,
    documento: documentoUnico(),
    telefono: '+57 300 123 4567',
    correo: 'cliente.qa@stockdaily.test',
    direccion: 'Calle 12 #34-56',
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['cliente'])

  const c = r.cuerpo.data.cliente
  assertCliente(c)
  assert.equal(c.nombre, nombre)
  assert.equal(c.sucursal_id, sucursalA.id)
  assert.equal(c.sucursal_nombre, nombreA)
  assert.equal(c.telefono, '+57 300 123 4567')
  assert.equal(c.correo, 'cliente.qa@stockdaily.test')
  assert.equal(c.direccion, 'Calle 12 #34-56')
  assert.equal(c.activo, true)
})

test('POST sin opcionales y con vacios/null los normaliza a null', async () => {
  const sinOpcionales = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre: nombreUnico('QA-CLI-DEF'),
  })
  assert.equal(sinOpcionales.status, 201, JSON.stringify(sinOpcionales.cuerpo))
  const c1 = sinOpcionales.cuerpo.data.cliente
  assertCliente(c1)
  for (const campo of ['documento', 'telefono', 'correo', 'direccion']) {
    assert.equal(c1[campo], null, `${campo} debe ser null`)
  }

  const vacios = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre: nombreUnico('QA-CLI-VACIO'),
    documento: '   ',
    telefono: '',
    correo: null,
    direccion: '   ',
  })
  assert.equal(vacios.status, 201, JSON.stringify(vacios.cuerpo))
  const c2 = vacios.cuerpo.data.cliente
  for (const campo of ['documento', 'telefono', 'correo', 'direccion']) {
    assert.equal(c2[campo], null, `${campo} debe ser null`)
  }
})

test('POST /clientes validaciones 400 (nunca 500)', async (t) => {
  const casos = [
    ['cuerpo vacio', {}],
    ['cuerpo null', null],
    ['cuerpo arreglo', [{ sucursal_id: sucursalA.id, nombre: 'X' }]],
    ['sin sucursal_id', { nombre: nombreUnico() }],
    ['sucursal_id no numerico', { sucursal_id: 'abc', nombre: nombreUnico() }],
    ['sucursal_id cero', { sucursal_id: 0, nombre: nombreUnico() }],
    ['sucursal_id decimal', { sucursal_id: 1.5, nombre: nombreUnico() }],
    ['sucursal_id fuera de rango bigint', { sucursal_id: 9223372036854775808, nombre: nombreUnico() }],
    ['sin nombre', { sucursal_id: sucursalA.id }],
    ['nombre vacio', { sucursal_id: sucursalA.id, nombre: '   ' }],
    ['nombre no texto', { sucursal_id: sucursalA.id, nombre: 123 }],
    ['nombre mayor a 150', { sucursal_id: sucursalA.id, nombre: 'A'.repeat(151) }],
    ['documento mayor a 30', { sucursal_id: sucursalA.id, nombre: nombreUnico(), documento: 'D'.repeat(31) }],
    ['documento no texto', { sucursal_id: sucursalA.id, nombre: nombreUnico(), documento: 5 }],
    ['telefono mayor a 30', { sucursal_id: sucursalA.id, nombre: nombreUnico(), telefono: 'T'.repeat(31) }],
    ['correo con formato invalido', { sucursal_id: sucursalA.id, nombre: nombreUnico(), correo: 'no-es-correo' }],
    ['correo mayor a 150', { sucursal_id: sucursalA.id, nombre: nombreUnico(), correo: `${'a'.repeat(145)}@x.com` }],
    ['direccion mayor a 200', { sucursal_id: sucursalA.id, nombre: nombreUnico(), direccion: 'D'.repeat(201) }],
  ]

  for (const [descripcion, cuerpo] of casos) {
    await t.test(descripcion, async () => {
      const r = await peticion(base, '/clientes', { metodo: 'POST', token, cuerpo })
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

test('POST acepta longitudes en el limite exacto', async () => {
  const r = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre: 'A'.repeat(150),
    documento: 'D'.repeat(30),
    telefono: 'T'.repeat(30),
    correo: `${'c'.repeat(144)}@x.co`,
    direccion: 'Z'.repeat(200),
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  const c = r.cuerpo.data.cliente
  assert.equal(c.nombre.length, 150)
  assert.equal(c.documento.length, 30)
  assert.equal(c.telefono.length, 30)
  assert.equal(c.direccion.length, 200)
})

test('POST ignora empresa_id y campos extra (no aparecen en el sobre)', async () => {
  const nombre = nombreUnico('QA-CLI-EXTRA')
  const r = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre,
    empresa_id: 999,
    creado_en: '1970-01-01T00:00:00.000Z',
    campo_desconocido: 'x',
    activo: false,
  })
  assert.equal(r.status, 201, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  // `activo` no es parte del POST: nace activo.
  assert.equal(r.cuerpo.data.cliente.activo, true)

  // Pertenece a la empresa 1 (la del token), no a la 999.
  const { rows } = await pool.query(
    `SELECT s.empresa_id
       FROM cliente c JOIN sucursal s ON s.id = c.sucursal_id
      WHERE c.id = $1`,
    [r.cuerpo.data.cliente.id],
  )
  assert.equal(Number(rows[0].empresa_id), 1)
})

// ---------------------------------------------------------------------------
// Unicidad (409) y sucursal (404)
// ---------------------------------------------------------------------------

test('documento duplicado en la misma sucursal responde 409', async () => {
  const documento = documentoUnico()
  const a = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico(), documento })
  assert.equal(a.status, 201, JSON.stringify(a.cuerpo))

  const repetido = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico(), documento })
  assert.equal(repetido.status, 409, JSON.stringify(repetido.cuerpo))
  assertSobreError(repetido.cuerpo)

  // No se creo una segunda fila con ese documento en la sucursal.
  const total = await contarClientesBd({ sucursalId: sucursalA.id, buscar: documento })
  assert.equal(total, 1)
})

test('varios clientes sin documento (NULL) en la misma sucursal son validos', async () => {
  const a = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico('QA-CLI-NULL') })
  const b = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico('QA-CLI-NULL') })
  const c = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico('QA-CLI-NULL'), documento: '' })
  assert.equal(a.status, 201, JSON.stringify(a.cuerpo))
  assert.equal(b.status, 201, JSON.stringify(b.cuerpo))
  assert.equal(c.status, 201, JSON.stringify(c.cuerpo))
  assert.equal(a.cuerpo.data.cliente.documento, null)
  assert.equal(b.cuerpo.data.cliente.documento, null)
  assert.equal(c.cuerpo.data.cliente.documento, null)
})

test('el mismo documento en sucursales distintas es valido', async () => {
  const documento = documentoUnico()
  const a = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico(), documento })
  const b = await crearCliente({ sucursal_id: sucursalB.id, nombre: nombreUnico(), documento })
  assert.equal(a.status, 201, JSON.stringify(a.cuerpo))
  assert.equal(b.status, 201, JSON.stringify(b.cuerpo))
  assert.equal(a.cuerpo.data.cliente.documento, documento)
  assert.equal(b.cuerpo.data.cliente.documento, documento)
  assert.equal(a.cuerpo.data.cliente.sucursal_id, sucursalA.id)
  assert.equal(b.cuerpo.data.cliente.sucursal_id, sucursalB.id)
})

test('POST con sucursal inexistente o ajena responde 404 (sin crear)', async () => {
  const inexistente = await crearCliente({
    sucursal_id: 99999999,
    nombre: nombreUnico('QA-CLI-404'),
  })
  assert.equal(inexistente.status, 404, JSON.stringify(inexistente.cuerpo))
  assertSobreError(inexistente.cuerpo)

  // Token de otra empresa con la sucursal (real) de la empresa 1.
  const ajena = await crearCliente(
    { sucursal_id: sucursalA.id, nombre: nombreUnico('QA-CLI-404-AJENA') },
    { token: tokenAjeno },
  )
  assert.equal(ajena.status, 404, JSON.stringify(ajena.cuerpo))
  assertSobreError(ajena.cuerpo)
})

// ---------------------------------------------------------------------------
// Listado (GET /clientes): defaults, filtros, orden, sucursal_nombre, 400
// ---------------------------------------------------------------------------

test('GET default pagina=1 y por_pagina=10 con sobre exacto', async () => {
  const r = await peticion(base, `/clientes?buscar=${encodeURIComponent(marcaPag)}`, { token })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  const data = assertSobrePagina(r.cuerpo, {
    pagina: 1,
    por_pagina: 10,
    total: N_PAG,
    total_paginas: Math.ceil(N_PAG / 10),
  })
  assert.equal(data.items.length, 10)
  for (const c of data.items) assertCliente(c)
})

test('GET pagina=2 con por_pagina=5 respeta el tamano, el sobre y el orden', async () => {
  const r = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalA.id}&buscar=${encodeURIComponent(marcaPag)}&pagina=2&por_pagina=5`,
    { token },
  )
  const data = assertSobrePagina(r.cuerpo, {
    pagina: 2,
    por_pagina: 5,
    total: N_PAG,
    total_paginas: Math.ceil(N_PAG / 5),
  })
  assert.equal(data.items.length, 5)
  for (const c of data.items) assertCliente(c)

  // Una sola pagina exacta: 12 items en la pagina 1 con por_pagina=12.
  const exacta = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalA.id}&buscar=${encodeURIComponent(marcaPag)}&pagina=1&por_pagina=12`,
    { token },
  )
  const dataExacta = assertSobrePagina(exacta.cuerpo, {
    pagina: 1,
    por_pagina: 12,
    total: N_PAG,
    total_paginas: 1,
  })
  assert.equal(dataExacta.items.length, N_PAG)
})

test('GET filtros combinados y total = COUNT SQL', async () => {
  const base2 = `sucursal_id=${sucursalA.id}&buscar=${encodeURIComponent(marcaFiltro)}&por_pagina=100`

  const todos = await peticion(base, `/clientes?${base2}`, { token })
  const dataTodos = assertSobrePagina(todos.cuerpo, { total: 2 })
  assert.equal(dataTodos.total, await contarClientesBd({ sucursalId: sucursalA.id, buscar: marcaFiltro }))
  const idsTodos = dataTodos.items.map((c) => c.id).sort((a, b) => a - b)
  assert.deepEqual(idsTodos, [clienteActivoA, clienteInactivoA].sort((a, b) => a - b))

  const activos = await peticion(base, `/clientes?${base2}&activo=true`, { token })
  const dataActivos = assertSobrePagina(activos.cuerpo, { total: 1 })
  assert.deepEqual(dataActivos.items.map((c) => c.id), [clienteActivoA])
  assert.equal(
    dataActivos.total,
    await contarClientesBd({ sucursalId: sucursalA.id, buscar: marcaFiltro, activo: true }),
  )

  const inactivos = await peticion(base, `/clientes?${base2}&activo=false`, { token })
  const dataInactivos = assertSobrePagina(inactivos.cuerpo, { total: 1 })
  assert.deepEqual(dataInactivos.items.map((c) => c.id), [clienteInactivoA])
  assert.equal(
    dataInactivos.total,
    await contarClientesBd({ sucursalId: sucursalA.id, buscar: marcaFiltro, activo: false }),
  )

  // La sucursal B tiene su propio activo con la misma marca.
  const enB = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalB.id}&buscar=${encodeURIComponent(marcaFiltro)}&activo=true`,
    { token },
  )
  const dataB = assertSobrePagina(enB.cuerpo, { total: 1 })
  assert.deepEqual(dataB.items.map((c) => c.id), [clienteActivoB])
})

test('GET orden nombre ASC, id ASC y cada item con sucursal_nombre', async () => {
  const r = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalA.id}&buscar=${encodeURIComponent(marcaPag)}&por_pagina=100`,
    { token },
  )
  const data = assertSobrePagina(r.cuerpo, { total: N_PAG })
  assert.equal(data.items.length, N_PAG)
  for (const c of data.items) {
    assertCliente(c)
    assert.equal(c.sucursal_nombre, nombreA)
  }

  const { rows } = await pool.query(
    `SELECT c.id
       FROM cliente c JOIN sucursal s ON s.id = c.sucursal_id
      WHERE s.empresa_id = $1 AND c.sucursal_id = $2 AND c.nombre ILIKE $3
      ORDER BY c.nombre ASC, c.id ASC`,
    [1, sucursalA.id, `%${marcaPag}%`],
  )
  assert.deepEqual(
    data.items.map((c) => c.id),
    rows.map((fila) => Number(fila.id)),
    'el orden debe ser nombre ASC, id ASC',
  )
})

test('GET buscar con % y _ los trata como texto literal', async () => {
  // Debe coincidir SOLO el cliente cuyo nombre contiene el caracter literal.
  const porcentaje = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalA.id}&buscar=%25&por_pagina=100`,
    { token },
  )
  const dataPorcentaje = assertSobrePagina(porcentaje.cuerpo, { total: 1 })
  assert.deepEqual(dataPorcentaje.items.map((c) => c.id), [clientePorcentaje])

  const guion = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalA.id}&buscar=_&por_pagina=100`,
    { token },
  )
  const dataGuion = assertSobrePagina(guion.cuerpo, { total: 1 })
  assert.deepEqual(dataGuion.items.map((c) => c.id), [clienteGuionBajo])

  // Control: la marca completa encuentra los tres fixtures.
  const control = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalA.id}&buscar=${encodeURIComponent(marcaEspecial)}&por_pagina=100`,
    { token },
  )
  const dataControl = assertSobrePagina(control.cuerpo, { total: 3 })
  assert.deepEqual(
    dataControl.items.map((c) => c.id).sort((a, b) => a - b),
    [clientePorcentaje, clienteGuionBajo, clienteNormalEsp].sort((a, b) => a - b),
  )
})

test('GET buscar tambien encuentra por documento', async () => {
  const documento = documentoUnico()
  const c = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre: nombreUnico('QA-CLI-PORDOC'),
    documento,
  })
  assert.equal(c.status, 201, JSON.stringify(c.cuerpo))
  const id = c.cuerpo.data.cliente.id

  const r = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalA.id}&buscar=${encodeURIComponent(documento)}&por_pagina=100`,
    { token },
  )
  const data = assertSobrePagina(r.cuerpo, { total: 1 })
  assert.deepEqual(data.items.map((item) => item.id), [id])
})

test('GET buscar sin coincidencias responde 200 con items vacio y total 0', async () => {
  const r = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalA.id}&buscar=${encodeURIComponent(codigoUnico('QACLIX'))}`,
    { token },
  )
  const data = assertSobrePagina(r.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(data.items, [])
})

test('GET 400 en paginacion y filtros invalidos (nunca 500)', async (t) => {
  const casos = [
    'pagina=0',
    'pagina=-1',
    'pagina=1.5',
    'pagina=abc',
    'por_pagina=0',
    'por_pagina=101',
    'por_pagina=1.5',
    'sucursal_id=0',
    'sucursal_id=-1',
    'sucursal_id=abc',
    'sucursal_id=1.5',
    'activo=si',
    'activo=1',
    `buscar=${encodeURIComponent('A'.repeat(151))}`,
  ]
  for (const caso of casos) {
    await t.test(caso, async () => {
      const r = await peticion(base, `/clientes?${caso}`, { token })
      assert.notEqual(r.status, 500, `${caso}: nunca 500 ${JSON.stringify(r.cuerpo)}`)
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
// GET /clientes/:id
// ---------------------------------------------------------------------------

test('GET /clientes/:id devuelve el cliente propio (200)', async () => {
  const c = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico('QA-CLI-OBT') })
  const id = c.cuerpo.data.cliente.id

  const r = await peticion(base, `/clientes/${id}`, { token })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  assert.deepEqual(Object.keys(r.cuerpo.data), ['cliente'])
  assertCliente(r.cuerpo.data.cliente)
  assert.equal(r.cuerpo.data.cliente.id, id)
  assert.equal(r.cuerpo.data.cliente.sucursal_nombre, nombreA)
})

test('GET /clientes/:id inexistente responde 404', async () => {
  const r = await peticion(base, '/clientes/99999999', { token })
  assert.equal(r.status, 404, JSON.stringify(r.cuerpo))
  assertSobreError(r.cuerpo)
})

test('GET/PATCH con :id invalido responde 400 (nunca 500)', async (t) => {
  const invalidos = ['abc', '1.5', '0', '-3', '1e5', '9223372036854775808', '99999999999999999999999999']
  for (const id of invalidos) {
    await t.test(id, async () => {
      const g = await peticion(base, `/clientes/${id}`, { token })
      assert.notEqual(g.status, 500, `GET ${id}: nunca 500 ${JSON.stringify(g.cuerpo)}`)
      assert.equal(g.status, 400, `GET ${id}: esperaba 400, obtuve ${g.status}`)
      assertSobreError(g.cuerpo)

      const p = await editarCliente(id, { nombre: nombreUnico() })
      assert.notEqual(p.status, 500, `PATCH ${id}: nunca 500 ${JSON.stringify(p.cuerpo)}`)
      assert.equal(p.status, 400, `PATCH ${id}: esperaba 400, obtuve ${p.status}`)
      assertSobreError(p.cuerpo)
    })
  }
})

// ---------------------------------------------------------------------------
// PATCH /clientes/:id
// ---------------------------------------------------------------------------

test('PATCH edita solo los campos presentes y conserva el resto', async () => {
  const nombre = nombreUnico('QA-CLI-PATCH')
  const documento = documentoUnico()
  const c = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre,
    documento,
    telefono: '111',
  })
  const id = c.cuerpo.data.cliente.id

  const r = await editarCliente(id, {
    telefono: '222',
    correo: 'nuevo.qa@stockdaily.test',
    direccion: 'Calle Nueva 99',
  })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assertSobreExito(r.cuerpo)
  const editado = r.cuerpo.data.cliente
  assertCliente(editado)
  assert.equal(editado.id, id)
  assert.equal(editado.nombre, nombre, 'el nombre no enviado permanece')
  assert.equal(editado.documento, documento, 'el documento no enviado permanece')
  assert.equal(editado.sucursal_id, sucursalA.id)
  assert.equal(editado.telefono, '222')
  assert.equal(editado.correo, 'nuevo.qa@stockdaily.test')
  assert.equal(editado.direccion, 'Calle Nueva 99')
})

test('PATCH activo:false desactiva y activo:true reactiva (borrado logico)', async () => {
  const c = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico('QA-CLI-ESTADO') })
  const id = c.cuerpo.data.cliente.id

  const off = await editarCliente(id, { activo: false })
  assert.equal(off.status, 200, JSON.stringify(off.cuerpo))
  assert.equal(off.cuerpo.data.cliente.activo, false, 'el nombre no enviado permanece')
  assert.equal(off.cuerpo.data.cliente.nombre, c.cuerpo.data.cliente.nombre)

  const aunVisible = await peticion(base, `/clientes/${id}`, { token })
  assert.equal(aunVisible.status, 200, 'el borrado es logico, la fila sigue')
  assert.equal(aunVisible.cuerpo.data.cliente.activo, false)

  const on = await editarCliente(id, { activo: true })
  assert.equal(on.status, 200)
  assert.equal(on.cuerpo.data.cliente.activo, true)
})

test('PATCH sin campos responde 400; activo no booleano y nombre largo 400', async () => {
  const c = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico('QA-CLI-VAL') })
  const id = c.cuerpo.data.cliente.id

  const vacio = await editarCliente(id, {})
  assert.equal(vacio.status, 400, JSON.stringify(vacio.cuerpo))
  assertSobreError(vacio.cuerpo)

  for (const activo of [1, 0, 'si', null]) {
    const r = await editarCliente(id, { activo })
    assert.equal(r.status, 400, `activo=${JSON.stringify(activo)} debia ser 400`)
    assertSobreError(r.cuerpo)
  }

  const largo = await editarCliente(id, { nombre: 'A'.repeat(151) })
  assert.equal(largo.status, 400)
  assertSobreError(largo.cuerpo)
})

test('PATCH ignora sucursal_id: no mueve al cliente', async () => {
  const c = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico('QA-CLI-MOVER') })
  const id = c.cuerpo.data.cliente.id

  const r = await editarCliente(id, {
    sucursal_id: sucursalB.id,
    nombre: `${c.cuerpo.data.cliente.nombre} editado`,
  })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assert.equal(r.cuerpo.data.cliente.sucursal_id, sucursalA.id, 'la sucursal no debe cambiar')
  assert.equal(r.cuerpo.data.cliente.sucursal_nombre, nombreA)

  const enB = await peticion(base, `/clientes/${id}`, { token })
  assert.equal(enB.cuerpo.data.cliente.sucursal_id, sucursalA.id)
})

test('PATCH documento duplicado en la misma sucursal responde 409; el propio no', async () => {
  const documento = documentoUnico()
  const a = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico(), documento })
  const b = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico(), documento: documentoUnico() })
  assert.equal(a.status, 201)
  assert.equal(b.status, 201)

  const choque = await editarCliente(b.cuerpo.data.cliente.id, { documento })
  assert.equal(choque.status, 409, JSON.stringify(choque.cuerpo))
  assertSobreError(choque.cuerpo)

  // Reenviar el documento propio no debe dar 409.
  const propio = await editarCliente(b.cuerpo.data.cliente.id, {
    documento: b.cuerpo.data.cliente.documento,
  })
  assert.equal(propio.status, 200, JSON.stringify(propio.cuerpo))
})

test('PATCH puede usar un documento que solo existe en otra sucursal', async () => {
  const documento = documentoUnico()
  const a = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico(), documento })
  const b = await crearCliente({ sucursal_id: sucursalB.id, nombre: nombreUnico() })
  assert.equal(a.status, 201)
  assert.equal(b.status, 201)

  const r = await editarCliente(b.cuerpo.data.cliente.id, { documento })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assert.equal(r.cuerpo.data.cliente.documento, documento)
})

test('PATCH inexistente/ajena responde 404 (IDOR) y no altera el original', async () => {
  const c = await crearCliente({ sucursal_id: sucursalA.id, nombre: nombreUnico('QA-CLI-404P') })
  const id = c.cuerpo.data.cliente.id

  const g = await peticion(base, `/clientes/${id}`, { token: tokenAjeno })
  assert.equal(g.status, 404, JSON.stringify(g.cuerpo))
  assertSobreError(g.cuerpo)

  const p = await editarCliente(id, { nombre: 'Intento ajeno' }, { token: tokenAjeno })
  assert.equal(p.status, 404, JSON.stringify(p.cuerpo))
  assertSobreError(p.cuerpo)

  const propio = await peticion(base, `/clientes/${id}`, { token })
  assert.equal(propio.status, 200)
  assert.notEqual(propio.cuerpo.data.cliente.nombre, 'Intento ajeno')

  const inexistente = await editarCliente(99999999, { activo: false })
  assert.equal(inexistente.status, 404)
  assertSobreError(inexistente.cuerpo)
})

// ---------------------------------------------------------------------------
// Multi-tenant / IDOR
// ---------------------------------------------------------------------------

test('IDOR: token de otra empresa no ve ni afecta clientes de la empresa 1', async () => {
  // Listado: la empresa 999 no tiene datos.
  const listaAjena = await peticion(base, '/clientes?por_pagina=100', { token: tokenAjeno })
  assert.equal(listaAjena.status, 200)
  const dataAjena = assertSobrePagina(listaAjena.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(dataAjena.items, [])

  // Filtro por la sucursal real (empresa 1) con token de empresa 3 -> vacio.
  const listaEmpresa3 = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalA.id}&por_pagina=100`,
    { token: tokenEmpresa3 },
  )
  const dataEmpresa3 = assertSobrePagina(listaEmpresa3.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(dataEmpresa3.items, [])
})

test('IDOR: empresa_id falso en query/body se ignora (tenant del token)', async () => {
  // Query: filtrar por la sucursal propia con empresa_id=999 debe seguir contando
  // lo de la empresa 1 (del token).
  const r = await peticion(
    base,
    `/clientes?sucursal_id=${sucursalA.id}&empresa_id=999&buscar=${encodeURIComponent(marcaPag)}&por_pagina=100`,
    { token },
  )
  const data = assertSobrePagina(r.cuerpo, { total: N_PAG })
  assert.equal(data.total, await contarClientesBd({ sucursalId: sucursalA.id, buscar: marcaPag }))

  // Body: el POST con empresa_id=999 ya se probo arriba; aqui se repite para
  // confirmar que el cliente queda en la sucursal real de la empresa 1.
  const c = await crearCliente({
    sucursal_id: sucursalB.id,
    nombre: nombreUnico('QA-CLI-IDOR'),
    empresa_id: 999,
  })
  assert.equal(c.status, 201, JSON.stringify(c.cuerpo))
  assert.equal(c.cuerpo.data.cliente.sucursal_id, sucursalB.id)
  assert.equal(c.cuerpo.data.cliente.sucursal_nombre, nombreB)
})

test('EC-005: filtro por sucursal de otra empresa/inexistente -> lista vacia 200', async () => {
  const r = await peticion(base, '/clientes?sucursal_id=99999999&por_pagina=100', { token })
  assert.equal(r.status, 200)
  const data = assertSobrePagina(r.cuerpo, { total: 0, total_paginas: 0 })
  assert.deepEqual(data.items, [])
})

// ---------------------------------------------------------------------------
// Traduccion de errores de PostgreSQL (23505 -> 409, 22003 -> 400)
// ---------------------------------------------------------------------------

test('servicio: 23505 -> 409 y 22003 -> 400 (defensa en profundidad)', async (t) => {
  const servicioClientes = requerirServidor('./servicios/clientes')
  const repoClientes = requerirServidor('./repositorios/clientes')

  await t.test('23505 al crear se traduce a 409', async () => {
    const originalSucursal = repoClientes.sucursalDeEmpresa
    const originalExiste = repoClientes.existeDocumento
    const originalCrear = repoClientes.crear
    repoClientes.sucursalDeEmpresa = async () => ({ id: 1 })
    repoClientes.existeDocumento = async () => false
    repoClientes.crear = async () => {
      const error = new Error('unique_violation')
      error.code = '23505'
      throw error
    }
    try {
      await assert.rejects(
        () =>
          servicioClientes.crearCliente(
            { empresa_id: 1 },
            { sucursal_id: 1, nombre: 'X', documento: 'D' },
          ),
        (error) => error.status === 409,
        'el 23505 debe mapearse a 409, no a 500',
      )
    } finally {
      repoClientes.sucursalDeEmpresa = originalSucursal
      repoClientes.existeDocumento = originalExiste
      repoClientes.crear = originalCrear
    }
  })

  await t.test('22003 al obtener se traduce a 400', async () => {
    const original = repoClientes.buscarPorId
    repoClientes.buscarPorId = async () => {
      const error = new Error('out_of_range')
      error.code = '22003'
      throw error
    }
    try {
      await assert.rejects(
        () => servicioClientes.obtenerCliente({ empresa_id: 1 }, 1),
        (error) => error.status === 400,
        'el 22003 debe mapearse a 400, no a 500',
      )
    } finally {
      repoClientes.buscarPorId = original
    }
  })

  await t.test('22003 al crear se traduce a 400', async () => {
    const originalSucursal = repoClientes.sucursalDeEmpresa
    const originalExiste = repoClientes.existeDocumento
    const originalCrear = repoClientes.crear
    repoClientes.sucursalDeEmpresa = async () => ({ id: 1 })
    repoClientes.existeDocumento = async () => false
    repoClientes.crear = async () => {
      const error = new Error('out_of_range')
      error.code = '22003'
      throw error
    }
    try {
      await assert.rejects(
        () =>
          servicioClientes.crearCliente(
            { empresa_id: 1 },
            { sucursal_id: 1, nombre: 'X', documento: null },
          ),
        (error) => error.status === 400,
        'el 22003 debe mapearse a 400, no a 500',
      )
    } finally {
      repoClientes.sucursalDeEmpresa = originalSucursal
      repoClientes.existeDocumento = originalExiste
      repoClientes.crear = originalCrear
    }
  })
})

// ---------------------------------------------------------------------------
// Regresion: el POS (POST /facturas) y la anulacion siguen funcionando
// ---------------------------------------------------------------------------

test('REGRESION POS: POST /facturas con cliente_id + snapshot (201)', async () => {
  // Producto de apoyo para la venta.
  const producto = await peticion(base, '/productos', {
    metodo: 'POST',
    token,
    cuerpo: {
      codigo: codigoUnico('QA-CLI-POS'),
      nombre: 'Producto Clientes QA POS',
      precio_unitario: 1000,
      impuesto_porcentaje: 19,
    },
  })
  assert.equal(producto.status, 201, JSON.stringify(producto.cuerpo))
  const productoId = producto.cuerpo.data.producto.id
  productosCreados.push(productoId)

  // Cliente registrado (sucursal A).
  const cliente = await crearCliente({
    sucursal_id: sucursalA.id,
    nombre: nombreUnico('QA-CLI-POS-VENTA'),
    documento: documentoUnico(),
  })
  assert.equal(cliente.status, 201)
  const registrado = cliente.cuerpo.data.cliente

  const venta = await peticion(base, '/facturas', {
    metodo: 'POST',
    token,
    cuerpo: {
      sucursal_id: sucursalA.id,
      cliente_id: registrado.id,
      cliente_nombre: registrado.nombre,
      cliente_documento: registrado.documento,
      lineas: [{ producto_id: productoId, cantidad: 1, descuento_porcentaje: 0 }],
    },
  })
  assert.equal(venta.status, 201, JSON.stringify(venta.cuerpo))
  assertSobreExito(venta.cuerpo)
  const factura = venta.cuerpo.data.factura
  assert.equal(factura.cliente_id, registrado.id, 'debe asociar el cliente registrado')
  assert.equal(factura.cliente_nombre, registrado.nombre, 'snapshot de nombre')
  assert.equal(factura.cliente_documento, registrado.documento, 'snapshot de documento')
  assert.equal(factura.estado, 'emitida')

  // Regresion de la anulacion.
  const anulada = await peticion(base, `/facturas/${factura.id}/anular`, {
    metodo: 'PATCH',
    token,
  })
  assert.equal(anulada.status, 200, JSON.stringify(anulada.cuerpo))
  assertSobreExito(anulada.cuerpo)
  assert.equal(anulada.cuerpo.data.factura.estado, 'anulada')
})

test('REGRESION SD-009: GET /facturas responde 200 con sobre paginado', async () => {
  const r = await peticion(base, '/facturas?por_pagina=10', { token })
  assert.equal(r.status, 200, JSON.stringify(r.cuerpo))
  assertSobrePagina(r.cuerpo)
})
