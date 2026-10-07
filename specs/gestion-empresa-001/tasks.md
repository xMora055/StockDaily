# Tareas — Onboarding Superadmin: Empresas y Administradores (gestion-empresa-001)

## Convención
- Cada tarea **T-###** dura 20–30 min, ordenada por dependencia.
- `capa`: `server` | `client` | `tests`
- `permite` / `prohíbe`: rutas que el subagente puede/no puede tocar.
- El bloque `handoff` es idéntico para `backend`, `frontend` y `qa`.

---

## T-001: Validaciones backend (empresas y admins)
**Objetivo:** Esquemas Joi/Zod (o el validador actual) para body/query de los 6 endpoints.
**Capa:** server
**Alcance:** `server/validaciones/empresas.js` (nuevo)
**Handoff:**
```yaml
T-001:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: Validar request/params de empresas y administradores (crear, editar, listar, id, paginación).
  capa: server
  permite: [server/validaciones/empresas.js]
  prohibe: [client/**, tests/**, server/db/schema.sql]
  contrato_api_v1:
    recurso: empresa / administrador
    request: ver plan.md §Contrato
  criterios_aceptacion: ["lint", "build", "healthcheck"]
  evidencia_requerida: "node -e \"require('./validaciones/empresas')\" no lanza error"
```

---

## T-002: Repositorio empresas
**Objetivo:** SQL parametrizado para CRUD empresas y listar/crear admins por empresa.
**Capa:** server
**Alcance:** `server/repositorios/empresas.js` (nuevo)
**Handoff:**
```yaml
T-002:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: Consultas SQL: listar (paginado + filtros), crear, buscarPorId, actualizar, listarAdminsPorEmpresa, crearAdminEnEmpresa (con bcrypt hash).
  capa: server
  permite: [server/repositorios/empresas.js]
  prohibe: [client/**, tests/**, server/db/schema.sql]
  negocio:
    transaccion: n/a (crear admin = 1 INSERT; servicio maneja transacción si fuera necesario)
    multi_tenant: "superadmin sin empresa_id; NO filtrar por empresa en listados"
    roles: [superadmin]
  criterios_aceptacion: ["lint", "build", "healthcheck"]
  evidencia_requerida: "node -e \"require('./repositorios/empresas')\" no lanza error"
```

---

## T-003: Servicio empresas
**Objetivo:** Reglas de negocio: solo superadmin, unicidad nombre, empresa activa para crear admin, bcrypt.
**Capa:** server
**Alcance:** `server/servicios/empresas.js` (nuevo)
**Handoff:**
```yaml
T-003:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: Orquesta repo; valida unicidad (409); hashea password admin con bcrypt (costo 10); proyección pública sin password_hash.
  capa: server
  permite: [server/servicios/empresas.js]
  prohibe: [client/**, tests/**, server/db/schema.sql]
  negocio:
    transaccion: n/a
    multi_tenant: "superadmin ve todas; admins no acceden (403 en controlador)"
    roles: [superadmin]
  criterios_aceptacion: ["lint", "build", "healthcheck"]
  evidencia_requerida: "node -e \"require('./servicios/empresas')\" no lanza error"
```

---

## T-004: Controlador empresas
**Objetivo:** 6 handlers HTTP: listarEmpresas, crearEmpresa, obtenerEmpresa, actualizarEmpresa, listarAdminsEmpresa, crearAdminEmpresa.
**Capa:** server
**Alcance:** `server/controladores/empresas.js` (nuevo)
**Handoff:**
```yaml
T-004:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: Parse req, llama servicio, responde {success, data} 200/201 o next(ErrorApp).
  capa: server
  permite: [server/controladores/empresas.js]
  prohibe: [client/**, tests/**, server/db/schema.sql]
  contrato_api_v1:
    recurso: empresa / administrador
    metodo_path: "GET/POST/PATCH /api/v1/empresas, GET/POST /api/v1/empresas/:id/administradores"
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
  criterios_aceptacion: ["lint", "build", "healthcheck"]
  evidencia_requerida: "node -e \"require('./controladores/empresas')\" no lanza error"
```

