const { Router } = require('express');
const { listar, crear, obtener, actualizar } = require('../controladores/categorias');
const { autenticacion } = require('../middlewares/autenticacion');
const { autorizacion } = require('../middlewares/autorizacion');
const { validarEntrada } = require('../middlewares/validarEntrada');
const {
    validarCreacionCategoria,
    validarEdicionCategoria,
    validarFiltrosCategorias,
    validarIdCategoria,
} = require('../validaciones/categorias');

const router = Router();

// Todo el recurso exige token válido y rol administrador (superadmin: 403).
router.use(autenticacion, autorizacion('administrador'));

router.get('/', validarEntrada({ query: validarFiltrosCategorias }), listar);
router.post('/', validarEntrada({ body: validarCreacionCategoria }), crear);
router.get('/:id', validarEntrada({ params: validarIdCategoria }), obtener);
router.patch(
    '/:id',
    validarEntrada({ params: validarIdCategoria, body: validarEdicionCategoria }),
    actualizar,
);

module.exports = router;
