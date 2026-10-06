const { Pool } = require('pg');
const { entorno } = require('../config/entorno');

// Conexión a PostgreSQL (Supabase) vía Session pooler.
// La cadena se lee desde DATABASE_URL (ver config/entorno.js).
const pool = new Pool({
    connectionString: entorno.databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

// Ejecuta un conjunto de consultas dentro de una transacción SQL.
// Uso: enTransaccion(async (cliente) => { ... })
async function enTransaccion(fn) {
    const cliente = await pool.connect();
    try {
        await cliente.query('BEGIN');
        const resultado = await fn(cliente);
        await cliente.query('COMMIT');
        return resultado;
    } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
    } finally {
        cliente.release();
    }
}

module.exports = { pool, enTransaccion };
