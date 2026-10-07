# MEMORY.md — StockDaily

Memoria activa del proyecto. Mantener conciso (máximo ~50 líneas).

## Estado Actual

- [x] Configuración inicial de arquitectura (Frontend + Backend + BD).
- [x] Creación de archivos de contexto (`AGENTS.md`, `MEMORY.md`).
- [x] Diseño y aplicación del esquema PostgreSQL (`schema.sql` + Supabase).
- [x] Rol **superadmin** de plataforma en `usuario` (empresa_id NULL, crea empresas/administradores; no opera en sucursales).
- [x] Capa de conexión del backend (`server/db/pool.js`, `server/index.js`, scripts `dev`/`start`).
- [x] `DATABASE_URL` (Session pooler `aws-0-us-east-1`) en `server/.env`.
- [x] Refactor base del backend: `app.js` construye la app y `index.js` solo arranca y cierra el pool; rutas en `/api/v1`; `config/entorno.js`, `config/cors.js`, `middlewares/` (`manejadorErrores`, `noEncontrado`, `autenticacion`, `autorizacion`) y `utilidades/errores.js` (`ErrorApp`).
- [x] Healthcheck corregido a `/api/v1/salud` → `{ success: true, data: { bd: true } }` (verificado contra Supabase).
- [x] Dependencias de auth instaladas: `jsonwebtoken` + `bcrypt` (audit producción: 0 vulnerabilidades).
- [x] Subagentes `backend` y `frontend` estructurados en `.opencode/agents/` con alcance separado; skill de diseño `impeccable`.
- [x] Subagente `qa` en `.opencode/agents/qa.md`: prueba los cambios (solo `tests/`), reporta Fallos/Faltantes/Riesgos y la aprueba/rechaza; `planeador` re-delega correcciones si rechaza.
- [~] `coordinador` (orquestador previo) **retirado** en favor de `planeador`; el archivo queda `disable: true` como referencia.
- [x] Agente `product-owner` (primary) en `.opencode/agents/product-owner.md`: gestiona `docs/backlog.md` y prioriza/destraba requisitos; ya **no** escribe specs.
- [x] Rediseño del flujo de agentes: **`planeador` pasa a primary orquestador** (redacta specs y delega en `backend`/`frontend`, cierra con `qa`); `coordinador` **retirado** (`disable: true`); alcances forzados con `permission.edit` (`server/**`, `client/**`, `tests/**`, `specs/**`); `arquitecto-db` reparado con frontmatter.
- [x] Runner de pruebas `node --test` configurado (raíz y `server`); `npm test` en la raíz corre `tests/**/*.test.js` (38 en SD-003).
- [x] Frontend real: Tailwind CSS v4 (`@tailwindcss/vite`, `@theme`), pantalla de **Login** con diseño propio, gate por contexto (sin React Router) y mock opt-in (`VITE_USAR_MOCK_AUTH`).
- [x] Vertical de auth backend: `POST /api/v1/auth/login` y `GET /api/v1/auth/perfil` (bcrypt + JWT) + `server/scripts/crearUsuario.js`; verificado e2e contra Supabase.
- [x] Conexión dev frontend↔backend: proxy de Vite (`/api` → `http://localhost:3000`).
- [x] SD-003 Catálogo de productos: endpoints `/api/v1/productos` (GET/POST/GET:id/PATCH, borrado lógico, multi-tenant) + UI `Productos` con estados; QA APROBADO (38/38). Pendiente P1: SD-017 endurecimiento de validaciones.
- [x] SD-001 Gestión de sucursales: endpoints `/api/v1/sucursales` + UI `Sucursales` y navegación; QA APROBADO (41/41; total 79/79 con productos). Riesgos no bloqueantes: unicidad case-sensitive, listado incluye inactivas (el POS filtra `activo`).
- [x] SD-006 POS: `POST /api/v1/facturas` transaccional (snapshot de precios, numeración por sucursal, `salida_venta`) + UI `Punto de venta`; QA APROBADO tras 1 rechazo (redondeo) → 133/133.
- [x] SD-005 + SD-011 Inventario: `POST/GET /api/v1/inventario/movimientos` (`carga_inicial`/`ajuste`) y `GET /api/v1/inventario/stock` (con `solo_faltantes` sobre `vista_stock_faltante`) + UI `Inventario`; QA APROBADO. Paginación aplicada (Revisión 2). Riesgos no bloqueantes: `23503`→500 no mapeado, comodines ILIKE sin escapar.
- [x] SD-018 Paginación de listados: `GET /api/v1/productos` y `GET /api/v1/sucursales` con sobre paginado + `Paginacion` en sus tablas; selectores de POS/Inventario consumen `items` (`por_pagina=100`). QA APROBADO (**235/235** tests). Deuda: catálogos >100 en selectores requieren búsqueda/paginación.
- [x] SD-019 Selector de tamaño de página: opciones **5/10/15/20** (sin 0) en `Paginacion`, en las 4 tablas; default `por_pagina` **10** (API y cliente). QA APROBADO (**272/272** tests). Ver `specs/paginacion-listados-002/`.
- [x] SD-007 Anulación de factura: `PATCH /api/v1/facturas/:id/anular` transaccional (reversión de stock con `movimiento_inventario` `anulacion`, `FOR UPDATE`, auditoría `anulada_en`/`anulada_por`) + botón "Anular venta" en `ReciboEmitido`. QA APROBADO (`tests/api/anulacion-factura.test.js`, 27 casos; suite raíz 272/272). Ver `specs/anulacion-factura-001/`.
- [~] SD-009 Listado y consulta de facturas (P1): **código completo** (backend `GET /facturas` y `GET /facturas/:id`; UI `Facturacion` + sección "Facturación" activa en el panel), **pendiente QA (T-005)**. No existe `tests/api/listado-facturas.test.js`; no marcar `Hecho` sin aprobación de `qa`.
- [x] SD-020 UX del dashboard (P1): cards Top productos y Ventas por sucursal con altura máxima fija (max-h-64/max-h-80), scroll interno y contador "Mostrando N de M". QA APROBADO (lint/build verdes). Ver specs/mejora-ux-dashboard-001/.
- [x] SD-010 Onboarding superadmin (P1): implementado en /server y /client; contraseña fija `123` para dev/demo. **Hecho** (QA omitido por decisión del usuario).
- [~] SD-021 Moneda por empresa (P1): usuario reporta que empresa.moneda = 'USD' sigue mostrando COP en productos/facturación/dashboard. formatearMoneda tiene COP quemado; login/perfil no exponen moneda. En discusión.
- [x] Rediseño visual "papel de caja" de Login, Inicio y primitivos — ver **Diseño Visual**.
- [x] SD-022 Bugfix etiqueta moneda en producto (P1): ayuda de precio unitario ahora usa `usuario.empresa?.moneda`. Lint/build verdes.
- [~] Inicialización del repositorio Git pendiente; README.md creado por solicitud del usuario.

