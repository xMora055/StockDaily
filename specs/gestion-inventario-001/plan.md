# Plan técnico — Inventario (gestion-inventario-001)

## Contrato `/api/v1` (fuente de verdad)

Base `/api/v1/inventario`. Auth: `Bearer`, rol `administrador`; empresa desde el token.

### 1) POST /api/v1/inventario/movimientos
**Request:**
```json
{ "producto_id": 1, "sucursal_id": 1, "tipo": "carga_inicial", "cantidad": 50, "observacion": "Inventario inicial" }
```
- `producto_id`: int obligatorio (de la empresa).
- `sucursal_id`: int obligatorio (de la empresa).
- `tipo`: `"carga_inicial" | "ajuste"` obligatorio.
- `cantidad`: int obligatorio, `≠ 0`, `|cantidad| <= 1000000`; positivo = entrada, negativo = salida.
- `observacion`: string opcional, max 255.

**201:**
```json
{ "success": true, "data": {
  "movimiento": { "id": 10, "producto_id": 1, "sucursal_id": 1, "tipo": "carga_inicial", "cantidad": 50, "observacion": "Inventario inicial", "usuario_id": 1, "factura_id": null, "creado_en": "..." },
  "stock": { "producto_id": 1, "sucursal_id": 1, "cantidad": 50 }
} }
```
Errores: `400` (validación/tipo/cantidad), `401`, `403`, `404` (producto/sucursal ajena), `500`.

### 2) GET /api/v1/inventario/stock
- **Query:** `sucursal_id` (int), `producto_id` (int), `buscar` (string: nombre/código, ILIKE), `solo_faltantes` (bool, default false), `pagina` (int >=1, default 1), `por_pagina` (int 1..100, default 20).
- **200 (paginado):** `{ "success": true, "data": { "items": [ { "producto_id", "producto_codigo", "producto_nombre", "sucursal_id", "sucursal_nombre", "cantidad", "actualizado_en" } ], "pagina", "por_pagina", "total", "total_paginas" } }`
- Orden: `producto_nombre ASC, sucursal_nombre ASC`. Con `solo_faltantes=true` usa `vista_stock_faltante` (cantidad < 0).
- `pagina` < 1 o `por_pagina` fuera de 1..100 → `400`.

### 3) GET /api/v1/inventario/movimientos
- **Query:** `producto_id`, `sucursal_id`, `tipo`, `desde`, `hasta` (ISO), `pagina` (int >=1, default 1), `por_pagina` (int 1..100, default 20). Orden `creado_en DESC`. (`limite` queda reemplazado por `por_pagina`.)
- **200 (paginado):** `{ "success": true, "data": { "items": [ { "id", "producto_id", "producto_nombre", "sucursal_id", "sucursal_nombre", "tipo", "cantidad", "observacion", "usuario_id", "factura_id", "creado_en" } ], "pagina", "por_pagina", "total", "total_paginas" } }`
- `pagina` < 1 o `por_pagina` fuera de 1..100 → `400`.

## Reglas
- `enTransaccion` para el POST: validar → `INSERT movimiento_inventario` (`usuario_id` del token, `factura_id` null) → leer `stock` resultante → COMMIT.
- El trigger `aplicar_movimiento_inventario` mantiene `stock`; se permite negativo.
- Cota `|cantidad| <= 1_000_000`; mapear `22003` → `400` (defensa en profundidad).
- `empresa_id` siempre del token, en todas las consultas (IDOR).
- numeric/bigint → `Number`.
- **Paginación (Revisión 2):** `GET stock` y `GET movimientos` devuelven `data` como objeto `{ items, pagina, por_pagina, total, total_paginas }`. `total` = filas que cumplen los filtros (COUNT con los mismos WHERE); `total_paginas = ceil(total / por_pagina)`. `OFFSET = (pagina - 1) * por_pagina`. Defaults `pagina=1`, `por_pagina=20`, máx 100.

## Archivos por capa

**Backend (`/server`):**
- `validaciones/inventario.js`, `repositorios/inventario.js`, `servicios/inventario.js` (con `enTransaccion`), `controladores/inventario.js`, `rutas/inventario.js`; montar `/inventario` en `rutas/index.js`.

**Frontend (`/client`):**
- `servicios/inventario.js` (stock, movimientos, crear movimiento).
- `hooks/useInventario.js` / `useMovimientosInventario.js`.
- `paginas/Inventario.jsx` con `TablaStock`, `FiltrosInventario`, `FormularioMovimiento`, `TablaMovimientos`.
- `ArmazonPanel.jsx` habilita "Inventario"; `App.jsx` vista `inventario`; `constantes.js` rutas.

## Orden
1. Backend (contrato + transacción) y verificación HTTP.
2. Frontend consumiendo el contrato + navegación.
3. QA (transacción, IDOR, filtros, faltantes) y lint/build.

## Riesgos
- **Atomicidad** del movimiento.
- **Desbordes de `integer`** (cota de cantidad).
- **Multi-tenant** en producto/sucursal (no ajustar stock ajeno).
- **Faltantes**: usar la vista con `security_invoker` y filtrar por empresa.
- **Cantidades** formateadas con `formatearNumero` (miles con punto) en la UI.