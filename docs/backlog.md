# Backlog de StockDaily

Fuente de verdad del backlog. Mantenido por `product-owner`.

## Convenciones

- **Prioridad:** `P0` (bloqueante/crítico para el MVP), `P1` (importante), `P2` (deseable), `P3` (idea futura).
- **Estado:** `Idea` -> `Backlog` -> `Listo para ejecutar` -> `En progreso` -> `Hecho` -> `Descartado`.
- **Capas:** `/server`, `/client`, `BD`, `tests`.
- Un ítem pasa a `Listo para ejecutar` cuando tiene objetivo, alcance y criterios de aceptación acordados. Entonces `planeador` redacta la spec en `specs/<accion>-<recurso>-<NNN>/`.
- Regla: ningún código se escribe sin spec (ver `docs/constitucion.md`).

## MVP (camino crítico al POS con inventario)

| ID | Título | Prioridad | Estado | Capas | Depende de |
|---|---|---|---|---|---|
| SD-001 | Gestión de sucursales | P0 | Hecho | /server, /client, BD | auth (Hecho) |
| SD-002 | Catálogo de categorías | P0 | Backlog | /server, /client, BD | SD-001 (opcional) |
| SD-003 | Catálogo de productos | P0 | Hecho | /server, /client, BD | SD-001, SD-002 |
| SD-004 | Gestión de clientes | P0 | Backlog | /server, /client, BD | SD-001 |
| SD-005 | Inventario: carga inicial y ajustes | P0 | Hecho | /server, /client, BD | SD-001, SD-003 |
| SD-006 | POS: registrar venta (transacción) | P0 | Hecho | /server, /client, BD | SD-003 (Hecho), SD-001 (Hecho); SD-004/SD-005 recomendados |
| SD-007 | Anulación de factura | P0 | Hecho | /server, /client, BD | SD-006 |

## Siguiente nivel

| ID | Título | Prioridad | Estado | Capas | Depende de |
|---|---|---|---|---|---|
| SD-008 | Catálogo de métodos de pago | P1 | Backlog | /server, /client, BD | SD-001 |
| SD-009 | Listado y consulta de facturas | P1 | En progreso | /server, /client | SD-006 |
| SD-010 | Onboarding superadmin: empresas y administradores | P1 | Backlog | /server, /client, BD | auth (Hecho) |
| SD-011 | Consulta de stock y faltantes (vista vista_stock_faltante) | P1 | Hecho | /server, /client, BD | SD-005 |
| SD-012 | Runner de pruebas real (node --test) y scripts test | P1 | Hecho | /server, tests | - |
| SD-013 | Login multi-tenant (resolver 409 por correo repetido) | P1 | Backlog | /server, /client | SD-010 |
| SD-017 | Endurecimiento de validación de productos (id bigint, coerción estricta) | P1 | Backlog | /server | SD-003 (Hecho) |
| SD-018 | Paginación de listados existentes (productos y sucursales) | P1 | Hecho | /server, /client | SD-003, SD-001 |
| SD-019 | Selector de tamaño de página (5/10/15/20) y default 10 | P1 | Hecho | /server, /client, tests | SD-018 |

## Deseables / ideas

| ID | Título | Prioridad | Estado | Capas | Depende de |
|---|---|---|---|---|---|
| SD-014 | Inicio/Dashboard con métricas reales | P2 | Idea | /server, /client | SD-006, SD-009 |
| SD-015 | Impresión/exportación de factura (tique) | P2 | Idea | /client | SD-006 |
| SD-016 | Reportes de ventas por rango/sucursal | P3 | Idea | /server, /client | SD-009 |

---

## Detalle de ítems P0