---

## T-005: Rutas empresas + montaje
**Objetivo:** Router con `autenticacion` + `autorizacion('superadmin')` + `validarEntrada`; montar en `rutas/index.js`.
**Capa:** server
**Alcance:** `server/rutas/empresas.js` (nuevo), `server/rutas/index.js` (modificar)
**Handoff:**
```yaml
T-005:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: Exponer 6 endpoints bajo /api/v1/empresas con middlewares correctos.
  capa: server
  permite: [server/rutas/empresas.js, server/rutas/index.js]
  prohibe: [client/**, tests/**, server/db/schema.sql]
  criterios_aceptacion: ["lint", "build", "healthcheck", "GET /api/v1/salud -> 200"]
  evidencia_requerida: "curl -H 'Authorization: Bearer <superadmin_token>' http://localhost:3000/api/v1/empresas -> 200 {success:true}"
```

---

## T-006: Servicio API cliente (empresas y admins)
**Objetivo:** Funciones fetch tipadas para los 6 endpoints.
**Capa:** client
**Alcance:** `client/src/servicios/empresas.js` (nuevo)
**Handoff:**
```yaml
T-006:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: listarEmpresas(params), crearEmpresa(data), obtenerEmpresa(id), actualizarEmpresa(id,data), listarAdminsEmpresa(empresaId,params), crearAdminEmpresa(empresaId,data). Usan clienteApi.js (Bearer token).
  capa: client
  permite: [client/src/servicios/empresas.js]
  prohibe: [server/**, tests/**]
  contrato_api_v1:
    recurso: empresa / administrador
    metodo_path: ver plan.md
    casteo: [numeric/bigint -> Number]
  criterios_aceptacion: ["lint", "build"]
  evidencia_requerida: "npm run lint --prefix client -> 0 errores"
```

---

## T-007: Hooks useEmpresas y useAdministradoresEmpresa
**Objetivo:** Estado reactivo, carga/error, paginación, recarga, mutaciones.
**Capa:** client
**Alcance:** `client/src/hooks/useEmpresas.js`, `client/src/hooks/useAdministradoresEmpresa.js` (nuevos)
**Handoff:**
```yaml
T-007:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: Encapsulan servicios; exponen { items, cargando, error, paginacion, recargar, crear, actualizar, crearAdmin }.
  capa: client
  permite: [client/src/hooks/useEmpresas.js, client/src/hooks/useAdministradoresEmpresa.js]
  prohibe: [server/**, tests/**]
  criterios_aceptacion: ["lint", "build"]
  evidencia_requerida: "npm run lint --prefix client -> 0 errores"
```

---

## T-008: Componentes UI (tablas y formularios)
**Objetivo:** Tablas responsive + formularios modales (crear/editar empresa; crear admin).
**Capa:** client
**Alcance:** `client/src/componentes/EmpresasTabla.jsx`, `client/src/componentes/AdministradoresTabla.jsx`, `client/src/componentes/FormularioEmpresa.jsx`, `client/src/componentes/FormularioAdminEmpresa.jsx` (nuevos)
**Handoff:**
```yaml
T-008:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: UI "papel de caja" (Space Grotesk + IBM Plex Mono, @theme tokens). Tabla: colgroup, sticky header, paginación. Formulario: validación inline, password + confirmar, estados disabled loading.
  capa: client
  permite: [client/src/componentes/EmpresasTabla.jsx, client/src/componentes/AdministradoresTabla.jsx, client/src/componentes/FormularioEmpresa.jsx, client/src/componentes/FormularioAdminEmpresa.jsx]
  prohibe: [server/**, tests/**]
  criterios_aceptacion: ["lint", "build", "estados carga/error/vacío visibles"]
  evidencia_requerida: "npm run build --prefix client -> success"
```

---

