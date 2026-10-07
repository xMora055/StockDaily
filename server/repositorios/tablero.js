// Acceso a datos del tablero de Inicio. Todas las consultas son de solo
// lectura y se acotan por `empresa_id` (derivado del token en el servicio).
// `factura` y `stock` no tienen `empresa_id`, por lo que el filtro se aplica
// vía JOIN con `sucursal`. pg entrega numeric/bigint como string; el casteo a
// Number se centraliza aquí. Sin lógica de negocio en esta capa.
const { pool } = require('../db/pool');

// Zona horaria de negocio: los buckets diarios y "hoy" se calculan con el
// calendario de Bogotá, no con la fecha UTC del servidor.
const ZONA_HORARIA = 'America/Bogota';
const LIMITE_TOP = 5;

// Convierte a Number un valor que pg puede devolver como string (numeric/bigint).
function aNumero(valor) {
    if (valor === null || valor === undefined) {
        return 0;
    }
    return Number(valor);
}

// Agrega el filtro opcional de sucursal sobre `factura` (alias `f`) reutilizando
// el parámetro posicional dinámico. Devuelve el fragmento SQL ('' si no aplica).
function filtroSucursalFactura(valores, sucursalId) {
    if (sucursalId === undefined) {
        return '';
    }
    valores.push(sucursalId);
    return ` AND f.sucursal_id = $${valores.length}`;
}

// Sucursal acotada a la empresa (evita IDOR); null si no existe o es ajena.
async function buscarSucursalDeEmpresa(empresaId, sucursalId) {
    const { rows } = await pool.query(
        `SELECT id FROM sucursal WHERE id = $1 AND empresa_id = $2`,
        [sucursalId, empresaId],
    );
    return rows[0] ? { id: aNumero(rows[0].id) } : null;
}

// Resumen de hoy y del periodo: ventas y tickets. La ventana del periodo son
// `dias` días calendario en Bogotá incluyendo hoy (coherente con `serie_ventas`).
// Las facturas anuladas se excluyen SIEMPRE.
async function obtenerResumen(empresaId, filtros) {
    const valores = [empresaId, filtros.dias];
    const sucursal = filtroSucursalFactura(valores, filtros.sucursal_id);

    const { rows } = await pool.query(
        `SELECT
            COALESCE(SUM(total) FILTER (
                WHERE dia = (now() AT TIME ZONE '${ZONA_HORARIA}')::date
            ), 0) AS ventas_hoy,
            COUNT(*) FILTER (
                WHERE dia = (now() AT TIME ZONE '${ZONA_HORARIA}')::date
            ) AS tickets_hoy,
            COALESCE(SUM(total), 0) AS ventas_periodo,
            COUNT(*) AS tickets_periodo
           FROM (
                SELECT f.total,
                       (f.fecha AT TIME ZONE '${ZONA_HORARIA}')::date AS dia
                  FROM factura f
                  JOIN sucursal s ON s.id = f.sucursal_id
                 WHERE s.empresa_id = $1
                   AND f.estado = 'emitida'
                   AND (f.fecha AT TIME ZONE '${ZONA_HORARIA}')::date
                       BETWEEN (now() AT TIME ZONE '${ZONA_HORARIA}')::date - ($2::int - 1)
                           AND (now() AT TIME ZONE '${ZONA_HORARIA}')::date
                   ${sucursal}
           ) sub`,
        valores,
    );

    const fila = rows[0];
    const ventasHoy = aNumero(fila.ventas_hoy);
    const ticketsHoy = aNumero(fila.tickets_hoy);

    return {
        ventas_hoy: ventasHoy,
        tickets_hoy: ticketsHoy,
        // Nunca dividir entre cero (EC-001).
        ticket_promedio_hoy: ticketsHoy > 0 ? ventasHoy / ticketsHoy : 0,
        ventas_periodo: aNumero(fila.ventas_periodo),
        tickets_periodo: aNumero(fila.tickets_periodo),
    };
}

// Serie diaria del periodo. `generate_series` garantiza exactamente `dias`
// puntos; los días sin ventas quedan en 0 (EC-006). Orden ascendente por fecha.
async function obtenerSerieVentas(empresaId, filtros) {
    const valores = [empresaId, filtros.dias];
    const sucursal = filtroSucursalFactura(valores, filtros.sucursal_id);

    const { rows } = await pool.query(
        `SELECT TO_CHAR(d.dia, 'YYYY-MM-DD') AS fecha,
                COALESCE(v.total, 0) AS total,
                COALESCE(v.tickets, 0) AS tickets
           FROM generate_series(
                    (now() AT TIME ZONE '${ZONA_HORARIA}')::date - ($2::int - 1),
                    (now() AT TIME ZONE '${ZONA_HORARIA}')::date,
                    interval '1 day'
                ) AS d(dia)
           LEFT JOIN (
                SELECT (f.fecha AT TIME ZONE '${ZONA_HORARIA}')::date AS dia,
                       SUM(f.total) AS total,
                       COUNT(*) AS tickets
                  FROM factura f
                  JOIN sucursal s ON s.id = f.sucursal_id
                 WHERE s.empresa_id = $1
                   AND f.estado = 'emitida'
                   AND (f.fecha AT TIME ZONE '${ZONA_HORARIA}')::date
                       BETWEEN (now() AT TIME ZONE '${ZONA_HORARIA}')::date - ($2::int - 1)
                           AND (now() AT TIME ZONE '${ZONA_HORARIA}')::date
                   ${sucursal}
                 GROUP BY 1
           ) v ON v.dia = d.dia
          ORDER BY d.dia ASC`,
        valores,
    );

    return rows.map((fila) => ({
        fecha: fila.fecha,
        total: aNumero(fila.total),
        tickets: aNumero(fila.tickets),
    }));
}