## Decisiones Técnicas (y Justificación)

- **Arquitectura separada (Client/Server):** Facilita desplegar el frontend en Vercel y el backend en Render de manera independiente.
- **PostgreSQL (Supabase):** Elegido por soporte estricto de transacciones SQL, vital para evitar descuadres entre facturación e inventario.
- **Vite + React:** Compilación rápida y estándar moderno para el portafolio.
- **Autenticación JWT + bcrypt:** tokens Bearer `jsonwebtoken` (secreto en `JWT_SECRETO`, expiración en `JWT_EXPIRACION`) y hash de contraseñas con `bcrypt`. Roles desde `usuario.rol` (administrador/superadmin) validados por el middleware `autorizacion`.
- **Tailwind CSS v4:** config CSS-first con `@theme`; instalado con autorización del usuario (AGENTS.md actualizado).
- **Sobreventa permitida + alerta:** `stock.cantidad` puede ser negativa (se eliminó `stock_cantidad_check`); la venta nunca se bloquea por falta de stock. Los faltantes se exponen con la vista `vista_stock_faltante` (con `empresa_id`/`sucursal_id` para filtrar por tenant) e índice parcial `idx_stock_cantidad_negativa`.
- **Navegación sin React Router:** gate por contexto de autenticación; se evaluará el router cuando haya más vistas.
- **Orquestación en una sola línea:** `planeador` (primary) es el único orquestador y dueño de `specs/**`; `product-owner` define el QUÉ/POR QUÉ en `docs/backlog.md`. No se mantienen dos orquestadores (se retiró `coordinador`).
- **Convención de specs:** cada unidad vive en `specs/<accion>-<recurso>-<NNN>/` (p. ej. `specs/creacion-facturacion-001/`) con `spec.md` (EARS), `plan.md` (contrato `/api/v1`) y `tasks.md`; `planeador` es el único escritor.
- **Idioma unificado (español):** se corrigió `docs/constitucion.md` §6 para ratificar español en código, variables, tablas, specs y commits (antes decía inglés y contradecía el repo).
- **Mock de auth opt-in:** `VITE_USAR_MOCK_AUTH=true` en dev; sin la bandera se pega al backend real.
- **Paginación obligatoria (listados):** todo endpoint `GET` de colección devuelve `data: { items, pagina, por_pagina, total, total_paginas }` con params `pagina` (entero ≥1, default 1) y `por_pagina` (entero 1..100, default **10**); `total` = `COUNT` con los mismos filtros; `OFFSET = (pagina-1)*por_pagina`; inválidos (incluido `0`) → `400`. Toda tabla de la UI pagina (no renderiza la colección completa) con el componente `Paginacion` (Anterior/Siguiente deshabilitados en extremos, "Página X de Y", total con `formatearNumero`) y selector "Por página" (5/10/15/20); al cambiar filtros o tamaño vuelve a la página 1.

