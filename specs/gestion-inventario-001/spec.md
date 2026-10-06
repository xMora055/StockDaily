# Spec — Inventario: movimientos y consulta de stock (SD-005 + SD-011)

- **Identificador:** gestion-inventario-001
- **Backlog:** SD-005 (P0) + SD-011 (P1)
- **Capas:** /server, /client
- **Dependencias:** auth, SD-001 (sucursales), SD-003 (productos), esquema `stock`/`movimiento_inventario`/`vista_stock_faltante`
- **Fecha:** 2026-10-05

## Contexto

El POS ya descuenta stock con `salida_venta`, pero **no existe forma de cargar stock inicial ni de ajustarlo**; por eso el inventario solo decrece y queda negativo. Esta feature es el lado de gestión del inventario: registrar movimientos (`carga_inicial`/`ajuste`) y consultar existencias y faltantes.

## Alcance

**Dentro:** registrar movimientos (entrada/salida) por producto y sucursal en una transacción; consultar existencias por empresa; consultar historial de movimientos; ver faltantes (stock negativo).
**Fuera:** transferencias entre sucursales, anulación de factura (SD-007), edición/borrado de movimientos (histórico inmutable).

## Decisiones
- Tipos permitidos por API: `carga_inicial` y `ajuste` (los tipos `salida_venta`/`anulacion` los generan las ventas/anulaciones).
- `cantidad` es un entero con signo: positivo = entrada, negativo = salida (coherente con el esquema).
- Se permite dejar el `stock` negativo (sobreventa); no se bloquea.
- Cota de `cantidad`: ±1.000.000 (evita desbordes de `integer`; por encima → 400).

## Requisitos funcionales (EARS)

- **RF-001** CUANDO un `administrador` autenticado envía `POST /api/v1/inventario/movimientos` con `producto_id`, `sucursal_id`, `tipo` y `cantidad`, EL SISTEMA DEBE registrar el movimiento en una transacción y responder `201` con `{ success:true, data:{ movimiento, stock } }`.
- **RF-002** EL SISTEMA DEBE derivar `usuario_id` y la empresa del token; `factura_id` queda `null`.
- **RF-003** EL SISTEMA DEBE validar que `producto_id` y `sucursal_id` pertenecen a la empresa; si no → `404`.
- **RF-004** CUANDO `tipo` no sea `carga_inicial` ni `ajuste`, EL SISTEMA DEBE responder `400`.
- **RF-005** CUANDO `cantidad` sea `0` o su valor absoluto supere `1.000.000`, EL SISTEMA DEBE responder `400`.
- **RF-006** EL SISTEMA DEBE responder el `stock` resultante (producto, sucursal, cantidad) tras aplicar el movimiento (el trigger lo actualiza).
- **RF-007** CUANDO se envía `GET /api/v1/inventario/stock`, EL SISTEMA DEBE devolver las existencias de la empresa **paginadas** con filtros opcionales `sucursal_id`, `producto_id`, `buscar` (nombre/código), `solo_faltantes`, `pagina` y `por_pagina`, en el sobre `{ items, pagina, por_pagina, total, total_paginas }`.
- **RF-008** CUANDO `solo_faltantes` es verdadero, EL SISTEMA DEBE devolver solo las filas con `cantidad < 0` (vista `vista_stock_faltante`).
- **RF-009** CUANDO se envía `GET /api/v1/inventario/movimientos`, EL SISTEMA DEBE devolver el historial de la empresa **paginado** (filtros `producto_id`, `sucursal_id`, `tipo`, `desde`, `hasta`; `pagina`/`por_pagina`; orden `creado_en DESC`) con el mismo sobre paginado.
- **RF-010** SI falta el token → `401`; si el rol no es `administrador` → `403`.
- **RF-011** SI el cuerpo/query incluyen `empresa_id`, EL SISTEMA DEBE ignorarlo (anti-IDOR).
- **RF-012** Todos los `numeric`/`bigint` se serializan como `Number`.
- **RF-013** EL SISTEMA DEBE validar la paginación: `pagina` entero `>= 1` y `por_pagina` entero entre `1` y `100` (defaults 1 y 20); inválidos → `400`. `total` = filas que cumplen los filtros; `total_paginas = ceil(total / por_pagina)`.

