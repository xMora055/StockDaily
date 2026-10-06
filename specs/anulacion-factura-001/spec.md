# Spec — Anulación de factura (SD-007)

- **Identificador:** anulacion-factura-001
- **Backlog:** SD-007 (P0)
- **Capas:** /server, /client
- **Dependencias:** SD-006 (POS, Hecho), esquema `factura`/`detalle_factura`/`movimiento_inventario`
- **Fecha:** 2026-10-05

## Contexto

El POS emite facturas y descuenta stock (`salida_venta`). Falta poder **anular** una venta: marcarla como `anulada` y **revertir el stock** de sus líneas en una sola transacción, dejando rastro (`movimiento_inventario` tipo `anulacion`) y auditoría (`anulada_en`, `anulada_por`).

## Alcance

**Dentro:** anular una factura `emitida` de la empresa del usuario; revertir stock por cada línea; UI de anulación con confirmación desde el recibo del POS.
**Fuera:** anulación parcial, anulación de facturas de otra empresa, motivo/nota, anular facturas antiguas (requiere el listado SD-009).

## Decisiones
- `anulada_por` = `usuario_id` del token; `anulada_en` = `now()`.
- Un movimiento `anulacion` (cantidad positiva) por cada `detalle_factura`, con `factura_id` = factura anulada.
- No se puede anular dos veces (409). Se bloquea la fila con `SELECT ... FOR UPDATE` para evitar carrera.

## Requisitos funcionales (EARS)

- **RF-001** CUANDO un `administrador` autenticado envía `PATCH /api/v1/facturas/:id/anular`, EL SISTEMA DEBE, en una única transacción, marcar la factura `estado='anulada'`, `anulada_en=now()`, `anulada_por=usuario`, e insertar un `movimiento_inventario` tipo `anulacion` (cantidad positiva) por cada línea, revirtiendo el `stock`.
- **RF-002** EL SISTEMA DEBE devolver `200 { success:true, data:{ factura } }` con `estado`, `anulada_en`, `anulada_por` y `detalles`.
- **RF-003** EL SISTEMA DEBE validar que la factura pertenece a la empresa del token (vía su sucursal); si no existe o es ajena → `404`.
- **RF-004** SI la factura ya está `anulada`, ENTONCES EL SISTEMA DEBE responder `409`.
- **RF-005** SI `:id` no es numérico o está fuera de rango, EL SISTEMA DEBE responder `400` (nunca `500`).
- **RF-006** SI falta el token → `401`; si el rol no es `administrador` → `403`.
- **RF-007** SI algún paso de la transacción falla, EL SISTEMA DEBE hacer `ROLLBACK` total (factura sin cambios y sin movimientos).
- **RF-008** CUANDO el POS muestra el recibo recién emitido, EL SISTEMA DEBE ofrecer una acción "Anular venta" con confirmación de dos pasos; tras anular, DEBE reflejar el estado `anulada`.
- **RF-009** Todos los `numeric`/`bigint` → `Number`.

## Casos límite (EC)

- **EC-001** Anular una factura ya anulada → `409`.
- **EC-002** Anular una factura de otra empresa → `404`.
- **EC-003** `:id` `abc`/`0`/fuera de bigint → `400`.
- **EC-004** Factura con varias líneas → un movimiento `anulacion` por línea (mismo `factura_id`).
- **EC-005** El `stock` resultante = stock previo + cantidades anuladas (revertido).

## Criterios de aceptación

1. Anular una factura `emitida` → `200`, `estado='anulada'`, con `anulada_en`/`anulada_por`.
2. **Stock revertido:** por cada línea se crea un `movimiento_inventario` `anulacion` y el `stock` sube en la cantidad vendida.
3. **Transacción:** ante fallo, ni la factura cambia ni hay movimientos (rollback).
4. `409` al reintentar; `404` ajena; `400` id inválido; `401`/`403`.
5. UI: acción de anulación desde el recibo con confirmación y estado final visible.
6. `npm test` (raíz) en verde; `lint`/`build` verdes.
7. QA independiente aprueba con evidencia.

## Resultado QA (2026-10-05)

- **Veredicto: APROBADO** — 0 Fallos, 0 Faltantes. Suite `tests/api/anulacion-factura.test.js` (27 casos); `npm test` raíz → **262/262 pass**; `lint`/`build` verdes.
- **Verificado:** anular `emitida` → 200 con `estado:'anulada'`, `anulada_en`, `anulada_por` y `detalles`; **stock revertido** (un `movimiento_inventario` `anulacion` `+cantidad` por línea, `factura_id` correcto); **ROLLBACK** real (factura queda `emitida`, sin movimientos); `409` al reintentar; `404` ajena/inexistente; `400` `:id` inválido; `401`/`403`; concurrencia con `FOR UPDATE` (`[200,409]`); regresión de `POST /facturas` OK; UI `ReciboEmitido` con confirmación de 2 pasos y estado anulado.
- **Riesgos no bloqueantes (→ SD-019):** (1) el `22003` del desborde de `stock` en `anularFactura` se mapea al mensaje "id no válido" (engañoso); (2) la UI no reconcilia el estado tras un `409` (reaparece "Anular venta").
- **Pendiente de cierre:** marcar SD-007 `Hecho` y crear SD-019 en `docs/backlog.md`/`MEMORY.md` (territorio de `product-owner`).