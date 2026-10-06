const { pool } = require('../db/pool');

// Proyección del contrato `Cliente` (JOIN a `sucursal` para `sucursal_nombre`;
// nunca se expone `empresa_id`).
const COLUMNAS = `
    c.id,
    c.sucursal_id,
    s.nombre AS sucursal_nombre,
    c.nombre,
    c.documento,
    c.telefono,
    c.correo,
    c.direccion,
    c.activo,
    c.creado_en,
    c.actualizado_en
`;

// pg entrega bigint como string; lo casteamos a Number aquí, centralizado en
// la capa de repositorios, antes de salir hacia el servicio.
function mapear(fila) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        sucursal_id: Number(fila.sucursal_id),
        sucursal_nombre: fila.sucursal_nombre,
        nombre: fila.nombre,
        documento: fila.documento,
        telefono: fila.telefono,
        correo: fila.correo,
        direccion: fila.direccion,
        activo: fila.activo,
        creado_en: fila.creado_en,
        actualizado_en: fila.actualizado_en,
    };
}

// Escapa los comodines de LIKE/ILIKE para tratar `buscar` como texto literal
// (EC-006): `%` y `_` no deben actuar como comodines inyectables.
function escaparLike(texto) {
    return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

// Lista los clientes de las sucursales de una empresa, paginados y filtrables.
// Devuelve `{ items, total }` con el COUNT del MISMO WHERE (sin LIMIT/OFFSET).
// `empresaId` es obligatorio (aislamiento multi-tenant vía `sucursal`).
async function listar(empresaId, filtros = {}) {
    const condiciones = ['s.empresa_id = $1'];
    const valores = [empresaId];

    if (filtros.sucursal_id !== undefined) {
        valores.push(filtros.sucursal_id);
        condiciones.push(`c.sucursal_id = $${valores.length}`);
    }
    if (filtros.activo !== undefined) {
        valores.push(filtros.activo);
        condiciones.push(`c.activo = $${valores.length}`);
    }
    if (filtros.buscar !== undefined) {
        valores.push(`%${escaparLike(filtros.buscar)}%`);
        const parametro = valores.length;
        condiciones.push(
            `(c.nombre ILIKE $${parametro} ESCAPE '\\' ` +
                `OR c.documento ILIKE $${parametro} ESCAPE '\\')`,
        );
    }

    const where = condiciones.join(' AND ');
    const offset = (filtros.pagina - 1) * filtros.por_pagina;

    const { rows: totalRows } = await pool.query(
        `SELECT COUNT(*) AS total
           FROM cliente c
           JOIN sucursal s ON s.id = c.sucursal_id
          WHERE ${where}`,
        valores,
    );

    const { rows } = await pool.query(
        `SELECT ${COLUMNAS}
           FROM cliente c
           JOIN sucursal s ON s.id = c.sucursal_id
          WHERE ${where}
          ORDER BY c.nombre ASC, c.id ASC
          LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
        [...valores, filtros.por_pagina, offset],
    );

    return { items: rows.map(mapear), total: Number(totalRows[0].total) };
}

// Busca por id SIEMPRE acotado a la empresa vía `sucursal` (evita IDOR).
// Devuelve null si no existe o es de otra empresa.
async function buscarPorId(id, empresaId) {
    const { rows } = await pool.query(
        `SELECT ${COLUMNAS}
           FROM cliente c
           JOIN sucursal s ON s.id = c.sucursal_id
          WHERE c.id = $1 AND s.empresa_id = $2`,
        [id, empresaId],
    );
    return mapear(rows[0]);
}

// Inserta un cliente en la sucursal indicada y devuelve la proyección completa.
// La pertenencia de la sucursal a la empresa la pre-valida el servicio (404);
// el INSERT ... SELECT la refuerza como defensa en profundidad (si la sucursal
// no es de la empresa, no se inserta ninguna fila y se devuelve null).
async function crear(empresaId, datos) {
    const { rows } = await pool.query(
        `INSERT INTO cliente (sucursal_id, nombre, documento, telefono, correo, direccion)
              SELECT s.id, $2, $3, $4, $5, $6
                FROM sucursal s
               WHERE s.id = $1 AND s.empresa_id = $7
           RETURNING id`,
        [
            datos.sucursal_id,
            datos.nombre,
            datos.documento,
            datos.telefono,
            datos.correo,
            datos.direccion,
            empresaId,
        ],
    );

    if (!rows[0]) {
        return null;
    }
    return buscarPorId(Number(rows[0].id), empresaId);
}

// Actualiza solo las columnas presentes en `cambios` (claves ya validadas),
// acotado a la empresa vía `sucursal`. El trigger `trg_cliente_timestamp`
// refresca `actualizado_en`. Devuelve null si el cliente no es de la empresa.
async function actualizar(id, empresaId, cambios) {
    const asignaciones = [];
    const valores = [];

    for (const [columna, valor] of Object.entries(cambios)) {
        valores.push(valor);
        asignaciones.push(`${columna} = $${valores.length}`);
    }

    valores.push(id);
    const parametroId = valores.length;
    valores.push(empresaId);
    const parametroEmpresa = valores.length;

    const { rows } = await pool.query(
        `UPDATE cliente
            SET ${asignaciones.join(', ')}
          WHERE id = $${parametroId}
            AND sucursal_id IN (SELECT id FROM sucursal WHERE empresa_id = $${parametroEmpresa})
        RETURNING id`,
        valores,
    );

    if (!rows[0]) {
        return null;
    }
    return buscarPorId(Number(rows[0].id), empresaId);
}

// Indica si el `documento` ya existe en la sucursal. `excluirId` permite
// ignorar el propio cliente al editar. `documento` null nunca es duplicado
// (varios clientes sin documento son válidos por la UNIQUE parcial).
async function existeDocumento(sucursalId, documento, excluirId = null) {
    if (documento === null || documento === undefined) {
        return false;
    }

    if (excluirId === null) {
        const { rows } = await pool.query(
            `SELECT 1 FROM cliente
              WHERE sucursal_id = $1 AND documento = $2
              LIMIT 1`,
            [sucursalId, documento],
        );
        return rows.length > 0;
    }

    const { rows } = await pool.query(
        `SELECT 1 FROM cliente
          WHERE sucursal_id = $1 AND documento = $2 AND id <> $3
          LIMIT 1`,
        [sucursalId, documento, excluirId],
    );
    return rows.length > 0;
}

// Comprueba que una sucursal exista y pertenezca a la empresa (anti-IDOR).
// Devuelve `{ id }` o null.
async function sucursalDeEmpresa(sucursalId, empresaId) {
    const { rows } = await pool.query(
        `SELECT id FROM sucursal WHERE id = $1 AND empresa_id = $2`,
        [sucursalId, empresaId],
    );
    return rows[0] ? { id: Number(rows[0].id) } : null;
}

module.exports = {
    listar,
    buscarPorId,
    crear,
    actualizar,
    existeDocumento,
    sucursalDeEmpresa,
};