## Casos límite (EC)

- **EC-001** `cantidad` `0`, no entera o no numérica → `400`.
- **EC-002** `tipo` inválido (`salida_venta`, `anulacion` u otro) → `400`.
- **EC-003** `producto_id`/`sucursal_id` inexistente o de otra empresa → `404`.
- **EC-004** `observacion` > 255 → `400`.
- **EC-005** Movimiento sobre un producto inactivo: permitido (el inventario debe poder corregirse), pero se documenta.
- **EC-006** `GET /stock` sin sucursal devuelve todas las sucursales de la empresa.

## Criterios de aceptación

1. Registrar `carga_inicial` y `ajuste` (entrada y salida) → `201`; el `stock` resultante coincide con la suma de movimientos.
2. Movimiento en **una transacción**; ante fallo no queda movimiento ni cambio de stock.
3. `GET /inventario/stock` filtra por sucursal/búsqueda y `solo_faltantes` devuelve negativos, **paginado** con `total`/`total_paginas` correctos.
4. `GET /inventario/movimientos` lista el historial con filtros, **paginado**.
5. Validaciones `400`; `401`/`403`; IDOR ignorado; `404` ajeno.
6. UI "Inventario": existencias + registro de movimiento + historial, con estados carga/error/vacío y acceso desde el panel.
7. QA independiente aprueba con evidencia.

## Resultado QA (2026-10-05)

- **Veredicto: APROBADO** — 0 Fallos, 0 Faltantes. Suite `tests/api/inventario.test.js` (55 casos); `npm test` raíz → **188/188 pass**; `lint`/`build` verdes.
- **Verificado:** `carga_inicial`/`ajuste` (entrada y salida) 201 con `stock = suma de movimientos`; **ROLLBACK** real (desborde `22003` → `400`, sin movimiento ni cambio de stock); validaciones 400; 401/403; IDOR ignorado y `404` ajeno; `GET stock` con filtros y `solo_faltantes` (vista `vista_stock_faltante`); `GET movimientos` con filtros y `limite` topado en 100; cadena de UI y `formatearNumero` OK.
- **Riesgos no bloqueantes:** (1) `POST` devuelve `producto_nombre`/`sucursal_nombre` de más (aditivo, alinear plan); (2) `23503` (FK `usuario_id` inexistente) no mapeado → `500`, solo alcanzable con token firmado por el servidor; (3) comodines `%`/`_` en `buscar` no escapados (impacto bajo, misma empresa); (4) `GET /stock` sin paginación (deuda de diseño).
- **Pendiente de cierre:** marcar SD-005 y SD-011 `Hecho` en `docs/backlog.md` y `MEMORY.md` (territorio de `product-owner`). *(Hecho.)*

## Revisión 2 — Paginación (2026-10-05)

- **Motivo:** las tablas de inventario eran muy largas.
- **Contrato:** `GET /inventario/stock` y `GET /inventario/movimientos` devuelven `data` como `{ items, pagina, por_pagina, total, total_paginas }`; params `pagina` (>=1, default 1) y `por_pagina` (1..100, default 20); `limite` obsoleto. `POST` sin cambios.
- **Frontend:** componente `Paginacion` (Anterior/Siguiente, "Página X de Y", total con `formatearNumero`), en las tablas de existencias e historial; cambiar filtros resetea a página 1.
- **QA: APROBADO** — `npm test` raíz → **212/212 pass** (2 corridas, sin flaky); lint/build verdes; paginación sin repetir/omitir filas; `total` cotejado contra `COUNT` SQL; `400` con paginación inválida; regresión de `POST` OK.
- **Riesgos no bloqueantes:** `limite` ignorado silenciosamente; `total_paginas=0` cuando `total=0`; comodines ILIKE sin escapar; histórico inmutable deja movimientos `QA-*`.