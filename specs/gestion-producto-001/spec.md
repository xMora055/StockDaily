# Spec — Gestión de productos (SD-003)

- **Identificador:** gestion-producto-001
- **Backlog:** SD-003 (P0)
- **Capas:** /server, /client
- **Dependencias:** auth (Hecho), tabla `producto` (esquema aplicado)
- **Fecha:** 2026-10-05

## Contexto

StockDaily (Express + PostgreSQL en `/server`, React + Vite en `/client`) ya tiene auth JWT (`POST /api/v1/auth/login`, `GET /api/v1/auth/perfil`) pero **ningún endpoint de negocio**. `producto` existe en el esquema y está aislado por `empresa_id` (multi-tenant). `req.usuario` expone la identidad y `empresa_id` derivados del token.

## Alcance

**Dentro:** crear, listar (con filtros), consultar por id y editar/activar-desactivar productos de la empresa del usuario autenticado. Borrado lógico (`activo = false`).

**Fuera:** categorías (SD-002), inventario/stock (SD-005), variantes, lotes, códigos de barras, importación masiva.

## Requisitos funcionales (EARS)

- **RF-001** CUANDO un `administrador` autenticado envía `POST /api/v1/productos` con `codigo` y `nombre`, EL SISTEMA DEBE crear el producto asociado a la empresa del token y responder `201` con `{ success: true, data: { producto } }`.
- **RF-002** CUANDO se envía `GET /api/v1/productos`, EL SISTEMA DEBE devolver los productos de la empresa del token, con filtros opcionales por `nombre`, `codigo`, `categoria_id` y `activo`.
- **RF-003** CUANDO se envía `GET /api/v1/productos/:id`, EL SISTEMA DEBE devolver el producto si pertenece a la empresa del token; si no existe o es de otra empresa, DEBE responder `404`.
- **RF-004** CUANDO se envía `PATCH /api/v1/productos/:id`, EL SISTEMA DEBE actualizar solo los campos presentes en el cuerpo (`nombre`, `descripcion`, `precio_unitario`, `impuesto_porcentaje`, `categoria_id`, `codigo`, `activo`).
- **RF-005** CUANDO se envía `activo: false` por `PATCH`, EL SISTEMA DEBE desactivar el producto mediante borrado lógico, sin eliminarlo.
- **RF-006** DONDE `impuesto_porcentaje` no se envíe al crear, EL SISTEMA DEBE usar `0`.
- **RF-007** DONDE `categoria_id` no se envíe, EL SISTEMA DEBE aceptar el producto con categoría nula.
- **RF-008** EL SISTEMA DEBE convertir `precio_unitario` (tipo `numeric`) a `Number` antes de serializar la respuesta JSON.
- **RF-009** SI falta el encabezado `Authorization: Bearer <token>` o el token es inválido, ENTONCES EL SISTEMA DEBE responder `401`.
- **RF-010** SI el rol del usuario no es `administrador`, ENTONCES EL SISTEMA DEBE responder `403` (el `superadmin` no tiene empresa y no opera catálogos).

## Casos límite (EC)

- **EC-001** SI `codigo` ya existe para la misma empresa, ENTONCES EL SISTEMA DEBE responder `409`.
- **EC-002** SI faltan `codigo` o `nombre`, o están vacíos, ENTONCES EL SISTEMA DEBE responder `400`.
- **EC-003** SI `precio_unitario < 0` o `impuesto_porcentaje` está fuera de `0..100`, ENTONCES EL SISTEMA DEBE responder `400`.
- **EC-004** SI el cuerpo o el query incluyen `empresa_id`, EL SISTEMA DEBE ignorarlo y usar siempre el de `req.usuario`.
- **EC-005** SI `categoria_id` no existe o pertenece a otra empresa, ENTONCES EL SISTEMA DEBE responder `400`.
- **EC-006** CUANDO se envía `activo: true` sobre un producto inactivo, EL SISTEMA DEBE reactivarlo.
- **EC-007** SI `:id` no es numérico, ENTONCES EL SISTEMA DEBE responder `400`.

## Criterios de aceptación

1. `GET /api/v1/salud` responde `{ success: true, data: { bd: true } }`.
2. Los cuatro endpoints cumplen el sobre `{ success, data }` / `{ success: false, error }` sin campos raíz extra.
3. Caso feliz de creación responde `201`; validaciones `400`; duplicado `409`; sin token `401`; producto ajeno o inexistente `404`.
4. Test IDOR: enviar `empresa_id` falso en body/query no altera el resultado.
5. `precio_unitario` llega como número (no string) en el JSON.
6. `npm run lint --prefix client` y `npm run build --prefix client` en verde.
7. QA independiente aprueba con evidencia.