const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { entorno } = require('../config/entorno');
const { ErrorApp } = require('../utilidades/errores');
const usuarios = require('../repositorios/usuarios');

// Proyección pública del usuario: nunca expone password_hash.
function aUsuarioPublico(usuario) {
    return {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        empresa_id: usuario.empresa_id,
        empresa: usuario.empresa,
    };
}

// Regla de negocio del login. No conoce req/res.
async function iniciarSesion({ correo, password }) {
    const candidatos = await usuarios.buscarPorCorreoConEmpresa(correo);
    const activos = candidatos.filter((usuario) => usuario.activo);

    // El correo es único por empresa, así que puede existir en varias.
    // Si hay más de un usuario ACTIVO, no elegimos arbitrariamente.
    if (activos.length > 1) {
        throw new ErrorApp(
            409,
            'El correo está asociado a más de una empresa; contacta al administrador',
        );
    }

    if (activos.length === 0) {
        if (candidatos.length > 0) {
            // Existe, pero desactivado (borrado lógico).
            throw new ErrorApp(403, 'Tu usuario está desactivado');
        }
        // No existe: mensaje genérico para no revelar si el correo está registrado.
        throw new ErrorApp(401, 'Correo o contraseña incorrectos');
    }

    const usuario = activos[0];
    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) {
        throw new ErrorApp(401, 'Correo o contraseña incorrectos');
    }

    // El payload alimenta req.usuario para el aislamiento multi-tenant.
    const token = jwt.sign(
        {
            id: usuario.id,
            empresa_id: usuario.empresa_id,
            nombre: usuario.nombre,
            correo: usuario.correo,
            rol: usuario.rol,
        },
        entorno.jwt.secreto,
        { expiresIn: entorno.jwt.expiracion },
    );

    return { token, usuario: aUsuarioPublico(usuario) };
}

// Datos frescos del usuario autenticado; 401 si ya no existe o está inactivo.
async function obtenerPerfil(usuarioId) {
    const usuario = await usuarios.buscarPorIdConEmpresa(usuarioId);
    if (!usuario || !usuario.activo) {
        throw new ErrorApp(401, 'Tu sesión ya no es válida');
    }
    return { usuario: aUsuarioPublico(usuario) };
}

module.exports = { iniciarSesion, obtenerPerfil };
