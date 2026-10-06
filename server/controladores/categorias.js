const servicioCategorias = require('../servicios/categorias');

// GET /api/v1/categorias
// -> { success, data: { items: [Categoria], pagina, por_pagina, total, total_paginas } }
async function listar(req, res, next) {
    try {
        const pagina = await servicioCategorias.listarCategorias(
            req.usuario,
            req.validado.query,
        );
        res.status(200).json({ success: true, data: pagina });
    } catch (error) {
        next(error);
    }
}

// POST /api/v1/categorias  ->  { success, data: { categoria } } (201)
async function crear(req, res, next) {
    try {
        const { categoria } = await servicioCategorias.crearCategoria(
            req.usuario,
            req.validado.body,
        );
        res.status(201).json({ success: true, data: { categoria } });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/categorias/:id  ->  { success, data: { categoria } }
async function obtener(req, res, next) {
    try {
        const { categoria } = await servicioCategorias.obtenerCategoria(
            req.usuario,
            req.validado.params.id,
        );
        res.status(200).json({ success: true, data: { categoria } });
    } catch (error) {
        next(error);
    }
}

// PATCH /api/v1/categorias/:id  ->  { success, data: { categoria } }
async function actualizar(req, res, next) {
    try {
        const { categoria } = await servicioCategorias.actualizarCategoria(
            req.usuario,
            req.validado.params.id,
            req.validado.body,
        );
        res.status(200).json({ success: true, data: { categoria } });
    } catch (error) {
        next(error);
    }
}

module.exports = { listar, crear, obtener, actualizar };
