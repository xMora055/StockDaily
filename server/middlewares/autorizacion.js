const { ErrorApp } = require('../utilidades/errores');

// Restringe el acceso a los roles indicados. Requiere ejecutarse
// después de `autenticacion`, que rellena req.usuario.
// Uso: router.post('/', autenticacion, autorizacion('administrador'), controlador)
function autorizacion(...roles) {
    return (req, res, next) => {
        if (!req.usuario || !roles.includes(req.usuario.rol)) {
            return next(new ErrorApp(403, 'No tienes permisos para realizar esta acción'));
        }
        return next();
    };
}

module.exports = { autorizacion };