### SD-001 - Gestión de sucursales (HECHO — QA APROBADO)
- **Objetivo/valor:** que el administrador cree y liste las sucursales/bodegas de su empresa. Es la raíz de cliente, stock y facturación (y desbloquea el POS).
- **Alcance dentro:** CRUD básico (crear, listar, ver por id, editar nombre/dirección/teléfono, activar/desactivar) sobre `sucursal`, filtrado por `empresa_id` del token.
- **Alcance fuera:** asignar usuarios a sucursales; borrado físico; geolocalización.
- **Estado:** Listo para ejecutar (aprobado 2026-10-05): CRUD completo; tenant de prueba ya sembrado (1 empresa, 1 sucursal, 2 usuarios).
- **Spec propuesta:** `specs/gestion-sucursal-001/`.
- **Contrato acordado:** `GET /api/v1/sucursales` (lista de la empresa), `POST /api/v1/sucursales` (201), `GET /api/v1/sucursales/:id`, `PATCH /api/v1/sucursales/:id` (editar y activar/desactivar). Sobre `{success,data}`/`{success:false,error}`; `empresa_id` desde el token; unicidad `(empresa_id, nombre)` -> 409; validaciones -> 400; `activo=false` (borrado lógico); rol `administrador`.
- **Criterios de aceptación:** endpoints POST/GET/GET:id/PATCH bajo `/api/v1/sucursales` con sobre `{ success, data }` / `{ success:false, error }`; `empresa_id` SIEMPRE del token (enviarlo en body/query se ignora, test IDOR); nombre duplicado en la misma empresa -> 409; entrada inválida -> 400; sin token -> 401; producto/sucursal ajena -> 404; desactivar usa `activo=false` (no DELETE); UI con estados carga/error/vacío y acceso desde el panel, lint y build en verde.

### SD-002 - Catálogo de categorías
- **Objetivo/valor:** clasificar productos para venta y reportes.
- **Alcance dentro:** crear, listar, editar y activar/desactivar `categoria` por empresa.
- **Spec propuesta:** `specs/gestion-categoria-001/`.
- **Criterios de aceptación:** CRUD con `{success,...}`; unicidad `(empresa_id, nombre)` -> 409; filtrado por tenant; UI con estados; lint/build OK.

### SD-003 - Catálogo de productos (HECHO — QA APROBADO)
- **Objetivo/valor:** registrar los productos con precio, impuesto y categoría; base del POS y del inventario.
- **Alcance dentro:** CRUD sobre `producto` (código/SKU único por empresa, nombre, descripción, `precio_unitario`, `impuesto_porcentaje`, categoría opcional, activo).
- **Alcance fuera:** variantes, lotes, códigos de barras.
- **Estado:** Hecho (QA APROBADO). CRUD completo; ver `specs/gestion-producto-001/spec.md`.
- **Spec propuesta:** `specs/gestion-producto-001/`.
- **Contrato acordado:** `GET /api/v1/productos` (lista, filtros por nombre/código/categoría), `POST /api/v1/productos` (201), `GET /api/v1/productos/:id`, `PATCH /api/v1/productos/:id` (editar y activar/desactivar). Sobre `{success,data}`/`{success:false,error}`; `empresa_id` desde el token; `codigo` único por empresa -> 409; `precio_unitario >= 0`, `impuesto_porcentaje` 0-100 -> 400; `numeric` -> `Number`.
- **Criterios de aceptación:** `codigo` duplicado por empresa -> 409; `precio_unitario >= 0` e `impuesto_porcentaje` 0-100 -> 400 si se violan; `numeric` casteado a `Number`; listado filtrable por nombre/código/categoría; UI de tabla + formulario con estados; lint/build OK.

### SD-004 - Gestión de clientes
- **Objetivo/valor:** asociar clientes a la venta y conservar histórico.
- **Alcance dentro:** CRUD sobre `cliente` (por sucursal; nombre, documento, contacto; documento único por sucursal).
- **Spec propuesta:** `specs/gestion-cliente-001/`.
- **Criterios de aceptación:** documento duplicado en la sucursal -> 409; el consumidor final se maneja con `cliente_id` nulo en la factura; filtrado por sucursal/tenant; UI con estados.

