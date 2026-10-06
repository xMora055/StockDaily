# Spec — Catálogo de categorías (SD-002)

- **Identificador:** gestion-categoria-001
- **Backlog:** SD-002 (P0)
- **Capas:** /server, /client, tests
- **Dependencias:** SD-003 (productos, Hecho), tabla `categoria` y FK `producto.categoria_id` (esquema ya aplicado)
- **Fecha:** 2026-10-05

## Contexto

`producto.categoria_id` ya existe en el esquema y el API de productos ya lo valida (debe existir en la empresa), lo filtra y lo devuelve. Sin embargo **no hay forma de crear ni administrar categorías**: el formulario de productos pide `categoria_id` como **número escrito a mano** y no existe ningún catálogo ni filtro por categoría en la UI. SD-002 completa ese circuito: CRUD de `categoria` por empresa y su uso real desde Productos. **No hay cambios de esquema**.

## Decisiones de alcance (asumidas por el planeador)

1. **CRUD de `categoria` por empresa:** crear, listar (paginado/filtrable), ver, editar `nombre` y activar/desactivar (borrado lógico).
2. **Unicidad `(empresa_id, nombre)`** (ya definida en el esquema) → `409`. La comparación es la del `UNIQUE` de PostgreSQL (sensible a mayúsculas/espacios internos); se hace `trim` del nombre.
3. **Integración con Productos sin cambiar el contrato existente:**
   - El **formulario de producto** deja de pedir un número: usa un **select de categorías** (opción "Sin categoría" = `null`). Se sigue enviando `categoria_id` por el contrato ya existente.
   - El **listado de productos** añade un **filtro por categoría** (usa el `categoria_id` que el endpoint ya acepta).
   - La **tabla de productos** muestra el **nombre** de la categoría mapeándolo en el cliente con el catálogo cargado (no se modifica la respuesta de `/api/v1/productos`).
4. **Desactivar una categoría no altera sus productos** (`producto.categoria_id` se conserva). En el formulario del producto, si la categoría asignada está inactiva, se muestra marcada como "(inactiva)" para no perderla silenciosamente.
5. **Sin borrado físico** ni reasignación masiva de productos a otra categoría.

## Alcance

**Dentro:** CRUD de `categoria` por empresa (`GET/POST/GET:id/PATCH`), página "Categorías" en el panel, uso del catálogo desde Productos (select en formulario, filtro en listado, nombre en tabla), pruebas de integración.

**Fuera:** jerarquía/subcategorías; borrado físico; reasignación masiva; cambios en `server/db/schema.sql`; cambio de la forma de respuesta de `/api/v1/productos`.

## Requisitos funcionales (EARS)