## T-009: Páginas Empresas y Administradores
**Objetivo:** Páginas contenedoras que usan hooks + componentes; wiring completo.
**Capa:** client
**Alcance:** `client/src/paginas/Empresas.jsx`, `client/src/paginas/Administradores.jsx` (nuevos)
**Handoff:**
```yaml
T-009:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: Empresas.jsx: tabla + modal crear/editar + toggle activo. Administradores.jsx: select empresa (solo activas) -> tabla admins + modal crear admin.
  capa: client
  permite: [client/src/paginas/Empresas.jsx, client/src/paginas/Administradores.jsx]
  prohibe: [server/**, tests/**]
  criterios_aceptacion: ["lint", "build", "navegación funcional"]
  evidencia_requerida: "npm run build --prefix client -> success"
```

---

## T-010: Navegación y registro de vistas
**Objetivo:** Agregar sección "Administración" (solo superadmin) en ArmazonPanel; registrar vistas en App.jsx; constantes de ruta.
**Capa:** client
**Alcance:** `client/src/componentes/ArmazonPanel.jsx` (modificar), `client/src/App.jsx` (modificar), `client/src/utilidades/constantes.js` (modificar)
**Handoff:**
```yaml
T-010:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: SECCIONES en ArmazonPanel: { id: 'administracion', nombre: 'Administración', subsecciones: ['empresas', 'administradores'] } solo si usuario.rol === 'superadmin'. VISTAS en App.jsx importan Empresas y Administradores.
  capa: client
  permite: [client/src/componentes/ArmazonPanel.jsx, client/src/App.jsx, client/src/utilidades/constantes.js]
  prohibe: [server/**, tests/**]
  criterios_aceptacion: ["lint", "build", "superadmin ve Administración; admin no la ve"]
  evidencia_requerida: "npm run build --prefix client -> success; login superadmin -> sección visible; login admin -> no visible"
```

---

## T-011: Tests de integración (QA)
**Objetivo:** Suite `tests/api/empresas.test.js` cubriendo casos felices, validaciones, 401, 403, 404, 409, IDOR, paginación, casteo bigint.
**Capa:** tests
**Alcance:** `tests/api/empresas.test.js` (nuevo), `tests/utilidades/` (reutilizar helpers)
**Handoff:**
```yaml
T-011:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: 30+ casos: crear/listar/obtener/editar empresa; crear/listar admins; superadmin vs admin; duplicados; empresa inactiva; paginación; id Number; password_hash nunca expuesto.
  capa: tests
  permite: [tests/api/empresas.test.js]
  prohibe: [server/**, client/**]
  criterios_aceptacion: ["npm test (raíz) -> pass", "0 fallos, 0 faltantes en reporte QA"]
  evidencia_requerida: "npm test 2>&1 | tail -20"
```

---

## T-012: Verificación integrada y cierre QA
**Objetivo:** Ejecutar suite completa, lint, build, healthcheck; reportar veredicto.
**Capa:** tests (qa)
**Alcance:** `tests/` (lectura), todo el repo (verificación)
**Handoff:**
```yaml
T-012:
  spec: specs/gestion-empresa-001/spec.md
  objetivo: QA ejecuta npm test (raíz), npm run lint --prefix client, npm run build --prefix client, healthcheck. Verifica contrato, IDOR, roles, casteo, UI estados.
  capa: tests
  permite: [tests/**]
  prohibe: [server/**, client/**]  # solo verifica, no modifica
  criterios_aceptacion: ["Veredicto APROBADO", "0 fallos, 0 faltantes"]
  evidencia_requerida: "npm test 2>&1 | grep -E 'pass|fail|tests'"
```

---

## Orden de ejecución sugerido

```
Backend (T-001 → T-005) → Frontend (T-006 → T-010) → QA (T-011 → T-012)
```

- Backend completo antes de Frontend (contrato nuevo).
- T-011 (tests) puede empezar en paralelo con T-010 si el backend está listo y corriendo.
- T-012 **siempre al final**, tras confirmar que backend + frontend integrados funcionan.