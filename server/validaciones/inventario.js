const { ErrorApp } = require('../utilidades/errores');

// Límites alineados con schema.sql.
const OBSERVACION_MAX = 255; // movimiento_inventario.observacion varchar(255)
const CANTIDAD_MAX = 1000000; // cota comercial; evita desbordar stock.cantidad (integer)

// Paginación común a GET /stock y GET /movimientos (RF-013).
const PAGINA_DEFAULT = 1;
const POR_PAGINA_DEFAULT = 10;
const POR_PAGINA_MAX = 100;

// Tipos que la API de gestión puede crear. `salida_venta`/`anulacion` los
// generan las ventas y anulaciones, nunca este endpoint.
const TIPOS_CREABLES = ['carga_inicial', 'ajuste'];
// Tipos consultables en el historial (incluye los generados por ventas).
const TIPOS_FILTRABLES = ['carga_inicial', 'ajuste', 'salida_venta', 'anulacion'];

// El cuerpo/query debe ser un objeto plano (no null, array ni escalar).
function validarCuerpoObjeto(objeto) {
    if (objeto === null || typeof objeto !== 'object' || Array.isArray(objeto)) {
        throw new ErrorApp(400, 'Datos de entrada inválidos');
    }
    return objeto;
}

// `hasOwnProperty` distingue "campo ausente" de "campo presente con null/0/''".
function tiene(objeto, clave) {
    return Object.prototype.hasOwnProperty.call(objeto, clave);
}

// Convierte number o string numérico a Number finito; si no, ErrorApp(400).
// Rechaza booleanos explícitamente (Number(true) sería 1 y no es un id/cantidad).
function aNumero(valor, campo) {
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

function normalizarIdObligatorio(valor, campo) {
    const id = aNumero(valor, campo);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ErrorApp(400, `El campo ${campo} debe ser un entero positivo`);
    }
    return id;
}

// Id opcional de query: ausente/null/'' se omite del filtro.
function normalizarIdOpcionalQuery(valor, campo) {
    if (valor === undefined || valor === null || valor === '') {
        return undefined;
    }
    return normalizarIdObligatorio(valor, campo);
}

// Texto opcional: ausente/null/'' se normaliza a null; nunca supera la columna.
function normalizarTextoOpcional(valor, campo, maximo) {
    if (valor === undefined || valor === null) {
        return null;
    }
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, `El campo ${campo} debe ser texto`);
    }
    const texto = valor.trim();
    if (texto.length > maximo) {
        throw new ErrorApp(400, `El campo ${campo} no puede superar ${maximo} caracteres`);
    }
    return texto === '' ? null : texto;
}

function normalizarTipoCreable(valor) {
    if (typeof valor !== 'string' || !TIPOS_CREABLES.includes(valor)) {
        throw new ErrorApp(400, 'El tipo debe ser "carga_inicial" o "ajuste"');
    }
    return valor;
}

function normalizarTipoFiltro(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return undefined;
    }
    if (typeof valor !== 'string' || !TIPOS_FILTRABLES.includes(valor)) {
        throw new ErrorApp(400, 'El tipo indicado no es válido');
    }
    return valor;
}

// Cantidad con signo: positiva = entrada, negativa = salida.
function normalizarCantidad(valor) {
    const cantidad = aNumero(valor, 'cantidad');
    if (!Number.isInteger(cantidad) || cantidad === 0) {
        throw new ErrorApp(400, 'La cantidad debe ser un entero distinto de 0');
    }
    if (Math.abs(cantidad) > CANTIDAD_MAX) {
        throw new ErrorApp(
            400,
            `La cantidad no puede superar ${CANTIDAD_MAX} en valor absoluto`,
        );
    }
    return cantidad;
}

