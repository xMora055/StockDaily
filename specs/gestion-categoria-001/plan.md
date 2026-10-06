# Plan técnico — Catálogo de categorías (gestion-categoria-001)

## Contrato `/api/v1` (fuente de verdad)

Auth en todo el recurso: `Authorization: Bearer <token>`, rol `administrador` (superadmin → `403`). `empresa_id` se deriva del token; **nunca** del body/query. Sobre estándar `{ "success": true, "data": ... }` / `{ "success": false, "error": "Mensaje" }`.

### `Categoria` (proyección que devuelve la API)
```
{ id:Number, nombre:string, activo:boolean, creado_en:ISO, actualizado_en:ISO }
```
> No se expone `empresa_id`.

### GET /api/v1/categorias
- Query (opcional): `pagina` (entero ≥1, default 1), `por_pagina` (entero 1..100, default 10), `activo` (`true`|`false`), `buscar` (texto ≤100 → `nombre`).
- Orden: `nombre ASC, id ASC`. `total` = COUNT del mismo WHERE.
- **200:** `{ success:true, data:{ items:[Categoria], pagina, por_pagina, total, total_paginas } }`.
- **Errores:** `400` paginación/`activo` inválidos; `401`; `403`; `500`.

### POST /api/v1/categorias
- Body: `{ nombre:string(req, ≤100, no vacío tras trim) }`. Se ignora `empresa_id` y cualquier campo extra.
- **201:** `{ success:true, data:{ categoria:Categoria } }`.
- **Errores:** `400`; `401`; `403`; `409` nombre duplicado en la empresa; `500`.

### GET /api/v1/categorias/:id
- **200:** `{ success:true, data:{ categoria:Categoria } }`.
- **Errores:** `400` `:id` no entero seguro positivo; `401`; `403`; `404` inexistente o de otra empresa; `500`.

### PATCH /api/v1/categorias/:id
- Body (solo campos presentes): `{ nombre?, activo? }`. Sin campos → `400`.
- **200:** `{ success:true, data:{ categoria:Categoria } }`.
- **Errores:** `400`; `401`; `403`; `404`; `409` nombre duplicado; `500`.

> **`/api/v1/productos` NO cambia.** Ya acepta `categoria_id` (crear/editar y filtro) y la UI lo usará con un select. La tabla de productos mostrará el nombre de la categoría mapeado en el cliente, sin modificar la respuesta.

## Modelo de datos (sin cambios de esquema)

- `categoria (id, empresa_id, nombre, activo, creado_en, actualizado_en)`, `UNIQUE (empresa_id, nombre)`.
- `producto.categoria_id bigint REFERENCES categoria(id) ON DELETE SET NULL` — el borrado es lógico (`activo`), así que no hay `SET NULL`.
- Multi-tenant: `categoria` filtrada por `empresa_id` del token; el `:id` se acota con `empresa_id` (evita IDOR).
- **No se toca `server/db/schema.sql`.** No hay dependencias nuevas.

## Archivos por capa

**Backend (`/server`):**
- `validaciones/categorias.js` (nuevo) — `validarCreacionCategoria`, `validarEdicionCategoria`, `validarFiltrosCategorias`, `validarIdCategoria`. Patrón de `validaciones/sucursales.js` (objeto plano, `hasOwnProperty`, `normalizarPaginacion`, `validarId` solo dígitos + entero seguro).
- `repositorios/categorias.js` (nuevo) — `listar(empresaId, filtros) → { items, total }` (filtros `activo`/`buscar` con escape de `%`/`_`, COUNT del mismo WHERE, `LIMIT/OFFSET`, `mapear` bigint→Number); `buscarPorId(id, empresaId)`; `crear(empresaId, datos)`; `actualizar(id, empresaId, cambios)`; `existeNombre(empresaId, nombre, excluirId)`.
- `servicios/categorias.js` (nuevo) — `empresaDelUsuario`, `armarPagina`, `listarCategorias`, `crearCategoria` (409), `obtenerCategoria` (404), `actualizarCategoria` (404/409); traduce `23505→409` y `22003→400`.
- `controladores/categorias.js` (nuevo) — `listar`, `crear` (201), `obtener`, `actualizar`.
- `rutas/categorias.js` (nuevo) — `router.use(autenticacion, autorizacion('administrador'))`; `GET '/'`, `POST '/'`, `GET '/:id'`, `PATCH '/:id'`.
- `rutas/index.js` — registrar `router.use('/categorias', categorias)`.

