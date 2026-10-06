const { ErrorApp } = require('../utilidades/errores');
const productos = require('../repositorios/productos');

const CODIGO_DUPLICADO = '23505'; // unique_violation de PostgreSQL

// Deriva el tenant del token. Nunca se acepta empresa_id del body/query.
function empresaDelUsuario(usuario) {
    const empresaId = usuario && usuario.empresa_id;
    if (empresaId === null || empresaId === undefined) {
        throw new ErrorApp(403, 'Tu usuario no pertenece a una empresa');
    }
    return Number(empresaId);
}

// Si se envía categoría, debe existir y ser de la misma empresa (400 si no).
async function validarCategoria(empresaId, categoriaId) {
    if (categoriaId === null || categoriaId === undefined) {
        return;
    }
    const existe = await productos.existeCategoriaDeEmpresa(empresaId, categoriaId);
    if (!existe) {
        throw new ErrorApp(400, 'La categoría no existe o no pertenece a tu empresa');
    }
}

function errorCodigoDuplicado(codigo) {
    return new ErrorApp(409, `Ya existe un producto con el código ${codigo}`);
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

// Lista los productos de la empresa del usuario autenticado (paginados).
async function listarProductos(usuario, filtros) {
    const empresaId = empresaDelUsuario(usuario);
    const { items, total } = await productos.listar(empresaId, filtros);
    return armarPagina({ items, total }, filtros.pagina, filtros.por_pagina);
}

// Crea un producto para la empresa del usuario autenticado.
async function crearProducto(usuario, datos) {
    const empresaId = empresaDelUsuario(usuario);
    await validarCategoria(empresaId, datos.categoria_id);

    if (await productos.existeCodigo(empresaId, datos.codigo)) {
        throw errorCodigoDuplicado(datos.codigo);
    }

    try {
        const producto = await productos.crear(empresaId, datos);
        return { producto };
    } catch (error) {
        // Condición de carrera: la restricción UNIQUE (empresa_id, codigo) es
        // la última defensa aunque dos peticiones pasen la verificación previa.
        if (error.code === CODIGO_DUPLICADO) {
            throw errorCodigoDuplicado(datos.codigo);
        }
        throw error;
    }
}

// Obtiene un producto propio; 404 si no existe o pertenece a otra empresa.
async function obtenerProducto(usuario, id) {
    const empresaId = empresaDelUsuario(usuario);
    const producto = await productos.buscarPorId(id, empresaId);
    if (!producto) {
        throw new ErrorApp(404, 'Producto no encontrado');
    }
    return { producto };
}

// Edita campos presentes y activa/desactiva (borrado lógico vía `activo`).
async function actualizarProducto(usuario, id, cambios) {
    const empresaId = empresaDelUsuario(usuario);

    const existente = await productos.buscarPorId(id, empresaId);
    if (!existente) {
        throw new ErrorApp(404, 'Producto no encontrado');
    }

    await validarCategoria(empresaId, cambios.categoria_id);

    if (cambios.codigo !== undefined && cambios.codigo !== existente.codigo) {
        if (await productos.existeCodigo(empresaId, cambios.codigo, id)) {
            throw errorCodigoDuplicado(cambios.codigo);
        }
    }

    try {
        const producto = await productos.actualizar(id, empresaId, cambios);
        if (!producto) {
            throw new ErrorApp(404, 'Producto no encontrado');
        }
        return { producto };
    } catch (error) {
        if (error.code === CODIGO_DUPLICADO) {
            throw errorCodigoDuplicado(cambios.codigo);
        }
        throw error;
    }
}

module.exports = {
    listarProductos,
    crearProducto,
    obtenerProducto,
    actualizarProducto,
};