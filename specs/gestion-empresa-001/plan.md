# Plan técnico — Onboarding Superadmin: Empresas y Administradores (gestion-empresa-001)

## Contrato `/api/v1` (fuente de verdad)

Base: `/api/v1/empresas` y `/api/v1/empresas/:empresaId/administradores`.
Auth: `Authorization: Bearer <token>`, **solo rol `superadmin`**.
`empresa_id` SIEMPRE desde `req.usuario` (superadmin no tiene empresa; estos endpoints son exclusivos de superadmin).

### 1) GET /api/v1/empresas
- **Query:** `pagina` (int ≥1, default 1), `por_pagina` (int 1..100, default 10), `activo` (boolean opcional), `q` (string opcional, busca en nombre/documento/correo).
- **200:** `{ "success": true, "data": { "items": [ Empresa ], "pagina": 1, "por_pagina": 10, "total": 1, "total_paginas": 1 } }`
- **401** sin token; **403** rol ≠ superadmin; **400** params inválidos.

### 2) POST /api/v1/empresas
- **Request:**
  - `nombre`: string, obligatorio, max 150
  - `documento`: string, opcional, max 30
  - `moneda`: string, obligatorio, 3 chars (ISO-4217, ej. COP, USD, EUR)
  - `direccion`: string, opcional, max 200
  - `telefono`: string, opcional, max 30
  - `correo`: string, opcional, max 150
- **201:** `{ "success": true, "data": { "empresa": Empresa } }`
- **400** validación; **401**; **403**; **409** nombre duplicado.

### 3) GET /api/v1/empresas/:id
- **200:** `{ "success": true, "data": { "empresa": Empresa } }`
- **400** id no numérico; **401**; **403**; **404** inexistente.

### 4) PATCH /api/v1/empresas/:id
- **Request:** todos opcionales: `nombre`, `documento`, `moneda`, `direccion`, `telefono`, `correo`, `activo`.
- **200:** `{ "success": true, "data": { "empresa": Empresa } }`
- **400** validación; **401**; **403**; **404**; **409** nombre duplicado.

### 5) GET /api/v1/empresas/:empresaId/administradores
- **Query:** `pagina`, `por_pagina` (igual convención).
- **200:** `{ "success": true, "data": { "items": [ Administrador ], "pagina": 1, "por_pagina": 10, "total": 1, "total_paginas": 1 } }`
- **400** params/empresaId inválido; **401**; **403**; **404** empresa no existe.

### 6) POST /api/v1/empresas/:empresaId/administradores
- **Request:**
  - `nombre`: string, obligatorio, max 150
  - `correo`: string, obligatorio, max 150, email válido
  - `password`: string, obligatorio, min 6 chars
- **201:** `{ "success": true, "data": { "administrador": Administrador } }`
  - `Administrador` = proyección pública (id, nombre, correo, rol, empresa_id, activo, creado_en) **SIN password_hash**.
- **400** validación; **401**; **403**; **404** empresa inexistente; **409** correo duplicado en la empresa; **409** empresa inactiva.

### Forma de `Empresa` (data)
```json
{
  "id": 1,
  "nombre": "Mi Empresa",
  "documento": "900123456-7",
  "moneda": "COP",
  "direccion": "Calle 1 #2-3",
  "telefono": "3001234567",
  "correo": "contacto@miempresa.com",
  "activo": true,
  "creado_en": "2026-10-05T00:00:00.000Z",
  "actualizado_en": "2026-10-05T00:00:00.000Z"
}
```

### Forma de `Administrador` (data)
```json
{
  "id": 5,
  "nombre": "Ana Pérez",
  "correo": "ana@miempresa.com",
  "rol": "administrador",
  "empresa_id": 1,
  "activo": true,
  "creado_en": "2026-10-05T00:00:00.000Z"
}
```
`id` (bigint) DEBE llegar como `Number`. No se expone `password_hash`.

---

## Archivos por capa

### Backend (`/server`)

