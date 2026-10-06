const { ErrorApp } = require('../utilidades/errores');

// Límites alineados con las columnas de `factura`/`detalle_factura` en schema.sql.
const CLIENTE_NOMBRE_MAX = 150; // factura.cliente_nombre varchar(150)
const CLIENTE_DOCUMENTO_MAX = 30; // factura.cliente_documento varchar(30)
const MONTO_MAX = 999999999999.99; // numeric(14,2)
// Cota comercial por línea para retail: aunque `detalle_factura.cantidad` es
// integer (máx. 2147483647), aceptar un valor tan alto desbordaría el saldo
// `stock.cantidad` (integer) dentro del trigger `aplicar_movimiento_inventario`,
// devolviendo 500. Se limita a 1.000.000 unidades por línea (400 por encima).
const CANTIDAD_MAX = 1000000;

// El cuerpo debe ser un objeto plano (no null, array ni escalar).
function validarCuerpoObjeto(cuerpo) {
    if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
        throw new ErrorApp(400, 'Datos de entrada inválidos');
    }
    return cuerpo;
}

// `hasOwnProperty` distingue "campo ausente" de "campo presente con null/0/''".
function tiene(objeto, clave) {
    return Object.prototype.hasOwnProperty.call(objeto, clave);
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

function normalizarIdObligatorio(valor, campo) {
    const id = aNumero(valor, campo);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ErrorApp(400, `El campo ${campo} debe ser un entero positivo`);
    }
    return id;
}

// Id opcional: ausente/null se normaliza a null.
function normalizarIdOpcional(valor, campo) {
    if (valor === undefined || valor === null) {
        return null;
    }
    return normalizarIdObligatorio(valor, campo);
}

// Texto opcional: ausente/null/'' se normaliza a null; límite de columna.
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

// Descuento global: monto absoluto >= 0 (default 0).
function normalizarDescuentoGlobal(valor) {
    if (valor === undefined || valor === null) {
        return 0;
    }
    const descuento = aNumero(valor, 'descuento');
    if (descuento < 0) {
        throw new ErrorApp(400, 'El descuento no puede ser negativo');
    }
    if (descuento > MONTO_MAX) {
        throw new ErrorApp(400, 'El descuento es demasiado alto');
    }
    return descuento;
}

function normalizarCantidad(valor, productoId) {
    const cantidad = aNumero(valor, 'cantidad');
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw new ErrorApp(
            400,
            `La cantidad del producto ${productoId} debe ser un entero mayor que 0`,
        );
    }
    if (cantidad > CANTIDAD_MAX) {
        throw new ErrorApp(
            400,
            `La cantidad del producto ${productoId} supera el máximo permitido (${CANTIDAD_MAX})`,
        );
    }
    return cantidad;
}

function normalizarDescuentoLinea(valor, productoId) {
    if (valor === undefined || valor === null) {
        return 0;
    }
    const descuento = aNumero(valor, 'descuento_porcentaje');
    if (descuento < 0 || descuento > 100) {
        throw new ErrorApp(
            400,
            `El descuento del producto ${productoId} debe estar entre 0 y 100`,
        );
    }
    return descuento;
}

function normalizarLinea(linea, indice) {
    if (linea === null || typeof linea !== 'object' || Array.isArray(linea)) {
        throw new ErrorApp(400, `La línea ${indice} no es válida`);
    }
    const productoId = normalizarIdObligatorio(linea.producto_id, 'producto_id');
    return {
        producto_id: productoId,
        cantidad: normalizarCantidad(linea.cantidad, productoId),
        descuento_porcentaje: normalizarDescuentoLinea(linea.descuento_porcentaje, productoId),
    };
}

// `lineas` debe ser un array con al menos una línea y sin producto_id repetido
// (detalle_factura es única por producto; el frontend debe consolidar).
function normalizarLineas(valor) {
    if (!Array.isArray(valor) || valor.length === 0) {
        throw new ErrorApp(400, 'Debes incluir al menos una línea de venta');
    }
    const lineas = valor.map((linea, indice) => normalizarLinea(linea, indice + 1));

    const vistos = new Set();
    for (const linea of lineas) {
        if (vistos.has(linea.producto_id)) {
            throw new ErrorApp(
                400,
                `El producto ${linea.producto_id} está repetido en las líneas; consolídalo en una sola`,
            );
        }
        vistos.add(linea.producto_id);
    }
    return lineas;
}

// PATCH /api/v1/facturas/:id/anular — id endurecido (lección SD-003): SOLO
// dígitos y entero seguro. Un bigint fuera de rango o con formato inválido se
// responde como 400, nunca 500.
function validarIdFactura(params) {
    const parametros = validarCuerpoObjeto(params || {});
    const crudo = parametros.id;

    if (typeof crudo !== 'string' || !/^\d+$/.test(crudo)) {
        throw new ErrorApp(400, 'El id de la factura no es válido');
    }

    const id = Number(crudo);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ErrorApp(400, 'El id de la factura no es válido');
    }
    return { id };
}

