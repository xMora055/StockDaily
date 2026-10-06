const servicioProductos = require('../servicios/productos');

// GET /api/v1/productos
// -> { success, data: { items: [Producto], pagina, por_pagina, total, total_paginas } }
async function listar(req, res, next) {
    try {
        const pagina = await servicioProductos.listarProductos(
            req.usuario,
            req.validado.query,
        );
        res.status(200).json({ success: true, data: pagina });
    } catch (error) {
        next(error);
    }
}

// POST /api/v1/productos  ->  { success, data: { producto } } (201)
async function crear(req, res, next) {
    try {
        const { producto } = await servicioProductos.crearProducto(
            req.usuario,
            req.validado.body,
        );
        res.status(201).json({ success: true, data: { producto } });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/productos/:id  ->  { success, data: { producto } }
async function obtener(req, res, next) {
    try {
        const { producto } = await servicioProductos.obtenerProducto(
            req.usuario,
            req.validado.params.id,
        );
        res.status(200).json({ success: true, data: { producto } });
    } catch (error) {
        next(error);
    }
}

// PATCH /api/v1/productos/:id  ->  { success, data: { producto } }
async function actualizar(req, res, next) {
    try {
        const { producto } = await servicioProductos.actualizarProducto(
            req.usuario,
            req.validado.params.id,
            req.validado.body,
        );
        res.status(200).json({ success: true, data: { producto } });
    } catch (error) {
        next(error);
    }
}

module.exports = { listar, crear, obtener, actualizar };