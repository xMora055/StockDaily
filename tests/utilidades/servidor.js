/*
 * Arranque de la app Express en un puerto efimero para las pruebas de
 * integracion HTTP. `server/app.js` exporta la app sin `listen`, asi que la
 * levantamos aqui y cerramos el pool al terminar.
 *
 * Se usa `createRequire` apuntando al package.json del servidor para que la
 * resolucion de modulos (`express`, `pg`, `jsonwebtoken`, `dotenv`) ocurra
 * contra `server/node_modules`, ya que la raiz no define workspaces.
 */
const path = require('path')
const { createRequire } = require('module')

const DIR_SERVER = path.resolve(__dirname, '..', '..', 'server')
const requerirServidor = createRequire(path.join(DIR_SERVER, 'package.json'))

// `node --test` se ejecuta desde la raiz, donde no hay `.env`; cargamos
// explicitamente el del servidor para que `config/entorno` resuelva
// DATABASE_URL y JWT_SECRETO. Nunca se imprime ni se escribe el secreto.
requerirServidor('dotenv').config({
  path: path.join(DIR_SERVER, '.env'),
  quiet: true,
})

const app = requerirServidor('./app')
const { pool } = requerirServidor('./db/pool')

async function iniciarServidor() {
  const servidor = await new Promise((resolver, rechazar) => {
    const instancia = app.listen(0, '127.0.0.1', () => resolver(instancia))
    instancia.on('error', rechazar)
  })

  const { port } = servidor.address()

  return {
    urlBase: `http://127.0.0.1:${port}/api/v1`,
    async cerrar() {
      await new Promise((resolver) => servidor.close(resolver))
      await pool.end()
    },
  }
}

module.exports = { iniciarServidor, requerirServidor, DIR_SERVER }