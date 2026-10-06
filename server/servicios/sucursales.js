const { ErrorApp } = require('../utilidades/errores');
const sucursales = require('../repositorios/sucursales');

const NOMBRE_DUPLICADO = '23505'; // unique_violation de PostgreSQL
const BIGINT_FUERA_RANGO = '22003'; // numeric_value_out_of_range de PostgreSQL

// Deriva el tenant del token. Nunca se acepta empresa_id del body/query.
function empresaDelUsuario(usuario) {
    const empresaId = usuario && usuario.empresa_id;
    if (empresaId === null || empresaId === undefined) {
        throw new ErrorApp(403, 'Tu usuario no pertenece a una empresa');
    }
    return Number(empresaId);
}

function errorNombreDuplicado(nombre) {
    return new ErrorApp(409, `Ya existe una sucursal con el nombre ${nombre}`);
}

function errorIdInvalido() {
    return new ErrorApp(400, 'El id de la sucursal no es válido');
}

// Defensa en profundidad: aunque el validador ya exige un entero seguro, si
// PostgreSQL rechaza el bigint por fuera de rango (22003) debe ser 400, no 500.
function traducirErrorId(error) {
    return error.code === BIGINT_FUERA_RANGO ? errorIdInvalido() : error;
}

// Arma el sobre paginado que exige el contrato de listados.
function armarPagina({ items, total }, pagina, porPagina) {
    return {
        items,
        pagina,
        por_pagina: porPagina,
        total,
        total_paginas: Math.ceil(total / porPagina),
    };
}

// Lista las sucursales de la empresa del usuario autenticado (paginadas).
async function listarSucursales(usuario, filtros) {
    const empresaId = empresaDelUsuario(usuario);
    const { items, total } = await sucursales.listar(empresaId, filtros);
    return armarPagina({ items, total }, filtros.pagina, filtros.por_pagina);
}

// Crea una sucursal para la empresa del usuario autenticado.
async function crearSucursal(usuario, datos) {
    const empresaId = empresaDelUsuario(usuario);

    if (await sucursales.existeNombre(empresaId, datos.nombre)) {
        throw errorNombreDuplicado(datos.nombre);
    }

    try {
        const sucursal = await sucursales.crear(empresaId, datos);
        return { sucursal };
    } catch (error) {
        // Condición de carrera: la restricción UNIQUE (empresa_id, nombre) es
        // la última defensa aunque dos peticiones pasen la verificación previa.
        if (error.code === NOMBRE_DUPLICADO) {
            throw errorNombreDuplicado(datos.nombre);
        }
        throw error;
    }
}

// Obtiene una sucursal propia; 404 si no existe o pertenece a otra empresa.
async function obtenerSucursal(usuario, id) {
    const empresaId = empresaDelUsuario(usuario);
    try {
        const sucursal = await sucursales.buscarPorId(id, empresaId);
        if (!sucursal) {
            throw new ErrorApp(404, 'Sucursal no encontrada');
        }
        return { sucursal };
    } catch (error) {
        throw traducirErrorId(error);
    }
}

// Edita campos presentes y activa/desactiva (borrado lógico vía `activo`).
async function actualizarSucursal(usuario, id, cambios) {
    const empresaId = empresaDelUsuario(usuario);

    try {
        const existente = await sucursales.buscarPorId(id, empresaId);
        if (!existente) {
            throw new ErrorApp(404, 'Sucursal no encontrada');
        }

        if (cambios.nombre !== undefined && cambios.nombre !== existente.nombre) {
            if (await sucursales.existeNombre(empresaId, cambios.nombre, id)) {
                throw errorNombreDuplicado(cambios.nombre);
            }
        }

        const sucursal = await sucursales.actualizar(id, empresaId, cambios);
        if (!sucursal) {
            throw new ErrorApp(404, 'Sucursal no encontrada');
        }
        return { sucursal };
    } catch (error) {
        if (error.code === BIGINT_FUERA_RANGO) {
            throw errorIdInvalido();
        }
        if (error.code === NOMBRE_DUPLICADO) {
            throw errorNombreDuplicado(cambios.nombre);
        }
        throw error;
    }
}

module.exports = {
    listarSucursales,
    crearSucursal,
    obtenerSucursal,
    actualizarSucursal,
};
