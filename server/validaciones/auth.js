const { ErrorApp } = require('../utilidades/errores');

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARGO_CORREO_MAX = 150; // coincide con usuario.correo varchar(150)
const LARGO_PASSWORD_MAX = 200;

// Valida y normaliza el cuerpo del login. Lanza ErrorApp(400) ante datos
// inválidos; el manejador central los formatea. No consulta la base de datos.
function validarLogin(cuerpo) {
    if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
        throw new ErrorApp(400, 'Datos de entrada inválidos');
    }

    const correo = typeof cuerpo.correo === 'string' ? cuerpo.correo.trim().toLowerCase() : '';
    const password = typeof cuerpo.password === 'string' ? cuerpo.password : '';

    if (!correo) {
        throw new ErrorApp(400, 'El correo es obligatorio');
    }
    if (correo.length > LARGO_CORREO_MAX) {
        throw new ErrorApp(400, 'El correo es demasiado largo');
    }
    if (!CORREO_REGEX.test(correo)) {
        throw new ErrorApp(400, 'El correo no tiene un formato válido');
    }
    if (!password) {
        throw new ErrorApp(400, 'La contraseña es obligatoria');
    }
    if (password.length > LARGO_PASSWORD_MAX) {
        throw new ErrorApp(400, 'La contraseña es demasiado larga');
    }

    return { correo, password };
}

module.exports = { validarLogin };