## Diseño Visual (dirección vigente)

Dirección **"papel de caja"**: interfaz impresa (mostrador/tique/libro de caja), no el look SaaS genérico. Todo UI nuevo debe seguir este lenguaje.
- **Tipografía:** Space Grotesk (display/UI) + IBM Plex Mono (cifras/códigos/fechas), vía `<link>` en `client/index.html`, fallback `system-ui`. Sin dependencias npm.
- **Paleta (`client/src/index.css` `@theme`):** papel hueso frío (`fondo`), tinta petróleo-negro, `petroleo`, `marca` teal, **acento ámbar** usado con restricción (checks, punto del logo), `exito` verde libro, `error` ladrillo, `aviso`. Sombras `shadow-impresa` (sólidas, sin blur gris) y utilidades `seam-y`/`seam-x`/`grano`.
- **Reglas:** jerarquía por hairlines y tipografía, no tarjetas idénticas; sin gradientes genéricos; animación de entrada `aparecer`; respetar `prefers-reduced-motion`, foco visible y contraste AA; targets de 44px.
- **Chrome del panel:** riel lateral en desktop / barra superior en móvil. Secciones **activas**: Inicio, Productos, Sucursales, Punto de venta, Inventario y **Facturación** (SD-009, pendiente QA). Ya no queda ningún item "Pronto".
- **Formato de cifras (COP):** todo el dinero con `fformatearMoneda` y toda cantidad/contador visible con `formatearNumero`, ambos de `client/src/utilidades/formatoMoneda.js` (es-CO: miles con punto, sin decimales, `—` si no es numérico). Nunca formatear a mano, ni dentro de inputs de edición, ni en porcentajes decimales o IDs.

## Aprendizajes & Errores a Evitar

- **Operaciones atómicas:** Toda venta debe realizarse dentro de una transacción (`BEGIN ... COMMIT`) en el backend para evitar descontar stock si la factura falla.
- **Variables de entorno:** Configurar los nombres con prefijo `VITE_` en el cliente para que Vite pueda exponer las URLs del backend correctamente. Todo `VITE_` es público: nunca secretos.
- **Multi-tenant en login:** el correo es único **por empresa** (`UNIQUE (empresa_id, correo)`); como el login solo envía `correo`, si hay más de un usuario activo el backend responde **409**. Solución futura: enviar `empresa_id`/tenant.
- **Correo inactivo:** devuelve **403** y revela que el correo existe; el **401** de credenciales sí es genérico.
- **Permisos de agentes (Windows):** `permission.edit` compara la ruta del archivo; aquí el workspace root es `/` y las rutas llegan absolutas (`C:\...`), por lo que patrones tipo `docs/**`/`server/**` **no** matchean. Usar prefijo `*` y cubrir ambos separadores: `*server/*` y `*server\*` (idem `client`, `tests`, `specs`, `docs`); `*` ya cubre el resto. Los `deny`/`ask` específicos (`.env`, `schema.sql`) van **después** del allow (last-match-wins). Verificar tras reiniciar opencode (la config no se recarga en caliente).
- **Runner de tests:** `node --test` corre desde la raíz y descubre `tests/**/*.test.js`; `npm test` en `server` no encuentra tests y sale 0 (los tests viven en la raíz).
- **Anti-rumiado de subagentes:** `backend`, `frontend` y `qa` tienen sección "Definición de terminado (parar aquí)": alcance exacto, verificación UNA pasada (máx. 2 ciclos si hay fallo real que corregir), prohibido auto-revisarse, cierre = reportar y detenerse. `planeador` no re-verifica lo que `qa` aprobó (regla 9 "Delegación acotada").

## Próximos Pasos

Backlog priorizado en `docs/backlog.md` (fuente de verdad). **HECHOS: SD-001, SD-003, SD-005, SD-006, SD-007, SD-010, SD-011, SD-012, SD-018, SD-019, SD-020, SD-021 y SD-022.** **Foco actual: retomar SD-009** (listado de facturas, código completo, pendiente QA T-005). Después, P0: **SD-004 Clientes** y **SD-002 Categorías**. Luego P1: SD-013 login multi-tenant, SD-008 métodos de pago y SD-017 endurecimiento. Git se omite por decisión del usuario.