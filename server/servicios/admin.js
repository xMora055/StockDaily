const bcrypt = require('bcrypt');
const { enTransaccion } = require('../db/pool');
const { ErrorApp } = require('../utilidades/errores');
const empresas = require('../repositorios/empresas');
const usuarios = require('../repositorios/usuarios');

const NOMBRE_DUPLICADO = '23505'; // unique_violation de PostgreSQL
const BIGINT_FUERA_RANGO = '22003'; // numeric_value_out_of_range de PostgreSQL
const CHECK_VIOLATION = '23514'; // check_violation de PostgreSQL
const PASSWORD_TEMPORAL = '123';
const COSTO_BCRYPT = 10;

function errorEmpresaNoEncontrada() {
    return new ErrorApp(404, 'Empresa no encontrada');
}

function errorUsuarioNoEncontrado() {
    return new ErrorApp(404, 'Administrador no encontrado');
}

function errorCorreoDuplicado(correo) {
    return new ErrorApp(409, `El correo ${correo} ya está registrado en esta empresa`);
}

function errorIdEmpresaInvalido() {
    return new ErrorApp(400, 'El id de la empresa no es válido');
}

function errorIdUsuarioInvalido() {
    return new ErrorApp(400, 'El id del usuario no es válido');
}

function traducirErrorId(error, tipo = 'empresa') {
    if (error.code === BIGINT_FUERA_RANGO) {
        return tipo === 'empresa' ? errorIdEmpresaInvalido() : errorIdUsuarioInvalido();
    }
    return error;
}

function armarPagina({ items, total }, pagina, porPagina) {
    return {
        items,
        pagina,
        por_pagina: porPagina,
        total,
        total_paginas: Math.ceil(total / porPagina),
    };
}

async function hashPasswordTemporal() {
    return bcrypt.hash(PASSWORD_TEMPORAL, COSTO_BCRYPT);
}

function manejarUniqueViolation(error, correo) {
    if (error.code === NOMBRE_DUPLICADO) {
        // El unique_violation puede venir por (empresa_id, correo) o por nombre de empresa.
        // Si el mensaje menciona correo, es duplicado de admin; si no, asumimos empresa.
        if (error.message && /correo/i.test(error.message)) {
            throw errorCorreoDuplicado(correo);
        }
        throw new ErrorApp(409, 'Ya existe una empresa con ese nombre');
    }
    if (error.code === CHECK_VIOLATION) {
        throw new ErrorApp(400, 'Los datos no cumplen las reglas del sistema');
    }
    throw error;
}

// ============= Empresas =============

async function listarEmpresas(_usuario, filtros) {
    const { items, total } = await empresas.listar(filtros);
    return armarPagina({ items, total }, filtros.pagina, filtros.por_pagina);
}

async function crearEmpresaConAdmin(_usuario, datos) {
    const { empresa, admin } = datos;

    if (await empresas.existeNombre(empresa.nombre)) {
        throw new ErrorApp(409, `Ya existe una empresa con el nombre ${empresa.nombre}`);
    }

    try {
        const resultado = await enTransaccion(async (cliente) => {
            const empresaCreada = await empresas.crear(empresa, cliente);

            if (await usuarios.existeCorreoEnEmpresa(empresaCreada.id, admin.correo, null, cliente)) {
                throw errorCorreoDuplicado(admin.correo);
            }

            const passwordHash = await hashPasswordTemporal();
            const administradorCreado = await usuarios.crearAdministrador(
                {
                    empresa_id: empresaCreada.id,
                    nombre: admin.nombre,
                    correo: admin.correo,
                    password_hash: passwordHash,
                },
                cliente,
            );

            return { empresa: empresaCreada, administrador: administradorCreado };
        });

        return { ...resultado, password: PASSWORD_TEMPORAL };
    } catch (error) {
        manejarUniqueViolation(error, admin.correo);
        throw error;
    }
}

async function obtenerEmpresa(_usuario, id) {
    try {
        const empresa = await empresas.buscarPorId(id);
        if (!empresa) {
            throw errorEmpresaNoEncontrada();
        }
        const administradores = await usuarios.listarAdministradoresPorEmpresa(empresa.id);
        return { empresa, administradores };
    } catch (error) {
        throw traducirErrorId(error, 'empresa');
    }
}