// ---------------------------------------------------------------------------
// GET /api/v1/facturas — filtros del listado (paginación + sucursal, estado,
// rango de fechas y búsqueda libre). `empresa_id` NUNCA se lee del query.
// ---------------------------------------------------------------------------
const PAGINA_DEFAULT = 1;
const POR_PAGINA_DEFAULT = 10;
const POR_PAGINA_MAX = 100;
const BUSCAR_MAX = 150; // factura.cliente_nombre varchar(150)
const ESTADOS = ['emitida', 'anulada'];

// Igual que `aNumero` pero rechaza booleanos explícitamente: en un query string
// `?pagina=true` no debe convertirse silenciosamente en 1.
function aNumeroQuery(valor, campo) {
    if (typeof valor === 'boolean') {
        throw new ErrorApp(400, `El campo ${campo} debe ser numérico`);
    }
    return aNumero(valor, campo);
}

// `pagina` entero >= 1 (default 1). No se acepta 0, negativos ni decimales.
function normalizarPagina(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return PAGINA_DEFAULT;
    }
    const numero = aNumeroQuery(valor, 'pagina');
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
    const numero = aNumeroQuery(valor, 'por_pagina');
    if (!Number.isInteger(numero) || numero < 1 || numero > POR_PAGINA_MAX) {
        throw new ErrorApp(
            400,
            `El campo por_pagina debe ser un entero entre 1 y ${POR_PAGINA_MAX}`,
        );
    }
    return numero;
}

// Id opcional de query: ausente/null/'' se omite del filtro. Usa el helper de
// query para rechazar booleanos (`?sucursal_id=true` no es un entero válido).
function normalizarIdOpcionalQuery(valor, campo) {
    if (valor === undefined || valor === null || valor === '') {
        return undefined;
    }
    const id = aNumeroQuery(valor, campo);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ErrorApp(400, `El campo ${campo} debe ser un entero positivo`);
    }
    return id;
}

function normalizarEstado(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return undefined;
    }
    if (typeof valor !== 'string' || !ESTADOS.includes(valor)) {
        throw new ErrorApp(400, 'El estado debe ser "emitida" o "anulada"');
    }
    return valor;
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

// Texto de búsqueda libre (número de factura o cliente), opcional.
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

// GET /api/v1/facturas — devuelve solo los filtros del contrato (ignora el
// resto de parámetros). Valores inválidos -> 400.
function validarFiltrosFacturas(query) {
    const parametros = validarCuerpoObjeto(query || {});
    const filtros = {};

    const sucursalId = normalizarIdOpcionalQuery(parametros.sucursal_id, 'sucursal_id');
    if (sucursalId !== undefined) filtros.sucursal_id = sucursalId;

    const estado = normalizarEstado(parametros.estado);
    if (estado !== undefined) filtros.estado = estado;

    const desde = normalizarFechaQuery(parametros.desde, 'desde');
    if (desde !== undefined) filtros.desde = desde;

    const hasta = normalizarFechaQuery(parametros.hasta, 'hasta');
    if (hasta !== undefined) filtros.hasta = hasta;

    const buscar = normalizarBuscar(parametros.buscar);
    if (buscar !== undefined) filtros.buscar = buscar;

    filtros.pagina = normalizarPagina(parametros.pagina);
    filtros.por_pagina = normalizarPorPagina(parametros.por_pagina);

    return filtros;
}

// POST /api/v1/facturas — devuelve solo los campos del contrato.
// Ignora explícitamente empresa_id y cualquier campo extra (anti-IDOR).
function validarCreacionFactura(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    return {
        sucursal_id: normalizarIdObligatorio(datos.sucursal_id, 'sucursal_id'),
        metodo_pago_id: normalizarIdOpcional(datos.metodo_pago_id, 'metodo_pago_id'),
        cliente_id: normalizarIdOpcional(datos.cliente_id, 'cliente_id'),
        cliente_nombre: normalizarTextoOpcional(
            datos.cliente_nombre,
            'cliente_nombre',
            CLIENTE_NOMBRE_MAX,
        ),
        cliente_documento: normalizarTextoOpcional(
            datos.cliente_documento,
            'cliente_documento',
            CLIENTE_DOCUMENTO_MAX,
        ),
        descuento: normalizarDescuentoGlobal(datos.descuento),
        lineas: normalizarLineas(datos.lineas),
    };
}

module.exports = { validarCreacionFactura, validarIdFactura, validarFiltrosFacturas };
