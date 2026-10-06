# Spec — Listado y consulta de facturas (SD-009)

- **Identificador:** listado-facturas-001
- **Backlog:** SD-009 (P1)
- **Capas:** /server, /client
- **Dependencias:** SD-006 (POS, Hecho), SD-007 (anulación, Hecho), tablas `factura`/`detalle_factura`/`sucursal`/`producto`
- **Fecha:** 2026-10-05

## Contexto

El POS emite facturas y ya se pueden anular (SD-007), pero **no existe forma de verlas**: el listado de facturación es el lado de lectura que falta. Sin él no se pueden revisar ventas, consultar un tique histórico ni anular facturas antiguas (SD-007 dejó fuera ese caso justamente por la ausencia de SD-009). Este trabajo habilita además el dashboard (SD-014) y los reportes (SD-016).

## Decisiones de alcance (asumidas por el planeador)

1. **Filtros del listado:** `sucursal_id`, `estado` (emitida/anulada), rango de fechas `desde`/`hasta` y búsqueda libre `buscar` (número de factura o nombre de cliente). Orden por `fecha DESC, id DESC`.
2. **Incluye detalle:** `GET /api/v1/facturas/:id` devuelve la factura con sus líneas, totales y datos de sucursal/cliente, para consultar el tique histórico.
3. **Anular desde el detalle:** se reutiliza el endpoint ya existente `PATCH /api/v1/facturas/:id/anular` (SD-007) para cerrar el ciclo "anular facturas antiguas". No se crea endpoint nuevo.
4. **Solo lectura + anulación:** no se edita una factura emitida (no hay alcance para corregir líneas).

## Alcance

**Dentro:** listado paginado y filtrable de facturas de la empresa del usuario; consulta de detalle con líneas; acción de anulación desde el detalle reutilizando SD-007; activar la sección "Facturación" en el panel.
**Fuera:** edición de facturas, nota/crédito, anulación parcial, exportación/impresión del tique (SD-015), reportes agregados (SD-016), pagos parciales.

## Requisitos funcionales (EARS)

- **RF-001** CUANDO un `administrador` autenticado solicita `GET /api/v1/facturas`, EL SISTEMA DEBE devolver las facturas de las sucursales de su empresa, paginadas y ordenadas por `fecha DESC, id DESC`.
- **RF-002** EL SISTEMA DEBE aceptar los filtros opcionales `sucursal_id`, `estado` (`emitida`/`anulada`), `desde`, `hasta` (rango sobre `factura.fecha`) y `buscar` (número de factura o `cliente_nombre`), combinables con la paginación.
- **RF-003** EL SISTEMA DEBE devolver el sobre `{ success:true, data:{ items, pagina, por_pagina, total, total_paginas } }`, con `total` = COUNT de las filas que cumplen los mismos filtros.
- **RF-004** CUANDO `pagina`/`por_pagina` son inválidos, EL SISTEMA DEBE responder `400` (defaults `pagina=1`, `por_pagina=10`; rango 1..100; `0` inválido).
- **RF-005** DONDE llega un `estado` distinto de `emitida`/`anulada`, EL SISTEMA DEBE responder `400`.
- **RF-006** CUANDO un `administrador` autenticado solicita `GET /api/v1/facturas/:id`, EL SISTEMA DEBE devolver `{ success:true, data:{ factura } }` con encabezado, sucursal (`sucursal_nombre`), totales y `detalles` (líneas con producto y totales), ordenadas por `id ASC`.
- **RF-007** SI la factura no existe o pertenece a otra empresa, ENTONCES EL SISTEMA DEBE responder `404` (sin fuga de datos).
- **RF-008** SI `:id` no es numérico, es `0`/negativo o está fuera de rango bigint, EL SISTEMA DEBE responder `400` (nunca `500`).
- **RF-009** SI falta el token → `401`; si el rol no es `administrador` → `403`.
- **RF-010** EL SISTEMA DEBE castear `numeric`/`bigint`/`integer` a `Number` en todas las respuestas (ids, cantidades, montos, `numero_factura`).
- **RF-011** CUANDO el `administrador` abre la sección "Facturación", EL SISTEMA DEBE mostrar el listado paginado con filtros y estados de carga, error y vacío; toda cifra de dinero con `formatearMoneda` y todo contador con `formatearNumero`.
- **RF-012** CUANDO el `administrador` selecciona una factura, EL SISTEMA DEBE mostrar su detalle con sucursal, cliente, líneas y totales.
- **RF-013** DONDE la factura está `emitida`, EL SISTEMA DEBE ofrecer la acción "Anular venta" con confirmación de dos pasos (reutilizando `PATCH /api/v1/facturas/:id/anular`); tras anular DEBE reflejar `estado='anulada'` en el detalle y en el listado.
- **RF-014** SI la anulación falla (p. ej. `409` ya anulada), ENTONCES EL SISTEMA DEBE mostrar un mensaje legible y reconciliar el estado de la factura con el servidor.

