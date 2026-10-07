const { Router } = require('express');
const salud = require('./salud');
const auth = require('./auth');
const productos = require('./productos');
const categorias = require('./categorias');
const sucursales = require('./sucursales');
const clientes = require('./clientes');
const facturas = require('./facturas');
const inventario = require('./inventario');
const tablero = require('./tablero');
const admin = require('./admin');

const router = Router();

router.use('/salud', salud);
router.use('/auth', auth);
router.use('/productos', productos);
router.use('/categorias', categorias);
router.use('/sucursales', sucursales);
router.use('/clientes', clientes);
router.use('/facturas', facturas);
router.use('/inventario', inventario);
router.use('/tablero', tablero);
router.use('/admin', admin);

module.exports = router;