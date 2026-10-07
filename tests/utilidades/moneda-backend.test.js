/*
 * Tests unitarios de la validacion de moneda del backend.
 * No requieren base de datos ni servidor.
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { createRequire } = require('module')
const path = require('path')

const requerirServidor = createRequire(
  path.join(__dirname, '..', '..', 'server', 'package.json'),
)
const { validarEdicionEmpresa, validarCreacionEmpresa } = requerirServidor(
  './validaciones/admin',
)

describe('normalizarMoneda', () => {
  it('acepta codigo ISO 4217 valido en edicion', () => {
    const cambios = validarEdicionEmpresa({ moneda: 'usd' })
    assert.equal(cambios.moneda, 'USD')
  })

  it('rechaza codigo distinto de 3 letras', () => {
    assert.throws(
      () => validarEdicionEmpresa({ moneda: 'USDC' }),
      (err) => err.status === 400 && err.message.includes('ISO 4217'),
    )
  })

  it('rechaza moneda con numeros', () => {
    assert.throws(
      () => validarEdicionEmpresa({ moneda: 'US1' }),
      (err) => err.status === 400,
    )
  })

  it('rechaza moneda no textual', () => {
    assert.throws(
      () => validarEdicionEmpresa({ moneda: 123 }),
      (err) => err.status === 400,
    )
  })

  it('usa COP por defecto en creacion cuando no se envia moneda', () => {
    const { empresa } = validarCreacionEmpresa({
      nombre: 'QA Empresa Moneda',
      admin: { nombre: 'Admin QA', correo: 'qa.moneda@stockdaily.test' },
    })
    assert.equal(empresa.moneda, 'COP')
  })
})
