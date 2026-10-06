const jwt = require('jsonwebtoken');
const { entorno } = require('../config/entorno');
const { ErrorApp } = require('../utilidades/errores');

// Verifica el token Bearer y deja la carga útil en req.usuario.
function autenticacion(req, res, next) {
    const encabezado = req.headers.authorization || '';
    const [tipo, token] = encabezado.split(' ');

    if (tipo !== 'Bearer' || !token) {
        return next(new ErrorApp(401, 'Token de autenticación requerido'));
    }

    try {
        req.usuario = jwt.verify(token, entorno.jwt.secreto);
        return next();
    } catch {
        return next(new ErrorApp(401, 'Token inválido o expirado'));
    }
}

module.exports = { autenticacion };
