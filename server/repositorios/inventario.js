const { pool } = require('../db/pool');

// pg entrega bigint/numeric como string; el casteo a Number se centraliza en
// esta capa antes de que la fila salga hacia el servicio.

// Proyección del contrato `Stock` (orden estable en las respuestas).
const COLUMNAS_STOCK = `st.producto_id,
                        p.codigo  AS producto_codigo,
                        p.nombre  AS producto_nombre,
                        st.sucursal_id,
                        s.nombre  AS sucursal_nombre,
                        st.cantidad,
                        st.actualizado_en`;

function mapearStock(fila) {
    if (!fila) {
        return null;
    }
    return {
        producto_id: Number(fila.producto_id),
        producto_codigo: fila.producto_codigo,
        producto_nombre: fila.producto_nombre,
        sucursal_id: Number(fila.sucursal_id),
        sucursal_nombre: fila.sucursal_nombre,
        cantidad: Number(fila.cantidad),
        actualizado_en: fila.actualizado_en,
    };
}

function mapearMovimiento(fila) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        producto_id: Number(fila.producto_id),
        producto_nombre: fila.producto_nombre,
        sucursal_id: Number(fila.sucursal_id),
        sucursal_nombre: fila.sucursal_nombre,
        tipo: fila.tipo,
        cantidad: Number(fila.cantidad),
        observacion: fila.observacion,
        usuario_id: fila.usuario_id === null ? null : Number(fila.usuario_id),
        factura_id: fila.factura_id === null ? null : Number(fila.factura_id),
        creado_en: fila.creado_en,
    };
}

// Producto acotado a la empresa (evita IDOR); null si no existe.
async function buscarProductoDeEmpresa(db, productoId, empresaId) {
    const { rows } = await db.query(
        `SELECT id FROM producto WHERE id = $1 AND empresa_id = $2`,
        [productoId, empresaId],
    );
    return rows[0] ? { id: Number(rows[0].id) } : null;
}

// Sucursal acotada a la empresa (evita IDOR); null si no existe.
async function buscarSucursalDeEmpresa(db, sucursalId, empresaId) {
    const { rows } = await db.query(
        `SELECT id FROM sucursal WHERE id = $1 AND empresa_id = $2`,
        [sucursalId, empresaId],
    );
    return rows[0] ? { id: Number(rows[0].id) } : null;
}

// Inserta el movimiento y devuelve la fila con los nombres de producto y
// sucursal resueltos. El trigger `aplicar_movimiento_inventario` ajusta
// `stock` en la MISMA transacción. `factura_id` va NULL para gestión manual.
async function insertarMovimiento(db, datos) {
    const { rows } = await db.query(
        `WITH nuevo AS (
            INSERT INTO movimiento_inventario
                (producto_id, sucursal_id, usuario_id, factura_id, tipo, cantidad, observacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
         )
         SELECT n.id, n.producto_id, p.nombre AS producto_nombre, n.sucursal_id,
                s.nombre AS sucursal_nombre, n.tipo, n.cantidad, n.observacion,
                n.usuario_id, n.factura_id, n.creado_en
           FROM nuevo n
           JOIN producto p ON p.id = n.producto_id
           JOIN sucursal s ON s.id = n.sucursal_id`,
        [
            datos.producto_id,
            datos.sucursal_id,
            datos.usuario_id,
            datos.factura_id,
            datos.tipo,
            datos.cantidad,
            datos.observacion,
        ],
    );
    return mapearMovimiento(rows[0]);
}

// Lee el saldo resultante (incluye producto/sucursal de la empresa).
async function buscarStock(db, productoId, sucursalId, empresaId) {
    const { rows } = await db.query(
        `SELECT ${COLUMNAS_STOCK}
           FROM stock st
           JOIN producto p ON p.id = st.producto_id
           JOIN sucursal s ON s.id = st.sucursal_id
          WHERE st.producto_id = $1 AND st.sucursal_id = $2
            AND p.empresa_id = $3 AND s.empresa_id = $3`,
        [productoId, sucursalId, empresaId],
    );
    return mapearStock(rows[0]);
}