- **RF-001** CUANDO un `administrador` autenticado solicita `GET /api/v1/categorias`, EL SISTEMA DEBE devolver las categorías de su empresa, paginadas y ordenadas por `nombre ASC, id ASC`.
- **RF-002** EL SISTEMA DEBE aceptar los filtros opcionales `activo` (booleano) y `buscar` (nombre), combinables con la paginación.
- **RF-003** EL SISTEMA DEBE devolver el sobre `{ success:true, data:{ items, pagina, por_pagina, total, total_paginas } }`, con `total` = COUNT de las filas que cumplen los mismos filtros.
- **RF-004** CUANDO `pagina`/`por_pagina` son inválidos, EL SISTEMA DEBE responder `400` (defaults `pagina=1`, `por_pagina=10`; rango 1..100; `0`, decimales y texto inválidos).
- **RF-005** CUANDO un `administrador` envía `POST /api/v1/categorias` con `{ nombre }`, EL SISTEMA DEBE crear la categoría y responder `201 { success:true, data:{ categoria } }`.
- **RF-006** EL SISTEMA DEBE exigir `nombre` no vacío y de longitud ≤100 (`varchar(100)`); en caso contrario `400`.
- **RF-007** SI el `nombre` ya existe en la misma empresa, ENTONCES EL SISTEMA DEBE responder `409`.
- **RF-008** CUANDO un `administrador` solicita `GET /api/v1/categorias/:id`, EL SISTEMA DEBE devolver `{ success:true, data:{ categoria } }`; `404` si no existe o es de otra empresa; `400` si `:id` no es un entero seguro positivo (nunca `500`).
- **RF-009** CUANDO un `administrador` solicita `PATCH /api/v1/categorias/:id`, EL SISTEMA DEBE editar solo los campos presentes (`nombre`, `activo`) y responder `{ success:true, data:{ categoria } }`; sin campos → `400`.
- **RF-010** SI en la edición el `nombre` choca con otra categoría de la empresa, ENTONCES EL SISTEMA DEBE responder `409`.
- **RF-011** SI falta el token → `401`; si el rol no es `administrador` (p. ej. superadmin) → `403`.
- **RF-012** EL SISTEMA DEBE castear `bigint`/`integer` a `Number` en todas las respuestas (ids y contadores). No expone `empresa_id`.
- **RF-013** CUANDO el `administrador` abre la sección "Categorías", EL SISTEMA DEBE mostrar el listado paginado con el componente `Paginacion` (selector 5/10/15/20) y filtros por estado y búsqueda, con estados de carga, error y vacío; al cambiar filtros o tamaño DEBE volver a la página 1; los contadores usan `formatearNumero`.
- **RF-014** CUANDO el `administrador` guarda una categoría, EL SISTEMA DEBE permitir crearla y editarla (validación en línea y errores del backend en español) y activarla/desactivarla con confirmación, reflejando el cambio en el listado.
- **RF-015** CUANDO el `administrador` crea o edita un producto, EL SISTEMA DEBE ofrecer la categoría como **select** con las categorías activas de su empresa y la opción "Sin categoría" (`null`).
- **RF-016** CUANDO el `administrador` filtra productos por categoría, EL SISTEMA DEBE usar el catálogo para poblar el selector y enviar `categoria_id` al endpoint existente.
- **RF-017** CUANDO el `administrador` ve el listado de productos, EL SISTEMA DEBE mostrar el **nombre** de la categoría de cada producto (mapeado en el cliente), y "—" cuando no tenga.
- **RF-018** SI un producto tiene asignada una categoría inactiva, ENTONCES EL SISTEMA DEBE mostrar esa categoría en el select marcada como "(inactiva)" al editar (no debe desaparecer).

## Casos límite (EC)

- **EC-001** `empresa_id` enviado en query/body se ignora: el tenant SIEMPRE sale del token.
- **EC-002** `buscar` sin coincidencias → `items: []`, `total: 0`, `total_paginas: 0` (200, no error).
- **EC-003** `%`/`_` en `buscar` se tratan como texto literal (sin comodines ILIKE inyectables).
- **EC-004** Superadmin (sin empresa) → `403`.
- **EC-005** Desactivar una categoría no modifica ni oculta sus productos; siguen consultables y editables.
- **EC-006** `:id` no numérico/`0`/negativo/fuera de rango bigint → `400` (nunca `500`).
- **EC-007** Sin categorías activas, el formulario de producto ofrece solo "Sin categoría" y no bloquea el guardado.
- **EC-008** `nombre` con espacios externos se `trim`ea; un nombre resultante vacío → `400`.

## Criterios de aceptación

1. `GET /api/v1/categorias` responde el sobre paginado con items de la empresa del token; filtros `activo`/`buscar` y `total` correctos.
2. `POST /categorias` crea con `201`; `nombre` duplicado en la empresa → `409`; `nombre` vacío o `>100` → `400`.
3. `GET /categorias/:id` responde `200`; ajena/inexistente → `404`; `:id` inválido → `400` (nunca `500`).
4. `PATCH /categorias/:id` edita `nombre`/`activo` (borrado lógico); `409` por duplicado; `400` sin campos.
5. Paginación: defaults `1`/`10`; `pagina=0`, `por_pagina=0`, `por_pagina=101`, decimales y texto → `400`.
6. Seguridad: sin token `401`; superadmin `403`; `empresa_id` falso en query/body ignorado (test IDOR).
7. UI: página "Categorías" activa en el panel con listado paginado (`Paginacion` 5/10/15/20), filtros, alta/edición y activar/desactivar; estados carga/error/vacío.
8. Productos: formulario con **select** de categoría (sin número escrito a mano), filtro por categoría y nombre de categoría visible en la tabla; sin cambiar la respuesta de `/api/v1/productos`.
9. `npm run lint --prefix client` y `npm run build --prefix client` en verde.
10. QA independiente aprueba con evidencia; `npm test` (raíz) sin regresiones (incluida la suite de productos).

## Resultado QA

_(Pendiente de ejecución.)_
