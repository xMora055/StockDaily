/*
 * Cliente HTTP minimo sobre `fetch` nativo: serializa JSON, adjunta el
 * Bearer opcional y devuelve `{ status, cuerpo }` con el cuerpo ya parseado.
 */
async function peticion(
  urlBase,
  ruta,
  { metodo = 'GET', token, cuerpo, cabeceras = {} } = {},
) {
  const headers = { ...cabeceras }

  if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const respuesta = await fetch(`${urlBase}${ruta}`, {
    method: metodo,
    headers,
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })

  const texto = await respuesta.text()
  let json = null
  if (texto) {
    try {
      json = JSON.parse(texto)
    } catch {
      json = texto
    }
  }

  return { status: respuesta.status, cuerpo: json }
}

module.exports = { peticion }