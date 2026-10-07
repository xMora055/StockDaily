# Spec — Onboarding Superadmin: Empresas y Administradores (SD-010)

- **Identificador:** gestion-empresa-001
- **Backlog:** SD-010 (P1)
- **Capas:** /server, /client, BD
- **Dependencias:** auth (Hecho), tabla `empresa` y `usuario` (esquema aplicado)
- **Fecha:** 2026-10-05

## Contexto

StockDaily ya tiene auth JWT con dos roles:
- **superadmin** (`rol = 'superadmin'`, `empresa_id = NULL`): usuario de plataforma, crea empresas y administradores, no opera en sucursales.
- **administrador** (`rol = 'administrador'`, `empresa_id NOT NULL`): pertenece a una empresa, gestiona sucursales, productos, ventas, inventario.

Falta la UI y los endpoints para que el **superadmin** dé de alta empresas y cree usuarios administrador para cada empresa (onboarding). Hoy solo existe el script CLI `server/scripts/crearUsuario.js`.

## Alcance

**Dentro:**
- CRUD de `empresa` (solo superadmin): crear, listar, consultar por id, editar (nombre, documento, moneda, dirección, teléfono, correo, activo), activar/desactivar (borrado lógico `activo = false`).
- Crear y listar usuarios `administrador` vinculados a una empresa (solo superadmin): `POST /api/v1/empresas/:id/administradores`, `GET /api/v1/empresas/:id/administradores`. El superadmin no edita ni borra admins (eso lo hace cada admin desde su panel si se implementa luego).
- Navegación exclusiva para superadmin en el panel lateral: sección "Administración" con sub-secciones "Empresas" y "Administradores".
- Validación de unicidad: `empresa.nombre` único global; `usuario.correo` único por empresa (ya en BD).
- Filtro por tenant: el superadmin ve todo (no hay `empresa_id` en su token); los admins solo ven su empresa (ya resuelto en otros endpoints).

**Fuera:**
- Login multi-tenant (resolver 409 por correo repetido en varias empresas) → SD-013.
- Asignar sucursales a administradores.
- Editar/borrar administradores desde el panel superadmin (solo creación y listado).
- Métricas de uso por empresa.

## Requisitos funcionales (EARS)

### Empresas (solo superadmin)

- **RF-001** CUANDO un `superadmin` autenticado envía `POST /api/v1/empresas` con `nombre` y `moneda`, EL SISTEMA DEBE crear la empresa y responder `201` con `{ success: true, data: { empresa } }`.
- **RF-002** CUANDO un `superadmin` envía `GET /api/v1/empresas`, EL SISTEMA DEBE devolver todas las empresas (paginado).
- **RF-003** CUANDO un `superadmin` envía `GET /api/v1/empresas/:id`, EL SISTEMA DEBE devolver la empresa si existe; si no, `404`.
- **RF-004** CUANDO un `superadmin` envía `PATCH /api/v1/empresas/:id`, EL SISTEMA DEBE actualizar solo los campos presentes (`nombre`, `documento`, `moneda`, `direccion`, `telefono`, `correo`, `activo`).
- **RF-005** CUANDO se envía `activo: false` por `PATCH`, EL SISTEMA DEBE desactivar la empresa (borrado lógico).
- **RF-006** EL SISTEMA DEBE convertir `bigint` a `Number` en respuestas JSON.

### Administradores de empresa (solo superadmin)

- **RF-007** CUANDO un `superadmin` envía `POST /api/v1/empresas/:empresaId/administradores` con `nombre`, `correo`, `password`, EL SISTEMA DEBE crear el usuario con `rol = 'administrador'`, `empresa_id = :empresaId`, hashear la contraseña con bcrypt y responder `201` con `{ success: true, data: { administrador } }` (sin `password_hash`).
- **RF-008** CUANDO un `superadmin` envía `GET /api/v1/empresas/:empresaId/administradores`, EL SISTEMA DEBE devolver los administradores activos de esa empresa (paginado).

### Seguridad y multi-tenant

- **RF-009** SI falta `Authorization: Bearer <token>` o token inválido, ENTONCES EL SISTEMA DEBE responder `401`.
- **RF-010** SI el rol del usuario no es `superadmin`, ENTONCES EL SISTEMA DEBE responder `403` en todos los endpoints de esta spec.
- **RF-011** SI un `administrador` intenta acceder a estos endpoints, ENTONCES EL SISTEMA DEBE responder `403`.
- **RF-012** EL SISTEMA DEBE ignorar cualquier `empresa_id` enviado en body/query y usar siempre el contexto del token (para superadmin no hay empresa; para admins estos endpoints son 403).

## Casos límite (EC)

- **EC-001** SI `nombre` de empresa ya existe, ENTONCES EL SISTEMA DEBE responder `409`.
- **EC-002** SI falta `nombre` o `moneda` en creación de empresa, ENTONCES EL SISTEMA DEBE responder `400`.
- **EC-003** SI `moneda` no es código ISO-4217 de 3 letras, ENTONCES EL SISTEMA DEBE responder `400`.
- **EC-004** SI `correo` de administrador ya existe en la misma empresa, ENTONCES EL SISTEMA DEBE responder `409`.
- **EC-005** SI `password` tiene menos de 6 caracteres, ENTONCES EL SISTEMA DEBE responder `400`.
- **EC-006** SI `:empresaId` no existe o no es numérico, ENTONCES EL SISTEMA DEBE responder `400`/`404`.
- **EC-007** SI se intenta crear admin en empresa inactiva, ENTONCES EL SISTEMA DEBE responder `409`.
- **EC-008** CUANDO se reactiva una empresa (`activo: true`), EL SISTEMA DEBE permitir crear administradores de nuevo.

## Criterios de aceptación

1. Endpoints de empresas: `GET` (lista paginada), `POST` (201), `GET/:id`, `PATCH` bajo `/api/v1/empresas` con sobre `{ success, data }` / `{ success: false, error }`.
2. Endpoints de administradores: `POST /api/v1/empresas/:id/administradores` (201), `GET /api/v1/empresas/:id/administradores` (200 paginado).
3. Validaciones: 400 campos obligatorios/formato; 409 duplicados; 401 sin token; 403 rol no superadmin; 404 inexistente.
4. Test IDOR: superadmin ve todas las empresas; admin no puede acceder (403); `empresa_id` en body/query ignorado.
5. `id` llega como `Number`; `password_hash` nunca se expone en respuestas.
6. UI "Administración" en panel lateral solo visible para `rol === 'superadmin'`; dos páginas: `Empresas` (tabla + formulario crear/editar + activar/desactivar) y `Administradores` (selector de empresa → tabla + formulario crear admin).
7. `npm run lint --prefix client` y `npm run build --prefix client` en verde.
8. QA independiente aprueba con evidencia (`npm test` en raíz + tests específicos).

## Resultado QA

- Pendiente de ejecución.