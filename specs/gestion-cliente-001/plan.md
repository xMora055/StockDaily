# Plan técnico — Gestión de clientes (gestion-cliente-001)

## Contrato `/api/v1` (fuente de verdad)

Auth en todo el recurso: `Authorization: Bearer <token>`, rol `administrador`. `empresa_id` se deriva del token vía `sucursal`; **nunca** del body/query. Sobre estándar `{ "success": true, "data": ... }` / `{ "success": false, "error": "Mensaje" }`.

### `Cliente` (proyección que devuelve la API)
```
{ id:Number, sucursal_id:Number, sucursal_nombre:string, nombre:string,
  documento:string|null, telefono:string|null, correo:string|null,
  direccion:string|null, activo:boolean, creado_en:ISO, actualizado_en:ISO }
```
> `sucursal_nombre` solo en respuestas (JOIN); no se expone `empresa_id`.

### GET /api/v1/clientes
- Query (todos opcionales): `pagina` (entero ≥1, default 1), `por_pagina` (entero 1..100, default 10), `sucursal_id` (entero >0), `activo` (`true`|`false`), `buscar` (texto ≤150 → `nombre` o `documento`).
- Orden: `nombre ASC, id ASC`.
- **200:** `{ success:true, data:{ items:[Cliente], pagina, por_pagina, total, total_paginas } }`.
- **Errores:** `400` paginación/`sucursal_id` inválidos; `401`; `403`; `500`.

### POST /api/v1/clientes
- Body: `{ sucursal_id:Number(req), nombre:string(req ≤150), documento?:string ≤30, telefono?:string ≤30, correo?:string ≤150 (formato), direccion?:string ≤200 }`. Campos opcionales ausentes/`null`/`''` → `null`. Se ignora `empresa_id` y cualquier otro campo.
- **201:** `{ success:true, data:{ cliente:Cliente } }`.
- **Errores:** `400` validación (incluye `sucursal_id` faltante/no numérico); `401`; `403`; `404` sucursal inexistente o de otra empresa; `409` documento duplicado en la sucursal; `500`.

### GET /api/v1/clientes/:id
- **200:** `{ success:true, data:{ cliente:Cliente } }`.
- **Errores:** `400` `:id` no entero seguro positivo; `401`; `403`; `404` inexistente o de otra empresa; `500`.

### PATCH /api/v1/clientes/:id
- Body (solo campos presentes): `{ nombre?, documento?, telefono?, correo?, direccion?, activo? }`. `sucursal_id` presente se **ignora**. Sin campos → `400`.
- **200:** `{ success:true, data:{ cliente:Cliente } }`.
- **Errores:** `400`; `401`; `403`; `404`; `409` documento duplicado en la sucursal; `500`.

> **`POST /api/v1/facturas` (SD-006) NO cambia.** Ya acepta `cliente_id` (valida empresa con `facturas.buscarClienteDeEmpresa`) y snapshot `cliente_nombre`/`cliente_documento`. El POS solo empieza a enviarlo.

## Modelo de datos (sin cambios de esquema)

- `cliente (id, sucursal_id, nombre, documento, telefono, correo, direccion, activo, creado_en, actualizado_en)`, `UNIQUE (sucursal_id, documento)` (varios `NULL` permitidos).
- Multi-tenant: `cliente c JOIN sucursal s ON s.id = c.sucursal_id WHERE s.empresa_id = $empresa`.
- `empresa_id` de una `sucursal` referida se valida con `sucursal` filtrando por empresa.
- **No se toca `server/db/schema.sql`.** No hay dependencias nuevas.

## Archivos por capa

**Backend (`/server`):**
- `validaciones/clientes.js` (nuevo) — `validarCreacionCliente`, `validarEdicionCliente`, `validarFiltrosClientes`, `validarIdCliente`. Reutiliza el patrón de `validaciones/sucursales.js` (objeto plano, `hasOwnProperty`, longitudes, `normalizarPaginacion`, `validarId` tipo dígitos + entero seguro). Normaliza `búsqueda`, `correo` (formato básico), `activo`.
- `repositorios/clientes.js` (nuevo) — `listar(empresaId, filtros) → { items, total }` (JOIN `sucursal`, filtros dinámicos, COUNT del mismo WHERE, `LIMIT/OFFSET`, escape de `%`/`_` en `buscar`, `mapear` bigint→Number); `buscarPorId(id, empresaId)`; `crear(empresaId, datos)` (valida sucursal de la empresa); `actualizar(id, empresaId, cambios)`; `existeDocumento(sucursalId, documento, excluirId)`; `sucursalDeEmpresa(sucursalId, empresaId)`.
- `servicios/clientes.js` (nuevo) — `empresaDelUsuario`, `armarPagina`, `listarClientes`, `crearCliente` (404 sucursal / 409 documento), `obtenerCliente` (404), `actualizarCliente` (404, 409, traduce `23505` y `22003`).
- `controladores/clientes.js` (nuevo) — `listar`, `crear` (201), `obtener`, `actualizar`.
- `rutas/clientes.js` (nuevo) — `router.use(autenticacion, autorizacion('administrador'))`; `GET '/'`, `POST '/'`, `GET '/:id'`, `PATCH '/:id'` con `validarEntrada`.
- `rutas/index.js` — registrar `router.use('/clientes', clientes)`.

