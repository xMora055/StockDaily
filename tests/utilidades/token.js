/*
 * Firmado de tokens JWT efimeros con el mismo payload que emite el login
 * (`id`, `empresa_id`, `nombre`, `correo`, `rol`). El secreto se toma en
 * tiempo de ejecucion de `server/config/entorno`; no se imprime ni se guarda.
 */
const { requerirServidor } = require('./servidor')

const jwt = requerirServidor('jsonwebtoken')
const { entorno } = requerirServidor('./config/entorno')

function firmarToken(carga = {}) {
  const payload = {
    id: 1,
    empresa_id: 1,
    nombre: 'QA Pruebas',
    correo: 'qa@stockdaily.test',
    rol: 'administrador',
    ...carga,
  }
  return jwt.sign(payload, entorno.jwt.secreto, { expiresIn: '20m' })
}

// administrador de la empresa 1 (tenant real de datos)
const tokenAdmin = () => firmarToken()

// superadmin de plataforma: sin empresa y rol no autorizado para catalogos
const tokenSuperadmin = () =>
  firmarToken({
    id: 3,
    empresa_id: null,
    nombre: 'Superadmin QA',
    correo: 'superadmin.qa@stockdaily.test',
    rol: 'superadmin',
  })

// administrador de una empresa que NO existe (para sondear IDOR)
const tokenOtraEmpresa = (empresaId = 999) =>
  firmarToken({
    id: 999,
    empresa_id: empresaId,
    nombre: 'Admin Ajeno QA',
    correo: `admin.ajeno.${empresaId}@stockdaily.test`,
  })

module.exports = { firmarToken, tokenAdmin, tokenSuperadmin, tokenOtraEmpresa }