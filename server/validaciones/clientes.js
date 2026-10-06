const { ErrorApp } = require('../utilidades/errores');

// Límites alineados con las columnas de `cliente` en schema.sql.
const NOMBRE_MAX = 150; // cliente.nombre varchar(150)
const DOCUMENTO_MAX = 30; // cliente.documento varchar(30)
const TELEFONO_MAX = 30; // cliente.telefono varchar(30)
const CORREO_MAX = 150; // cliente.correo varchar(150)
const DIRECCION_MAX = 200; // cliente.direccion varchar(200)
const BUSCAR_MAX = 150; // coincide con cliente.nombre varchar(150)

// Formato básico de correo (mismo criterio que validaciones/auth.js).
const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Paginación de GET /api/v1/clientes.
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

// Convierte number o string numérico a Number finito; si no, ErrorApp(400).
function aNumero(valor, campo) {
    const esTextoVacio = typeof valor === 'string' && valor.trim() === '';
    const numero = typeof valor === 'number' ? valor : Number(valor);
    if (esTextoVacio || !Number.isFinite(numero)) {
        throw new ErrorApp(400, `El campo ${campo} debe ser numérico`);
    }
    return numero;
}

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

// Campo opcional: ausente/null/'' se normaliza a null (regla de negocio).
function normalizarOpcional(valor, campo, maximo) {
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

// Correo opcional con formato básico (solo se valida si viene con contenido).
function normalizarCorreo(valor) {
    if (valor === undefined || valor === null) {
        return null;
    }
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, 'El correo debe ser texto');
    }
    const correo = valor.trim();
    if (correo === '') {
        return null;
    }
    if (correo.length > CORREO_MAX) {
        throw new ErrorApp(400, `El correo no puede superar ${CORREO_MAX} caracteres`);
    }
    if (!CORREO_REGEX.test(correo)) {
        throw new ErrorApp(400, 'El correo no tiene un formato válido');
    }
    return correo;
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

// Entero seguro positivo (ids de sucursal/cliente): rechaza texto no numérico,
// booleanos, null, decimales y bigints fuera del rango seguro de JS.
function normalizarEnteroPositivo(valor, campo) {
    if (typeof valor !== 'number' && typeof valor !== 'string') {
        throw new ErrorApp(400, `El campo ${campo} debe ser un entero positivo`);
    }
    const numero = aNumero(valor, campo);
    if (!Number.isSafeInteger(numero) || numero <= 0) {
        throw new ErrorApp(400, `El campo ${campo} debe ser un entero positivo`);
    }
    return numero;
}

// `sucursal_id` obligatorio en POST (desde el body).
function normalizarIdObligatorio(valor, campo) {
    return normalizarEnteroPositivo(valor, campo);
}

// `sucursal_id` opcional en query: ausente/vacío = sin filtro.
function normalizarIdOpcionalQuery(valor, campo) {
    if (valor === undefined || valor === null || valor === '') {
        return undefined;
    }
    return normalizarEnteroPositivo(valor, campo);
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

// Texto de búsqueda libre (nombre o documento), opcional.
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

// POST /api/v1/clientes — devuelve solo los campos del contrato.
// Ignora explícitamente empresa_id y cualquier campo extra (anti-IDOR).
function validarCreacionCliente(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    return {
        sucursal_id: normalizarIdObligatorio(datos.sucursal_id, 'sucursal_id'),
        nombre: normalizarNombre(datos.nombre),
        documento: normalizarOpcional(datos.documento, 'documento', DOCUMENTO_MAX),
        telefono: normalizarOpcional(datos.telefono, 'telefono', TELEFONO_MAX),
        correo: normalizarCorreo(datos.correo),
        direccion: normalizarOpcional(datos.direccion, 'direccion', DIRECCION_MAX),
    };
}

// PATCH /api/v1/clientes/:id — solo los campos presentes.
// `sucursal_id` NO es editable: aunque venga, se ignora.
function validarEdicionCliente(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    const cambios = {};

    if (tiene(datos, 'nombre')) cambios.nombre = normalizarNombre(datos.nombre);
    if (tiene(datos, 'documento')) {
        cambios.documento = normalizarOpcional(datos.documento, 'documento', DOCUMENTO_MAX);
    }
    if (tiene(datos, 'telefono')) {
        cambios.telefono = normalizarOpcional(datos.telefono, 'telefono', TELEFONO_MAX);
    }
    if (tiene(datos, 'correo')) cambios.correo = normalizarCorreo(datos.correo);
    if (tiene(datos, 'direccion')) {
        cambios.direccion = normalizarOpcional(datos.direccion, 'direccion', DIRECCION_MAX);
    }
    if (tiene(datos, 'activo')) cambios.activo = normalizarActivo(datos.activo);

    if (Object.keys(cambios).length === 0) {
        throw new ErrorApp(400, 'No se enviaron campos para actualizar');
    }
    return cambios;
}

// GET /api/v1/clientes — filtros opcionales + paginación.
function validarFiltrosClientes(query) {
    const parametros = validarCuerpoObjeto(query || {});
    const filtros = {};

    const sucursalId = normalizarIdOpcionalQuery(parametros.sucursal_id, 'sucursal_id');
    if (sucursalId !== undefined) filtros.sucursal_id = sucursalId;

    if (tiene(parametros, 'activo') && parametros.activo !== '') {
        filtros.activo = normalizarActivo(parametros.activo);
    }

    const buscar = normalizarBuscar(parametros.buscar);
    if (buscar !== undefined) filtros.buscar = buscar;

    Object.assign(filtros, normalizarPaginacion(parametros));

    return filtros;
}

// GET/PATCH /:id — endurecido: SOLO dígitos y entero seguro.
// Un bigint fuera de rango o con formato inválido se responde como 400, nunca 500.
function validarIdCliente(params) {
    const parametros = validarCuerpoObjeto(params || {});
    const crudo = parametros.id;

    if (typeof crudo !== 'string' || !/^\d+$/.test(crudo)) {
        throw new ErrorApp(400, 'El id del cliente no es válido');
    }

    const id = Number(crudo);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ErrorApp(400, 'El id del cliente no es válido');
    }
    return { id };
}

module.exports = {
    validarCreacionCliente,
    validarEdicionCliente,
    validarFiltrosClientes,
    validarIdCliente,
};
