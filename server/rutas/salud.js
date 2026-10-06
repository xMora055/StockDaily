const { Router } = require('express');
const { pool } = require('../db/pool');

const router = Router();

// Healthcheck: verifica que el backend responde y que la BD es alcanzable.
router.get('/', async (req, res, next) => {
    try {
        const { rows } = await pool.query('SELECT 1 AS ok');
        res.json({ success: true, data: { bd: rows[0].ok === 1 } });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
