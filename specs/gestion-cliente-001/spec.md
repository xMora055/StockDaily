# Spec — Gestión de clientes (SD-004)

- **Identificador:** gestion-cliente-001
- **Backlog:** SD-004 (P0)
- **Capas:** /server, /client, tests
- **Dependencias:** SD-001 (sucursales, Hecho), SD-006 (POS, Hecho), tabla `cliente` y `factura.cliente_id` (esquema ya aplicado)
- **Fecha:** 2026-10-05

## Contexto

El POS ya permite emitir ventas con un cliente **ocasional** (texto libre `cliente_nombre`/`cliente_documento`, `cliente_id` nulo). Falta el catálogo que da valor al histórico: registrar clientes reales por sucursal y **asociarlos a la venta** mediante `cliente_id`. La tabla `cliente` ya existe en `schema.sql` (`UNIQUE (sucursal_id, documento)`, varios `NULL` permitidos); **no hay cambios de esquema**.

## Decisiones de alcance (asumidas por el planeador)

1. **Cliente pertenece a una sucursal.** `sucursal_id` es obligatorio al crear y **no es editable** en esta entrega (mover un cliente de sede queda fuera; evita re-validar unicidad de documento).
2. **Documento opcional.** `documento` único por sucursal; varios clientes sin documento (`NULL`) están permitidos (por la propia `UNIQUE`).
3. **Consumidor final = `cliente_id` nulo.** La venta ocasional con texto libre sigue existiendo; el POS añade un selector de **cliente registrado** que rellena `cliente_id` + snapshot.
4. **Sin cambio al contrato existente.** `POST /api/v1/facturas` ya acepta `cliente_id` y valida que el cliente sea de la empresa; SD-004 **no lo modifica**. El selector del POS vive por sucursal, pero el backend mantiene la validación por empresa (no se endurece aquí para no alterar SD-006).
5. **Listado transversal a la empresa.** `GET /api/v1/clientes` lista los clientes de todas las sucursales de la empresa (con `sucursal_nombre`) y acepta `sucursal_id` como filtro.

## Alcance

**Dentro:** CRUD de `cliente` (crear, listar paginado/filtrable, ver por id, editar, activar/desactivar) acotado a la empresa del token vía `sucursal`; página "Clientes" en el panel; selector de cliente registrado en el POS; pruebas de integración.

**Fuera:** mover cliente entre sucursales; borrado físico; historial/compras por cliente (SD-016); importación masiva; campos adicionales (tipo de documento, régimen fiscal, cupo de crédito); validar en el backend que el `cliente_id` de una factura pertenezca a la misma sucursal de la venta (no se altera SD-006).

## Requisitos funcionales (EARS)

- **RF-001** CUANDO un `administrador` autenticado solicita `GET /api/v1/clientes`, EL SISTEMA DEBE devolver los clientes de las sucursales de su empresa, paginados y ordenados por `nombre ASC, id ASC`.
- **RF-002** EL SISTEMA DEBE aceptar los filtros opcionales `sucursal_id` (entero >0), `activo` (booleano) y `buscar` (nombre o documento), combinables con la paginación.
- **RF-003** EL SISTEMA DEBE devolver el sobre `{ success:true, data:{ items, pagina, por_pagina, total, total_paginas } }`, con `total` = COUNT de las filas que cumplen los mismos filtros y cada item con `sucursal_nombre`.
- **RF-004** CUANDO `pagina`/`por_pagina` son inválidos, EL SISTEMA DEBE responder `400` (defaults `pagina=1`, `por_pagina=10`; rango 1..100; `0`, decimales y texto inválidos).
- **RF-005** CUANDO un `administrador` envía `POST /api/v1/clientes` con `{ sucursal_id, nombre, documento?, telefono?, correo?, direccion? }`, EL SISTEMA DEBE crear el cliente y responder `201 { success:true, data:{ cliente } }`.
- **RF-006** EL SISTEMA DEBE exigir `sucursal_id` y `nombre`; `nombre` ≤150, `documento` ≤30, `telefono` ≤30, `correo` ≤150 (formato básico de correo si viene) y `direccion` ≤200; en caso contrario `400`.
- **RF-007** SI el `documento` ya existe en la misma sucursal, ENTONCES EL SISTEMA DEBE responder `409`.
- **RF-008** SI la `sucursal_id` no existe o pertenece a otra empresa, ENTONCES EL SISTEMA DEBE responder `404` (sin crear el cliente).
- **RF-009** CUANDO un `administrador` solicita `GET /api/v1/clientes/:id`, EL SISTEMA DEBE devolver `{ success:true, data:{ cliente } }` con `sucursal_nombre`; `404` si no existe o es de otra empresa; `400` si `:id` no es un entero seguro positivo (nunca `500`).
- **RF-010** CUANDO un `administrador` solicita `PATCH /api/v1/clientes/:id`, EL SISTEMA DEBE editar solo los campos presentes (`nombre`, `documento`, `telefono`, `correo`, `direccion`, `activo`) y responder `{ success:true, data:{ cliente } }`; `sucursal_id` se ignora (no editable).
- **RF-011** SI en la edición el `documento` choca con otro cliente de la misma sucursal, ENTONCES EL SISTEMA DEBE responder `409`; si no hay campos, `400`.
- **RF-012** SI falta el token → `401`; si el rol no es `administrador` (p. ej. superadmin) → `403`.
- **RF-013** EL SISTEMA DEBE castear `bigint`/`numeric`/`integer` a `Number` en todas las respuestas (ids y contadores).
- **RF-014** CUANDO el `administrador` abre la sección "Clientes", EL SISTEMA DEBE mostrar el listado paginado con el componente `Paginacion` (selector 5/10/15/20) y filtros por sucursal, estado y búsqueda, con estados de carga, error y vacío; al cambiar filtros o tamaño DEBE volver a la página 1.
- **RF-015** CUANDO el `administrador` guarda un cliente, EL SISTEMA DEBE permitir crearlo y editarlo (con validación en línea y mensajes en español) y activarlo/desactivarlo con confirmación, reflejando el cambio en el listado.
- **RF-016** CUANDO el `administrador` registra una venta en el POS, EL SISTEMA DEBE ofrecer un selector "Cliente registrado" con los clientes **activos de la sucursal seleccionada** y la opción de consumidor final; al elegir un cliente registrado DEBE enviar `cliente_id` y autocargar `cliente_nombre`/`cliente_documento` como snapshot.
- **RF-017** SI la sucursal seleccionada cambia en el POS, ENTONCES EL SISTEMA DEBE limpiar el cliente registrado elegido (los clientes son por sucursal).
- **RF-018** DONDE no hay clientes registrados en la sucursal, EL SISTEMA DEBE permitir vender igualmente como consumidor final (los campos de texto libre siguen disponibles).

