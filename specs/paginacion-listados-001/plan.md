# Plan técnico — Paginación de productos y sucursales (paginacion-listados-001)

## Contrato `/api/v1` (fuente de verdad)

### GET /api/v1/productos
- **Query:** `nombre`, `codigo`, `categoria_id`, `activo` (filtros existentes) + `pagina` (int >=1, default 1), `por_pagina` (int 1..100, default 20).
- **200:** `{ "success": true, "data": { "items": [ Producto ], "pagina", "por_pagina", "total", "total_paginas" } }`
- Orden: `producto.nombre ASC, producto.id ASC`. `pagina`/`por_pagina` inválidos → `400`.

### GET /api/v1/sucursales
- **Query:** `pagina` (int >=1, default 1), `por_pagina` (int 1..100, default 20). (Opcional: `activo`.)
- **200:** `{ "success": true, "data": { "items": [ Sucursal ], "pagina", "por_pagina", "total", "total_paginas" } }`
- Orden: `sucursal.nombre ASC, sucursal.id ASC`. Inválidos → `400`.

Reglas comunes: `total` = `COUNT` con los mismos filtros y `empresa_id` del token; `total_paginas = ceil(total/por_pagina)`; `OFFSET = (pagina-1)*por_pagina`; numeric/bigint → `Number`.

## Archivos por capa

**Backend (`/server`):**
- `validaciones/productos.js`, `validaciones/sucursales.js` — añadir `pagina`/`por_pagina`.
- `repositorios/productos.js`, `repositorios/sucursales.js` — `COUNT` + `LIMIT/OFFSET`, devolver `{ items, total }`.
- `servicios/productos.js`, `servicios/sucursales.js` — armar `{ items, pagina, por_pagina, total, total_paginas }`.
- `controladores/productos.js`, `controladores/sucursales.js` — responder el sobre paginado.
- `POST/PATCH/GET :id` **no cambian**.

**Frontend (`/client`):**
- `servicios/productos.js`, `servicios/sucursales.js` — aceptar/enviar `pagina`/`por_pagina` y normalizar `{ items, pagina, por_pagina, total, total_paginas }`.
- `hooks/useProductos.js`, `hooks/useSucursales.js` — exponer `datos` (=items) + `pagina`, `porPagina`, `total`, `totalPaginas`, `irAPagina`, `paginaSiguiente`, `paginaAnterior`; reset a página 1 al cambiar filtros.
- `paginas/Productos.jsx`, `paginas/Sucursales.jsx` — renderizar `Paginacion` en las tablas.
- **Consumidores de catálogo a adaptar:** `usePuntoDeVenta`, `SelectorSucursal`, `BuscadorProductos`, `Inventario`/`FiltrosInventario`/`FormularioMovimiento` (usan `useProductos`/`useSucursales`): consumir `items`; para selectores pedir `por_pagina: 100`.

## Orden
1. Backend (contrato) y verificación HTTP.
2. Frontend (tablas + adaptación de consumidores).
3. QA (paginación, filtros, sin regresión en POS/Inventario) y lint/build.

## Riesgos
- **Consumidores de catálogo:** POS/Inventario deben usar `items`; si no, quedan rotos.
- **Selectores con >100 productos:** el tope `por_pagina=100` podría no listar todos; documentar (búsqueda/a paginar en el futuro).
- **Tests existentes** de productos/sucursales asumían `data` array; QA debe actualizarlos.
- **Orden determinista** para no repetir/omitir filas.