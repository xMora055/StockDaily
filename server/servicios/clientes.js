const { ErrorApp } = require('../utilidades/errores');
const clientes = require('../repositorios/clientes');

const DOCUMENTO_DUPLICADO = '23505'; // unique_violation de PostgreSQL
const BIGINT_FUERA_RANGO = '22003'; // numeric_value_out_of_range de PostgreSQL

// Deriva el tenant del token. Nunca se acepta empresa_id del body/query.
function empresaDelUsuario(usuario) {
    const empresaId = usuario && usuario.empresa_id;
    if (empresaId === null || empresaId === undefined) {
        throw new ErrorApp(403, 'Tu usuario no pertenece a una empresa');
    }
    return Number(empresaId);
}

function errorDocumentoDuplicado() {
    return new ErrorApp(409, 'Ya existe un cliente con el documento indicado en esta sucursal');
}

function errorSucursalNoEncontrada() {
    return new ErrorApp(404, 'Sucursal no encontrada');
}

function errorClienteNoEncontrado() {
    return new ErrorApp(404, 'Cliente no encontrado');
}

function errorIdInvalido() {
    return new ErrorApp(400, 'El id del cliente no es válido');
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

// Lista los clientes de las sucursales de la empresa del usuario (paginados).
async function listarClientes(usuario, filtros) {
    const empresaId = empresaDelUsuario(usuario);
    const { items, total } = await clientes.listar(empresaId, filtros);
    return armarPagina({ items, total }, filtros.pagina, filtros.por_pagina);
}

// Crea un cliente validando que la sucursal pertenezca a la empresa (404) y
// que el documento no esté repetido en esa sucursal (409).
async function crearCliente(usuario, datos) {
    const empresaId = empresaDelUsuario(usuario);

    const sucursal = await clientes.sucursalDeEmpresa(datos.sucursal_id, empresaId);
    if (!sucursal) {
        throw errorSucursalNoEncontrada();
    }

    if (await clientes.existeDocumento(datos.sucursal_id, datos.documento)) {
        throw errorDocumentoDuplicado();
    }

    try {
        const cliente = await clientes.crear(empresaId, datos);
        if (!cliente) {
            throw errorSucursalNoEncontrada();
        }
        return { cliente };
    } catch (error) {
        if (error.code === BIGINT_FUERA_RANGO) {
            throw errorIdInvalido();
        }
        // Condición de carrera: UNIQUE (sucursal_id, documento) es la última
        // defensa aunque dos peticiones pasen la verificación previa.
        if (error.code === DOCUMENTO_DUPLICADO) {
            throw errorDocumentoDuplicado();
        }
        throw error;
    }
}

// Obtiene un cliente propio; 404 si no existe o pertenece a otra empresa.
async function obtenerCliente(usuario, id) {
    const empresaId = empresaDelUsuario(usuario);
    try {
        const cliente = await clientes.buscarPorId(id, empresaId);
        if (!cliente) {
            throw errorClienteNoEncontrado();
        }
        return { cliente };
    } catch (error) {
        throw traducirErrorId(error);
    }
}

// Edita campos presentes y activa/desactiva (borrado lógico vía `activo`).
// `sucursal_id` no llega aquí: el validador lo ignora.
async function actualizarCliente(usuario, id, cambios) {
    const empresaId = empresaDelUsuario(usuario);

    try {
        const existente = await clientes.buscarPorId(id, empresaId);
        if (!existente) {
            throw errorClienteNoEncontrado();
        }

        // El documento null nunca se compara (varios clientes sin documento OK).
        if (cambios.documento !== undefined && cambios.documento !== null) {
            const duplicado = await clientes.existeDocumento(
                existente.sucursal_id,
                cambios.documento,
                id,
            );
            if (duplicado) {
                throw errorDocumentoDuplicado();
            }
        }

        const cliente = await clientes.actualizar(id, empresaId, cambios);
        if (!cliente) {
            throw errorClienteNoEncontrado();
        }
        return { cliente };
    } catch (error) {
        if (error.code === BIGINT_FUERA_RANGO) {
            throw errorIdInvalido();
        }
        if (error.code === DOCUMENTO_DUPLICADO) {
            throw errorDocumentoDuplicado();
        }
        throw error;
    }
}

module.exports = {
    listarClientes,
    crearCliente,
    obtenerCliente,
    actualizarCliente,
};
