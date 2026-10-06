const { pool } = require('../db/pool');

// Proyección del contrato `Categoria` (sin `empresa_id`; nunca se expone).
const COLUMNAS = `id, nombre, activo, creado_en, actualizado_en`;

// pg entrega bigint como string; lo casteamos a Number aquí, centralizado en
// la capa de repositorios, antes de salir hacia el servicio.
function mapear(fila) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        nombre: fila.nombre,
        activo: fila.activo,
        creado_en: fila.creado_en,
        actualizado_en: fila.actualizado_en,
    };
}

// Escapa los comodines de LIKE/ILIKE para tratar `buscar` como texto literal
// (EC-003): `%` y `_` no deben actuar como comodines inyectables.
function escaparLike(texto) {
    return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

// Lista las categorías de una empresa (por defecto incluye las inactivas para
// poder reactivarlas), paginadas y filtrables. Devuelve `{ items, total }` con
// el COUNT del MISMO WHERE (sin LIMIT/OFFSET). `empresaId` es obligatorio
// (aislamiento multi-tenant).
async function listar(empresaId, filtros = {}) {
    const condiciones = ['empresa_id = $1'];
    const valores = [empresaId];

    if (filtros.activo !== undefined) {
        valores.push(filtros.activo);
        condiciones.push(`activo = $${valores.length}`);
    }
    if (filtros.buscar !== undefined) {
        valores.push(`%${escaparLike(filtros.buscar)}%`);
        condiciones.push(`nombre ILIKE $${valores.length} ESCAPE '\\'`);
    }

    const where = condiciones.join(' AND ');
    const offset = (filtros.pagina - 1) * filtros.por_pagina;

    const { rows: totalRows } = await pool.query(
        `SELECT COUNT(*) AS total FROM categoria WHERE ${where}`,
        valores,
    );

    const { rows } = await pool.query(
        `SELECT ${COLUMNAS}
           FROM categoria
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
           FROM categoria
          WHERE id = $1 AND empresa_id = $2`,
        [id, empresaId],
    );
    return mapear(rows[0]);
}

// Inserta una categoría nueva para la empresa y devuelve la fila creada.
async function crear(empresaId, datos) {
    const { rows } = await pool.query(
        `INSERT INTO categoria (empresa_id, nombre)
              VALUES ($1, $2)
           RETURNING ${COLUMNAS}`,
        [empresaId, datos.nombre],
    );
    return mapear(rows[0]);
}

// Actualiza solo las columnas presentes en `cambios` (claves ya validadas).
// El trigger `trg_categoria_timestamp` refresca `actualizado_en`.
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
        `UPDATE categoria
            SET ${asignaciones.join(', ')}
          WHERE id = $${parametroId} AND empresa_id = $${parametroEmpresa}
        RETURNING ${COLUMNAS}`,
        valores,
    );
    return mapear(rows[0]);
}

// Indica si el nombre ya existe en la empresa. `excluirId` permite ignorar la
// propia categoría al editar.
async function existeNombre(empresaId, nombre, excluirId = null) {
    if (excluirId === null) {
        const { rows } = await pool.query(
            `SELECT 1 FROM categoria WHERE empresa_id = $1 AND nombre = $2 LIMIT 1`,
            [empresaId, nombre],
        );
        return rows.length > 0;
    }

    const { rows } = await pool.query(
        `SELECT 1 FROM categoria WHERE empresa_id = $1 AND nombre = $2 AND id <> $3 LIMIT 1`,
        [empresaId, nombre, excluirId],
    );
    return rows.length > 0;
}

module.exports = { listar, buscarPorId, crear, actualizar, existeNombre };
