const { ErrorApp } = require('../utilidades/errores');

// Límites alineados con las columnas de `categoria` en schema.sql.
const NOMBRE_MAX = 100; // categoria.nombre varchar(100)

// Filtro `buscar` (nombre).
const BUSCAR_MAX = 100;

// Paginación de GET /api/v1/categorias.
const PAGINA_DEFAULT = 1;
const POR_PAGINA_DEFAULT = 10;
const POR_PAGINA_MAX = 100;

// El cuerpo debe ser un objeto plano (no null, array ni escalar).
function validarCuerpoObjeto(cuerpo) {
    if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
        throw new ErrorApp(400, 'Datos de entrada inválidos');
    }
    return cuerpo;
}

// `hasOwnProperty` distingue "campo ausente" de "campo presente con null/''".
function tiene(objeto, clave) {
    return Object.prototype.hasOwnProperty.call(objeto, clave);
}

// `nombre` obligatorio: texto, trim, no vacío, <= 100.
function normalizarNombre(valor) {
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, 'El nombre debe ser texto');
    }
    const nombre = valor.trim();
    if (!nombre) {
        throw new ErrorApp(400, 'El nombre es obligatorio');
    }
    if (nombre.length > NOMBRE_MAX) {
        throw new ErrorApp(400, `El nombre no puede superar ${NOMBRE_MAX} caracteres`);
    }
    return nombre;
}

function normalizarActivo(valor) {
    if (typeof valor === 'boolean') {
        return valor;
    }
    if (valor === 'true') {
        return true;
    }
    if (valor === 'false') {
        return false;
    }
    throw new ErrorApp(400, 'El campo activo debe ser booleano');
}

// Convierte number o string numérico a Number finito; si no, ErrorApp(400).
function aNumero(valor, campo) {
    const esTextoVacio = typeof valor === 'string' && valor.trim() === '';
    const numero = typeof valor === 'number' ? valor : Number(valor);
    if (esTextoVacio || !Number.isFinite(numero)) {
        throw new ErrorApp(400, `El campo ${campo} debe ser numérico`);
    }
    return numero;
}

// `pagina` entero >= 1 (default 1). No se acepta 0, negativos ni decimales.
function normalizarPagina(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return PAGINA_DEFAULT;
    }
    const numero = aNumero(valor, 'pagina');
    if (!Number.isInteger(numero) || numero < 1) {
        throw new ErrorApp(400, 'El campo pagina debe ser un entero mayor o igual a 1');
    }
    return numero;
}

// `por_pagina` entero entre 1 y 100 (default 10). Fuera de rango -> 400.
function normalizarPorPagina(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return POR_PAGINA_DEFAULT;
    }
    const numero = aNumero(valor, 'por_pagina');
    if (!Number.isInteger(numero) || numero < 1 || numero > POR_PAGINA_MAX) {
        throw new ErrorApp(
            400,
            `El campo por_pagina debe ser un entero entre 1 y ${POR_PAGINA_MAX}`,
        );
    }
    return numero;
}

// Paginación de query: defaults 1 y 10; cualquier valor inválido -> 400.
function normalizarPaginacion(parametros) {
    return {
        pagina: normalizarPagina(parametros.pagina),
        por_pagina: normalizarPorPagina(parametros.por_pagina),
    };
}

// Texto de búsqueda libre por nombre, opcional.
function normalizarBuscar(valor) {
    if (valor === undefined || valor === null) {
        return undefined;
    }
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, 'El campo buscar debe ser texto');
    }
    const buscar = valor.trim();
    if (buscar === '') {
        return undefined;
    }
    if (buscar.length > BUSCAR_MAX) {
        throw new ErrorApp(400, `El campo buscar no puede superar ${BUSCAR_MAX} caracteres`);
    }
    return buscar;
}

// POST /api/v1/categorias — devuelve solo los campos del contrato.
// Ignora explícitamente empresa_id y cualquier campo extra (anti-IDOR).
function validarCreacionCategoria(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    return {
        nombre: normalizarNombre(datos.nombre),
    };
}

// PATCH /api/v1/categorias/:id — solo los campos presentes.
function validarEdicionCategoria(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    const cambios = {};

    if (tiene(datos, 'nombre')) cambios.nombre = normalizarNombre(datos.nombre);
    if (tiene(datos, 'activo')) cambios.activo = normalizarActivo(datos.activo);

    if (Object.keys(cambios).length === 0) {
        throw new ErrorApp(400, 'No se enviaron campos para actualizar');
    }
    return cambios;
}

// GET /api/v1/categorias — paginación + `activo` y `buscar` opcionales.
function validarFiltrosCategorias(query) {
    const parametros = validarCuerpoObjeto(query || {});
    const filtros = {};

    if (tiene(parametros, 'activo') && parametros.activo !== '') {
        filtros.activo = normalizarActivo(parametros.activo);
    }

    const buscar = normalizarBuscar(parametros.buscar);
    if (buscar !== undefined) filtros.buscar = buscar;

    Object.assign(filtros, normalizarPaginacion(parametros));

    return filtros;
}

// GET/PATCH /:id — endurecido (lección SD-003): SOLO dígitos y entero seguro.
// Un bigint fuera de rango o con formato inválido se responde como 400, nunca 500.
function validarIdCategoria(params) {
    const parametros = validarCuerpoObjeto(params || {});
    const crudo = parametros.id;

    if (typeof crudo !== 'string' || !/^\d+$/.test(crudo)) {
        throw new ErrorApp(400, 'El id de la categoría no es válido');
    }

    const id = Number(crudo);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ErrorApp(400, 'El id de la categoría no es válido');
    }
    return { id };
}

module.exports = {
    validarCreacionCategoria,
    validarEdicionCategoria,
    validarFiltrosCategorias,
    validarIdCategoria,
};
