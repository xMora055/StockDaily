# Plan técnico — Selector de tamaño de página y default 10 (paginacion-listados-002)

## Contrato `/api/v1` (fuente de verdad)

Los cuatro listados **no cambian de forma**; solo cambia el **default** de `por_pagina`.

### GET /api/v1/productos
- **Query:** filtros existentes (`nombre`, `codigo`, `categoria_id`, `activo`) + `pagina` (int ≥1, default 1) + `por_pagina` (int **1..100**, default **10**).
- **200:** `{ "success": true, "data": { "items": [Producto], "pagina", "por_pagina", "total", "total_paginas" } }`
- Orden `nombre ASC, id ASC`.

### GET /api/v1/sucursales
- **Query:** `activo` (opcional) + `pagina` (int ≥1, default 1) + `por_pagina` (int 1..100, default **10**).
- **200:** mismo sobre paginado. Orden `nombre ASC, id ASC`.

### GET /api/v1/inventario/stock y GET /api/v1/inventario/movimientos
- **Query:** filtros existentes + `pagina` (default 1) + `por_pagina` (int 1..100, default **10**).
- **200:** mismo sobre paginado.

Reglas comunes (sin cambios): `total` = `COUNT` con los mismos filtros y `empresa_id` del token; `total_paginas = ceil(total/por_pagina)`; `OFFSET = (pagina-1)*por_pagina`; `por_pagina` fuera de `1..100` → `400` (**`0` inválido**); numeric/bigint → `Number`.

### Contrato de UI (componente `Paginacion`)
- **Props nuevas:** `opcionesPorPagina` (default `[5, 10, 15, 20]`) y `alCambiarPorPagina(valor)`.
- **Comportamiento:** `select` etiquetado ("Por página"), valor = `por_pagina` actual; al cambiar, se emite el número y el hook recarga en página 1. Sin `alCambiarPorPagina`, el componente se comporta como hoy (solo Anterior/Siguiente).

## Archivos por capa

**Backend (`/server`):**
- `validaciones/productos.js`, `validaciones/sucursales.js`, `validaciones/inventario.js` — `POR_PAGINA_DEFAULT: 20 → 10` (rango `POR_PAGINA_MAX = 100` intacto; `0` sigue rechazado). Actualizar comentarios.

**Frontend (`/client`):**
- `utilidades/paginacion.js` — `PAGINA_POR_DEFECTO: 20 → 10`; exportar las opciones (`OPCIONES_POR_PAGINA = [5, 10, 15, 20]`) si conviene centralizarlas. `acotarPorPagina` sigue acotando a `[1,100]` (los selectores con `100` no se afectan).
- `hooks/useInventario.js`, `hooks/useMovimientosInventario.js` — `POR_PAGINA_INICIAL: 20 → 10`.
- `componentes/Paginacion.jsx` — añadir `select` (5/10/15/20) + `alCambiarPorPagina`; conservar Anterior/Siguiente, "Página X de Y" y el total con `formatearNumero`.
- `componentes/ProductosTabla.jsx`, `componentes/SucursalesTabla.jsx`, `componentes/TablaStock.jsx`, `componentes/TablaMovimientos.jsx` — aceptar `alCambiarPorPagina` y pasarlo a `Paginacion`.
- `paginas/Productos.jsx`, `paginas/Sucursales.jsx`, `paginas/Inventario.jsx` — exponer `cambiarPorPagina` de los hooks y pasarlo a su tabla.

**Tests (`/tests`):**
- `tests/api/productos.test.js`, `tests/api/sucursales.test.js`, `tests/api/inventario.test.js` — actualizar las aserciones de default `por_pagina: 20 → 10`; verificar que `por_pagina=0` sigue en `400`; añadir cobertura del nuevo default en los cuatro listados.

## Orden
1. **Backend** (default 10) y **Frontend** (selector + default 10) en paralelo: el contrato ya está cerrado y ambos comparten el mismo valor.
2. **QA** sobre el conjunto: default, selector, reset a página 1, sin regresión y lint/build.

## Riesgos
- **Tests que fijan `20`:** productos/sucursales (y posiblemente inventario) fallarán hasta actualizarlos; sin eso `npm test` no queda verde.
- **Selector fuera de opciones:** si el `por_pagina` normalizado no está en la lista (p. ej. un valor arbitrario de la URL), el `select` debe mostrar un valor válido sin romper; acotar a las opciones conocidas.
- **Doble recarga:** evitar `onChange` que dispare peticiones si el valor no cambió (EC-006).
- **Accesibilidad:** `<label>`/`aria-label` correctos y foco visible (dirección "papel de caja").
- **Selectores de catálogo:** POS/Inventario piden `por_pagina=100`; no deben pasar por el selector ni cambiar.
