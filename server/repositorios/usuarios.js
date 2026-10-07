const { pool } = require('../db/pool');

const COLUMNAS_USUARIO = `id, empresa_id, nombre, correo, password_hash, rol, activo, creado_en, actualizado_en`;

const COLUMNAS_USUARIO_CON_EMPRESA = `
  u.id, u.empresa_id, u.nombre, u.correo, u.password_hash, u.rol, u.activo, u.creado_en, u.actualizado_en,
  e.id AS empresa_pk, e.nombre AS empresa_nombre, e.moneda AS empresa_moneda
`;

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
        creado_en: fila.creado_en,
        actualizado_en: fila.actualizado_en,
    };
}

// Proyección pública: nunca expone password_hash.
function mapearPublico(fila) {
    if (!fila) {
        return null;
    }
    const usuario = mapear(fila);
    delete usuario.password_hash;
    return usuario;
}

// Extiende un usuario con la empresa relacionada (solo id, nombre y moneda).
function mapearConEmpresa(fila) {
    if (!fila) {
        return null;
    }
    const usuario = mapear(fila);
    usuario.empresa = fila.empresa_id === null
        ? null
        : {
              id: Number(fila.empresa_pk),
              nombre: fila.empresa_nombre,
              moneda: fila.empresa_moneda,
          };
    return usuario;
}

// Devuelve TODOS los usuarios que comparten el correo (activos e inactivos).
// El servicio necesita la lista completa para (a) detectar la ambigüedad
// multi-tenant cuando el mismo correo existe en varias empresas y
// (b) distinguir un usuario desactivado de uno inexistente.
async function buscarPorCorreo(correo) {
    const { rows } = await pool.query(
        `SELECT ${COLUMNAS_USUARIO}
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
        `SELECT ${COLUMNAS_USUARIO}
           FROM usuario
          WHERE id = $1`,
        [id],
    );
    return mapear(rows[0]);
}

async function buscarPorIdPublico(id) {
    const { rows } = await pool.query(
        `SELECT ${COLUMNAS_USUARIO}
           FROM usuario
          WHERE id = $1`,
        [id],
    );
    return mapearPublico(rows[0]);
}

// Devuelve TODOS los usuarios que comparten el correo con su empresa anexada.
async function buscarPorCorreoConEmpresa(correo) {
    const { rows } = await pool.query(
        `SELECT ${COLUMNAS_USUARIO_CON_EMPRESA}
           FROM usuario u
           LEFT JOIN empresa e ON e.id = u.empresa_id
          WHERE lower(u.correo) = lower($1)
          ORDER BY u.id`,
        [correo],
    );
    return rows.map(mapearConEmpresa);
}

// Relee un usuario por su id con su empresa anexada.
async function buscarPorIdConEmpresa(id) {
    const { rows } = await pool.query(
        `SELECT ${COLUMNAS_USUARIO_CON_EMPRESA}
           FROM usuario u
           LEFT JOIN empresa e ON e.id = u.empresa_id
          WHERE u.id = $1`,
        [id],
    );
    return mapearConEmpresa(rows[0]);
}

async function listarAdministradores(filtros = {}) {
    const condiciones = [`rol = 'administrador'`];
    const valores = [];

    if (filtros.empresa_id !== undefined) {
        valores.push(filtros.empresa_id);
        condiciones.push(`empresa_id = $${valores.length}`);
    }

    if (filtros.activo !== undefined) {
        valores.push(filtros.activo);
        condiciones.push(`activo = $${valores.length}`);
    }

    const where = `WHERE ${condiciones.join(' AND ')}`;
    const offset = (filtros.pagina - 1) * filtros.por_pagina;

    const { rows: totalRows } = await pool.query(
        `SELECT COUNT(*) AS total FROM usuario ${where}`,
        valores,
    );

    const { rows } = await pool.query(
        `SELECT id, empresa_id, nombre, correo, rol, activo, creado_en, actualizado_en
           FROM usuario
           ${where}
          ORDER BY nombre ASC, id ASC
          LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
        [...valores, filtros.por_pagina, offset],
    );

    return { items: rows.map(mapearPublico), total: Number(totalRows[0].total) };
}

async function listarAdministradoresPorEmpresa(empresaId, cliente) {
    const ejecutor = cliente || pool;
    const { rows } = await ejecutor.query(
        `SELECT id, empresa_id, nombre, correo, rol, activo, creado_en, actualizado_en
           FROM usuario
          WHERE empresa_id = $1 AND rol = 'administrador'
          ORDER BY nombre ASC, id ASC`,
        [empresaId],
    );
    return rows.map(mapearPublico);
}

async function existeCorreoEnEmpresa(empresaId, correo, excluirId = null, cliente) {
    const ejecutor = cliente || pool;
    if (excluirId === null) {
        const { rows } = await ejecutor.query(
            `SELECT 1 FROM usuario
              WHERE empresa_id = $1 AND lower(correo) = lower($2)
              LIMIT 1`,
            [empresaId, correo],
        );
        return rows.length > 0;
    }

    const { rows } = await ejecutor.query(
        `SELECT 1 FROM usuario
          WHERE empresa_id = $1 AND lower(correo) = lower($2) AND id <> $3
          LIMIT 1`,
        [empresaId, correo, excluirId],
    );
    return rows.length > 0;
}

async function crearAdministrador(datos, cliente) {
    const ejecutor = cliente || pool;
    const { rows } = await ejecutor.query(
        `INSERT INTO usuario (empresa_id, nombre, correo, password_hash, rol)
              VALUES ($1, $2, $3, $4, 'administrador')
           RETURNING id, empresa_id, nombre, correo, rol, activo, creado_en, actualizado_en`,
        [datos.empresa_id, datos.nombre, datos.correo, datos.password_hash],
    );
    return mapearPublico(rows[0]);
}

async function actualizarAdministrador(id, cambios, cliente) {
    const ejecutor = cliente || pool;
    const asignaciones = [];
    const valores = [];

    for (const [columna, valor] of Object.entries(cambios)) {
        valores.push(valor);
        asignaciones.push(`${columna} = $${valores.length}`);
    }

    valores.push(id);
    const parametroId = valores.length;

    const { rows } = await ejecutor.query(
        `UPDATE usuario
            SET ${asignaciones.join(', ')}
          WHERE id = $${parametroId} AND rol = 'administrador'
        RETURNING id, empresa_id, nombre, correo, rol, activo, creado_en, actualizado_en`,
        valores,
    );
    return mapearPublico(rows[0]);
}

async function desactivarAdministradoresPorEmpresa(empresaId, cliente) {
    const ejecutor = cliente || pool;
    await ejecutor.query(
        `UPDATE usuario
            SET activo = false
          WHERE empresa_id = $1 AND rol = 'administrador'`,
        [empresaId],
    );
}

module.exports = {
    buscarPorCorreo,
    buscarPorCorreoConEmpresa,
    buscarPorId,
    buscarPorIdConEmpresa,
    buscarPorIdPublico,
    listarAdministradores,
    listarAdministradoresPorEmpresa,
    existeCorreoEnEmpresa,
    crearAdministrador,
    actualizarAdministrador,
    desactivarAdministradoresPorEmpresa,
};
