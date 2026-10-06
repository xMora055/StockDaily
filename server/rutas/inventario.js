const { Router } = require('express');
const { crearMovimiento, listarStock, listarMovimientos } = require('../controladores/inventario');
const { autenticacion } = require('../middlewares/autenticacion');
const { autorizacion } = require('../middlewares/autorizacion');
const { validarEntrada } = require('../middlewares/validarEntrada');
const {
    validarCreacionMovimiento,
    validarFiltrosStock,
    validarFiltrosMovimientos,
} = require('../validaciones/inventario');

const router = Router();

// Todo el recurso exige token válido y rol administrador (superadmin: 403).
router.use(autenticacion, autorizacion('administrador'));

router.post(
    '/movimientos',
    validarEntrada({ body: validarCreacionMovimiento }),
    crearMovimiento,
);
router.get('/stock', validarEntrada({ query: validarFiltrosStock }), listarStock);
router.get(
    '/movimientos',
    validarEntrada({ query: validarFiltrosMovimientos }),
    listarMovimientos,
);

module.exports = router;
