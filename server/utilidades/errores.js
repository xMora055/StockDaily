// Error de aplicación con status HTTP asociado.
// Permite que la capa de rutas/servicios lance errores controlados
// sin acoplarse a `res` y que el manejador central los formatee.
class ErrorApp extends Error {
    constructor(status, mensaje) {
        super(mensaje);
        this.name = 'ErrorApp';
        this.status = status;
    }
}

module.exports = { ErrorApp };
