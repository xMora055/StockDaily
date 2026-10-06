# Spec — Gestión de sucursales (SD-001)

- **Identificador:** gestion-sucursal-001
- **Backlog:** SD-001 (P0)
- **Capas:** /server, /client
- **Dependencias:** auth (Hecho), tabla `sucursal` (esquema aplicado)
- **Fecha:** 2026-10-05

## Contexto

StockDaily (Express + PostgreSQL en `/server`, React + Vite en `/client`) tiene auth JWT y ya expone `/api/v1/productos`. Falta gestionar `sucursal`, que es la raíz de `cliente`, `stock` y `factura`. Sin listar sucursales, el futuro POS no puede elegir en cuál vender (la tabla `usuario` no referencia sucursal). `req.usuario` expone identidad, rol y `empresa_id` derivados del token.

## Alcance

**Dentro:** crear, listar (de la empresa del usuario), consultar por id y editar/activar-desactivar sucursales. Borrado lógico (`activo = false`).

**Fuera:** asignar usuarios a sucursales, borrado físico, geolocalización, horarios.

## Requisitos funcionales (EARS)

- **RF-001** CUANDO un `administrador` autenticado envía `POST /api/v1/sucursales` con `nombre`, EL SISTEMA DEBE crear la sucursal asociada a la empresa del token y responder `201` con `{ success: true, data: { sucursal } }`.
- **RF-002** CUANDO se envía `GET /api/v1/sucursales`, EL SISTEMA DEBE devolver las sucursales de la empresa del token.
- **RF-003** CUANDO se envía `GET /api/v1/sucursales/:id`, EL SISTEMA DEBE devolver la sucursal si pertenece a la empresa del token; si no existe o es de otra empresa, DEBE responder `404`.
- **RF-004** CUANDO se envía `PATCH /api/v1/sucursales/:id`, EL SISTEMA DEBE actualizar solo los campos presentes (`nombre`, `direccion`, `telefono`, `activo`).
- **RF-005** CUANDO se envía `activo: false` por `PATCH`, EL SISTEMA DEBE desactivar la sucursal mediante borrado lógico, sin eliminarla.
- **RF-006** EL SISTEMA DEBE convertir los identificadores `bigint` a `Number` antes de serializar la respuesta JSON.
- **RF-007** SI falta el encabezado `Authorization: Bearer <token>` o el token es inválido, ENTONCES EL SISTEMA DEBE responder `401`.
- **RF-008** SI el rol del usuario no es `administrador`, ENTONCES EL SISTEMA DEBE responder `403`.

## Casos límite (EC)

- **EC-001** SI `nombre` ya existe para la misma empresa, ENTONCES EL SISTEMA DEBE responder `409`.
- **EC-002** SI falta `nombre` o está vacío, ENTONCES EL SISTEMA DEBE responder `400`.
- **EC-003** SI el cuerpo o el query incluyen `empresa_id`, EL SISTEMA DEBE ignorarlo y usar siempre el de `req.usuario`.
- **EC-004** CUANDO se envía `activo: true` sobre una sucursal inactiva, EL SISTEMA DEBE reactivarla.
- **EC-005** SI `:id` no es numérico, ENTONCES EL SISTEMA DEBE responder `400`.
- **EC-006** SI `nombre` supera 150, `direccion` 200 o `telefono` 30 caracteres, EL SISTEMA DEBE responder `400`.

## Criterios de aceptación

1. Los cuatro endpoints cumplen el sobre `{ success, data }` / `{ success: false, error }` sin campos raíz extra.
2. Caso feliz de creación `201`; validaciones `400`; duplicado `409`; sin token `401`; rol no autorizado `403`; sucursal ajena o inexistente `404`.
3. Test IDOR: enviar `empresa_id` falso en body/query no altera el resultado.
4. `id` llega como `Number`.
5. UI de Sucursales con estados carga/error/vacío y acceso desde el panel; `npm run lint --prefix client` y `npm run build --prefix client` en verde.
6. QA independiente aprueba con evidencia.

## Resultado QA (2026-10-05)

- **Veredicto: APROBADO** — 0 fallos, 0 faltantes.
- **Pruebas:** `npm test` en la raíz → `tests 79 · pass 79 · fail 0` (38 productos + 41 sucursales, sin regresiones). Suite en `tests/api/sucursales.test.js`.
- **Frontend:** `npm run lint --prefix client` y `npm run build --prefix client` en verde; cadena `Sucursales.jsx → useSucursales → servicios/sucursales.js → api/clienteApi.js` verificada (sobre, carga/error/vacío, 401).
- **Endpoints:** 201/200 felices; 400 validaciones (incl. `:id` fuera de rango → 400, nunca 500); 409 duplicado; 401/403; IDOR (`empresa_id` falso ignorado); `id` como `Number`.
- **Riesgos no bloqueantes (seguimiento):** unicidad case-sensitive de `nombre`; `GET /sucursales` devuelve también inactivas (el POS debe filtrar `activo`); acumulación de filas `QA-*` inactivas en Supabase; sin rate limiting.
- **Pendiente de cierre:** marcar SD-001 `Hecho` en `docs/backlog.md` y `MEMORY.md` (territorio de `product-owner`).