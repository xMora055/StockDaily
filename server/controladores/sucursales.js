const servicioSucursales = require('../servicios/sucursales');

// GET /api/v1/sucursales
// -> { success, data: { items: [Sucursal], pagina, por_pagina, total, total_paginas } }
async function listar(req, res, next) {
    try {
        const pagina = await servicioSucursales.listarSucursales(
            req.usuario,
            req.validado.query,
        );
        res.status(200).json({ success: true, data: pagina });
    } catch (error) {
        next(error);
    }
}

// POST /api/v1/sucursales  ->  { success, data: { sucursal } } (201)
async function crear(req, res, next) {
    try {
        const { sucursal } = await servicioSucursales.crearSucursal(
            req.usuario,
            req.validado.body,
        );
        res.status(201).json({ success: true, data: { sucursal } });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/sucursales/:id  ->  { success, data: { sucursal } }
async function obtener(req, res, next) {
    try {
        const { sucursal } = await servicioSucursales.obtenerSucursal(
            req.usuario,
            req.validado.params.id,
        );
        res.status(200).json({ success: true, data: { sucursal } });
    } catch (error) {
        next(error);
    }
}

// PATCH /api/v1/sucursales/:id  ->  { success, data: { sucursal } }
async function actualizar(req, res, next) {
    try {
        const { sucursal } = await servicioSucursales.actualizarSucursal(
            req.usuario,
            req.validado.params.id,
            req.validado.body,
        );
        res.status(200).json({ success: true, data: { sucursal } });
    } catch (error) {
        next(error);
    }
}

module.exports = { listar, crear, obtener, actualizar };
