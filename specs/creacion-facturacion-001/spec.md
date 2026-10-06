# Spec — POS: registrar venta (SD-006)

- **Identificador:** creacion-facturacion-001
- **Backlog:** SD-006 (P0)
- **Capas:** /server, /client
- **Dependencias:** auth (Hecho), SD-003 productos (Hecho), SD-001 sucursales (Hecho), esquema `factura`/`detalle_factura`/`movimiento_inventario` aplicado
- **Fecha:** 2026-10-05

## Decisiones de producto (acordadas)

- **Método de pago:** opcional (`metodo_pago_id` puede ser `null`). No hay catálogo aún (SD-008); el POS enviará `null` en el MVP.
- **Descuento:** **ambos** — por línea (`descuento_porcentaje` 0–100) y global (`descuento`, monto absoluto).
- **Productos inactivos:** **no** se pueden vender.
- **Cliente:** opcional. Por defecto **consumidor final** (`cliente_id` nulo y sin snapshot). Si se envía `cliente_id`, debe pertenecer a la empresa; alternativamente se aceptan snapshot `cliente_nombre`/`cliente_documento` (venta sin cliente registrado).
- **Numeración:** consecutiva por sucursal (`siguiente_numero_factura`), sin prefijo, dentro de la transacción.
- **Tique/exportación:** fuera del MVP (SD-015).

## Contexto

`POST /api/v1/facturas` debe emitir una factura y descontar inventario de forma **atómica**. La cabecera, el detalle y los movimientos de stock van en la MISMA transacción (`enTransaccion`). El schema exige `total = subtotal - descuento + impuesto` y no permite `total < 0`.

## Alcance

**Dentro:** endpoint transaccional de venta, cálculo de totales en backend, validación multi-tenant, snapshot de precios/impuestos, salida de stock por línea. UI de POS con búsqueda de productos, carrito, descuentos y envío.

**Fuera:** anulación (SD-007), pagos parciales, devoluciones, impresión/exportación (SD-015), catálogo de métodos de pago (SD-008), clientes registrados (SD-004).

## Requisitos funcionales (EARS)

- **RF-001** CUANDO un `administrador` autenticado envía `POST /api/v1/facturas` con `sucursal_id` y al menos una línea válida, EL SISTEMA DEBE crear la factura en una única transacción y responder `201` con `{ success: true, data: { factura } }` incluyendo `numero_factura`, totales y `detalles`.
- **RF-002** EL SISTEMA DEBE derivar `usuario_id` y la empresa desde el token; `sucursal_id` debe pertenecer a la empresa del usuario.
- **RF-003** CUANDO se envían `cliente_id` y/o `cliente_nombre`/`cliente_documento`, EL SISTEMA DEBE guardar el snapshot en la factura; si no se envían, DEBE registrar consumidor final.
- **RF-004** CUANDO se envía `metodo_pago_id`, EL SISTEMA DEBE validar que pertenece a la empresa; si no, responder `400`.
- **RF-005** EL SISTEMA DEBE calcular por línea: `subtotal_linea = cantidad * precio_unitario * (1 - descuento_porcentaje/100)`, `impuesto_linea = subtotal_linea * impuesto_porcentaje/100`, `total_linea = subtotal_linea + impuesto_linea`, usando el `precio_unitario` e `impuesto_porcentaje` actuales del producto (snapshot).
- **RF-006** EL SISTEMA DEBE calcular la cabecera: `subtotal = suma(subtotal_linea)`, `impuesto = suma(impuesto_linea)`, `descuento` global enviado (default 0), `total = subtotal - descuento + impuesto`.
- **RF-007** EL SISTEMA DEBE obtener el número con `siguiente_numero_factura(sucursal_id)` DENTRO de la transacción (consecutivo por sucursal, sin reutilizar).
- **RF-008** EL SISTEMA DEBE insertar un `movimiento_inventario` tipo `salida_venta` con cantidad negativa por cada línea; el trigger actualiza `stock` (la sobreventa puede dejar saldo negativo, sin error).
- **RF-009** SI la misma `producto_id` aparece más de una vez en `lineas`, EL SISTEMA DEBE responder `400` (la tabla `detalle_factura` es única por producto; el frontend debe consolidar).
- **RF-010** SI `descuento` global es mayor que `subtotal + impuesto` (dejaría `total < 0`), ENTONCES EL SISTEMA DEBE responder `400`.
- **RF-011** SI falta el token o es inválido → `401`; si el rol no es `administrador` → `403`.
- **RF-012** SI algún paso de la transacción falla, EL SISTEMA DEBE hacer `ROLLBACK` total: sin factura y sin stock alterado.

