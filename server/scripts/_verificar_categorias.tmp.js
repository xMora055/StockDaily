// TEMPORAL DE VERIFICACIÓN SD-002. Se elimina al terminar.
const jwt = require('jsonwebtoken');
const { entorno } = require('../config/entorno');

const BASE = `http://localhost:${process.env.PORT || 3999}/api/v1`;

function token(payload) {
    return jwt.sign(payload, entorno.jwt.secreto, { expiresIn: '1h' });
}

const admin = token({ id: 1, empresa_id: 1, nombre: 'Admin Demo', correo: 'admin@stockdaily.com', rol: 'administrador' });
const ajena = token({ id: 9, empresa_id: 3, nombre: 'Ajena', correo: 'qa.ajena@stockdaily.test', rol: 'administrador' });
const superadmin = token({ id: 3, empresa_id: null, nombre: 'Super', correo: 'superadmin@stockdaily.com', rol: 'superadmin' });

let ok = 0;
let fallos = 0;
let idCreado = null;

async function pedir(metodo, ruta, { bearer, body } = {}) {
    const headers = {};
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${BASE}${ruta}`, {
        method: metodo,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await res.json(); } catch { /* sin cuerpo */ }
    return { status: res.status, json };
}

function j(v) { return JSON.stringify(v); }

function resumen(json) {
    if (!json) return 'sin JSON';
    if (json.error) return `error="${json.error}"`;
    const d = json.data;
    if (d && Array.isArray(d.items)) {
        const conId = d.items.map((c) => ({ id: c.id, nombre: c.nombre }));
        return `items=${j(conId)} pagina=${d.pagina} por_pagina=${d.por_pagina} total=${d.total} total_paginas=${d.total_paginas}`;
    }
    if (d && d.categoria) {
        const c = d.categoria;
        return `categoria=${j(c)} tiene_empresa_id=${Object.prototype.hasOwnProperty.call(c, 'empresa_id')}`;
    }
    return j(d);
}

async function comprobar(descripcion, esperado, promesa) {
    const { status, json } = await promesa;
    const paso = status === esperado;
    if (paso) ok += 1; else fallos += 1;
    console.log(`${paso ? 'OK ' : 'XX '} [${status} esp ${esperado}] ${descripcion}`);
    console.log(`      ${resumen(json)}`);
    return { status, json };
}

async function main() {
    await comprobar('GET /salud', 200, pedir('GET', '/salud'));
    await comprobar('GET /categorias sin token -> 401', 401, pedir('GET', '/categorias'));
    await comprobar('GET /categorias superadmin -> 403', 403, pedir('GET', '/categorias', { bearer: superadmin }));
    await comprobar('GET /categorias default pagina/por_pagina', 200, pedir('GET', '/categorias', { bearer: admin }));
    await comprobar('GET /categorias?pagina=0 -> 400', 400, pedir('GET', '/categorias?pagina=0', { bearer: admin }));
    await comprobar('GET /categorias?por_pagina=101 -> 400', 400, pedir('GET', '/categorias?por_pagina=101', { bearer: admin }));
    await comprobar('GET /categorias?buscar=General', 200, pedir('GET', '/categorias?buscar=General', { bearer: admin }));
    await comprobar('GET /categorias?buscar=%25 (literal, sin comodin)', 200, pedir('GET', '/categorias?buscar=%25', { bearer: admin }));

    const creada = await comprobar(
        'POST /categorias ignora empresa_id del body',
        201,
        pedir('POST', '/categorias', { bearer: admin, body: { nombre: 'ZZ Verif SD-002', empresa_id: 999 } }),
    );
    idCreado = creada.json && creada.json.data && creada.json.data.categoria ? creada.json.data.categoria.id : null;

    await comprobar('POST duplicado -> 409', 409, pedir('POST', '/categorias', { bearer: admin, body: { nombre: 'ZZ Verif SD-002' } }));
    await comprobar('POST nombre vacio -> 400', 400, pedir('POST', '/categorias', { bearer: admin, body: { nombre: '   ' } }));
    await comprobar('POST nombre >100 -> 400', 400, pedir('POST', '/categorias', { bearer: admin, body: { nombre: 'x'.repeat(101) } }));

    await comprobar('GET /categorias/:id propio -> 200', 200, pedir('GET', `/categorias/${idCreado}`, { bearer: admin }));
    await comprobar('GET /categorias/:id no numerico -> 400', 400, pedir('GET', '/categorias/abc', { bearer: admin }));
    await comprobar('GET /categorias/:id fuera de rango -> 400 (no 500)', 400, pedir('GET', '/categorias/999999999999999999999', { bearer: admin }));
    await comprobar('GET /categorias/:id de otra empresa -> 404 (IDOR)', 404, pedir('GET', `/categorias/${idCreado}`, { bearer: ajena }));

    await comprobar('PATCH /categorias/:id activo=false -> 200', 200, pedir('PATCH', `/categorias/${idCreado}`, { bearer: admin, body: { activo: false } }));
    await comprobar('PATCH sin campos -> 400', 400, pedir('PATCH', `/categorias/${idCreado}`, { bearer: admin, body: {} }));
    await comprobar('PATCH duplicado -> 409', 409, pedir('PATCH', `/categorias/${idCreado}`, { bearer: admin, body: { nombre: 'General' } }));

    console.log(`\nRESULTADO: ${ok} OK, ${fallos} fallos. idCreado=${idCreado}`);
}

main().catch((e) => { console.error('Error en la verificacion:', e); process.exitCode = 1; });
