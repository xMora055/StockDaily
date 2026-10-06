# Plan técnico — Gestión de sucursales (gestion-sucursal-001)

## Contrato `/api/v1` (fuente de verdad)

Base: `/api/v1/sucursales`. Auth: `Authorization: Bearer <token>`, rol `administrador`. `empresa_id` SIEMPRE desde `req.usuario` (nunca body/query).

### 1) GET /api/v1/sucursales
- **200:** `{ "success": true, "data": [ Sucursal ] }`
- **401** sin token; **403** rol no autorizado.

### 2) POST /api/v1/sucursales
- **Request:**
  - `nombre`: string, obligatorio, max 150
  - `direccion`: string, opcional, max 200
  - `telefono`: string, opcional, max 30
- **201:** `{ "success": true, "data": { "sucursal": Sucursal } }`
- **400** validación; **401**; **403**; **409** nombre duplicado en la empresa.

### 3) GET /api/v1/sucursales/:id
- **200:** `{ "success": true, "data": { "sucursal": Sucursal } }`
- **400** id no numérico; **401**; **404** inexistente o de otra empresa.

### 4) PATCH /api/v1/sucursales/:id
- **Request:** todos opcionales: `nombre`, `direccion`, `telefono`, `activo`.
- **200:** `{ "success": true, "data": { "sucursal": Sucursal } }`
- **400**; **401**; **403**; **404**; **409** nombre duplicado.

### Forma de `Sucursal` (data)
```json
{
  "id": 1,
  "nombre": "Principal",
  "direccion": "Calle 1 #2-3",
  "telefono": "3001234567",
  "activo": true,
  "creado_en": "2026-10-05T00:00:00.000Z",
  "actualizado_en": "2026-10-05T00:00:00.000Z"
}
```
No se expone `empresa_id`. `id` (bigint) DEBE llegar como `Number`.

## Archivos por capa

**Backend (`/server`):**
- `validaciones/sucursales.js` — esquemas de creación/edición y `id`.
- `repositorios/sucursales.js` — SQL parametrizado, casteo bigint→Number, unicidad `(empresa_id, nombre)`.
- `servicios/sucursales.js` — reglas (empresa desde usuario, borrado lógico).
- `controladores/sucursales.js` — parsea req, llama servicio, responde 200/201.
- `rutas/sucursales.js` — router + `autenticacion` + `autorizacion('administrador')` + `validarEntrada` (reutiliza el middleware ya existente).
- `rutas/index.js` — montar `/sucursales`.

**Frontend (`/client`):**
- `servicios/sucursales.js` — listar, crear, obtener, actualizar.
- `hooks/useSucursales.js` — estado, carga/error, recarga.
- `paginas/Sucursales.jsx` — tabla + formulario (crear/editar) y activar/desactivar, con estados carga/error/vacío.
- `componentes/` — tabla/formulario (reutiliza el patrón responsive ya aplicado en Productos: `table-fixed`, colgroup).
- `componentes/ArmazonPanel.jsx` — agregar la sección "Sucursales".
- `App.jsx` — nueva vista `sucursales`.
- `utilidades/constantes.js` — `RUTA_SUCURSALES = '/sucursales'`.

## Orden de trabajo

1. **Backend** (contrato nuevo): endpoints + verificación con healthcheck/fetch.
2. **Frontend**: consumir el contrato y añadir navegación.
3. **QA**: integración, IDOR, validaciones y lint/build.

## Riesgos

- **Multi-tenant:** filtrar por `empresa_id` del token en TODAS las consultas (IDOR).
- **Unicidad y borrado lógico:** `409` por nombre duplicado; `activo=false` sin DELETE.
- **Casteo bigint→Number** en respuestas.
- **Navegación:** integrar "Sucursales" en `ArmazonPanel`/`App` sin romper Productos ni el gate de sesión.
- **Campos opcionales:** `direccion`/`telefono` vacíos se normalizan a `null`.