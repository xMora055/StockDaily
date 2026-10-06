const { pool } = require('../db/pool');

// pg devuelve las columnas bigint como string; las casteamos a Number
// antes de que la fila salga del repositorio.
function mapear(fila) {
    if (!fila) {
        return null;
    }
    return {
        id: Number(fila.id),
        empresa_id: fila.empresa_id === null ? null : Number(fila.empresa_id),
        nombre: fila.nombre,
        correo: fila.correo,
        password_hash: fila.password_hash,
        rol: fila.rol,
        activo: fila.activo,
    };
}

// Devuelve TODOS los usuarios que comparten el correo (activos e inactivos).
// El servicio necesita la lista completa para (a) detectar la ambigüedad
// multi-tenant cuando el mismo correo existe en varias empresas y
// (b) distinguir un usuario desactivado de uno inexistente.
async function buscarPorCorreo(correo) {
    const { rows } = await pool.query(
        `SELECT id, empresa_id, nombre, correo, password_hash, rol, activo
           FROM usuario
          WHERE lower(correo) = lower($1)
          ORDER BY id`,
        [correo],
    );
    return rows.map(mapear);
}

// Relee un usuario por su id (para refrescar el perfil desde la BD).
async function buscarPorId(id) {
    const { rows } = await pool.query(
        `SELECT id, empresa_id, nombre, correo, password_hash, rol, activo
           FROM usuario
          WHERE id = $1`,
        [id],
    );
    return mapear(rows[0]);
}

module.exports = { buscarPorCorreo, buscarPorId };
