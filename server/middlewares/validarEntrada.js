// Middleware genérico de validación de entrada. Recibe un mapa de validadores
// por origen (`body`, `query`, `params`); cada validador normaliza y lanza
// ErrorApp(400) ante datos inválidos. El resultado queda en `req.validado`
// para que el controlador lo consuma, sin tocar req.body/req.query.
function validarEntrada(validadores = {}) {
    return (req, res, next) => {
        try {
            req.validado = {};
            if (validadores.body) req.validado.body = validadores.body(req.body);
            if (validadores.query) req.validado.query = validadores.query(req.query);
            if (validadores.params) req.validado.params = validadores.params(req.params);
            next();
        } catch (error) {
            next(error);
        }
    };
}

module.exports = { validarEntrada };