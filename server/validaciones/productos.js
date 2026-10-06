const { ErrorApp } = require('../utilidades/errores');

// Límites alineados con las columnas de `producto` en schema.sql.
const CODIGO_MAX = 50; // producto.codigo varchar(50)
const NOMBRE_MAX = 150; // producto.nombre varchar(150)
const DESCRIPCION_MAX = 5000; // texto libre; límite de cordura
const PRECIO_MAX = 999999999999.99; // producto.precio_unitario numeric(14,2)

// Paginación de GET /api/v1/productos.
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

function normalizarCodigo(valor) {
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, 'El código debe ser texto');
    }
    const codigo = valor.trim();
    if (!codigo) {
        throw new ErrorApp(400, 'El código es obligatorio');
    }
    if (codigo.length > CODIGO_MAX) {
        throw new ErrorApp(400, `El código no puede superar ${CODIGO_MAX} caracteres`);
    }
    return codigo;
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

// Descripción opcional: ausente/null/'' se normaliza a null.
function normalizarDescripcion(valor) {
    if (valor === undefined || valor === null) {
        return null;
    }
    if (typeof valor !== 'string') {
        throw new ErrorApp(400, 'La descripción debe ser texto');
    }
    const descripcion = valor.trim();
    if (descripcion.length > DESCRIPCION_MAX) {
        throw new ErrorApp(400, `La descripción no puede superar ${DESCRIPCION_MAX} caracteres`);
    }
    return descripcion === '' ? null : descripcion;
}

function normalizarPrecio(valor) {
    const precio = aNumero(valor, 'precio_unitario');
    if (precio < 0) {
        throw new ErrorApp(400, 'El precio unitario no puede ser negativo');
    }
    if (precio > PRECIO_MAX) {
        throw new ErrorApp(400, 'El precio unitario es demasiado alto');
    }
    return precio;
}

function normalizarImpuesto(valor) {
    const impuesto = aNumero(valor, 'impuesto_porcentaje');
    if (impuesto < 0 || impuesto > 100) {
        throw new ErrorApp(400, 'El impuesto debe estar entre 0 y 100');
    }
    return impuesto;
}

// Obligatorio solo si se envía; null se traduce a "sin categoría".
function normalizarCategoriaId(valor) {
    const categoriaId = aNumero(valor, 'categoria_id');
    if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
        throw new ErrorApp(400, 'categoria_id debe ser un entero positivo');
    }
    return categoriaId;
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

// POST /api/v1/productos — devuelve solo los campos del contrato.
// Ignora explícitamente empresa_id y cualquier campo extra (anti-IDOR).
function validarCreacionProducto(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    return {
        codigo: normalizarCodigo(datos.codigo),
        nombre: normalizarNombre(datos.nombre),
        descripcion: normalizarDescripcion(datos.descripcion),
        precio_unitario: tiene(datos, 'precio_unitario')
            ? normalizarPrecio(datos.precio_unitario)
            : 0,
        impuesto_porcentaje: tiene(datos, 'impuesto_porcentaje')
            ? normalizarImpuesto(datos.impuesto_porcentaje)
            : 0,
        categoria_id:
            tiene(datos, 'categoria_id') && datos.categoria_id !== null
                ? normalizarCategoriaId(datos.categoria_id)
                : null,
    };
}

// PATCH /api/v1/productos/:id — solo los campos presentes.
function validarEdicionProducto(cuerpo) {
    const datos = validarCuerpoObjeto(cuerpo);
    const cambios = {};

    if (tiene(datos, 'codigo')) cambios.codigo = normalizarCodigo(datos.codigo);
    if (tiene(datos, 'nombre')) cambios.nombre = normalizarNombre(datos.nombre);
    if (tiene(datos, 'descripcion')) cambios.descripcion = normalizarDescripcion(datos.descripcion);
    if (tiene(datos, 'precio_unitario')) cambios.precio_unitario = normalizarPrecio(datos.precio_unitario);
    if (tiene(datos, 'impuesto_porcentaje')) {
        cambios.impuesto_porcentaje = normalizarImpuesto(datos.impuesto_porcentaje);
    }
    if (tiene(datos, 'categoria_id')) {
        cambios.categoria_id = datos.categoria_id === null
            ? null
            : normalizarCategoriaId(datos.categoria_id);
    }
    if (tiene(datos, 'activo')) cambios.activo = normalizarActivo(datos.activo);

    if (Object.keys(cambios).length === 0) {
        throw new ErrorApp(400, 'No se enviaron campos para actualizar');
    }
    return cambios;
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

// GET /api/v1/productos — filtros opcionales; los vacíos se omiten.
function validarFiltrosProductos(query) {
    const parametros = validarCuerpoObjeto(query || {});
    const filtros = {};

    if (tiene(parametros, 'nombre')) {
        if (typeof parametros.nombre !== 'string') {
            throw new ErrorApp(400, 'El filtro nombre debe ser texto');
        }
        const nombre = parametros.nombre.trim();
        if (nombre) filtros.nombre = nombre;
    }

    if (tiene(parametros, 'codigo')) {
        if (typeof parametros.codigo !== 'string') {
            throw new ErrorApp(400, 'El filtro codigo debe ser texto');
        }
        const codigo = parametros.codigo.trim();
        if (codigo) filtros.codigo = codigo;
    }

    if (tiene(parametros, 'categoria_id')) {
        filtros.categoria_id = normalizarCategoriaId(parametros.categoria_id);
    }

    if (tiene(parametros, 'activo')) {
        filtros.activo = normalizarActivo(parametros.activo);
    }

    Object.assign(filtros, normalizarPaginacion(parametros));

    return filtros;
}

// GET/PATCH /:id — el id debe ser un entero positivo.
function validarIdProducto(params) {
    const parametros = validarCuerpoObjeto(params || {});
    const id = Number(parametros.id);
    if (!Number.isInteger(id) || id <= 0) {
        throw new ErrorApp(400, 'El id del producto no es válido');
    }
    return { id };
}

module.exports = {
    validarCreacionProducto,
    validarEdicionProducto,
    validarFiltrosProductos,
    validarIdProducto,
};