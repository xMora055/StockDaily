const { Router } = require('express');
const { login, perfil } = require('../controladores/auth');
const { autenticacion } = require('../middlewares/autenticacion');

const router = Router();

router.post('/login', login);
router.get('/perfil', autenticacion, perfil);

module.exports = router;
