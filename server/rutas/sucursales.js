const { Router } = require('express');
const { listar, crear, obtener, actualizar } = require('../controladores/sucursales');
const { autenticacion } = require('../middlewares/autenticacion');
const { autorizacion } = require('../middlewares/autorizacion');
const { validarEntrada } = require('../middlewares/validarEntrada');
const {
    validarCreacionSucursal,
    validarEdicionSucursal,
    validarFiltrosSucursales,
    validarIdSucursal,
} = require('../validaciones/sucursales');

const router = Router();

// Todo el recurso exige token válido y rol administrador (superadmin: 403).
router.use(autenticacion, autorizacion('administrador'));

router.get('/', validarEntrada({ query: validarFiltrosSucursales }), listar);
router.post('/', validarEntrada({ body: validarCreacionSucursal }), crear);
router.get('/:id', validarEntrada({ params: validarIdSucursal }), obtener);
router.patch(
    '/:id',
    validarEntrada({ params: validarIdSucursal, body: validarEdicionSucursal }),
    actualizar,
);

module.exports = router;
