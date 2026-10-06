// Manejador central de errores. Debe declararse después de las rutas
// y llevar los 4 argumentos para que Express lo reconozca.
function manejadorErrores(err, req, res, next) {
    const status = err.status || 500;
    const mensaje = err.status ? err.message : 'Error interno del servidor';

    if (!err.status) {
        console.error('Error no controlado:', err);
    }

    res.status(status).json({ success: false, error: mensaje });
}

module.exports = { manejadorErrores };