**Frontend (`/client`):**
- `utilidades/constantes.js` — `RUTA_CATEGORIAS = '/categorias'`.
- `servicios/categorias.js` (nuevo) — `listarCategorias`, `crearCategoria`, `obtenerCategoria`, `actualizarCategoria` (patrón `servicios/sucursales.js`).
- `hooks/useCategorias.js` (nuevo) — listado paginado con filtros y reset a página 1.
- `hooks/useCategoriasCatalogo.js` (nuevo) — categorías activas para selectores (`por_pagina=100`), con mapa `id → nombre`.
- `componentes/FiltrosCategorias.jsx` (nuevo) — estado y buscador.
- `componentes/CategoriasTabla.jsx` (nuevo) — tabla desktop + tarjetas móvil, `Paginacion`, editar y activar/desactivar con confirmación.
- `componentes/FormularioCategoria.jsx` (nuevo) — alta/edición con validación local.
- `paginas/Categorias.jsx` (nuevo) — orquesta listado/filtros/formulario y estados.
- `componentes/ArmazonPanel.jsx` — añadir `{ id: 'categorias', nombre: 'Categorías' }`.
- `App.jsx` — registrar `categorias: Categorias`.
- `componentes/FormularioProducto.jsx` — sustituir el campo numérico `categoria_id` por un **select** (activas + opción "Sin categoría"; incluir la actual si está inactiva).
- `componentes/FiltrosProductos.jsx` — añadir **select de categoría** (`categoria_id`).
- `paginas/Productos.jsx` / `componentes/ProductosTabla.jsx` — cargar catálogo y mostrar el **nombre** de la categoría (mapa en cliente).

**Tests (`/tests`):**
- `tests/api/categorias.test.js` (nuevo, lo escribe `qa`).

## Orden de trabajo

1. **T-001** Backend listado (`GET /categorias`).
2. **T-002** Backend escritura/consulta (`POST`, `GET/:id`, `PATCH`) + registro de ruta.
3. **T-003** Frontend página Categorías: listado, filtros, paginación.
4. **T-004** Frontend formulario/acciones + navegación.
5. **T-005** Frontend integración con Productos (select en formulario, filtro, nombre en tabla).
6. **T-006** QA de integración.

> El backend va primero (recurso nuevo). T-005 depende de T-001/T-002 y de que exista el catálogo.

## Riesgos

- **Unicidad sensible a mayúsculas:** el `UNIQUE (empresa_id, nombre)` de PostgreSQL distingue mayúsculas ("Bebidas" ≠ "bebidas"). Se mantiene el comportamiento actual del repo (mismo riesgo ya registrado en sucursales); se hace `trim` para evitar duplicados por espacios externos.
- **IDOR:** toda consulta acotada a `empresa_id` del token; `:id` nunca sale del tenant.
- **`22003` bigint fuera de rango:** traducir a `400` (lección SD-003/SD-007), nunca `500`.
- **Filtro de productos:** el select debe enviar `categoria_id` numérico o vacío; el backend ya valida `categoria_id > 0` y responde `400` si llega inválido.
- **Catálogo para el mapa de nombres:** se consume `por_pagina=100`; si una empresa supera 100 categorías activas, el mapa/nombre podría quedar incompleto (deuda conocida de selectores). Aceptable para el MVP.
- **Regresión de productos:** la suite `tests/api/productos.test.js` usa categorías existentes; los cambios de UI no deben alterar el contrato. QA debe correr la suite completa.
