const { Router } = require('express');
const { crear, listar, obtener, anular } = require('../controladores/facturas');
const { autenticacion } = require('../middlewares/autenticacion');
const { autorizacion } = require('../middlewares/autorizacion');
const { validarEntrada } = require('../middlewares/validarEntrada');
const {
    validarCreacionFactura,
    validarIdFactura,
    validarFiltrosFacturas,
} = require('../validaciones/facturas');

const router = Router();

// Todo el recurso exige token válido y rol administrador (superadmin: 403).
router.use(autenticacion, autorizacion('administrador'));

router.get('/', validarEntrada({ query: validarFiltrosFacturas }), listar);
router.get('/:id', validarEntrada({ params: validarIdFactura }), obtener);
router.post('/', validarEntrada({ body: validarCreacionFactura }), crear);
router.patch(
    '/:id/anular',
    validarEntrada({ params: validarIdFactura }),
    anular,
);

module.exports = router;
