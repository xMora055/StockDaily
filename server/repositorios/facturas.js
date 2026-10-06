// Acceso a datos del vertical de facturación. Las operaciones de escritura
// reciben el cliente transaccional de `enTransaccion` (`db`) como primer
// argumento para participar de la MISMA transacción; las lecturas del listado
// y del detalle usan el `pool` directo (no requieren transacción). Sin lógica
// de negocio aquí.
const { pool } = require('../db/pool');

// pg entrega bigint/numeric como string; el casteo a Number se centraliza en
// esta capa antes de que la fila salga hacia el servicio.
function mapearFactura(fila) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        numero_factura: Number(fila.numero_factura),
        sucursal_id: Number(fila.sucursal_id),
        usuario_id: Number(fila.usuario_id),
        cliente_id: fila.cliente_id === null ? null : Number(fila.cliente_id),
        cliente_nombre: fila.cliente_nombre,
        cliente_documento: fila.cliente_documento,
        metodo_pago_id: fila.metodo_pago_id === null ? null : Number(fila.metodo_pago_id),
        estado: fila.estado,
        fecha: fila.fecha,
        subtotal: Number(fila.subtotal),
        descuento: Number(fila.descuento),
        impuesto: Number(fila.impuesto),
        total: Number(fila.total),
    };
}

// Proyección de la factura anulada: extiende `mapearFactura` con los campos de
// auditoría. Se mantiene separado de `mapearFactura` para NO alterar el shape
// de la respuesta de POST /facturas (que no los incluye).
function mapearFacturaAnulada(fila) {
    if (!fila) {
        return null;
    }
    return {
        ...mapearFactura(fila),
        anulada_en: fila.anulada_en,
        anulada_por: fila.anulada_por === null ? null : Number(fila.anulada_por),
    };
}

function mapearDetalle(fila) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        producto_id: Number(fila.producto_id),
        cantidad: Number(fila.cantidad),
        precio_unitario: Number(fila.precio_unitario),
        descuento_porcentaje: Number(fila.descuento_porcentaje),
        impuesto_porcentaje: Number(fila.impuesto_porcentaje),
        subtotal: Number(fila.subtotal),
        impuesto: Number(fila.impuesto),
        total: Number(fila.total),
    };
}

// Proyección del listado `FacturaResumen` (sin cliente_documento ni totales
// internos): el contrato de GET /facturas expone solo estos campos.
function mapearFacturaResumen(fila) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        numero_factura: Number(fila.numero_factura),
        sucursal_id: Number(fila.sucursal_id),
        sucursal_nombre: fila.sucursal_nombre,
        cliente_nombre: fila.cliente_nombre,
        total: Number(fila.total),
        estado: fila.estado,
        fecha: fila.fecha,
        anulada_en: fila.anulada_en,
    };
}

// Línea del detalle con el producto resuelto (JOIN producto).
function mapearDetalleConProducto(fila) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        producto_id: Number(fila.producto_id),
        producto_codigo: fila.producto_codigo,
        producto_nombre: fila.producto_nombre,
        cantidad: Number(fila.cantidad),
        precio_unitario: Number(fila.precio_unitario),
        descuento_porcentaje: Number(fila.descuento_porcentaje),
        impuesto_porcentaje: Number(fila.impuesto_porcentaje),
        subtotal: Number(fila.subtotal),
        impuesto: Number(fila.impuesto),
        total: Number(fila.total),
    };
}

// Encabezado completo de `FacturaDetalle` (incluye sucursal y auditoría).
function mapearFacturaDetalle(fila, detalles) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        numero_factura: Number(fila.numero_factura),
        sucursal_id: Number(fila.sucursal_id),
        sucursal_nombre: fila.sucursal_nombre,
        usuario_id: Number(fila.usuario_id),
        cliente_id: fila.cliente_id === null ? null : Number(fila.cliente_id),
        cliente_nombre: fila.cliente_nombre,
        cliente_documento: fila.cliente_documento,
        metodo_pago_id: fila.metodo_pago_id === null ? null : Number(fila.metodo_pago_id),
        estado: fila.estado,
        fecha: fila.fecha,
        anulada_en: fila.anulada_en,
        anulada_por: fila.anulada_por === null ? null : Number(fila.anulada_por),
        subtotal: Number(fila.subtotal),
        descuento: Number(fila.descuento),
        impuesto: Number(fila.impuesto),
        total: Number(fila.total),
        detalles,
    };
}

