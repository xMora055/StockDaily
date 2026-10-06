const { ErrorApp } = require('../utilidades/errores');

// Captura cualquier ruta no registrada y la deriva al manejador de errores.
function noEncontrado(req, res, next) {
    next(new ErrorApp(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

module.exports = { noEncontrado };
