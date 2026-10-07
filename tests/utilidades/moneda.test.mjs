/*
 * Tests unitarios del helper de moneda del frontend.
 * No requieren base de datos ni servidor.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { formatearMoneda, formatearNumero } = await import(
  '../../client/src/utilidades/formatoMoneda.js'
)

describe('formatearMoneda', () => {
  it('formatea COP sin decimales', () => {
    const resultado = formatearMoneda(1000, 'COP')
    assert.ok(resultado.includes('1.000'), `esperaba 1.000 en ${resultado}`)
    assert.ok(!resultado.includes(','), `COP no debe tener decimales: ${resultado}`)
  })

  it('formatea USD con 2 decimales', () => {
    const resultado = formatearMoneda(1000, 'USD')
    assert.ok(resultado.includes('1.000,00') || resultado.includes('1,000.00'),
      `esperaba 1.000,00 o 1,000.00 en ${resultado}`)
  })

  it('usa COP por defecto cuando no se envia moneda', () => {
    const resultado = formatearMoneda(2500)
    assert.ok(resultado.includes('2.500'), `esperaba 2.500 en ${resultado}`)
    assert.ok(!resultado.includes(','), `default COP no debe tener decimales: ${resultado}`)
  })

  it('devuelve em dash para valores no numericos', () => {
    assert.equal(formatearMoneda(undefined, 'USD'), '—')
    assert.equal(formatearMoneda('abc', 'COP'), '—')
    assert.equal(formatearMoneda(Number.NaN, 'COP'), '—')
  })
})

describe('formatearNumero', () => {
  it('formatea enteros con separador de miles', () => {
    const resultado = formatearNumero(1234567)
    assert.ok(resultado.includes('1.234.567'), `esperaba 1.234.567 en ${resultado}`)
  })

  it('devuelve em dash para valores no numericos', () => {
    assert.equal(formatearNumero(undefined), '—')
    assert.equal(formatearNumero('x'), '—')
    assert.equal(formatearNumero(Number.NaN), '—')
  })
})