### SD-005 - Inventario: carga inicial y ajustes (HECHO — QA APROBADO, junto con SD-011)
- **Objetivo/valor:** poblar el stock y corregirlo; habilita vender con existencias.
- **Alcance dentro:** registrar `movimiento_inventario` tipo `carga_inicial` y `ajuste` (positivo/negativo); el saldo `stock` lo actualiza el trigger. Listar movimientos.
- **Alcance fuera:** transferencias entre sucursales.
- **Spec:** `specs/gestion-inventario-001/` (cubre SD-005 + SD-011).
- **Estado:** Hecho (QA APROBADO, 188/188 tests).
- **Criterios de aceptación:** movimiento en una transacción (`enTransaccion`); el `stock` resultante coincide con la suma de movimientos; `cantidad <> 0` -> 400; producto/sucursal inexistente o de otra empresa -> 404/403; se permite saldo negativo (sobreventa) sin error; UI de carga/ajuste por producto y sucursal.

### SD-006 - POS: registrar venta (transacción)
- **Objetivo/valor:** el corazón del sistema; emitir facturas descontando stock de forma atómica.
- **Alcance dentro:** `POST /api/v1/facturas` que en una sola transacción obtiene `siguiente_numero_factura`, inserta `factura` + `detalle_factura` y `movimiento_inventario` (`salida_venta`) por línea; snapshot de cliente.
- **Alcance fuera:** pagos parciales, devoluciones, multi-moneda.
- **Spec propuesta:** `specs/creacion-facturacion-001/`.
- **Criterios de aceptación:** `{ success:true, data:{ id, numero_factura, total } }` con 201; 400 si el detalle es inválido; 401 sin token; si cualquier paso falla -> ROLLBACK total (sin factura ni stock alterado), probado por `qa`; `total = subtotal - descuento + impuesto`; numeración consecutiva por sucursal; el detalle guarda `precio_unitario` e `impuesto_porcentaje` del momento; UI POS con carrito y estados.
- **Estado:** Hecho (QA APROBADO). Ver `specs/creacion-facturacion-001/spec.md`.
- **Decisiones de producto acordadas:** (1) método de pago **opcional** (`null` permitido; catálogo en SD-008); (2) descuento **por línea y global**; (3) productos inactivos **no** vendibles; (4) cliente **opcional** (consumidor final por defecto, o `cliente_id`/snapshot `cliente_nombre`+`cliente_documento`); (5) numeración **consecutiva por sucursal**, sin prefijo; (6) tique/exportación **diferido** a SD-015.

### SD-007 - Anulación de factura (HECHO — QA APROBADO)
- **Objetivo/valor:** revertir una venta y su stock de forma trazable.
- **Alcance dentro:** `PATCH /api/v1/facturas/:id/anular` -> `estado=anulada`, `anulada_en`/`anulada_por`, y `movimiento_inventario` tipo `anulacion` (cantidad positiva) en la misma transacción; UI de anulación desde el recibo del POS.
- **Alcance fuera:** anulación parcial; motivo/nota de anulación (el esquema no lo contempla); anular facturas antiguas (requiere SD-009, listado).
- **Spec propuesta:** `specs/anulacion-factura-001/`.
- **Contrato acordado:** `PATCH /api/v1/facturas/:id/anular` (sin body) -> `200 { success:true, data:{ factura } }` con `estado:'anulada'`, `anulada_en`, `anulada_por` y `detalles`; `400` id inválido; `401`; `403`; `404` factura ajena/inexistente; `409` ya anulada. La reversión de stock (por cada `detalle_factura`) va en la MISMA transacción (`enTransaccion`).
- **Criterios de aceptación:** solo facturas `emitidas` anulables (ya anulada -> 409, con bloqueo `FOR UPDATE`); stock revertido en la misma transacción; roles autorizados (`administrador`); UI de confirmación con dos pasos.
- **Estado:** Hecho (QA APROBADO, 2026-10-05). Ver `specs/anulacion-factura-001/spec.md` §Resultado QA. Suite `tests/api/anulacion-factura.test.js` (27 casos) en verde; `npm test` raíz 272/272; lint/build verdes.
- **Riesgos no bloqueantes:** desborde `22003` de stock con mensaje "id no válido" (engañoso) y la UI no reconcilia estado tras 409. Candidatos a un ítem P1 de endurecimiento (no bloquean el MVP).

---

## Notas y supuestos abiertos

