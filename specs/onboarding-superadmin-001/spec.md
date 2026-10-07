# SD-010 — Onboarding superadmin: empresas y administradores

**Spec ID:** `onboarding-superadmin-001`  
**Backlog ID:** SD-010  
**Estado:** Listo para ejecutar  
**Capas afectadas:** `/server`, `/client`, `BD` (sin cambios mayores)  
**Fecha:** 2026-10-06

## Contexto

El schema de base de datos ya distingue dos roles:
- `superadmin`: `empresa_id IS NULL`, operador de la plataforma.
- `administrador`: `empresa_id NOT NULL`, opera dentro de una empresa.

Hoy no existe una forma dentro de la aplicación para que un `superadmin` cree empresas y asigne su primer administrador. Esto obliga a tocar la base de datos o usar `server/scripts/crearUsuario.js`. SD-010 habilita ese onboarding desde la UI.

## Objetivo

Permitir que un `superadmin` autenticado cree empresas y administradores iniciales desde el panel, sin acceder a la base de datos manualmente.

## Requisitos funcionales (EARS)

- **RF-001** CUANDO un usuario con rol `superadmin` acceda al panel, EL SISTEMA DEBE mostrarle la sección **Administración** para gestionar empresas y administradores.
- **RF-002** CUANDO el superadmin cree una empresa, EL SISTEMA DEBE crear obligatoriamente el primer administrador asociado a esa empresa en la misma operación.
- **RF-003** CUANDO el sistema cree un administrador, EL SISTEMA DEBE asignarle la contraseña temporal `"123"` y mostrarla una sola vez en la UI de confirmación.
- **RF-004** CUANDO un usuario que no sea `superadmin` intente acceder a cualquier endpoint bajo `/api/v1/admin/**`, EL SISTEMA DEBE responder **403**.
- **RF-005** CUANDO el superadmin liste empresas o administradores, EL SISTEMA DEBE devolver resultados paginados bajo el sobre `{ items, pagina, por_pagina, total, total_paginas }`.
- **RF-006** CUANDO el superadmin desactive una empresa, EL SISTEMA DEBE desactivar también todos los usuarios `administrador` pertenecientes a esa empresa.
- **RF-007** CUANDO se intente crear o editar un administrador con un correo ya usado en la misma empresa, EL SISTEMA DEBE responder **409**.
- **RF-008** MIENTRAS el superadmin edite una empresa, EL SISTEMA DEBE permitir modificar `nombre`, `documento`, `moneda`, `direccion`, `telefono`, `correo` y `activo`.
- **RF-009** CUANDO el superadmin consulte una empresa por id, EL SISTEMA DEBE incluir la lista de sus administradores en la respuesta.
- **RF-010** EL SISTEMA DEBE normalizar el correo del administrador a minúsculas antes de validar unicidad y guardar.

## Casos límite

- **EC-001** El mismo correo puede usarse en empresas distintas; el `UNIQUE` es `(empresa_id, correo)`.
- **EC-002** Desactivar una empresa ya inactiva es idempotente (200 sin cambios visibles).
- **EC-003** No se permite asignar `empresa_id` a un superadmin ni crear un administrador sin empresa.
- **EC-004** Correo inválido o vacío → 400.
- **EC-005** Parámetros de paginación inválidos (`pagina=0`, `por_pagina=101`) → 400.
- **EC-006** Si falla la creación del administrador después de crear la empresa, EL SISTEMA DEBE hacer ROLLBACK de toda la operación para no dejar empresas huérfanas.

## Criterios de aceptación verificables

1. `POST /api/v1/admin/empresas` con datos válidos crea empresa + administrador y devuelve `201 { success: true, data: { empresa, administrador, password: "123" } }`.
2. `GET /api/v1/admin/empresas` devuelve listado paginado de empresas.
3. `GET /api/v1/admin/empresas/:id` devuelve empresa con sus administradores.
4. `PATCH /api/v1/admin/empresas/:id` con `activo: false` desactiva la empresa y sus admins.
5. `POST /api/v1/admin/usuarios` crea un administrador adicional para una empresa existente.
6. Acceso con rol `administrador` a `/api/v1/admin/**` → 403.
7. Correo duplicado dentro de la misma empresa → 409.
8. La UI tiene sección "Administración" visible solo para `superadmin` con pantallas de empresas y administradores, estados de carga/error/vacío, y mensaje de confirmación mostrando la contraseña `"123"`.
9. `npm test` (raíz), `npm run lint --prefix client` y `npm run build --prefix client` pasan sin errores.

## Notas de seguridad (documentadas)

- La contraseña `"123"` es deliberadamente débil y solo está aprobada para ambiente de desarrollo/demo. En producción debe reemplazarse por contraseña aleatoria o flujo de cambio obligatorio en primer login.
