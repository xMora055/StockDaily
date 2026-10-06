const { enTransaccion } = require('../db/pool');
const { ErrorApp } = require('../utilidades/errores');
const inventario = require('../repositorios/inventario');

const CODIGO_FUERA_RANGO = '22003'; // numeric_value_out_of_range de PostgreSQL

// Deriva el tenant del token. Nunca se acepta empresa_id del body/query.
function empresaDelUsuario(usuario) {
    const empresaId = usuario && usuario.empresa_id;
    if (empresaId === null || empresaId === undefined) {
        throw new ErrorApp(403, 'Tu usuario no pertenece a una empresa');
    }
    return Number(empresaId);
}

// El usuario del token debe ser un id válido (la FK de `usuario_id` lo exige).
function usuarioIdDelToken(usuario) {
    const usuarioId = Number(usuario && usuario.id);
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
        throw new ErrorApp(401, 'La sesión no es válida');
    }
    return usuarioId;
}

// Registra un movimiento de inventario (carga_inicial/ajuste) de forma ATÓMICA:
// validar producto/sucursal de la empresa -> insertar movimiento (el trigger
// ajusta `stock`) -> leer el saldo resultante -> COMMIT. Cualquier fallo revierte
// por completo (ROLLBACK en `enTransaccion`).
async function registrarMovimiento(usuario, datos) {
    const empresaId = empresaDelUsuario(usuario);
    const usuarioId = usuarioIdDelToken(usuario);

    return enTransaccion(async (db) => {
        const producto = await inventario.buscarProductoDeEmpresa(
            db,
            datos.producto_id,
            empresaId,
        );
        if (!producto) {
            throw new ErrorApp(404, 'Producto no encontrado');
        }

        const sucursal = await inventario.buscarSucursalDeEmpresa(
            db,
            datos.sucursal_id,
            empresaId,
        );
        if (!sucursal) {
            throw new ErrorApp(404, 'Sucursal no encontrada');
        }

        let movimiento;
        let stockFila;
        try {
            movimiento = await inventario.insertarMovimiento(db, {
                producto_id: datos.producto_id,
                sucursal_id: datos.sucursal_id,
                usuario_id: usuarioId,
                factura_id: null,
                tipo: datos.tipo,
                cantidad: datos.cantidad,
                observacion: datos.observacion,
            });

            stockFila = await inventario.buscarStock(
                db,
                datos.producto_id,
                datos.sucursal_id,
                empresaId,
            );
        } catch (error) {
            // Defensa en profundidad: si el ajuste de `stock.cantidad` (integer)
            // se desborda dentro del trigger, debe responder 400 y nunca 500.
            if (error.code === CODIGO_FUERA_RANGO) {
                throw new ErrorApp(400, 'La cantidad supera el máximo permitido');
            }
            throw error;
        }

        // Contrato del POST: `stock` expone solo producto, sucursal y saldo.
        const stock = {
            producto_id: datos.producto_id,
            sucursal_id: datos.sucursal_id,
            cantidad: stockFila ? stockFila.cantidad : 0,
        };

        return { movimiento, stock };
    });
}

// Arma el sobre paginado que exige el contrato (RF-007/RF-009/RF-013).
function armarPagina({ items, total }, pagina, porPagina) {
    return {
        items,
        pagina,
        por_pagina: porPagina,
        total,
        total_paginas: Math.ceil(total / porPagina),
    };
}

// Lista las existencias de la empresa del usuario autenticado (paginadas).
async function listarStock(usuario, filtros) {
    const empresaId = empresaDelUsuario(usuario);
    const { items, total } = await inventario.listarStock(empresaId, filtros);
    return armarPagina({ items, total }, filtros.pagina, filtros.por_pagina);
}

// Lista el historial de movimientos de la empresa del usuario (paginado).
async function listarMovimientos(usuario, filtros) {
    const empresaId = empresaDelUsuario(usuario);
    const { items, total } = await inventario.listarMovimientos(empresaId, filtros);
    return armarPagina({ items, total }, filtros.pagina, filtros.por_pagina);
}

module.exports = { registrarMovimiento, listarStock, listarMovimientos };
