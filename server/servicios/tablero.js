// Reglas de negocio del tablero de Inicio. Deriva el tenant del token y arma
// la respuesta del contrato. Sin req/res y sin SQL (delegado en el repositorio).
const { ErrorApp } = require('../utilidades/errores');
const tablero = require('../repositorios/tablero');

// Deriva el tenant del token. Nunca se acepta empresa_id del body/query.
function empresaDelUsuario(usuario) {
    const empresaId = usuario && usuario.empresa_id;
    if (empresaId === null || empresaId === undefined) {
        throw new ErrorApp(403, 'Tu usuario no pertenece a una empresa');
    }
    return Number(empresaId);
}

// Agregados del panel de Inicio para el administrador autenticado.
// `filtros` = { dias, sucursal_id? } ya validados en la capa de validaciones.
async function obtenerInicio(usuario, filtros) {
    const empresaId = empresaDelUsuario(usuario);

    // IDOR: si viene sucursal_id, debe pertenecer a la empresa del token.
    if (filtros.sucursal_id !== undefined) {
        const sucursal = await tablero.buscarSucursalDeEmpresa(
            empresaId,
            filtros.sucursal_id,
        );
        if (!sucursal) {
            throw new ErrorApp(404, 'Sucursal no encontrada');
        }
    }

    const [resumen, serieVentas, topProductos, ventasPorSucursal, stockFaltante] =
        await Promise.all([
            tablero.obtenerResumen(empresaId, filtros),
            tablero.obtenerSerieVentas(empresaId, filtros),
            tablero.obtenerTopProductos(empresaId, filtros),
            tablero.obtenerVentasPorSucursal(empresaId, filtros),
            tablero.obtenerStockFaltante(empresaId, filtros),
        ]);

    return {
        periodo_dias: filtros.dias,
        resumen,
        serie_ventas: serieVentas,
        top_productos: topProductos,
        ventas_por_sucursal: ventasPorSucursal,
        stock_faltante: stockFaltante,
    };
}

module.exports = { obtenerInicio };