// Top 5 productos por unidades vendidas en el periodo (empate: nombre asc).
async function obtenerTopProductos(empresaId, filtros) {
    const valores = [empresaId, filtros.dias];
    const sucursal = filtroSucursalFactura(valores, filtros.sucursal_id);

    const { rows } = await pool.query(
        `SELECT p.id     AS producto_id,
                p.codigo AS producto_codigo,
                p.nombre AS producto_nombre,
                SUM(d.cantidad) AS unidades,
                SUM(d.total)    AS total
           FROM detalle_factura d
           JOIN factura f ON f.id = d.factura_id
           JOIN sucursal s ON s.id = f.sucursal_id
           JOIN producto p ON p.id = d.producto_id
          WHERE s.empresa_id = $1
            AND f.estado = 'emitida'
            AND (f.fecha AT TIME ZONE '${ZONA_HORARIA}')::date
                BETWEEN (now() AT TIME ZONE '${ZONA_HORARIA}')::date - ($2::int - 1)
                    AND (now() AT TIME ZONE '${ZONA_HORARIA}')::date
            ${sucursal}
          GROUP BY p.id, p.codigo, p.nombre
          ORDER BY unidades DESC, p.nombre ASC
          LIMIT ${LIMITE_TOP}`,
        valores,
    );

    return rows.map((fila) => ({
        producto_id: aNumero(fila.producto_id),
        producto_codigo: fila.producto_codigo,
        producto_nombre: fila.producto_nombre,
        unidades: aNumero(fila.unidades),
        total: aNumero(fila.total),
    }));
}

// Ventas del periodo por sucursal. Incluye sucursales con 0 ventas (LEFT JOIN)
// y ordena por total DESC (empate: nombre asc).
async function obtenerVentasPorSucursal(empresaId, filtros) {
    const valores = [empresaId, filtros.dias];
    let filtroSucursal = '';
    if (filtros.sucursal_id !== undefined) {
        valores.push(filtros.sucursal_id);
        filtroSucursal = ` AND s.id = $${valores.length}`;
    }

    const { rows } = await pool.query(
        `SELECT s.id     AS sucursal_id,
                s.nombre AS sucursal_nombre,
                COALESCE(SUM(f.total), 0) AS total,
                COUNT(f.id) AS tickets
           FROM sucursal s
           LEFT JOIN factura f
                  ON f.sucursal_id = s.id
                 AND f.estado = 'emitida'
                 AND (f.fecha AT TIME ZONE '${ZONA_HORARIA}')::date
                     BETWEEN (now() AT TIME ZONE '${ZONA_HORARIA}')::date - ($2::int - 1)
                         AND (now() AT TIME ZONE '${ZONA_HORARIA}')::date
          WHERE s.empresa_id = $1
            ${filtroSucursal}
          GROUP BY s.id, s.nombre
          ORDER BY total DESC, s.nombre ASC`,
        valores,
    );

    return rows.map((fila) => ({
        sucursal_id: aNumero(fila.sucursal_id),
        sucursal_nombre: fila.sucursal_nombre,
        total: aNumero(fila.total),
        tickets: aNumero(fila.tickets),
    }));
}

// Stock faltante (cantidad < 0) usando la vista `vista_stock_faltante`.
// Devuelve `{ total, items }`; `items` son los 5 mayores faltantes.
async function obtenerStockFaltante(empresaId, filtros) {
    const valores = [empresaId];
    let filtroSucursal = '';
    if (filtros.sucursal_id !== undefined) {
        valores.push(filtros.sucursal_id);
        filtroSucursal = ` AND sucursal_id = $${valores.length}`;
    }

    const { rows: totalRows } = await pool.query(
        `SELECT COUNT(*) AS total
           FROM vista_stock_faltante
          WHERE empresa_id = $1 ${filtroSucursal}`,
        valores,
    );

    const { rows } = await pool.query(
        `SELECT producto_id, producto_codigo, producto_nombre, sucursal_nombre,
                cantidad, faltante
           FROM vista_stock_faltante
          WHERE empresa_id = $1 ${filtroSucursal}
          ORDER BY faltante DESC, producto_nombre ASC
          LIMIT ${LIMITE_TOP}`,
        valores,
    );

    return {
        total: aNumero(totalRows[0].total),
        items: rows.map((fila) => ({
            producto_id: aNumero(fila.producto_id),
            producto_codigo: fila.producto_codigo,
            producto_nombre: fila.producto_nombre,
            sucursal_nombre: fila.sucursal_nombre,
            cantidad: aNumero(fila.cantidad),
            faltante: aNumero(fila.faltante),
        })),
    };
}

module.exports = {
    buscarSucursalDeEmpresa,
    obtenerResumen,
    obtenerSerieVentas,
    obtenerTopProductos,
    obtenerVentasPorSucursal,
    obtenerStockFaltante,
};