**Nuevos:**
- `validaciones/empresas.js` — esquemas: `crearEmpresa`, `editarEmpresa`, `idEmpresa`, `crearAdminEmpresa`, `listarAdminsEmpresa`.
- `repositorios/empresas.js` — SQL parametrizado: `listar`, `crear`, `buscarPorId`, `actualizar`, `listarAdminsPorEmpresa`, `crearAdminEnEmpresa`. Casteo `bigint`→`Number`.
- `servicios/empresas.js` — reglas: solo superadmin accede; unicidad nombre; empresa activa para crear admins; bcrypt para password de admin.
- `controladores/empresas.js` — 6 handlers: `listarEmpresas`, `crearEmpresa`, `obtenerEmpresa`, `actualizarEmpresa`, `listarAdminsEmpresa`, `crearAdminEmpresa`.
- `rutas/empresas.js` — router con `autenticacion` + `autorizacion('superadmin')` + `validarEntrada`; montar en `rutas/index.js`.

**Modificar:**
- `rutas/index.js` — `router.use('/empresas', require('./empresas'))`.

### Frontend (`/client`)

**Nuevos:**
- `servicios/empresas.js` — `listarEmpresas(params)`, `crearEmpresa(data)`, `obtenerEmpresa(id)`, `actualizarEmpresa(id, data)`, `listarAdminsEmpresa(empresaId, params)`, `crearAdminEmpresa(empresaId, data)`.
- `hooks/useEmpresas.js` — estado: `items`, `cargando`, `error`, `paginacion`; `recargar()`, `crear()`, `actualizar()`.
- `hooks/useAdministradoresEmpresa.js` — similar, recibe `empresaId`.
- `paginas/Empresas.jsx` — tabla paginada + formulario modal (crear/editar) + botón activar/desactivar; estados carga/error/vacío; filtro por nombre y checkbox "Solo activas".
- `paginas/Administradores.jsx` — selector de empresa (solo activas) → tabla paginada de admins + formulario modal crear admin (nombre, correo, password, confirmar password); estados carga/error/vacío.
- `componentes/EmpresasTabla.jsx` — tabla responsive (patrón `table-fixed`, `colgroup`).
- `componentes/AdministradoresTabla.jsx` — tabla simple.
- `componentes/FormularioEmpresa.jsx` — formulario crear/editar empresa.
- `componentes/FormularioAdminEmpresa.jsx` — formulario crear admin (password + confirmación).

**Modificar:**
- `componentes/ArmazonPanel.jsx` — agregar sección "Administración" (solo si `usuario.rol === 'superadmin'`) con sub-items "Empresas" y "Administradores".
- `App.jsx` — importar y registrar vistas `empresas` y `administradores` en `VISTAS`.
- `utilidades/constantes.js` — `RUTA_EMPRESAS = '/empresas'`, `RUTA_ADMINISTRADORES = '/administradores'`.

---

## Orden de trabajo

1. **Backend** (contrato nuevo):
   - Validaciones → Repositorio → Servicio → Controlador → Rutas → Montar en index.
   - Verificación manual: healthcheck + `curl` a cada endpoint con token superadmin.
2. **Frontend**:
   - Servicios + Hooks → Páginas + Componentes → Navegación (ArmazonPanel + App).
   - Verificación visual: login como superadmin → ver sección Administración → CRUD empresas → crear admin.
3. **QA**:
   - Tests de integración en `tests/api/empresas.test.js` (cobertura: feliz, validaciones, 401, 403, 404, 409, IDOR, paginación, casteo bigint).
   - `npm test` en raíz + `npm run lint --prefix client` + `npm run build --prefix client`.

---

## Riesgos

- **Multi-tenant estricto:** superadmin ve todo (sin filtro `empresa_id`); admins nunca tocan estos endpoints (403 por `autorizacion('superadmin')`).
- **Unicidad y borrado lógico:** `empresa.nombre` único global; `activo=false` sin DELETE; `409` si se intenta crear admin en empresa inactiva.
- **Casteo `bigint`→`Number`** en todas las respuestas (empresa y admin).
- **Seguridad password:** bcrypt en servicio, **nunca** loguear ni devolver `password_hash`.
- **Navegación condicional:** sección "Administración" solo para superadmin; no romper gate de sesión ni otras secciones.
- **Login multi-tenant (deuda conocida):** si hay dos admins con mismo correo en empresas distintas, el login da 409 (SD-013). No bloquea esta spec.
- **Paginación:** aplicar convención `pagina`/`por_pagina` → sobre `{ items, pagina, por_pagina, total, total_paginas }` en ambos listados.