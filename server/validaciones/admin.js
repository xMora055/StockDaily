const { ErrorApp } = require('../utilidades/errores');

// Límites alineados con las columnas de `empresa` y `usuario` en schema.sql.
const EMPRESA_NOMBRE_MAX = 150;
const EMPRESA_DOCUMENTO_MAX = 30;
const EMPRESA_MONEDA_MAX = 3;
const EMPRESA_DIRECCION_MAX = 200;
const EMPRESA_TELEFONO_MAX = 30;
const EMPRESA_CORREO_MAX = 150;
const USUARIO_NOMBRE_MAX = 150;
const USUARIO_CORREO_MAX = 150;

const PAGINA_DEFAULT = 1;
const POR_PAGINA_DEFAULT = 10;
const POR_PAGINA_MAX = 100;

function validarCuerpoObjeto(cuerpo) {
    if (cuerpo === null || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
        throw new ErrorApp(400, 'Datos de entrada inválidos');
    }
    return cuerpo;
}

function tiene(objeto, clave) {
    return Object.prototype.hasOwnProperty.call(objeto, clave);
}

function normalizarTextoObligatorio(valor, campo, maximo) {
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, `El campo ${campo} debe ser texto`);
    }
    const texto = valor.trim();
    if (!texto) {
        throw new ErrorApp(400, `El campo ${campo} es obligatorio`);
    }
    if (texto.length > maximo) {
        throw new ErrorApp(400, `El campo ${campo} no puede superar ${maximo} caracteres`);
    }
    return texto;
}

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

function normalizarCorreo(valor, campo = 'correo') {
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, `El campo ${campo} debe ser texto`);
    }
    const correo = valor.trim().toLowerCase();
    if (!correo) {
        throw new ErrorApp(400, `El campo ${campo} es obligatorio`);
    }
    if (correo.length > USUARIO_CORREO_MAX) {
        throw new ErrorApp(400, `El campo ${campo} no puede superar ${USUARIO_CORREO_MAX} caracteres`);
    }
    // Validación básica de formato de email.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new ErrorApp(400, `El campo ${campo} no tiene un formato válido`);
    }
    return correo;
}

function normalizarMoneda(valor) {
    if (valor === undefined || valor === null) {
        return 'COP';
    }
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, 'El campo moneda debe ser texto');
    }
    const moneda = valor.trim().toUpperCase();
    if (!moneda) {
        return 'COP';
    }
    if (!/^[A-Z]{3}$/.test(moneda)) {
        throw new ErrorApp(400, 'El campo moneda debe ser un código ISO 4217 de 3 letras');
    }
    return moneda;
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

function aNumero(valor, campo) {
    const esTextoVacio = typeof valor === 'string' && valor.trim() === '';
    const numero = typeof valor === 'number' ? valor : Number(valor);
    if (esTextoVacio || !Number.isFinite(numero)) {
        throw new ErrorApp(400, `El campo ${campo} debe ser numérico`);
    }
    return numero;
}

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

function normalizarPorPagina(valor) {
    if (valor === undefined || valor === null || valor === '') {
        return POR_PAGINA_DEFAULT;
    }
    const numero = aNumero(valor, 'por_pagina');
    if (!Number.isInteger(numero) || numero < 1 || numero > POR_PAGINA_MAX) {
        throw new ErrorApp(400, `El campo por_pagina debe ser un entero entre 1 y ${POR_PAGINA_MAX}`);
    }
    return numero;
}

function normalizarPaginacion(parametros) {
    return {
        pagina: normalizarPagina(parametros.pagina),
        por_pagina: normalizarPorPagina(parametros.por_pagina),
    };
}

function normalizarIdEnteroPositivo(params, nombreCampo = 'id') {
    const parametros = validarCuerpoObjeto(params || {});
    const crudo = parametros.id;

    if (typeof crudo !== 'string' || !/^\d+$/.test(crudo)) {
        throw new ErrorApp(400, `El ${nombreCampo} no es válido`);
    }

    const id = Number(crudo);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ErrorApp(400, `El ${nombreCampo} no es válido`);
    }
    return { id };
}

// POST /api/v1/admin/empresas
function validarCreacionEmpresa(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    const empresa = {
        nombre: normalizarTextoObligatorio(datos.nombre, 'nombre', EMPRESA_NOMBRE_MAX),
        documento: normalizarTextoOpcional(datos.documento, 'documento', EMPRESA_DOCUMENTO_MAX),
        moneda: normalizarMoneda(datos.moneda),
        direccion: normalizarTextoOpcional(datos.direccion, 'direccion', EMPRESA_DIRECCION_MAX),
        telefono: normalizarTextoOpcional(datos.telefono, 'telefono', EMPRESA_TELEFONO_MAX),
        correo: normalizarTextoOpcional(datos.correo, 'correo', EMPRESA_CORREO_MAX),
    };

    if (!tiene(datos, 'admin') || datos.admin === null || typeof datos.admin !== 'object' || Array.isArray(datos.admin)) {
        throw new ErrorApp(400, 'El administrador inicial es obligatorio');
    }

    const admin = {
        nombre: normalizarTextoObligatorio(datos.admin.nombre, 'admin.nombre', USUARIO_NOMBRE_MAX),
        correo: normalizarCorreo(datos.admin.correo, 'admin.correo'),
    };

    return { empresa, admin };
}

