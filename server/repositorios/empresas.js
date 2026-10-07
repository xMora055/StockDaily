const { pool } = require('../db/pool');

const COLUMNAS_EMPRESA = `id, nombre, documento, moneda, direccion, telefono, correo, activo, creado_en, actualizado_en`;

function mapearEmpresa(fila) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        nombre: fila.nombre,
        documento: fila.documento,
        moneda: fila.moneda,
        direccion: fila.direccion,
        telefono: fila.telefono,
        correo: fila.correo,
        activo: fila.activo,
        creado_en: fila.creado_en,
        actualizado_en: fila.actualizado_en,
    };
}

async function listar(filtros = {}) {
    const condiciones = [];
    const valores = [];

    if (filtros.activo !== undefined) {
        valores.push(filtros.activo);
        condiciones.push(`activo = $${valores.length}`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const offset = (filtros.pagina - 1) * filtros.por_pagina;

    const { rows: totalRows } = await pool.query(
        `SELECT COUNT(*) AS total FROM empresa ${where}`,
        valores,
    );

    const { rows } = await pool.query(
        `SELECT ${COLUMNAS_EMPRESA}
           FROM empresa
           ${where}
          ORDER BY nombre ASC, id ASC
          LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
        [...valores, filtros.por_pagina, offset],
    );

    return { items: rows.map(mapearEmpresa), total: Number(totalRows[0].total) };
}

async function buscarPorId(id) {
    const { rows } = await pool.query(
        `SELECT ${COLUMNAS_EMPRESA}
           FROM empresa
          WHERE id = $1`,
        [id],
    );
    return mapearEmpresa(rows[0]);
}

async function crear(datos, cliente) {
    const ejecutor = cliente || pool;
    const { rows } = await ejecutor.query(
        `INSERT INTO empresa (nombre, documento, moneda, direccion, telefono, correo)
              VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING ${COLUMNAS_EMPRESA}`,
        [datos.nombre, datos.documento, datos.moneda, datos.direccion, datos.telefono, datos.correo],
    );
    return mapearEmpresa(rows[0]);
}

async function actualizar(id, cambios, cliente) {
    const ejecutor = cliente || pool;
    const asignaciones = [];
    const valores = [];

    for (const [columna, valor] of Object.entries(cambios)) {
        valores.push(valor);
        asignaciones.push(`${columna} = $${valores.length}`);
    }

    valores.push(id);
    const parametroId = valores.length;

    const { rows } = await ejecutor.query(
        `UPDATE empresa
            SET ${asignaciones.join(', ')}
          WHERE id = $${parametroId}
        RETURNING ${COLUMNAS_EMPRESA}`,
        valores,
    );
    return mapearEmpresa(rows[0]);
}

async function existeNombre(nombre, excluirId = null, cliente) {
    const ejecutor = cliente || pool;
    if (excluirId === null) {
        const { rows } = await ejecutor.query(
            `SELECT 1 FROM empresa WHERE nombre = $1 LIMIT 1`,
            [nombre],
        );
        return rows.length > 0;
    }

    const { rows } = await ejecutor.query(
        `SELECT 1 FROM empresa WHERE nombre = $1 AND id <> $2 LIMIT 1`,
        [nombre, excluirId],
    );
    return rows.length > 0;
}

module.exports = { listar, buscarPorId, crear, actualizar, existeNombre };