// Lista las existencias de la empresa aplicando filtros opcionales, paginadas.
// Devuelve `{ items, total }` donde `total` cuenta TODAS las filas que cumplen
// el mismo WHERE (sin LIMIT/OFFSET). Con `solo_faltantes` consulta la vista
// `vista_stock_faltante` (cantidad < 0).
async function listarStock(empresaId, filtros = {}) {
    const offset = (filtros.pagina - 1) * filtros.por_pagina;

    if (filtros.solo_faltantes) {
        const condiciones = ['empresa_id = $1'];
        const valores = [empresaId];

        if (filtros.sucursal_id !== undefined) {
            valores.push(filtros.sucursal_id);
            condiciones.push(`sucursal_id = $${valores.length}`);
        }
        if (filtros.producto_id !== undefined) {
            valores.push(filtros.producto_id);
            condiciones.push(`producto_id = $${valores.length}`);
        }
        if (filtros.buscar !== undefined) {
            valores.push(`%${filtros.buscar}%`);
            const parametro = valores.length;
            condiciones.push(
                `(producto_nombre ILIKE $${parametro} OR producto_codigo ILIKE $${parametro})`,
            );
        }

        const where = condiciones.join(' AND ');

        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*) AS total FROM vista_stock_faltante WHERE ${where}`,
            valores,
        );

        const { rows } = await pool.query(
            `SELECT producto_id, producto_codigo, producto_nombre, sucursal_id,
                    sucursal_nombre, cantidad, actualizado_en
               FROM vista_stock_faltante
              WHERE ${where}
              ORDER BY producto_nombre ASC, sucursal_nombre ASC
              LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
            [...valores, filtros.por_pagina, offset],
        );

        return { items: rows.map(mapearStock), total: Number(totalRows[0].total) };
    }

    // Ambas tablas se acotan por empresa (multi-tenant) sobre las mismas $1.
    const condiciones = ['p.empresa_id = $1', 's.empresa_id = $1'];
    const valores = [empresaId];

    if (filtros.sucursal_id !== undefined) {
        valores.push(filtros.sucursal_id);
        condiciones.push(`st.sucursal_id = $${valores.length}`);
    }
    if (filtros.producto_id !== undefined) {
        valores.push(filtros.producto_id);
        condiciones.push(`st.producto_id = $${valores.length}`);
    }
    if (filtros.buscar !== undefined) {
        valores.push(`%${filtros.buscar}%`);
        const parametro = valores.length;
        condiciones.push(`(p.nombre ILIKE $${parametro} OR p.codigo ILIKE $${parametro})`);
    }

    const where = condiciones.join(' AND ');

    const { rows: totalRows } = await pool.query(
        `SELECT COUNT(*) AS total
           FROM stock st
           JOIN producto p ON p.id = st.producto_id
           JOIN sucursal s ON s.id = st.sucursal_id
          WHERE ${where}`,
        valores,
    );

    const { rows } = await pool.query(
        `SELECT ${COLUMNAS_STOCK}
           FROM stock st
           JOIN producto p ON p.id = st.producto_id
           JOIN sucursal s ON s.id = st.sucursal_id
          WHERE ${where}
          ORDER BY p.nombre ASC, s.nombre ASC
          LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
        [...valores, filtros.por_pagina, offset],
    );

    return { items: rows.map(mapearStock), total: Number(totalRows[0].total) };
}

// Lista el historial de movimientos de la empresa (más recientes primero),
// paginado. Devuelve `{ items, total }` con el COUNT del mismo WHERE.
async function listarMovimientos(empresaId, filtros = {}) {
    const condiciones = ['p.empresa_id = $1', 's.empresa_id = $1'];
    const valores = [empresaId];

    if (filtros.producto_id !== undefined) {
        valores.push(filtros.producto_id);
        condiciones.push(`m.producto_id = $${valores.length}`);
    }
    if (filtros.sucursal_id !== undefined) {
        valores.push(filtros.sucursal_id);
        condiciones.push(`m.sucursal_id = $${valores.length}`);
    }
    if (filtros.tipo !== undefined) {
        valores.push(filtros.tipo);
        condiciones.push(`m.tipo = $${valores.length}`);
    }
    if (filtros.desde !== undefined) {
        valores.push(filtros.desde);
        condiciones.push(`m.creado_en >= $${valores.length}::timestamptz`);
    }
    if (filtros.hasta !== undefined) {
        valores.push(filtros.hasta);
        condiciones.push(`m.creado_en <= $${valores.length}::timestamptz`);
    }

    const where = condiciones.join(' AND ');
    const offset = (filtros.pagina - 1) * filtros.por_pagina;

    const { rows: totalRows } = await pool.query(
        `SELECT COUNT(*) AS total
           FROM movimiento_inventario m
           JOIN producto p ON p.id = m.producto_id
           JOIN sucursal s ON s.id = m.sucursal_id
          WHERE ${where}`,
        valores,
    );

    const { rows } = await pool.query(
        `SELECT m.id, m.producto_id, p.nombre AS producto_nombre, m.sucursal_id,
                s.nombre AS sucursal_nombre, m.tipo, m.cantidad, m.observacion,
                m.usuario_id, m.factura_id, m.creado_en
           FROM movimiento_inventario m
           JOIN producto p ON p.id = m.producto_id
           JOIN sucursal s ON s.id = m.sucursal_id
          WHERE ${where}
          ORDER BY m.creado_en DESC, m.id DESC
          LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
        [...valores, filtros.por_pagina, offset],
    );

    return { items: rows.map(mapearMovimiento), total: Number(totalRows[0].total) };
}

module.exports = {
    buscarProductoDeEmpresa,
    buscarSucursalDeEmpresa,
    insertarMovimiento,
    buscarStock,
    listarStock,
    listarMovimientos,
};
