const servicioFacturas = require('../servicios/facturas');

// POST /api/v1/facturas  ->  { success, data: { factura } } (201)
async function crear(req, res, next) {
    try {
        const { factura } = await servicioFacturas.registrarVenta(
            req.usuario,
            req.validado.body,
        );
        res.status(201).json({ success: true, data: { factura } });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/facturas
// -> { success, data: { items: [FacturaResumen], pagina, por_pagina, total, total_paginas } }
async function listar(req, res, next) {
    try {
        const pagina = await servicioFacturas.listarFacturas(
            req.usuario,
            req.validado.query,
        );
        res.status(200).json({ success: true, data: pagina });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/facturas/:id  ->  { success, data: { factura } }
async function obtener(req, res, next) {
    try {
        const { factura } = await servicioFacturas.obtenerFactura(
            req.usuario,
            req.validado.params.id,
        );
        res.status(200).json({ success: true, data: { factura } });
    } catch (error) {
        next(error);
    }
}

// PATCH /api/v1/facturas/:id/anular  ->  { success, data: { factura } } (200)
async function anular(req, res, next) {
    try {
        const { factura } = await servicioFacturas.anularFactura(
            req.usuario,
            req.validado.params.id,
        );
        res.status(200).json({ success: true, data: { factura } });
    } catch (error) {
        next(error);
    }
}

module.exports = { crear, listar, obtener, anular };
