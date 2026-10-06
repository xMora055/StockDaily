const { Router } = require('express');
const { listar, crear, obtener, actualizar } = require('../controladores/clientes');
const { autenticacion } = require('../middlewares/autenticacion');
const { autorizacion } = require('../middlewares/autorizacion');
const { validarEntrada } = require('../middlewares/validarEntrada');
const {
    validarCreacionCliente,
    validarEdicionCliente,
    validarFiltrosClientes,
    validarIdCliente,
} = require('../validaciones/clientes');

const router = Router();

// Todo el recurso exige token válido y rol administrador (superadmin: 403).
router.use(autenticacion, autorizacion('administrador'));

router.get('/', validarEntrada({ query: validarFiltrosClientes }), listar);
router.post('/', validarEntrada({ body: validarCreacionCliente }), crear);
router.get('/:id', validarEntrada({ params: validarIdCliente }), obtener);
router.patch(
    '/:id',
    validarEntrada({ params: validarIdCliente, body: validarEdicionCliente }),
    actualizar,
);

module.exports = router;