// PATCH /api/v1/admin/empresas/:id
function validarEdicionEmpresa(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    const cambios = {};

    if (tiene(datos, 'nombre')) {
        cambios.nombre = normalizarTextoObligatorio(datos.nombre, 'nombre', EMPRESA_NOMBRE_MAX);
    }
    if (tiene(datos, 'documento')) {
        cambios.documento = normalizarTextoOpcional(datos.documento, 'documento', EMPRESA_DOCUMENTO_MAX);
    }
    if (tiene(datos, 'moneda')) {
        cambios.moneda = normalizarMoneda(datos.moneda);
    }
    if (tiene(datos, 'direccion')) {
        cambios.direccion = normalizarTextoOpcional(datos.direccion, 'direccion', EMPRESA_DIRECCION_MAX);
    }
    if (tiene(datos, 'telefono')) {
        cambios.telefono = normalizarTextoOpcional(datos.telefono, 'telefono', EMPRESA_TELEFONO_MAX);
    }
    if (tiene(datos, 'correo')) {
        cambios.correo = normalizarTextoOpcional(datos.correo, 'correo', EMPRESA_CORREO_MAX);
    }
    if (tiene(datos, 'activo')) {
        cambios.activo = normalizarActivo(datos.activo);
    }

    if (Object.keys(cambios).length === 0) {
        throw new ErrorApp(400, 'No se enviaron campos para actualizar');
    }
    return cambios;
}

// GET /api/v1/admin/empresas
function validarFiltrosEmpresas(query) {
    const parametros = validarCuerpoObjeto(query || {});
    const filtros = {};

    if (tiene(parametros, 'activo') && parametros.activo !== '') {
        filtros.activo = normalizarActivo(parametros.activo);
    }

    Object.assign(filtros, normalizarPaginacion(parametros));
    return filtros;
}

// POST /api/v1/admin/usuarios
function validarCreacionUsuario(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);

    if (!tiene(datos, 'empresa_id')) {
        throw new ErrorApp(400, 'El campo empresa_id es obligatorio');
    }
    const empresaId = aNumero(datos.empresa_id, 'empresa_id');
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
        throw new ErrorApp(400, 'El campo empresa_id debe ser un entero positivo');
    }

    return {
        empresa_id: empresaId,
        nombre: normalizarTextoObligatorio(datos.nombre, 'nombre', USUARIO_NOMBRE_MAX),
        correo: normalizarCorreo(datos.correo, 'correo'),
    };
}

// PATCH /api/v1/admin/usuarios/:id
function validarEdicionUsuario(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    const cambios = {};

    if (tiene(datos, 'nombre')) {
        cambios.nombre = normalizarTextoObligatorio(datos.nombre, 'nombre', USUARIO_NOMBRE_MAX);
    }
    if (tiene(datos, 'correo')) {
        cambios.correo = normalizarCorreo(datos.correo, 'correo');
    }
    if (tiene(datos, 'activo')) {
        cambios.activo = normalizarActivo(datos.activo);
    }

    if (Object.keys(cambios).length === 0) {
        throw new ErrorApp(400, 'No se enviaron campos para actualizar');
    }
    return cambios;
}

// GET /api/v1/admin/usuarios
function validarFiltrosUsuarios(query) {
    const parametros = validarCuerpoObjeto(query || {});
    const filtros = {};

    if (tiene(parametros, 'empresa_id') && parametros.empresa_id !== '') {
        const empresaId = aNumero(parametros.empresa_id, 'empresa_id');
        if (!Number.isInteger(empresaId) || empresaId <= 0) {
            throw new ErrorApp(400, 'El campo empresa_id debe ser un entero positivo');
        }
        filtros.empresa_id = empresaId;
    }

    if (tiene(parametros, 'activo') && parametros.activo !== '') {
        filtros.activo = normalizarActivo(parametros.activo);
    }

    Object.assign(filtros, normalizarPaginacion(parametros));
    return filtros;
}

function validarIdEmpresa(params) {
    return normalizarIdEnteroPositivo(params, 'id de la empresa');
}

function validarIdUsuario(params) {
    return normalizarIdEnteroPositivo(params, 'id del usuario');
}

module.exports = {
    validarCreacionEmpresa,
    validarEdicionEmpresa,
    validarFiltrosEmpresas,
    validarIdEmpresa,
    validarCreacionUsuario,
    validarEdicionUsuario,
    validarFiltrosUsuarios,
    validarIdUsuario,
};
