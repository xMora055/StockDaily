const { Router } = require('express');
const { listar, crear, obtener, actualizar } = require('../controladores/productos');
const { autenticacion } = require('../middlewares/autenticacion');
const { autorizacion } = require('../middlewares/autorizacion');
const { validarEntrada } = require('../middlewares/validarEntrada');
const {
    validarCreacionProducto,
    validarEdicionProducto,
    validarFiltrosProductos,
    validarIdProducto,
} = require('../validaciones/productos');

const router = Router();

// Todo el recurso exige token válido y rol administrador (superadmin: 403).
router.use(autenticacion, autorizacion('administrador'));

router.get('/', validarEntrada({ query: validarFiltrosProductos }), listar);
router.post('/', validarEntrada({ body: validarCreacionProducto }), crear);
router.get('/:id', validarEntrada({ params: validarIdProducto }), obtener);
router.patch(
    '/:id',
    validarEntrada({ params: validarIdProducto, body: validarEdicionProducto }),
    actualizar,
);

module.exports = router;