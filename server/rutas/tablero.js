const { Router } = require('express');
const { obtenerInicio } = require('../controladores/tablero');
const { autenticacion } = require('../middlewares/autenticacion');
const { autorizacion } = require('../middlewares/autorizacion');
const { validarEntrada } = require('../middlewares/validarEntrada');
const { validarFiltrosTablero } = require('../validaciones/tablero');

const router = Router();

// Recurso de solo lectura para administradores (superadmin: 403).
router.use(autenticacion, autorizacion('administrador'));

router.get('/inicio', validarEntrada({ query: validarFiltrosTablero }), obtenerInicio);

module.exports = router;
