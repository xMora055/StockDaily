const { pool } = require('../db/pool');

// Proyección del contrato `Producto` (orden estable en todas las respuestas).
const COLUMNAS = `id, codigo, nombre, descripcion, precio_unitario,
                  impuesto_porcentaje, categoria_id, activo, creado_en, actualizado_en`;

// pg entrega bigint y numeric como string; los casteamos a Number aquí,
// centralizado en la capa de repositorios, antes de salir hacia el servicio.
function mapear(fila) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        codigo: fila.codigo,
        nombre: fila.nombre,
        descripcion: fila.descripcion,
        precio_unitario: Number(fila.precio_unitario),
        impuesto_porcentaje: Number(fila.impuesto_porcentaje),
        categoria_id: fila.categoria_id === null ? null : Number(fila.categoria_id),
        activo: fila.activo,
        creado_en: fila.creado_en,
        actualizado_en: fila.actualizado_en,
    };
}

// Lista los productos de una empresa aplicando filtros opcionales, paginados.
// Devuelve `{ items, total }` donde `total` cuenta TODAS las filas que cumplen
// el mismo WHERE (sin LIMIT/OFFSET). `empresa_id` es obligatorio (multi-tenant).
async function listar(empresaId, filtros = {}) {
    const condiciones = ['empresa_id = $1'];
    const valores = [empresaId];

    if (filtros.nombre !== undefined) {
        valores.push(`%${filtros.nombre}%`);
        condiciones.push(`nombre ILIKE $${valores.length}`);
    }
    if (filtros.codigo !== undefined) {
        valores.push(`%${filtros.codigo}%`);
        condiciones.push(`codigo ILIKE $${valores.length}`);
    }
    if (filtros.categoria_id !== undefined) {
        valores.push(filtros.categoria_id);
        condiciones.push(`categoria_id = $${valores.length}`);
    }
    if (filtros.activo !== undefined) {
        valores.push(filtros.activo);
        condiciones.push(`activo = $${valores.length}`);
    }

    const where = condiciones.join(' AND ');
    const offset = (filtros.pagina - 1) * filtros.por_pagina;

    const { rows: totalRows } = await pool.query(
        `SELECT COUNT(*) AS total FROM producto WHERE ${where}`,
        valores,
    );

    const { rows } = await pool.query(
        `SELECT ${COLUMNAS}
           FROM producto
          WHERE ${where}
          ORDER BY nombre ASC, id ASC
          LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
        [...valores, filtros.por_pagina, offset],
    );

    return { items: rows.map(mapear), total: Number(totalRows[0].total) };
}

// Busca por id SIEMPRE acotado a la empresa (evita IDOR); null si no existe.
async function buscarPorId(id, empresaId) {
    const { rows } = await pool.query(
        `SELECT ${COLUMNAS}
           FROM producto
          WHERE id = $1 AND empresa_id = $2`,
        [id, empresaId],
    );
    return mapear(rows[0]);
}

// Inserta un producto nuevo para la empresa y devuelve la fila creada.
async function crear(empresaId, datos) {
    const { rows } = await pool.query(
        `INSERT INTO producto
            (empresa_id, categoria_id, codigo, nombre, descripcion, precio_unitario, impuesto_porcentaje)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUMNAS}`,
        [
            empresaId,
            datos.categoria_id,
            datos.codigo,
            datos.nombre,
            datos.descripcion,
            datos.precio_unitario,
            datos.impuesto_porcentaje,
        ],
    );
    return mapear(rows[0]);
}

// Actualiza solo las columnas presentes en `cambios` (claves ya validadas).
// El trigger `trg_producto_timestamp` refresca `actualizado_en`.
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
        `UPDATE producto
            SET ${asignaciones.join(', ')}
          WHERE id = $${parametroId} AND empresa_id = $${parametroEmpresa}
        RETURNING ${COLUMNAS}`,
        valores,
    );
    return mapear(rows[0]);
}

// Indica si el código ya existe en la empresa. `excluirId` permite ignorar
// el propio producto al editar.
async function existeCodigo(empresaId, codigo, excluirId = null) {
    if (excluirId === null) {
        const { rows } = await pool.query(
            `SELECT 1 FROM producto WHERE empresa_id = $1 AND codigo = $2 LIMIT 1`,
            [empresaId, codigo],
        );
        return rows.length > 0;
    }

    const { rows } = await pool.query(
        `SELECT 1 FROM producto WHERE empresa_id = $1 AND codigo = $2 AND id <> $3 LIMIT 1`,
        [empresaId, codigo, excluirId],
    );
    return rows.length > 0;
}

// Verifica que una categoría exista y pertenezca a la misma empresa.
async function existeCategoriaDeEmpresa(empresaId, categoriaId) {
    const { rows } = await pool.query(
        `SELECT 1 FROM categoria WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
        [categoriaId, empresaId],
    );
    return rows.length > 0;
}

module.exports = {
    listar,
    buscarPorId,
    crear,
    actualizar,
    existeCodigo,
    existeCategoriaDeEmpresa,
};