## Casos límite (EC)

- **EC-001** `lineas` vacío o ausente → `400`.
- **EC-002** `cantidad <= 0` o no entera → `400`.
- **EC-003** `descuento_porcentaje` fuera de `0..100` → `400`.
- **EC-004** `producto_id` inexistente, de otra empresa o **inactivo** → `400`.
- **EC-005** `sucursal_id` inexistente o de otra empresa → `400`/`404`.
- **EC-006** Si el cuerpo/query incluyen `empresa_id` → se ignora (anti-IDOR).
- **EC-007** Productos de otra empresa nunca entran en la venta (404/400, sin fuga).
- **EC-008** Si un producto cambia de precio después, la factura conserva el snapshot del momento.

## Criterios de aceptación

1. Venta feliz de 1+ líneas → `201` con `numero_factura` consecutivo, totales coherentes y `detalles` con precios congelados.
2. `total = subtotal - descuento + impuesto` y `total >= 0` (coherente con el CHECK).
3. Cada línea genera su movimiento `salida_venta`; el `stock` se ajusta (puede quedar negativo).
4. **Rollback probado por QA:** forzar un fallo deja la BD sin factura ni movimiento.
5. Validaciones `400`; sin token `401`; rol no autorizado `403`; IDOR ignorado.
6. Frontend POS: selección de sucursal (activas), búsqueda/carrito de productos (activos), descuentos por línea y global, totales calculados, estados carga/error/vacío, y `lint`/`build` verdes.
7. QA independiente aprueba con evidencia.

## Resultado QA (2026-10-05)

- **Veredicto: APROBADO** (tras 1 rechazo y correcciones). Sin Fallos ni Faltantes abiertos.
- **Iteración 1 (RECHAZADO):** F-001 — el frontend sumaba importes crudos y redondeaba al final, y el backend redondea por línea → discrepancia de 0,01. Riesgos: R-001 (cantidad extrema → 500), R-004 (formato de moneda).
- **Correcciones:** `usePuntoDeVenta.js` redondea por línea y luego suma (igual que backend); `formatoMoneda.js` con 2 decimales; backend con `CANTIDAD_MAX = 1_000_000` y mapeo de `22003 → 400`.
- **Iteración 2 (APROBADO):** `npm test` → **133/133 pass** (productos + sucursales + facturas, sin regresiones); `lint`/`build` verdes; healthcheck OK.
- **Verificado:** venta feliz 201 con snapshot congelado; numeración consecutiva por sucursal (concurrencia sin repetir); `salida_venta` por línea y `stock` ajustado (sobreventa permitida); **ROLLBACK real** confirmado; validaciones 400; 401/403; IDOR ignorado; cantidad extrema → 400; redondeo frontend == backend.
- **Riesgos declarados (no bloqueantes):** R-003 cobertura multi-tenant con segunda empresa real (el entorno solo tiene empresa 1 y 0 clientes); sin runner de componente para el frontend (validación por lint/build + inspección); residuo de `stock` de una corrida QA anterior (no tocado).
- **Pendiente de cierre:** marcar SD-006 `Hecho` en `docs/backlog.md` y `MEMORY.md` (territorio de `product-owner`).