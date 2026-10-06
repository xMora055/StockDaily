# AGENTS.md — StockDaily

Sistema web full-stack de facturación, punto de venta y control de inventario en tiempo real para PYMES.

## Estado del repositorio (leer primero)

Proyecto en fase scaffold. No asumas que las features existen:

- `server/` tiene base funcional: `index.js` (solo arranque), `app.js` (Express), rutas en `/api/v1` (`rutas/`), middlewares de errores/404 y base de auth, `config/` y `db/pool.js`. `db/schema.sql` está **completo y aplicado a Supabase** (11 tablas). Existe el vertical de auth: `POST /api/v1/auth/login` y `GET /api/v1/auth/perfil` (bcrypt + JWT). **Aún no hay endpoints de negocio** (productos, clientes, facturación, inventario).
- `client/` ya no es el template de Vite: tiene pantalla de **Login** (gate por contexto, mock opt-in `VITE_USAR_MOCK_AUTH`) y un placeholder `Inicio`; consume el login real vía proxy de Vite.
- `tests/` y `specs/` están vacíos y no hay runner de pruebas configurado. `docs/constitucion.md` está redactado. `opencode.json` define el MCP de Supabase.
- El repositorio aún **no está inicializado en Git**.

## Stack real (verificado)

- **Frontend:** React 19 (`react`/`react-dom` ^19), Vite 8, ESLint 10, **Tailwind CSS v4** (`@tailwindcss/vite`, config CSS-first con `@theme`). `"type": "module"` (ESM).
- **Backend:** Node.js + Express 5, `pg`, `cors`, `dotenv`. `"type": "commonjs"` (NO ESM).
- **Auth (decidido e instalado):** `jsonwebtoken` (tokens Bearer) + `bcrypt` (hash de contraseñas). El secreto se lee de `JWT_SECRETO`; expiración en `JWT_EXPIRACION`.
- **No instalado:** Lucide y React Router. No los importes ni supongas que existen; pregunta antes de agregarlos.
- PostgreSQL es la BD objetivo (Supabase, verificado y en uso).

## Comandos

Cada paquete es independiente; **la raíz no define workspaces**, así que `npm install` en la raíz no instala `client`/`server`:

- Instalar: `npm install --prefix client` y `npm install --prefix server`
- **Frontend dev:** `npm run dev --prefix client`
- **Build frontend:** `npm run build --prefix client`
- **Lint frontend:** `npm run lint --prefix client`
- **Backend dev:** `npm run dev --prefix server` (nodemon). Arranque directo: `npm run start --prefix server`. La app se expone bajo `/api/v1`; healthcheck en `/api/v1/salud`.
- **Tests:** runner nativo `node --test` configurado en el `package.json` de la raíz y de `server`. Ejecuta `npm test` en la raíz: descubre `tests/**/*.test.js` (integración HTTP). No hay dependencias de test instaladas.

## Arquitectura y flujo

- Separación client/server independiente para desplegar el frontend en Vercel y el backend en Render.
- Agentes en `.opencode/agents/`: `planeador.md` (**primary, orquestador Spec-Driven**: redacta specs y delega en `backend`/`frontend`, cerrando con `qa`), `backend.md` (solo `/server`), `frontend.md` (solo `/client`), `qa.md` (solo `tests/`), `arquitecto-db.md` (entrevista y genera `server/db/schema.sql`), `product-owner.md` (primary: gestiona backlog `docs/backlog.md` y prioridades; no escribe código ni specs) y `coordinador.md` (**retirado/`disable: true`**, superado por `planeador`).
- **Flujo de features:** `product-owner` deja el ítem `Listo para ejecutar` → `planeador` redacta la spec y orquesta → `backend`/`frontend` implementan → `qa` verifica y aprueba/rechaza (bucle hasta aprobar).
- **Convención de specs:** cada unidad de trabajo vive en `specs/<accion>-<recurso>-<NNN>/` (p. ej. `specs/creacion-facturacion-001/`) con `spec.md` (EARS), `plan.md` (contrato `/api/v1`) y `tasks.md`. `planeador` es el único escritor de `specs/**`.
- `MEMORY.md` es la memoria activa del proyecto: mantenla en ~50 líneas y actualízala al cerrar trabajo relevante.

## Convenciones

- **Idioma:** español para UI, mensajes al usuario, variables/funciones/tablas/clases y commits.
- **Formato de cifras (COP):** dinero con `formatearMoneda` y cantidades/contadores con `formatearNumero`, ambos de `client/src/utilidades/formatoMoneda.js` (es-CO: miles con punto, sin decimales). No formatear a mano ni dentro de inputs.
- **Paginación:** todo listado de API es paginado (`pagina`/`por_pagina` → `{ items, pagina, por_pagina, total, total_paginas }`) y toda tabla de la UI pagina con el componente `Paginacion`. Al cambiar filtros, volver a la página 1.
- **Errores API:** toda ruta Express responde JSON estructurado `{ success: false, error: "Mensaje" }` con status HTTP adecuado (200/201/400/401/500).
- **Integridad:** facturación y descuento de stock van en la misma transacción SQL (`BEGIN ... COMMIT`). Usar `enTransaccion` de `db/pool.js`.
- **Estructura backend:** `config/` (entorno y CORS), `rutas/`, `middlewares/` (errores, 404, `autenticacion`, `autorizacion`), `utilidades/`. `app.js` solo construye la app; `index.js` solo arranca y cierra el pool. Los errores se lanzan con `ErrorApp` y los formatea `manejadorErrores`.
- **Env:** el backend carga `.env` vía `dotenv` (`config/entorno.js`); variables consumidas por Vite deben llevar prefijo `VITE_`.

## Guardarraíles

- **Pregunta antes de:** instalar dependencias npm nuevas o alterar `server/db/schema.sql`.
- **Nunca:** modificar `.env`, escribir credenciales/API keys en el código, ni desplegar sin pruebas locales.