- **Bootstrap de datos:** hoy solo existe `server/scripts/crearUsuario.js`. Para probar el MVP se necesita al menos una `empresa` + `sucursal` + `usuario` de prueba (SD-010 o script de seed).
- **Multi-tenant en login:** el 409 por correo repetido (ver `MEMORY.md`) afecta el onboarding de varias empresas; se ataca en SD-013.
- **Runner de pruebas:** `node --test` configurado (`npm test` en la raíz); `qa` ejecuta la suite de `tests/`.
- **Git:** se omite por decisión del usuario; se hará después.

### SD-017 - Endurecimiento validación de productos
- **Origen:** hallazgos no bloqueantes de QA sobre SD-003.
- **Aceptación:** `:id` fuera de rango bigint o con notación científica (`1e2`) -> `400` (no `500`); `precio_unitario`/`impuesto_porcentaje` rechazan `null`/booleanos -> `400`; mensaje de JSON malformado normalizado en español.
- **Frontend (opcional):** ocultar/deshabilitar "Productos" para rol `superadmin`.

### SD-018 - Paginación de listados existentes (productos y sucursales)
- **Origen:** convención de paginación obligatoria (ver `AGENTS.md`/`MEMORY.md`); inventario ya pagina, pero Productos y Sucursales aún devuelven la colección completa.
- **Alcance:** `GET /api/v1/productos` y `GET /api/v1/sucursales` con `pagina`/`por_pagina` y sobre `{ items, pagina, por_pagina, total, total_paginas }`; tablas `Productos` y `Sucursales` con el componente `Paginacion` y reset a página 1 al filtrar.
- **Criterios:** `total` = COUNT con filtros; inválidos -> 400; sin regresiones (POS e Inventario siguen funcionando al consumir catálogos).
- **Estado:** Hecho (QA APROBADO, 235/235 tests). Selectores POS/Inventario consumen `items` con `por_pagina=100` (deuda: catálogos >100 requieren búsqueda/paginación en selectores).

### SD-019 - Selector de tamaño de página y default 10
- **Origen:** producto (2026-10-05); continuación de SD-018. El usuario pidió elegir cuántos registros ver por página.
- **Alcance:** selector "Por página" con opciones **5/10/15/20** (sin 0) en el componente `Paginacion`, aplicado a las 4 tablas (Productos, Sucursales, Existencias, Movimientos); default de `por_pagina` de 20 a **10** en API y cliente.
- **Alcance fuera:** aceptar `por_pagina=0` (sigue 400); rango 1..100 intacto; listados nuevos.
- **Spec:** `specs/paginacion-listados-002/`.
- **Criterios:** default 10 en los 4 listados; cambiar tamaño recarga y vuelve a página 1; sin repetición/omisión de filas; lint/build verdes.
- **Estado:** Hecho (QA APROBADO, 272/272 tests). Nota: `AGENTS.md` §Paginación ya no fija un default numérico; el default **10** vive en la convención de `MEMORY.md` y en el código. Documento alineado (pendiente documental cerrada).

### SD-009 - Listado y consulta de facturas
- **Origen:** lado de lectura de facturación; habilita ver ventas históricas, anular facturas antiguas (SD-007 lo dejó fuera) y el dashboard (SD-014).
- **Estado de implementación (verificado 2026-10-05):** **código completo**, pendiente **QA (T-005)**.
  - **Backend:** `GET /api/v1/facturas` (listado paginado y filtrable) y `GET /api/v1/facturas/:id` (detalle con líneas); `validarFiltrosFacturas`, `listarFacturas`/`obtenerFacturaDetalle` en repositorio y servicio.
  - **Frontend:** página `Facturacion` con `TablaFacturas`, `FiltrosFacturas`, `DetalleFactura`, hooks `useFacturas`/`useFacturaDetalle`; **sección "Facturación" activa** en `ArmazonPanel` (ya no figura como "Pronto").
  - **Spec:** `specs/listado-facturas-001/` (spec/plan/tasks).
- **Pendiente para cerrar:** ejecutar QA (T-005) con `npm test` (raíz) + `lint`/`build`; **no existe** un `tests/api/listado-facturas.test.js` en el repo. Solo entonces pasa a `Hecho`.
- **Riesgo:** código sin verificación independiente; no marcar como `Hecho` hasta que `qa` apruebe.