## Casos límite (EC)

- **EC-001** `empresa_id` enviado en query/body se ignora: el tenant SIEMPRE sale del token.
- **EC-002** Factura con varias líneas → `detalles` incluye todas, en orden `id ASC`.
- **EC-003** `buscar` que no coincide → `items: []`, `total: 0`, `total_paginas: 0` (200, no error).
- **EC-004** `desde` mayor que `hasta` → lista vacía (200, no error).
- **EC-005** Superadmin (sin empresa) → `403`.
- **EC-006** `sucursal_id` de otra empresa → lista vacía (no `404`, es un filtro).
- **EC-007** `buscar` con `%`/`_` se trata como texto literal (no comodín ILIKE inyectable).

## Criterios de aceptación

1. `GET /api/v1/facturas` responde el sobre paginado con items de la empresa del token; filtros `sucursal_id`/`estado`/`desde`/`hasta`/`buscar` funcionan y `total` refleja el filtro activo.
2. `GET /api/v1/facturas/:id` responde `200` con `detalles`; factura ajena/inexistente → `404`; `:id` inválido → `400`.
3. Paginación: defaults `1`/`10`; `pagina=0`, `por_pagina=0`, `por_pagina=101`, decimales y texto → `400`.
4. Seguridad: sin token `401`; superadmin `403`; `empresa_id` falso en query/body ignorado (test IDOR).
5. UI: sección "Facturación" activa con listado paginado (`Paginacion`, selector 5/10/15/20), filtros, detalle y acción de anulación con confirmación; estados carga/error/vacío; `formatearMoneda`/`formatearNumero`.
6. `npm run lint --prefix client` y `npm run build --prefix client` en verde.
7. QA independiente aprueba con evidencia; `npm test` (raíz) sin regresiones.

## Resultado QA (2026-10-05)

- **Veredicto: APROBADO** — 0 Fallos de producto, 0 Faltantes bloqueantes. Suite `tests/api/listado-facturas.test.js` (53 casos); `npm test` raíz → **405/405 pass**; regresión de POS (`POST /facturas`) y anulación (`PATCH /facturas/:id/anular`) OK; `npm run lint --prefix client` y `npm run build --prefix client` verdes.
- **Cobertura:** defaults 1/10 y sobre exacto; orden `fecha DESC, id DESC`; filtros `sucursal_id`/`estado`/`desde`/`hasta`/`buscar` y `total` = COUNT; `400` de paginación/estado/fechas/`sucursal_id`; detalle con `detalles[]` orden `id ASC`; `404` ajena/inexistente; `400` `:id` inválido (nunca `500`); `401`/`403`; IDOR (`empresa_id` falso ignorado); castings a `Number`.
- **Faltante:** la UI de Facturación se validó solo por `lint`/`build` (sin runner de React); no se ejecutó en navegador.
- **Riesgos no bloqueantes:** `normalizarFechaQuery` es permisivo (`2026-02-30` rueda a marzo en vez de `400`); `pagina` con enteros absurdos (`1e20`) devuelve vacío en lugar de `400`; fixtures QA de facturas quedan como histórico (por diseño).
- **Artefacto de versionado:** `tests/api/listado-facturas.test.js`.
