# Spec — Paginación de listados existentes: productos y sucursales (SD-018)

- **Identificador:** paginacion-listados-001
- **Backlog:** SD-018 (P1)
- **Capas:** /server, /client
- **Dependencias:** SD-003 (productos), SD-001 (sucursales), patrón de paginación de inventario (Revisión 2)
- **Fecha:** 2026-10-05

## Contexto

La convención de paginación (ver `AGENTS.md`/`MEMORY.md`) exige que **todo listado** de la API sea paginado y que toda tabla de la UI pagine. Inventario ya lo cumple; `GET /api/v1/productos` y `GET /api/v1/sucursales` aún devuelven la colección completa y sus tablas no paginan.

## Alcance

**Dentro:** paginar `GET /productos` y `GET /sucursales`; añadir el componente `Paginacion` a las tablas `Productos` y `Sucursales`; adaptar los consumidores de catálogo (POS e Inventario) al nuevo sobre.
**Fuera:** búsqueda por texto en sucursales, paginación de facturas (no existe listado aún), cambios de cálculo.

## Requisitos funcionales (EARS)

- **RF-001** CUANDO se envía `GET /api/v1/productos`, EL SISTEMA DEBE aceptar `pagina` (entero ≥1, default 1) y `por_pagina` (entero 1..100, default 20), además de los filtros existentes (`nombre`, `codigo`, `categoria_id`, `activo`), y responder `{ success:true, data:{ items, pagina, por_pagina, total, total_paginas } }`.
- **RF-002** CUANDO se envía `GET /api/v1/sucursales`, EL SISTEMA DEBE aceptar `pagina`/`por_pagina` y responder el mismo sobre paginado.
- **RF-003** EL SISTEMA DEBE calcular `total` con los MISMOS filtros (`COUNT`) y `total_paginas = ceil(total / por_pagina)`; `OFFSET = (pagina - 1) * por_pagina`.
- **RF-004** SI `pagina` < 1, no es entera, o `por_pagina` está fuera de `1..100`, ENTONCES EL SISTEMA DEBE responder `400`.
- **RF-005** EL SISTEMA DEBE mantener el orden determinista (`nombre ASC, id ASC`) para no repetir/omitir filas entre páginas.
- **RF-006** EL SISTEMA DEBE conservar el aislamiento multi-tenant (`empresa_id` del token) en el conteo y la consulta.
- **RF-007** CUANDO la UI muestra las tablas de Productos y Sucursales, EL SISTEMA DEBE paginar contra el backend con el componente `Paginacion` (Anterior/Siguiente, "Página X de Y", total con `formatearNumero`) y volver a página 1 al cambiar filtros.
- **RF-008** EL SISTEMA DEBE adaptar los selectores de catálogo del POS y de Inventario (que necesitan el conjunto de productos/sucursales) al nuevo sobre paginado (usar `items`).

## Casos límite (EC)

- **EC-001** `por_pagina` mayor que el total devuelve todos los `items` y `total_paginas = 1`.
- **EC-002** `pagina` más allá del final devuelve `items: []` conservando `total`/`total_paginas`.
- **EC-003** `total = 0` → `total_paginas = 0`, `items: []`.
- **EC-004** Filtros combinados (`nombre` + `activo`, etc.) reflejados en `total`.

## Criterios de aceptación

1. `GET /productos` y `GET /sucursales` devuelven el sobre paginado; `total`/`total_paginas` correctos y coherentes con los filtros.
2. Paginar no repite ni omite filas.
3. `400` con `pagina`/`por_pagina` inválidos.
4. Tablas de Productos y Sucursales con `Paginacion`; reset a página 1 al filtrar; estados carga/error/vacío.
5. POS e Inventario siguen funcionando (sus selectores usan `items`).
6. `npm test` (raíz) en verde; `lint`/`build` verdes.
7. QA independiente aprueba con evidencia.