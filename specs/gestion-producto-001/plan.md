# Plan técnico — Gestión de productos (gestion-producto-001)

## Contrato `/api/v1` (fuente de verdad)

Base: `/api/v1/productos`. Auth: `Authorization: Bearer <token>`, rol `administrador`. `empresa_id` SIEMPRE desde `req.usuario` (nunca body/query).

### 1) GET /api/v1/productos
- **Query (opcional):** `nombre` (string, ILIKE), `codigo` (string, ILIKE), `categoria_id` (int), `activo` (bool).
- **200:** `{ "success": true, "data": [ Producto ] }`
- **401** sin token.

### 2) POST /api/v1/productos
- **Request:**
  - `codigo`: string, obligatorio, max 50
  - `nombre`: string, obligatorio, max 150
  - `descripcion`: string, opcional
  - `precio_unitario`: number, opcional (default 0), `>= 0`
  - `impuesto_porcentaje`: number, opcional (default 0), `0..100`
  - `categoria_id`: int, opcional
- **201:** `{ "success": true, "data": { "producto": Producto } }`
- **400** validación / categoría ajena; **401**; **403** rol; **409** código duplicado en la empresa.

### 3) GET /api/v1/productos/:id
- **200:** `{ "success": true, "data": { "producto": Producto } }`
- **400** id no numérico; **401**; **404** inexistente o de otra empresa.

### 4) PATCH /api/v1/productos/:id
- **Request:** todos opcionales: `codigo`, `nombre`, `descripcion`, `precio_unitario`, `impuesto_porcentaje`, `categoria_id`, `activo`.
- **200:** `{ "success": true, "data": { "producto": Producto } }`
- **400**; **401**; **403**; **404**; **409** código duplicado.

### Forma de `Producto` (data)
```json
{
  "id": 1,
  "codigo": "SKU-001",
  "nombre": "Producto",
  "descripcion": null,
  "precio_unitario": 1200.5,
  "impuesto_porcentaje": 19,
  "categoria_id": null,
  "activo": true,
  "creado_en": "2026-10-05T00:00:00.000Z",
  "actualizado_en": "2026-10-05T00:00:00.000Z"
}
```
`precio_unitario` e `impuesto_porcentaje` (numeric) DEBEN llegar como `Number`.

## Archivos por capa

**Backend (`/server`):**
- `validaciones/productos.js` — esquemas de creación/edición y filtros.
- `repositorios/productos.js` — SQL parametrizado, casteo numeric→Number, filtros dinámicos; unicidad `(empresa_id, codigo)`.
- `servicios/productos.js` — reglas (empresa desde usuario, categoría de la misma empresa, borrado lógico).
- `controladores/productos.js` — parsea req, llama servicio, responde 200/201.
- `rutas/productos.js` — router + middleware `autenticacion` + `autorizacion('administrador')` + `validarEntrada`.
- `rutas/index.js` — montar el router en `/productos`.

**Frontend (`/client`):**
- `servicios/productos.js` — `listarProductos(filtros)`, `crearProducto(datos)`, `obtenerProducto(id)`, `actualizarProducto(id, datos)`.
- `hooks/useProductos.js` — estado, carga/error, recarga.
- `utilidades/formatoMoneda.js` — `Intl.NumberFormat` (pendiente de crear).
- `paginas/Productos.jsx` — tabla + formulario (crear/editar), activar/desactivar, estados carga/error/vacío.
- `componentes/` — piezas de tabla/formulario si aplica.
- Navegación: acceso desde `Inicio` (riel/barra) sin instalar React Router.

## Orden de trabajo

1. **Backend** (contrato nuevo) — habilitar endpoints y dejarlos probados con `fetch`/healthcheck.
2. **Frontend** — consumir el contrato ya establecido.
3. **QA** — integración, IDOR, validaciones y lint/build.

## Riesgos

- **Casteo numeric:** olvidar convertir `precio_unitario`/`impuesto_porcentaje` a `Number` (rompe el contrato del frontend).
- **Multi-tenant:** filtrar por `empresa_id` del token en TODAS las consultas (IDOR).
- **Unicidad y borrado lógico:** `409` correcto de código y `activo=false` sin DELETE.
- **Validación de `categoria_id`:** debe pertenecer a la misma empresa.
- **Rutas/permisos:** montar el router con auth + rol; no exponer sin token.