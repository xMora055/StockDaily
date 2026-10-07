const { Router } = require('express');
const {
    listarEmpresas,
    crearEmpresa,
    obtenerEmpresa,
    actualizarEmpresa,
    listarAdministradores,
    crearAdministrador,
    obtenerAdministrador,
    actualizarAdministrador,
} = require('../controladores/admin');
const { autenticacion } = require('../middlewares/autenticacion');
const { autorizacion } = require('../middlewares/autorizacion');
const { validarEntrada } = require('../middlewares/validarEntrada');
const {
    validarCreacionEmpresa,
    validarEdicionEmpresa,
    validarFiltrosEmpresas,
    validarIdEmpresa,
    validarCreacionUsuario,
    validarEdicionUsuario,
    validarFiltrosUsuarios,
    validarIdUsuario,
} = require('../validaciones/admin');

const router = Router();

// Todo el vertical de administración de plataforma exige superadmin.
router.use(autenticacion, autorizacion('superadmin'));

// Empresas
router.get('/empresas', validarEntrada({ query: validarFiltrosEmpresas }), listarEmpresas);
router.post('/empresas', validarEntrada({ body: validarCreacionEmpresa }), crearEmpresa);
router.get('/empresas/:id', validarEntrada({ params: validarIdEmpresa }), obtenerEmpresa);
router.patch(
    '/empresas/:id',
    validarEntrada({ params: validarIdEmpresa, body: validarEdicionEmpresa }),
    actualizarEmpresa,
);

// Administradores
router.get('/usuarios', validarEntrada({ query: validarFiltrosUsuarios }), listarAdministradores);
router.post('/usuarios', validarEntrada({ body: validarCreacionUsuario }), crearAdministrador);
router.get('/usuarios/:id', validarEntrada({ params: validarIdUsuario }), obtenerAdministrador);
router.patch(
    '/usuarios/:id',
    validarEntrada({ params: validarIdUsuario, body: validarEdicionUsuario }),
    actualizarAdministrador,
);

module.exports = router;
