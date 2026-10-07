const { ErrorApp } = require('../utilidades/errores');

// GET /api/v1/tablero/inicio — filtros del query. `empresa_id` NUNCA se lee del
// query: el tenant sale del token en el servicio.
const DIAS_DEFAULT = 30;
const DIAS_MIN = 7;
const DIAS_MAX = 90;

// El query debe ser un objeto plano (Express lo entrega como tal).
function validarCuerpoObjeto(query) {
    if (query === null || typeof query !== 'object' || Array.isArray(query)) {
        throw new ErrorApp(400, 'Filtros de entrada inválidos');
    }
    return query;
}

// Convierte number o string numérico a Number finito; rechaza booleanos para que
// `?dias=true` no se interprete silenciosamente como número.
function aNumeroQuery(valor, campo) {
    if (typeof valor === 'boolean') {
        throw new ErrorApp(400, `El campo ${campo} debe ser numérico`);
    }
    const esTextoVacio = typeof valor === 'string' && valor.trim() === '';
    const numero = typeof valor === 'number' ? valor : Number(valor);
    if (esTextoVacio || !Number.isFinite(numero)) {
        throw new ErrorApp(400, `El campo ${campo} debe ser numérico`);
    }
    return numero;
}

// `dias`: entero entre 7 y 90 (default 30). Ausente/vacío -> default.
function normalizarDias(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return DIAS_DEFAULT;
    }
    const numero = aNumeroQuery(valor, 'dias');
    if (!Number.isInteger(numero) || numero < DIAS_MIN || numero > DIAS_MAX) {
        throw new ErrorApp(
            400,
            `El campo dias debe ser un entero entre ${DIAS_MIN} y ${DIAS_MAX}`,
        );
    }
    return numero;
}

// `sucursal_id`: entero positivo opcional. Ausente/vacío -> undefined.
function normalizarSucursalId(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return undefined;
    }
    const id = aNumeroQuery(valor, 'sucursal_id');
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ErrorApp(400, 'El campo sucursal_id debe ser un entero positivo');
    }
    return id;
}

// Devuelve solo los filtros del contrato (ignora cualquier otro parámetro).
function validarFiltrosTablero(query) {
    const parametros = validarCuerpoObjeto(query || {});
    return {
        dias: normalizarDias(parametros.dias),
        sucursal_id: normalizarSucursalId(parametros.sucursal_id),
    };
}

module.exports = { validarFiltrosTablero };
