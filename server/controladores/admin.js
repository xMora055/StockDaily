const servicioAdmin = require('../servicios/admin');

// GET /api/v1/admin/empresas
async function listarEmpresas(req, res, next) {
    try {
        const pagina = await servicioAdmin.listarEmpresas(req.usuario, req.validado.query);
        res.status(200).json({ success: true, data: pagina });
    } catch (error) {
        next(error);
    }
}

// POST /api/v1/admin/empresas
async function crearEmpresa(req, res, next) {
    try {
        const resultado = await servicioAdmin.crearEmpresaConAdmin(req.usuario, req.validado.body);
        res.status(201).json({ success: true, data: resultado });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/admin/empresas/:id
async function obtenerEmpresa(req, res, next) {
    try {
        const resultado = await servicioAdmin.obtenerEmpresa(req.usuario, req.validado.params.id);
        res.status(200).json({ success: true, data: resultado });
    } catch (error) {
        next(error);
    }
}

// PATCH /api/v1/admin/empresas/:id
async function actualizarEmpresa(req, res, next) {
    try {
        const resultado = await servicioAdmin.actualizarEmpresa(
            req.usuario,
            req.validado.params.id,
            req.validado.body,
        );
        res.status(200).json({ success: true, data: resultado });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/admin/usuarios
async function listarAdministradores(req, res, next) {
    try {
        const pagina = await servicioAdmin.listarAdministradores(req.usuario, req.validado.query);
        res.status(200).json({ success: true, data: pagina });
    } catch (error) {
        next(error);
    }
}

// POST /api/v1/admin/usuarios
async function crearAdministrador(req, res, next) {
    try {
        const resultado = await servicioAdmin.crearAdministrador(req.usuario, req.validado.body);
        res.status(201).json({ success: true, data: resultado });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/admin/usuarios/:id
async function obtenerAdministrador(req, res, next) {
    try {
        const resultado = await servicioAdmin.obtenerAdministrador(req.usuario, req.validado.params.id);
        res.status(200).json({ success: true, data: resultado });
    } catch (error) {
        next(error);
    }
}

// PATCH /api/v1/admin/usuarios/:id
async function actualizarAdministrador(req, res, next) {
    try {
        const resultado = await servicioAdmin.actualizarAdministrador(
            req.usuario,
            req.validado.params.id,
            req.validado.body,
        );
        res.status(200).json({ success: true, data: resultado });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    listarEmpresas,
    crearEmpresa,
    obtenerEmpresa,
    actualizarEmpresa,
    listarAdministradores,
    crearAdministrador,
    obtenerAdministrador,
    actualizarAdministrador,
};
