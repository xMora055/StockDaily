# Plan técnico — Listado y consulta de facturas (listado-facturas-001)

## Contrato `/api/v1` (fuente de verdad)

### GET /api/v1/facturas
- Auth: `Bearer`, rol `administrador`; `empresa_id` desde el token (NUNCA del body/query).
- Query (todos opcionales): `pagina` (int ≥1, default 1), `por_pagina` (int 1..100, default 10), `sucursal_id` (int >0), `estado` (`emitida`|`anulada`), `desde`/`hasta` (ISO date sobre `factura.fecha`), `buscar` (texto ≤150 → `numero_factura::text` o `cliente_nombre`).
- Orden: `fecha DESC, id DESC`.
- **200:** `{ "success": true, "data": { "items": [ FacturaResumen ], "pagina", "por_pagina", "total", "total_paginas" } }`
- `FacturaResumen`: `{ id:Number, numero_factura:Number, sucursal_id:Number, sucursal_nombre:string, cliente_nombre:string|null, total:Number, estado:"emitida"|"anulada", fecha:ISO, anulada_en:ISO|null }`
- **Errores:** `400` paginación/estado/fechas/`sucursal_id` inválidos; `401`; `403`; `500`.

### GET /api/v1/facturas/:id
- Auth: `Bearer`, rol `administrador`; tenant desde el token.
- **200:** `{ "success": true, "data": { "factura": FacturaDetalle } }`
- `FacturaDetalle` = `FacturaResumen` + `usuario_id:Number`, `cliente_id:Number|null`, `cliente_documento:string|null`, `metodo_pago_id:Number|null`, `anulada_por:Number|null`, `subtotal:Number`, `descuento:Number`, `impuesto:Number`, y `detalles: [ { id:Number, producto_id:Number, producto_codigo:string, producto_nombre:string, cantidad:Number, precio_unitario:Number, descuento_porcentaje:Number, impuesto_porcentaje:Number, subtotal:Number, impuesto:Number, total:Number } ]` (orden `id ASC`).
- **Errores:** `400` `:id` no numérico/fuera de rango; `401`; `403`; `404` inexistente o de otra empresa; `500`.

> `PATCH /api/v1/facturas/:id/anular` (SD-007) **no cambia**; la UI lo reutiliza.

## Modelo de datos (sin cambios de esquema)

- `factura (id, numero_factura, sucursal_id, usuario_id, cliente_id, cliente_nombre, cliente_documento, metodo_pago_id, estado, fecha, anulada_en, anulada_por, subtotal, descuento, impuesto, total)`.
- `detalle_factura (id, factura_id, producto_id, cantidad, precio_unitario, descuento_porcentaje, impuesto_porcentaje, subtotal, impuesto, total)`.
- Multi-tenant: `factura f JOIN sucursal s ON s.id = f.sucursal_id WHERE s.empresa_id = $empresa`.
- **No se toca `server/db/schema.sql`.**

## Archivos por capa

**Backend (`/server`):**
- `validaciones/facturas.js` — añadir `validarFiltrosFacturas(query)` (reutiliza helpers de paginación/fecha; valida `estado`, `sucursal_id`, `buscar`); reutilizar `validarIdFactura`.
- `repositorios/facturas.js` — `listarFacturas(empresaId, filtros) → { items, total }` (JOIN sucursal, filtros dinámicos, COUNT del mismo WHERE, `LIMIT/OFFSET`, escape de `%`/`_` en `buscar`); `obtenerFacturaDetalle(empresaId, id) → factura|null` (JOIN sucursal + `detalle_factura` JOIN `producto`).
- `servicios/facturas.js` — `listarFacturas(usuario, filtros)` (arma el sobre paginado) y `obtenerFactura(usuario, id)` (`404` si null); `empresaDelUsuario` reutilizado.
- `controladores/facturas.js` — handlers `listar` y `obtener`.
- `rutas/facturas.js` — `GET '/'` con `validarEntrada({ query: validarFiltrosFacturas })` y `GET '/:id'` con `validarEntrada({ params: validarIdFactura })`. Todo el recurso sigue con `autenticacion` + `autorizacion('administrador')`.

**Frontend (`/client`):**
- `servicios/facturas.js` — `listarFacturas(filtros)` (normaliza `items` y sobre paginado) y `obtenerFactura(id)` (normaliza `detalles`).
- `hooks/useFacturas.js` (nuevo) — listado paginado con filtros (patrón `useMovimientosInventario`, reset a página 1 al filtrar).
- `hooks/useFacturaDetalle.js` (nuevo) — carga el detalle por id.
- `componentes/FiltrosFacturas.jsx` (nuevo) — sucursal, estado, `desde`/`hasta`, `buscar`.
- `componentes/TablaFacturas.jsx` (nuevo) — tabla escritorio (`table-fixed` con celdas que recortan con `block truncate`) + tarjetas móvil + `Paginacion`.
- `componentes/DetalleFactura.jsx` (nuevo) — panel/modal con líneas, totales y acción "Anular venta" (2 pasos, reutiliza `anularFactura`).
- `paginas/Facturacion.jsx` (nuevo) — compone filtros + listado + detalle.
- `App.jsx` — registrar vista `facturacion`.
- `componentes/ArmazonPanel.jsx` — quitar `proximamente: true` del item "Facturación".

## Orden

1. **Backend** (ambos GET) y verificación HTTP con `GET /api/v1/salud` y requests reales.
2. **Frontend** (página Facturación: listado → detalle → anular).
3. **QA** independiente (paginación/filtros, detalle, IDOR, 401/403/404/400, regresión `POST`/`PATCH` de facturas) + `lint`/`build`.

## Riesgos

- **Fuga multi-tenant:** filtrar SIEMPRE por `s.empresa_id` del token; `sucursal_id` es solo filtro.
- **`buscar` con comodines:** escapar `%`/`_` antes del `ILIKE`.
- **`numero_factura::text ILIKE`:** evitar error de tipo; cast explícito.
- **Rendimiento:** `COUNT` del mismo WHERE y `LIMIT/OFFSET`; índices existentes sobre `factura`.
- **UI de anulación:** reconciliar estado tras `409` (riesgo conocido de SD-007).
- **Tabla ancha:** reutilizar el patrón de `TablaStock`/`TablaMovimientos` (recorte por celda) para no repetir el bug de solapamiento.
