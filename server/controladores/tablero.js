const servicioTablero = require('../servicios/tablero');

// GET /api/v1/tablero/inicio
// -> { success, data: { periodo_dias, resumen, serie_ventas, top_productos,
//                       ventas_por_sucursal, stock_faltante } }
async function obtenerInicio(req, res, next) {
    try {
        const data = await servicioTablero.obtenerInicio(
            req.usuario,
            req.validado.query,
        );
        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
}

module.exports = { obtenerInicio };