async function actualizarEmpresa(_usuario, id, cambios) {
    try {
        const existente = await empresas.buscarPorId(id);
        if (!existente) {
            throw errorEmpresaNoEncontrada();
        }

        if (cambios.nombre !== undefined && cambios.nombre !== existente.nombre) {
            if (await empresas.existeNombre(cambios.nombre, id)) {
                throw new ErrorApp(409, `Ya existe una empresa con el nombre ${cambios.nombre}`);
            }
        }

        // Si se desactiva la empresa, desactivar también sus administradores.
        const debeDesactivarAdmins = cambios.activo === false && existente.activo === true;

        const empresa = await enTransaccion(async (cliente) => {
            const actualizada = await empresas.actualizar(id, cambios, cliente);
            if (!actualizada) {
                throw errorEmpresaNoEncontrada();
            }
            if (debeDesactivarAdmins) {
                await usuarios.desactivarAdministradoresPorEmpresa(id, cliente);
            }
            return actualizada;
        });

        return { empresa };
    } catch (error) {
        if (error.code === BIGINT_FUERA_RANGO) {
            throw errorIdEmpresaInvalido();
        }
        if (error.code === NOMBRE_DUPLICADO) {
            throw new ErrorApp(409, `Ya existe una empresa con el nombre ${cambios.nombre}`);
        }
        throw error;
    }
}

// ============= Administradores =============

async function listarAdministradores(_usuario, filtros) {
    const { items, total } = await usuarios.listarAdministradores(filtros);
    return armarPagina({ items, total }, filtros.pagina, filtros.por_pagina);
}

async function crearAdministrador(_usuario, datos) {
    const empresa = await empresas.buscarPorId(datos.empresa_id);
    if (!empresa) {
        throw errorEmpresaNoEncontrada();
    }

    if (await usuarios.existeCorreoEnEmpresa(datos.empresa_id, datos.correo)) {
        throw errorCorreoDuplicado(datos.correo);
    }

    try {
        const passwordHash = await hashPasswordTemporal();
        const usuario = await usuarios.crearAdministrador({
            empresa_id: datos.empresa_id,
            nombre: datos.nombre,
            correo: datos.correo,
            password_hash: passwordHash,
        });
        return { usuario, password: PASSWORD_TEMPORAL };
    } catch (error) {
        manejarUniqueViolation(error, datos.correo);
        throw error;
    }
}

async function obtenerAdministrador(_usuario, id) {
    try {
        const usuario = await usuarios.buscarPorIdPublico(id);
        if (!usuario || usuario.rol !== 'administrador') {
            throw errorUsuarioNoEncontrado();
        }
        return { usuario };
    } catch (error) {
        throw traducirErrorId(error, 'usuario');
    }
}

async function actualizarAdministrador(_usuario, id, cambios) {
    try {
        const existente = await usuarios.buscarPorId(id);
        if (!existente || existente.rol !== 'administrador') {
            throw errorUsuarioNoEncontrado();
        }

        if (cambios.correo !== undefined && cambios.correo !== existente.correo) {
            if (await usuarios.existeCorreoEnEmpresa(existente.empresa_id, cambios.correo, id)) {
                throw errorCorreoDuplicado(cambios.correo);
            }
        }

        const usuario = await usuarios.actualizarAdministrador(id, cambios);
        if (!usuario) {
            throw errorUsuarioNoEncontrado();
        }
        return { usuario };
    } catch (error) {
        if (error.code === BIGINT_FUERA_RANGO) {
            throw errorIdUsuarioInvalido();
        }
        if (error.code === NOMBRE_DUPLICADO) {
            throw errorCorreoDuplicado(cambios.correo);
        }
        throw error;
    }
}

module.exports = {
    listarEmpresas,
    crearEmpresaConAdmin,
    obtenerEmpresa,
    actualizarEmpresa,
    listarAdministradores,
    crearAdministrador,
    obtenerAdministrador,
    actualizarAdministrador,
};
