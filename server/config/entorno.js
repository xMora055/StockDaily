require('dotenv').config({ quiet: true });

// Lee una variable de entorno obligatoria y falla si no está definida.
function obligatoria(nombre) {
    const valor = process.env[nombre];
    if (!valor) {
        throw new Error(`Variable de entorno obligatoria faltante: ${nombre}`);
    }
    return valor;
}

const entorno = {
    puerto: Number(process.env.PORT) || 3000,
    databaseUrl: obligatoria('DATABASE_URL'),
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    jwt: {
        // El secreto se valida al usarlo (firma/verificación), no al arrancar,
        // para no bloquear el servidor antes de implementar el login.
        get secreto() {
            return obligatoria('JWT_SECRETO');
        },
        expiracion: process.env.JWT_EXPIRACION || '2h',
    },
};

module.exports = { entorno };
