const servicioInventario = require('../servicios/inventario');

// POST /api/v1/inventario/movimientos
// -> { success, data: { movimiento, stock } } (201)
async function crearMovimiento(req, res, next) {
    try {
        const { movimiento, stock } = await servicioInventario.registrarMovimiento(
            req.usuario,
            req.validado.body,
        );
        res.status(201).json({ success: true, data: { movimiento, stock } });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/inventario/stock
// -> { success, data: { items: [Stock], pagina, por_pagina, total, total_paginas } }
async function listarStock(req, res, next) {
    try {
        const pagina = await servicioInventario.listarStock(
            req.usuario,
            req.validado.query,
        );
        res.status(200).json({ success: true, data: pagina });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/inventario/movimientos
// -> { success, data: { items: [Movimiento], pagina, por_pagina, total, total_paginas } }
async function listarMovimientos(req, res, next) {
    try {
        const pagina = await servicioInventario.listarMovimientos(
            req.usuario,
            req.validado.query,
        );
        res.status(200).json({ success: true, data: pagina });
    } catch (error) {
        next(error);
    }
}

module.exports = { crearMovimiento, listarStock, listarMovimientos };
