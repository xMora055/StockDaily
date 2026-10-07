/*
 * QA light SD-021: verifica que login y perfil expongan empresa.moneda.
 * Crea una empresa USD + admin de prueba y los desactiva al final.
 */
const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

const { iniciarServidor, requerirServidor } = require('../utilidades/servidor')
const { peticion } = require('../utilidades/http')
const { tokenSuperadmin } = require('../utilidades/token')
const { codigoUnico } = require('../utilidades/datos')

const { pool } = requerirServidor('./db/pool')

describe('SD-021 — moneda en auth', () => {
  let servidor
  let urlBase
  let correoAdmin
  let passwordAdmin
  let empresaId
  let adminId

  before(async () => {
    ;({ urlBase, cerrar: servidor } = await iniciarServidor())

    correoAdmin = `qa.moneda.${codigoUnico('n').slice(2)}@stockdaily.test`
    passwordAdmin = '123'

    const { status, cuerpo } = await peticion(urlBase, '/admin/empresas', {
      metodo: 'POST',
      token: tokenSuperadmin(),
      cuerpo: {
        nombre: `QA Moneda ${codigoUnico('n').slice(2)}`,
        moneda: 'USD',
        admin: { nombre: 'Admin Moneda QA', correo: correoAdmin },
      },
    })

    assert.equal(status, 201, JSON.stringify(cuerpo))
    empresaId = cuerpo.data.empresa.id
    adminId = cuerpo.data.administrador.id
  })

  after(async () => {
    if (empresaId) {
      await peticion(urlBase, `/admin/empresas/${empresaId}`, {
        metodo: 'PATCH',
        token: tokenSuperadmin(),
        cuerpo: { activo: false },
      })
    }
    await servidor()
  })

  it('POST /auth/login incluye usuario.empresa.moneda', async () => {
    const { status, cuerpo } = await peticion(urlBase, '/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: correoAdmin, password: passwordAdmin },
    })

    assert.equal(status, 200, JSON.stringify(cuerpo))
    assert.equal(cuerpo.success, true)
    assert.ok(cuerpo.data.token, 'debe devolver token')
    assert.ok(cuerpo.data.usuario, 'debe devolver usuario')
    assert.equal(cuerpo.data.usuario.empresa_id, empresaId)
    assert.ok(cuerpo.data.usuario.empresa, 'debe devolver usuario.empresa')
    assert.equal(cuerpo.data.usuario.empresa.moneda, 'USD')
  })

  it('GET /auth/perfil incluye usuario.empresa.moneda', async () => {
    const login = await peticion(urlBase, '/auth/login', {
      metodo: 'POST',
      cuerpo: { correo: correoAdmin, password: passwordAdmin },
    })
    assert.equal(login.status, 200)

    const { status, cuerpo } = await peticion(urlBase, '/auth/perfil', {
      token: login.cuerpo.data.token,
    })

    assert.equal(status, 200, JSON.stringify(cuerpo))
    assert.equal(cuerpo.success, true)
    assert.equal(cuerpo.data.usuario.empresa.moneda, 'USD')
  })
})
