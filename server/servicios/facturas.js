const { enTransaccion } = require('../db/pool');
const { ErrorApp } = require('../utilidades/errores');
const facturas = require('../repositorios/facturas');

const CODIGO_UNICO = '23505'; // unique_violation de PostgreSQL
const CODIGO_FUERA_RANGO = '22003'; // numeric_value_out_of_range de PostgreSQL
const MONTO_MAX = 999999999999.99; // numeric(14,2)

// Deriva el tenant del token. Nunca se acepta empresa_id del body/query.
function empresaDelUsuario(usuario) {
    const empresaId = usuario && usuario.empresa_id;
    if (empresaId === null || empresaId === undefined) {
        throw new ErrorApp(403, 'Tu usuario no pertenece a una empresa');
    }
    return Number(empresaId);
}

// Redondeo monetario a 2 decimales (coherente con numeric(14,2) y con el CHECK
// de totales de `factura`).
function redondear2(valor) {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function validarMonto(valor, campo) {
    if (valor > MONTO_MAX) {
        throw new ErrorApp(400, `El ${campo} de la venta es demasiado alto`);
    }
    return valor;
}

// Calcula una línea con el snapshot de precio/impuesto del producto.
function calcularLinea(linea, producto) {
    const subtotal = redondear2(
        linea.cantidad * producto.precio_unitario * (1 - linea.descuento_porcentaje / 100),
    );
    validarMonto(subtotal, 'subtotal');
    const impuesto = redondear2((subtotal * producto.impuesto_porcentaje) / 100);
    validarMonto(impuesto, 'impuesto');
    return {
        producto_id: linea.producto_id,
        cantidad: linea.cantidad,
        descuento_porcentaje: linea.descuento_porcentaje,
        precio_unitario: producto.precio_unitario,
        impuesto_porcentaje: producto.impuesto_porcentaje,
        subtotal,
        impuesto,
        total: validarMonto(redondear2(subtotal + impuesto), 'total de línea'),
    };
}

// Mapea los productos cargados por id para resolver las líneas.
function indexarPorId(productos) {
    return new Map(productos.map((producto) => [producto.id, producto]));
}

// Valida dependencias opcionales de la factura (sucursal, método, cliente)
// SIEMPRE acotadas a la empresa del usuario.
async function validarDependencias(cliente, empresaId, datos) {
    const sucursal = await facturas.buscarSucursalDeEmpresa(
        cliente,
        datos.sucursal_id,
        empresaId,
    );
    if (!sucursal) {
        throw new ErrorApp(404, 'Sucursal no encontrada');
    }

    if (datos.metodo_pago_id !== null) {
        const existe = await facturas.existeMetodoPagoDeEmpresa(
            cliente,
            datos.metodo_pago_id,
            empresaId,
        );
        if (!existe) {
            throw new ErrorApp(400, 'El método de pago no existe o no pertenece a tu empresa');
        }
    }

    if (datos.cliente_id !== null) {
        const clienteFila = await facturas.buscarClienteDeEmpresa(
            cliente,
            datos.cliente_id,
            empresaId,
        );
        if (!clienteFila) {
            throw new ErrorApp(400, 'El cliente no existe o no pertenece a tu empresa');
        }
    }
}

// Carga los productos de las líneas y calcula los totales con snapshot.
async function prepararLineas(cliente, empresaId, datos) {
    const ids = datos.lineas.map((linea) => linea.producto_id);
    const productos = await facturas.cargarProductosDeEmpresa(cliente, empresaId, ids);
    const porId = indexarPorId(productos);

    return datos.lineas.map((linea) => {
        const producto = porId.get(linea.producto_id);
        if (!producto) {
            throw new ErrorApp(
                400,
                `El producto ${linea.producto_id} no existe o no pertenece a tu empresa`,
            );
        }
        if (!producto.activo) {
            throw new ErrorApp(
                400,
                `El producto ${producto.nombre} está inactivo y no puede venderse`,
            );
        }
        return calcularLinea(linea, producto);
    });
}

// Reglas de totales de la cabecera:
//   subtotal = Σ subtotal_linea; impuesto = Σ impuesto_linea
//   total = subtotal - descuento + impuesto  (debe ser >= 0)
function calcularTotales(lineas, descuento) {
    // Se redondea el descuento global a 2 decimales para que el total calculado
    // coincida exactamente con el CHECK de `factura` (numeric(14,2)).
    const descuentoRedondeado = redondear2(descuento);
    const subtotal = redondear2(lineas.reduce((suma, linea) => suma + linea.subtotal, 0));
    const impuesto = redondear2(lineas.reduce((suma, linea) => suma + linea.impuesto, 0));
    const total = redondear2(subtotal - descuentoRedondeado + impuesto);
    if (total < 0) {
        throw new ErrorApp(400, 'El descuento supera el total de la venta');
    }
    return {
        subtotal: validarMonto(subtotal, 'subtotal'),
        descuento: descuentoRedondeado,
        impuesto: validarMonto(impuesto, 'impuesto'),
        total: validarMonto(total, 'total'),
    };
}

// Persiste cabecera, detalle y movimientos de stock dentro de la transacción.
async function persistir(cliente, { usuarioId, datos, lineas, totales }) {
    const numeroFactura = await facturas.siguienteNumeroFactura(cliente, datos.sucursal_id);

    const factura = await facturas.insertarFactura(cliente, {
        sucursal_id: datos.sucursal_id,
        usuario_id: usuarioId,
        cliente_id: datos.cliente_id,
        cliente_nombre: datos.cliente_nombre,
        cliente_documento: datos.cliente_documento,
        metodo_pago_id: datos.metodo_pago_id,
        numero_factura: numeroFactura,
        subtotal: totales.subtotal,
        descuento: totales.descuento,
        impuesto: totales.impuesto,
        total: totales.total,
    });

    const detalles = [];
    try {
        for (const linea of lineas) {
            const detalle = await facturas.insertarDetalle(cliente, factura.id, linea);
            detalles.push(detalle);

            await facturas.insertarMovimientoVenta(cliente, {
                producto_id: linea.producto_id,
                sucursal_id: datos.sucursal_id,
                usuario_id: usuarioId,
                factura_id: factura.id,
                cantidad: -linea.cantidad,
            });
        }
    } catch (error) {
        // Defensa ante una carrera de líneas duplicadas (UNIQUE(factura_id, producto_id)).
        if (error.code === CODIGO_UNICO) {
            throw new ErrorApp(400, 'Hay productos repetidos en las líneas de la venta');
        }
        // Defensa en profundidad: si el ajuste de `stock.cantidad` (integer) se
        // desborda dentro del trigger (22003), debe responder 400 y nunca 500.
        if (error.code === CODIGO_FUERA_RANGO) {
            throw new ErrorApp(400, 'La cantidad de una línea supera el máximo permitido');
        }
        throw error;
    }

    return { ...factura, detalles };
}

// Registra una venta completa de forma ATÓMICA. Cualquier fallo revierte la
// factura, el detalle y los movimientos (ROLLBACK total en `enTransaccion`).
async function registrarVenta(usuario, datos) {
    const empresaId = empresaDelUsuario(usuario);
    const usuarioId = Number(usuario && usuario.id);
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
        throw new ErrorApp(401, 'La sesión no es válida');
    }

    return enTransaccion(async (cliente) => {
        await validarDependencias(cliente, empresaId, datos);
        const lineas = await prepararLineas(cliente, empresaId, datos);
        const totales = calcularTotales(lineas, datos.descuento);

        const factura = await persistir(cliente, {
            usuarioId,
            datos,
            lineas,
            totales,
        });

        return { factura };
    });
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

// Lista las facturas de la empresa del usuario autenticado (paginadas y
// filtrables). Solo lectura: no abre transacción.
async function listarFacturas(usuario, filtros) {
    const empresaId = empresaDelUsuario(usuario);
    const { items, total } = await facturas.listarFacturas(empresaId, filtros);
    return armarPagina({ items, total }, filtros.pagina, filtros.por_pagina);
}

// Obtiene una factura con sus líneas; 404 si no existe o es de otra empresa.
async function obtenerFactura(usuario, id) {
    const empresaId = empresaDelUsuario(usuario);
    const factura = await facturas.obtenerFacturaDetalle(empresaId, id);
    if (!factura) {
        throw new ErrorApp(404, 'Factura no encontrada');
    }
    return { factura };
}

// Anula una factura `emitida` de la empresa del usuario y revierte el stock de
// sus líneas en UNA sola transacción. Cualquier fallo revierte la cabecera y
// los movimientos (ROLLBACK total de `enTransaccion`).
async function anularFactura(usuario, facturaId) {
    const empresaId = empresaDelUsuario(usuario);
    const usuarioId = Number(usuario && usuario.id);
    if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
        throw new ErrorApp(401, 'La sesión no es válida');
    }

    try {
        return await enTransaccion(async (cliente) => {
            // 1) Bloqueo acotado a la empresa del token; 404 si no existe o es ajena.
            const factura = await facturas.buscarParaAnular(cliente, facturaId, empresaId);
            if (!factura) {
                throw new ErrorApp(404, 'Factura no encontrada');
            }

            // 2) Doble anulación -> 409 (FOR UPDATE evita la carrera).
            if (factura.estado === 'anulada') {
                throw new ErrorApp(409, 'La factura ya está anulada');
            }

            // 3) Auditoría de la cabecera (anulada_en / anulada_por).
            const facturaAnulada = await facturas.actualizarAnulada(
                cliente,
                facturaId,
                usuarioId,
            );

            // 4) Un movimiento `anulacion` (+cantidad) por línea => sube el stock.
            await facturas.insertarMovimientosAnulacion(cliente, {
                facturaId,
                sucursalId: factura.sucursal_id,
                usuarioId,
            });

            // 5) Detalle para el contrato de respuesta.
            const detalles = await facturas.listarDetalles(cliente, facturaId);

            return { factura: { ...facturaAnulada, detalles } };
        });
    } catch (error) {
        // Defensa en profundidad: bigint fuera de rango -> 400, nunca 500.
        if (error.code === CODIGO_FUERA_RANGO) {
            throw new ErrorApp(400, 'El id de la factura no es válido');
        }
        throw error;
    }
}

module.exports = { registrarVenta, anularFactura, listarFacturas, obtenerFactura };
