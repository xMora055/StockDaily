const { validarLogin } = require('../validaciones/auth');
const servicioAuth = require('../servicios/auth');

// POST /api/v1/auth/login
async function login(req, res, next) {
    try {
        const { correo, password } = validarLogin(req.body);
        const data = await servicioAuth.iniciarSesion({ correo, password });
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

// GET /api/v1/auth/perfil  (requiere `autenticacion`)
async function perfil(req, res, next) {
    try {
        const data = await servicioAuth.obtenerPerfil(req.usuario.id);
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

module.exports = { login, perfil };
