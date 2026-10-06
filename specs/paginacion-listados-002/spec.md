# Spec — Selector de tamaño de página (5/10/15/20) y default 10 (paginacion-listados-002)

- **Identificador:** paginacion-listados-002
- **Backlog:** continuación de SD-018 (paginacion-listados-001, Hecho)
- **Capas:** /server, /client, tests
- **Dependencias:** paginacion-listados-001
- **Fecha:** 2026-10-05

## Contexto

La app ya pagina los cuatro listados (Productos, Sucursales, Inventario › Existencias e Inventario › Movimientos) con Anterior/Siguiente, y los hooks ya exponen `cambiarPorPagina`. Falta que **el usuario elija cuántos registros ver por página** y que el default global sea **10** en vez de 20.

Decisión de producto (2026-10-05): opciones **sin 0**; el valor `0` sigue siendo inválido (`400`). Tamaños permitidos: **5, 10, 15, 20**. Default: **10**.

## Alcance

**Dentro:** selector "por página" (5/10/15/20) en el componente compartido `Paginacion`; cablearlo en las 4 tablas; cambiar el default de `por_pagina` de 20 a 10 en la API y en el cliente; actualizar los tests que fijan el default anterior.
**Fuera:** cambiar el rango válido (sigue 1..100); aceptar `0`; añadir paginación a listados nuevos (facturas aún no tiene listado); cambiar la forma del sobre `data`; tocar los selectores de catálogo del POS/Inventario (siguen pidiendo `por_pagina=100`).

## Requisitos funcionales (EARS)

- **RF-001** EL SISTEMA DEBE ofrecer, en el componente `Paginacion`, un selector etiquetado "Por página" con las opciones **5, 10, 15 y 20** (sin opción "0"/"Todos").
- **RF-002** CUANDO el usuario cambia el tamaño de página, EL SISTEMA DEBE solicitar el listado con ese `por_pagina` y **volver a la página 1**.
- **RF-003** EL SISTEMA DEBE usar `por_pagina = 10` como valor por defecto, tanto cuando la API recibe la petición sin `por_pagina` como en el estado inicial de la UI.
- **RF-004** MIENTRAS un listado tenga al menos un registro, EL SISTEMA DEBE mostrar el selector de tamaño en las cuatro tablas: Productos, Sucursales, Existencias y Movimientos.
- **RF-005** EL SISTEMA DEBE mantener el rango válido `por_pagina` entre 1 y 100 y rechazar con `400` los valores `0`, negativos, decimales o mayores a 100.
- **RF-006** EL SISTEMA DEBE recalcular `total_paginas = ceil(total / por_pagina)` y `OFFSET = (pagina - 1) * por_pagina` con el tamaño elegido, sin repetir ni omitir filas.
- **RF-007** EL SISTEMA DEBE cumplir accesibilidad del selector: `<label>` asociada (o `aria-label`), operable por teclado, foco visible y contraste AA, siguiendo el lenguaje visual "papel de caja" (tipografía mono para cifras).

## Casos límite (EC)

- **EC-001** `total = 0` → no se renderiza la paginación (se muestra el estado vacío existente).
- **EC-002** `total <= por_pagina` (p. ej. 3 registros con tamaño 5) → una sola página; Anterior y Siguiente deshabilitados.
- **EC-003** Cambiar el tamaño estando en la página 3 → la UI vuelve a la página 1.
- **EC-004** `por_pagina=0`, `por_pagina=101`, `por_pagina=1.5` o `por_pagina` no numérico → `400` (sin cambios respecto a la spec 001).
- **EC-005** El `<select>` entrega el valor como texto; el sistema DEBE convertirlo a entero antes de enviarlo y acotarlo a `[1, 100]`.
- **EC-006** Elegir un tamaño que ya está seleccionado no debe disparar una recarga innecesaria.

## Criterios de aceptación

1. El selector "Por página" aparece en Productos, Sucursales, Existencias y Movimientos con opciones 5/10/15/20.
2. `GET /productos`, `GET /sucursales`, `GET /inventario/stock` y `GET /inventario/movimientos` sin `por_pagina` responden `por_pagina: 10`.
3. Cambiar el tamaño recarga el listado y reinicia a la página 1 en las 4 tablas.
4. `total`/`total_paginas` coherentes con el tamaño elegido; sin filas repetidas ni omitidas al recorrer páginas.
5. `400` ante `por_pagina` inválido; `0` sigue siendo inválido.
6. Sin regresión: filtros, búsqueda y selectores de POS/Inventario (`por_pagina=100`) siguen funcionando.
7. `npm test` (raíz) en verde con los tests actualizados al default 10; `npm run lint --prefix client` y `npm run build --prefix client` en verde.
8. QA independiente aprueba con evidencia.