// Escapa los comodines de LIKE/ILIKE para tratar `buscar` como texto literal
// (EC-007): `%` y `_` no deben actuar como comodines inyectables.
function escaparLike(texto) {
    return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

// Sucursal acotada a la empresa (evita IDOR); null si no existe.
async function buscarSucursalDeEmpresa(db, sucursalId, empresaId) {
    const { rows } = await db.query(
        `SELECT id, nombre, activo
           FROM sucursal
          WHERE id = $1 AND empresa_id = $2`,
        [sucursalId, empresaId],
    );
    if (!rows[0]) {
        return null;
    }
    return { id: Number(rows[0].id), nombre: rows[0].nombre, activo: rows[0].activo };
}

// Indica si el método de pago existe y pertenece a la empresa.
async function existeMetodoPagoDeEmpresa(db, metodoPagoId, empresaId) {
    const { rows } = await db.query(
        `SELECT 1 FROM metodo_pago WHERE id = $1 AND empresa_id = $2 LIMIT 1`,
        [metodoPagoId, empresaId],
    );
    return rows.length > 0;
}

// Cliente acotado a la empresa del usuario vía su sucursal; null si no existe.
async function buscarClienteDeEmpresa(db, clienteId, empresaId) {
    const { rows } = await db.query(
        `SELECT c.id, c.nombre, c.documento
           FROM cliente c
           JOIN sucursal s ON s.id = c.sucursal_id
          WHERE c.id = $1 AND s.empresa_id = $2`,
        [clienteId, empresaId],
    );
    if (!rows[0]) {
        return null;
    }
    return { id: Number(rows[0].id), nombre: rows[0].nombre, documento: rows[0].documento };
}

// Carga los productos pedidos acotados a la empresa (multi-tenant). Si un id
// es de otra empresa simplemente no aparece en el resultado.
async function cargarProductosDeEmpresa(db, empresaId, ids) {
    const { rows } = await db.query(
        `SELECT id, codigo, nombre, precio_unitario, impuesto_porcentaje, activo
           FROM producto
          WHERE empresa_id = $1 AND id = ANY($2::bigint[])`,
        [empresaId, ids],
    );
    return rows.map((fila) => ({
        id: Number(fila.id),
        codigo: fila.codigo,
        nombre: fila.nombre,
        precio_unitario: Number(fila.precio_unitario),
        impuesto_porcentaje: Number(fila.impuesto_porcentaje),
        activo: fila.activo,
    }));
}

// Número consecutivo por sucursal. Debe llamarse DENTRO de la transacción:
// la función bloquea la fila de la sucursal con FOR UPDATE.
async function siguienteNumeroFactura(db, sucursalId) {
    const { rows } = await db.query(
        `SELECT siguiente_numero_factura($1) AS numero`,
        [sucursalId],
    );
    return Number(rows[0].numero);
}

// Inserta la cabecera y devuelve la fila creada con los numerics castigados.
async function insertarFactura(db, datos) {
    const { rows } = await db.query(
        `INSERT INTO factura
            (sucursal_id, usuario_id, cliente_id, cliente_nombre, cliente_documento,
             metodo_pago_id, numero_factura, estado, subtotal, descuento, impuesto, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'emitida', $8, $9, $10, $11)
         RETURNING id, numero_factura, sucursal_id, usuario_id, cliente_id,
                   cliente_nombre, cliente_documento, metodo_pago_id, estado,
                   fecha, subtotal, descuento, impuesto, total`,
        [
            datos.sucursal_id,
            datos.usuario_id,
            datos.cliente_id,
            datos.cliente_nombre,
            datos.cliente_documento,
            datos.metodo_pago_id,
            datos.numero_factura,
            datos.subtotal,
            datos.descuento,
            datos.impuesto,
            datos.total,
        ],
    );
    return mapearFactura(rows[0]);
}

// Inserta una línea con el precio/impuesto congelados (snapshot).
async function insertarDetalle(db, facturaId, linea) {
    const { rows } = await db.query(
        `INSERT INTO detalle_factura
            (factura_id, producto_id, cantidad, precio_unitario,
             descuento_porcentaje, impuesto_porcentaje, subtotal, impuesto, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, producto_id, cantidad, precio_unitario,
                   descuento_porcentaje, impuesto_porcentaje, subtotal, impuesto, total`,
        [
            facturaId,
            linea.producto_id,
            linea.cantidad,
            linea.precio_unitario,
            linea.descuento_porcentaje,
            linea.impuesto_porcentaje,
            linea.subtotal,
            linea.impuesto,
            linea.total,
        ],
    );
    return mapearDetalle(rows[0]);
}

// Registra la salida de stock de una línea. El trigger del esquema ajusta el
// saldo de `stock` (la cantidad va negativa; la sobreventa es permitida).
async function insertarMovimientoVenta(db, datos) {
    await db.query(
        `INSERT INTO movimiento_inventario
            (producto_id, sucursal_id, usuario_id, factura_id, tipo, cantidad)
         VALUES ($1, $2, $3, $4, 'salida_venta', $5)`,
        [
            datos.producto_id,
            datos.sucursal_id,
            datos.usuario_id,
            datos.factura_id,
            datos.cantidad,
        ],
    );
}

// Busca una factura para anular acotada a la empresa del usuario (a través de
// su sucursal) y BLOQUEA la fila con FOR UPDATE para serializar anulaciones
// concurrentes. `null` si no existe o es de otra empresa (anti-IDOR).
async function buscarParaAnular(db, facturaId, empresaId) {
    const { rows } = await db.query(
        `SELECT f.id, f.numero_factura, f.sucursal_id, f.usuario_id, f.cliente_id,
                f.cliente_nombre, f.cliente_documento, f.metodo_pago_id, f.estado,
                f.fecha, f.subtotal, f.descuento, f.impuesto, f.total
           FROM factura f
           JOIN sucursal s ON s.id = f.sucursal_id
          WHERE f.id = $1 AND s.empresa_id = $2
          FOR UPDATE OF f`,
        [facturaId, empresaId],
    );
    return mapearFactura(rows[0]);
}

// Marca la factura como anulada con auditoría y devuelve la fila actualizada.
async function actualizarAnulada(db, facturaId, usuarioId) {
    const { rows } = await db.query(
        `UPDATE factura
            SET estado = 'anulada', anulada_en = now(), anulada_por = $2
          WHERE id = $1
          RETURNING id, numero_factura, sucursal_id, usuario_id, cliente_id,
                    cliente_nombre, cliente_documento, metodo_pago_id, estado,
                    fecha, subtotal, descuento, impuesto, total,
                    anulada_en, anulada_por`,
        [facturaId, usuarioId],
    );
    return mapearFacturaAnulada(rows[0]);
}

// Líneas de la factura (snapshot). Se devuelven dentro de `factura.detalles`.
async function listarDetalles(db, facturaId) {
    const { rows } = await db.query(
        `SELECT id, producto_id, cantidad, precio_unitario, descuento_porcentaje,
                impuesto_porcentaje, subtotal, impuesto, total
           FROM detalle_factura
          WHERE factura_id = $1
          ORDER BY id ASC`,
        [facturaId],
    );
    return rows.map(mapearDetalle);
}

// Inserta un movimiento `anulacion` (cantidad POSITIVA) por cada línea de la
// factura, con el MISMO `factura_id`. El trigger `aplicar_movimiento_inventario`
// sube el saldo de `stock` en la misma transacción.
async function insertarMovimientosAnulacion(db, { facturaId, sucursalId, usuarioId }) {
    await db.query(
        `INSERT INTO movimiento_inventario
            (producto_id, sucursal_id, usuario_id, factura_id, tipo, cantidad)
         SELECT d.producto_id, $2, $3, $1, 'anulacion', d.cantidad
           FROM detalle_factura d
          WHERE d.factura_id = $1`,
        [facturaId, sucursalId, usuarioId],
    );
}

// GET /api/v1/facturas — lista las facturas de la empresa aplicando filtros
// opcionales, ordenadas por `fecha DESC, id DESC`. Devuelve `{ items, total }`
// donde `total` cuenta TODAS las filas que cumplen el mismo WHERE (sin
// LIMIT/OFFSET). `empresaId` sale del token y acota por la sucursal (JOIN).
async function listarFacturas(empresaId, filtros = {}) {
    const condiciones = ['s.empresa_id = $1'];
    const valores = [empresaId];

    if (filtros.sucursal_id !== undefined) {
        valores.push(filtros.sucursal_id);
        condiciones.push(`f.sucursal_id = $${valores.length}`);
    }
    if (filtros.estado !== undefined) {
        valores.push(filtros.estado);
        condiciones.push(`f.estado = $${valores.length}`);
    }
    if (filtros.desde !== undefined) {
        valores.push(filtros.desde);
        condiciones.push(`f.fecha >= $${valores.length}::timestamptz`);
    }
    if (filtros.hasta !== undefined) {
        valores.push(filtros.hasta);
        condiciones.push(`f.fecha <= $${valores.length}::timestamptz`);
    }
    if (filtros.buscar !== undefined) {
        valores.push(`%${escaparLike(filtros.buscar)}%`);
        const parametro = valores.length;
        condiciones.push(
            `(CAST(f.numero_factura AS text) ILIKE $${parametro} ESCAPE '\\' ` +
                `OR f.cliente_nombre ILIKE $${parametro} ESCAPE '\\')`,
        );
    }

    const where = condiciones.join(' AND ');
    const offset = (filtros.pagina - 1) * filtros.por_pagina;

    const { rows: totalRows } = await pool.query(
        `SELECT COUNT(*) AS total
           FROM factura f
           JOIN sucursal s ON s.id = f.sucursal_id
          WHERE ${where}`,
        valores,
    );

    const { rows } = await pool.query(
        `SELECT f.id, f.numero_factura, f.sucursal_id, s.nombre AS sucursal_nombre,
                f.cliente_nombre, f.total, f.estado, f.fecha, f.anulada_en
           FROM factura f
           JOIN sucursal s ON s.id = f.sucursal_id
          WHERE ${where}
          ORDER BY f.fecha DESC, f.id DESC
          LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
        [...valores, filtros.por_pagina, offset],
    );

    return { items: rows.map(mapearFacturaResumen), total: Number(totalRows[0].total) };
}

// GET /api/v1/facturas/:id — encabezado + líneas con producto, acotado a la
// empresa del token (JOIN sucursal). `null` si no existe o es de otra empresa.
async function obtenerFacturaDetalle(empresaId, id) {
    const { rows } = await pool.query(
        `SELECT f.id, f.numero_factura, f.sucursal_id, s.nombre AS sucursal_nombre,
                f.usuario_id, f.cliente_id, f.cliente_nombre, f.cliente_documento,
                f.metodo_pago_id, f.estado, f.fecha, f.anulada_en, f.anulada_por,
                f.subtotal, f.descuento, f.impuesto, f.total
           FROM factura f
           JOIN sucursal s ON s.id = f.sucursal_id
          WHERE f.id = $1 AND s.empresa_id = $2`,
        [id, empresaId],
    );
    const cabecera = rows[0];
    if (!cabecera) {
        return null;
    }

    const { rows: lineas } = await pool.query(
        `SELECT d.id, d.producto_id, p.codigo AS producto_codigo,
                p.nombre AS producto_nombre, d.cantidad, d.precio_unitario,
                d.descuento_porcentaje, d.impuesto_porcentaje, d.subtotal,
                d.impuesto, d.total
           FROM detalle_factura d
           JOIN producto p ON p.id = d.producto_id
          WHERE d.factura_id = $1
          ORDER BY d.id ASC`,
        [id],
    );

    return mapearFacturaDetalle(cabecera, lineas.map(mapearDetalleConProducto));
}

module.exports = {
    buscarSucursalDeEmpresa,
    existeMetodoPagoDeEmpresa,
    buscarClienteDeEmpresa,
    cargarProductosDeEmpresa,
    siguienteNumeroFactura,
    insertarFactura,
    insertarDetalle,
    insertarMovimientoVenta,
    buscarParaAnular,
    actualizarAnulada,
    listarDetalles,
    insertarMovimientosAnulacion,
    listarFacturas,
    obtenerFacturaDetalle,
};