## Casos límite (EC)

- **EC-001** `empresa_id` enviado en query/body se ignora: el tenant SIEMPRE sale del token (vía `sucursal`).
- **EC-002** Varios clientes sin `documento` en la misma sucursal son válidos (no `409`).
- **EC-003** El mismo `documento` en sucursales distintas de la misma empresa es válido (UNIQUE por sucursal).
- **EC-004** `buscar` sin coincidencias → `items: []`, `total: 0`, `total_paginas: 0` (200, no error).
- **EC-005** `sucursal_id` de otra empresa como filtro → lista vacía (200, no `404`).
- **EC-006** `%`/`_` en `buscar` se tratan como texto literal (no comodín ILIKE inyectable).
- **EC-007** Superadmin (sin empresa) → `403`.
- **EC-008** `PATCH` con `sucursal_id` acompañado de otros campos: se ignora la sucursal y se aplican los demás (`200`). Si el body trae **solo** `sucursal_id` (sin campos editables), no hay cambios → `400`.
- **EC-009** Un cliente inactivo no aparece en el selector del POS.

## Criterios de aceptación

1. `GET /api/v1/clientes` responde el sobre paginado con items de la empresa del token; `total` refleja los filtros; cada item incluye `sucursal_nombre`.
2. `POST /clientes` crea con `201`; `documento` duplicado en la sucursal → `409`; sucursal ajena/inexistente → `404`; `nombre` faltante o campos con tipo/longitud inválidos → `400`.
3. `GET /clientes/:id` responde `200`; ajeno/inexistente → `404`; `:id` inválido → `400` (nunca `500`).
4. `PATCH /clientes/:id` edita campos y `activo` (borrado lógico); `409` por documento duplicado; `400` sin campos; `sucursal_id` ignorado.
5. Paginación: defaults `1`/`10`; `pagina=0`, `por_pagina=0`, `por_pagina=101`, decimales y texto → `400`.
6. Seguridad: sin token `401`; superadmin `403`; `empresa_id` falso en query/body ignorado (test IDOR).
7. UI: página "Clientes" activa en el panel con listado paginado (`Paginacion` 5/10/15/20), filtros, formulario de alta/edición, activar/desactivar con confirmación y estados carga/error/vacío; contadores con `formatearNumero`.
8. POS: selector "Cliente registrado" por sucursal que envía `cliente_id` con snapshot; consumidor final sigue operativo; cambiar de sucursal limpia el cliente.
9. `npm run lint --prefix client` y `npm run build --prefix client` en verde.
10. QA independiente aprueba con evidencia; `npm test` (raíz) sin regresiones.

## Resultado QA (2026-10-05)

- **Veredicto: APROBADO** — 0 Fallos, 0 Faltantes. Suite `tests/api/clientes.test.js` (80 casos); `npm test` raíz → **352/352 pass**; regresión de facturas/anulación (`facturas.test.js` + `anulacion-factura.test.js`, 81/81); `npm run lint --prefix client` y `npm run build --prefix client` verdes.
- **Riesgos no bloqueantes:** (1) verificación de UI/POS solo estática (sin runner de cliente; no hay Vitest autorizado); (2) selector del POS limitado a `por_pagina=100` por sucursal; (3) `GET /clientes` no filtra `sucursal.activo` (correcto para histórico).
- **Artefacto de versionado:** `tests/api/clientes.test.js`.
