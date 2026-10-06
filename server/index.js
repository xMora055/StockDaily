const { entorno } = require('./config/entorno');
const { pool } = require('./db/pool');
const app = require('./app');

const servidor = app.listen(entorno.puerto, () => {
    console.log(`API escuchando en el puerto ${entorno.puerto}`);
});

// Cierre ordenado: deja de aceptar peticiones y libera el pool de PostgreSQL.
function cerrar(senal) {
    console.log(`\n${senal} recibido. Cerrando servidor...`);
    servidor.close(async () => {
        try {
            await pool.end();
            console.log('Recursos liberados. Adiós.');
            process.exit(0);
        } catch (error) {
            console.error('Error al cerrar el pool:', error.message);
            process.exit(1);
        }
    });
}

process.on('SIGINT', () => cerrar('SIGINT'));
process.on('SIGTERM', () => cerrar('SIGTERM'));