// Booleano tolerante para query strings (`true`/`false`/`1`/`0`).
function normalizarBooleanoQuery(valor, campo, porDefecto = false) {
    if (valor === undefined || valor === null || valor === '') {
        return porDefecto;
    }
    if (typeof valor === 'boolean') {
        return valor;
    }
    if (valor === 'true' || valor === '1') {
        return true;
    }
    if (valor === 'false' || valor === '0') {
        return false;
    }
    throw new ErrorApp(400, `El campo ${campo} debe ser booleano`);
}

// Fecha ISO para los filtros `desde`/`hasta`; ausente se omite.
function normalizarFechaQuery(valor, campo) {
    if (valor === undefined || valor === null || valor === '') {
        return undefined;
    }
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, `El campo ${campo} debe ser una fecha ISO`);
    }
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) {
        throw new ErrorApp(400, `El campo ${campo} no es una fecha válida`);
    }
    return fecha.toISOString();
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

// Texto de búsqueda libre (nombre/código), opcional.
function normalizarBuscar(valor) {
    if (valor === undefined || valor === null) {
        return undefined;
    }
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, 'El campo buscar debe ser texto');
    }
    const buscar = valor.trim();
    return buscar === '' ? undefined : buscar;
}

// POST /api/v1/inventario/movimientos — solo los campos del contrato.
// Ignora explícitamente empresa_id y cualquier campo extra (anti-IDOR).
function validarCreacionMovimiento(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    return {
        producto_id: normalizarIdObligatorio(datos.producto_id, 'producto_id'),
        sucursal_id: normalizarIdObligatorio(datos.sucursal_id, 'sucursal_id'),
        tipo: normalizarTipoCreable(datos.tipo),
        cantidad: normalizarCantidad(datos.cantidad),
        observacion: normalizarTextoOpcional(datos.observacion, 'observacion', OBSERVACION_MAX),
    };
}

// GET /api/v1/inventario/stock — filtros opcionales.
function validarFiltrosStock(query) {
    const parametros = validarCuerpoObjeto(query || {});
    const filtros = {};

    const sucursalId = normalizarIdOpcionalQuery(parametros.sucursal_id, 'sucursal_id');
    if (sucursalId !== undefined) filtros.sucursal_id = sucursalId;

    const productoId = normalizarIdOpcionalQuery(parametros.producto_id, 'producto_id');
    if (productoId !== undefined) filtros.producto_id = productoId;

    const buscar = normalizarBuscar(parametros.buscar);
    if (buscar !== undefined) filtros.buscar = buscar;

    filtros.solo_faltantes = tiene(parametros, 'solo_faltantes')
        ? normalizarBooleanoQuery(parametros.solo_faltantes, 'solo_faltantes')
        : false;

    Object.assign(filtros, normalizarPaginacion(parametros));

    return filtros;
}

// GET /api/v1/inventario/movimientos — filtros opcionales.
function validarFiltrosMovimientos(query) {
    const parametros = validarCuerpoObjeto(query || {});
    const filtros = {};

    const productoId = normalizarIdOpcionalQuery(parametros.producto_id, 'producto_id');
    if (productoId !== undefined) filtros.producto_id = productoId;

    const sucursalId = normalizarIdOpcionalQuery(parametros.sucursal_id, 'sucursal_id');
    if (sucursalId !== undefined) filtros.sucursal_id = sucursalId;

    const tipo = normalizarTipoFiltro(parametros.tipo);
    if (tipo !== undefined) filtros.tipo = tipo;

    const desde = normalizarFechaQuery(parametros.desde, 'desde');
    if (desde !== undefined) filtros.desde = desde;

    const hasta = normalizarFechaQuery(parametros.hasta, 'hasta');
    if (hasta !== undefined) filtros.hasta = hasta;

    // `limite` fue reemplazado por `por_pagina` (Revisión 2): se ignora si llega.
    Object.assign(filtros, normalizarPaginacion(parametros));

    return filtros;
}

module.exports = {
    validarCreacionMovimiento,
    validarFiltrosStock,
    validarFiltrosMovimientos,
};
