# SD-020 — Mejora de UX en cards del dashboard

**Spec ID:** `mejora-ux-dashboard-001`  
**Backlog ID:** SD-020  
**Estado:** Listo para ejecutar  
**Capas afectadas:** `/client`  
**Fecha:** 2026-10-06

## Contexto

En la página `Inicio` del panel, las cards **Top productos** y **Ventas por sucursal** usan el componente `GraficoBarras`. Cuando el negocio tiene muchos productos o sucursales, estas cards crecen verticalmente sin límite, empujando el resto del dashboard hacia abajo y dificultando la navegación en desktop.

## Objetivo

Mantener el dashboard compacto y usable en desktop cuando las cards de barras contengan muchos datos, sin perder información ni romper el lenguaje visual "papel de caja".

## Requisitos funcionales (EARS)

- **RF-001** CUANDO el dashboard cargue los datos del tablero, EL SISTEMA DEBE renderizar las cards **Top productos** y **Ventas por sucursal** con una altura máxima fija en desktop.
- **RF-002** CUANDO la lista de barras de una card exceda la altura máxima visible, EL SISTEMA DEBE mostrar un scroll vertical interno en esa card.
- **RF-003** CUANDO una card de barras tenga uno o más items, EL SISTEMA DEBE mostrar en su encabezado el contador **Mostrando N de M**, donde `N` es la cantidad de items renderizados y `M` es el total.
- **RF-004** MIENTRAS el usuario haga scroll dentro de una card, EL SISTEMA DEBE mantener fijo el encabezado con el título, subtítulo y contador.
- **RF-005** CUANDO una card de barras no tenga datos, EL SISTEMA DEBE mostrar el mensaje de vacío existente sin scroll ni contador.
- **RF-006** EL SISTEMA DEBE preservar el diseño "papel de caja": bordes `border-borde`, sombra `shadow-impresa`, tipografía `font-display`/`font-mono`, colores del tema y espaciado actual.
- **RF-007** CUANDO el usuario cambie el periodo del dashboard (7/30/90 días), EL SISTEMA DEBE recargar los datos y re-aplicar el comportamiento de altura fija, scroll y contador.

## Casos límite

- **EC-001** Lista muy larga (más de 50 productos o sucursales): la card no debe estirarse; el scroll interno debe permitir ver todas las barras.
- **EC-002** Lista con un solo item: la card no debe mostrar scroll ni contador excesivo; debe verse equilibrada.
- **EC-003** Lista vacía: debe mostrarse el estado vacío actual de `GraficoBarras` sin contador ni scroll.
- **EC-004** Pantalla pequeña (móvil/tablet): el comportamiento de altura fija y scroll debe adaptarse sin romper el layout responsive; en móvil puede reducirse la altura máxima.
- **EC-005** Cambio rápido de periodo: no debe quedar scroll residual ni contador desfasado.

## Criterios de aceptación verificables

1. En desktop, ambas cards (`Top productos` y `Ventas por sucursal`) tienen una altura máxima fija (propuesta: `320px`–`360px` para el cuerpo de la card, ajustable durante la implementación si el diseño lo recomienda).
2. Si el contenido supera la altura máxima, aparece scroll vertical interno en la card; la barra de scroll respeta el tema y no rompe los bordes redondeados.
3. Cada card con datos muestra el contador `Mostrando N de M` en el encabezado, formateado con `formatearNumero`.
4. Los datos, formatos de moneda/cantidad y el layout responsive no presentan regresiones.
5. `npm run lint --prefix client` pasa sin errores.
6. `npm run build --prefix client` pasa sin errores.
7. QA verifica visualmente que con datos de prueba extensos las cards no se estiren más allá de la altura máxima.