**Frontend (`/client`):**
- `utilidades/constantes.js` — `RUTA_CLIENTES = '/clientes'`.
- `servicios/clientes.js` (nuevo) — `listarClientes(filtros)` (normaliza paginado + `Cliente`), `crearCliente`, `obtenerCliente`, `actualizarCliente` (patrón `servicios/sucursales.js`).
- `hooks/useClientes.js` (nuevo) — listado paginado con filtros y reset a página 1 (patrón `useSucursales`).
- `hooks/useClientesSucursal.js` (nuevo) o reutilización directa — catálogo de clientes activos por sucursal para el POS (`por_pagina=100`, `activo=true`, `sucursal_id`).
- `componentes/FiltrosClientes.jsx` (nuevo) — sucursal, estado y buscador.
- `componentes/ClientesTabla.jsx` (nuevo) — tabla desktop + tarjetas móvil, acciones editar/activar-desactivar con confirmación de dos pasos, `Paginacion`.
- `componentes/FormularioCliente.jsx` (nuevo) — alta/edición con selects de sucursal y validación local.
- `paginas/Clientes.jsx` (nuevo) — orquesta listado, filtros, formulario y estados (patrón `Sucursales.jsx`).
- `componentes/SelectorCliente.jsx` (nuevo) — selector "Cliente registrado | Consumidor final" para el POS.
- `componentes/ResumenVenta.jsx` / `paginas/PuntoDeVenta.jsx` / `hooks/usePuntoDeVenta.js` — integrar `cliente_id` + autocompletar snapshot y limpiar al cambiar de sucursal.
- `componentes/ArmazonPanel.jsx` — añadir sección `{ id: 'clientes', nombre: 'Clientes' }`.
- `App.jsx` — registrar `clientes: Clientes` en `VISTAS`.

**Tests (`/tests`):**
- `tests/api/clientes.test.js` (nuevo, lo escribe `qa`).

## Orden de trabajo

1. **T-001** Backend listado (`GET /clientes`).
2. **T-002** Backend escritura/consulta (`POST`, `GET/:id`, `PATCH`) + registro de ruta.
3. **T-003** Frontend página Clientes: listado, filtros, paginación.
4. **T-004** Frontend formulario/acciones + navegación.
5. **T-005** Frontend POS: selector de cliente registrado.
6. **T-006** QA de integración.

> El backend va primero porque el frontend depende de un recurso nuevo. T-003/T-004 dependen de T-001/T-002; T-005 depende de T-001 y de que la ruta exista.

## Riesgos

- **Unicidad de documento con `NULL`:** la `UNIQUE (sucursal_id, documento)` permite múltiples `NULL`; verificar que el pre-chequeo de duplicado no rechace `documento` nulo (tratar `NULL` como “sin comparar”).
- **IDOR:** toda consulta debe ir por `JOIN sucursal` con `empresa_id` del token; el `sucursal_id` del body debe validarse contra la empresa (`404`, no `403`, para no filtrar existencia).
- **`22003` bigint fuera de rango:** traducir a `400` (lección SD-003/SD-007), nunca `500`.
- **POS y sucursal:** al cambiar de sucursal, el cliente seleccionado debe limpiarse; si no, se podría enviar un `cliente_id` de otra sede (el backend lo aceptaría por validar solo empresa). El filtro por sucursal en el selector es la defensa de negocio.
- **Catálogo de clientes >100 en el selector:** el POS consume `por_pagina=100`; queda la deuda conocida (búsqueda/paginación en selectores) si se superan 100 clientes activos por sucursal.
- **Regresión de tests:** la suite compartida usa la empresa 1; crear fixtures `QA-*` aislados y desactivar (borrado lógico) al terminar, como en las suites previas.
