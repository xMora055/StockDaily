const servicioClientes = require('../servicios/clientes');

// GET /api/v1/clientes
// -> { success, data: { items: [Cliente], pagina, por_pagina, total, total_paginas } }
async function listar(req, res, next) {
    try {
        const pagina = await servicioClientes.listarClientes(
            req.usuario,
            req.validado.query,
        );
        res.status(200).json({ success: true, data: pagina });
    } catch (error) {
        next(error);
    }
}

// POST /api/v1/clientes  ->  { success, data: { cliente } } (201)
async function crear(req, res, next) {
    try {
        const { cliente } = await servicioClientes.crearCliente(
            req.usuario,
            req.validado.body,
        );
        res.status(201).json({ success: true, data: { cliente } });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/clientes/:id  ->  { success, data: { cliente } }
async function obtener(req, res, next) {
    try {
        const { cliente } = await servicioClientes.obtenerCliente(
            req.usuario,
            req.validado.params.id,
        );
        res.status(200).json({ success: true, data: { cliente } });
    } catch (error) {
        next(error);
    }
}

// PATCH /api/v1/clientes/:id  ->  { success, data: { cliente } }
async function actualizar(req, res, next) {
    try {
        const { cliente } = await servicioClientes.actualizarCliente(
            req.usuario,
            req.validado.params.id,
            req.validado.body,
        );
        res.status(200).json({ success: true, data: { cliente } });
    } catch (error) {
        next(error);
    }
}

module.exports = { listar, crear, obtener, actualizar };
