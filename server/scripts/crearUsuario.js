// ============================================================================
//  Utilidad de línea de comandos para crear el primer usuario (o más).
//  Hashea la contraseña con bcrypt e inserta con SQL parametrizado.
//
//  Uso (desde la carpeta server/):
//    Administrador de una empresa:
//      node scripts/crearUsuario.js --nombre "Ana Pérez" \
//        --correo ana@empresa.com --password "Secreta123" \
//        --rol administrador --empresa 1
//
//    Superadmin de plataforma (sin empresa):
//      node scripts/crearUsuario.js --nombre "Admin Plataforma" \
//        --correo admin@stockdaily.app --password "Secreta123" \
//        --rol superadmin
//
//  También acepta variables de entorno:
//    NOMBRE, CORREO, PASSWORD, ROL, EMPRESA_ID
//
//  La conexión usa DATABASE_URL (cargada por config/entorno.js vía dotenv).
//  No hay credenciales ni contraseñas en el código.
// ============================================================================

const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');

const ROLES_VALIDOS = ['administrador', 'superadmin'];
const COSTO_BCRYPT = 10;

// Convierte --clave valor en un objeto { clave: 'valor' }.
function leerArgumentos() {
    const args = process.argv.slice(2);
    const opciones = {};
    for (let i = 0; i < args.length; i += 1) {
        const actual = args[i];
        if (!actual.startsWith('--')) {
            continue;
        }
        const clave = actual.slice(2);
        const siguiente = args[i + 1];
        if (siguiente !== undefined && !siguiente.startsWith('--')) {
            opciones[clave] = siguiente;
            i += 1;
        } else {
            opciones[clave] = true;
        }
    }
    return opciones;
}

function obtenerDatos() {
    const opciones = leerArgumentos();

    const nombre = String(opciones.nombre || process.env.NOMBRE || '').trim();
    const correo = String(opciones.correo || process.env.CORREO || '').trim().toLowerCase();
    const password = String(opciones.password || process.env.PASSWORD || '');
    const rol = String(opciones.rol || process.env.ROL || 'administrador').trim().toLowerCase();
    const empresaCruda = opciones.empresa || process.env.EMPRESA_ID;

    const errores = [];
    if (!nombre) errores.push('Falta el nombre (--nombre).');
    if (!correo) errores.push('Falta el correo (--correo).');
    if (!password) errores.push('Falta la contraseña (--password).');
    if (!ROLES_VALIDOS.includes(rol)) {
        errores.push(`El rol debe ser uno de: ${ROLES_VALIDOS.join(', ')}.`);
    }

    let empresaId = null;
    if (rol === 'administrador') {
        empresaId = Number(empresaCruda);
        if (!empresaCruda || !Number.isInteger(empresaId) || empresaId <= 0) {
            errores.push('Un administrador requiere --empresa <id> entero positivo.');
        }
    } else if (empresaCruda) {
        errores.push('Un superadmin no debe llevar --empresa (empresa_id es NULL).');
    }

    if (errores.length > 0) {
        return { error: errores.join('\n  - ') };
    }

    return { datos: { nombre, correo, password, rol, empresaId } };
}

async function main() {
    const { datos, error } = obtenerDatos();
    if (error) {
        console.error('No se pudo crear el usuario:\n  - ' + error);
        console.error(
            '\nEjemplo:\n  node scripts/crearUsuario.js --nombre "Ana" ' +
                '--correo ana@empresa.com --password "Secreta123" ' +
                '--rol administrador --empresa 1',
        );
        process.exitCode = 1;
        return;
    }

    try {
        const hash = await bcrypt.hash(datos.password, COSTO_BCRYPT);

        const { rows } = await pool.query(
            `INSERT INTO usuario (empresa_id, nombre, correo, password_hash, rol)
                  VALUES ($1, $2, $3, $4, $5)
               RETURNING id, empresa_id, nombre, correo, rol, activo`,
            [datos.empresaId, datos.nombre, datos.correo, hash, datos.rol],
        );

        const usuario = rows[0];
        console.log('Usuario creado correctamente:');
        console.log({
            id: Number(usuario.id),
            empresa_id: usuario.empresa_id === null ? null : Number(usuario.empresa_id),
            nombre: usuario.nombre,
            correo: usuario.correo,
            rol: usuario.rol,
            activo: usuario.activo,
        });
    } catch (err) {
        // Se evita imprimir el hash; solo el mensaje de error de PostgreSQL.
        console.error('Error al insertar el usuario:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main();
