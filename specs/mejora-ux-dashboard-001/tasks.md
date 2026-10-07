# Tareas — SD-020

## T-001 — Frontend: aplicar altura máxima y scroll interno a las cards de barras

```yaml
T-001:
  spec: specs/mejora-ux-dashboard-001/spec.md
  objetivo: Evitar que las cards "Top productos" y "Ventas por sucursal" se estiren verticalmente cuando haya muchos datos, aplicando una altura máxima fija con scroll interno.
  capa: client
  alcance:
    permite:
      - client/src/paginas/Inicio.jsx
    prohibe:
      - server/**
      - client/src/componentes/GraficoBarras.jsx (salvo ajustes menores no funcionales)
      - client/src/componentes/GraficoVentas.jsx
      - client/src/hooks/useTablero.js
      - client/src/servicios/tablero.js
      - .env
      - server/db/schema.sql
  contrato_api_v1:
    recurso: Tablero de inicio
    metodo_path: "GET /api/v1/tablero/inicio"
    request: { dias: { tipo: "integer", obligatorio: false }, sucursal_id: { tipo: "integer", obligatorio: false } }
    data: { "periodo_dias", "resumen", "serie_ventas", "top_productos", "ventas_por_sucursal", "stock_faltante" }
    codigos: [200, 401, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: n/a
    roles: [administrador, superadmin]
  criterios_aceptacion:
    - Las dos cards de barras tienen altura máxima fija en desktop (propuesta max-h-80 / 320px, ajustable dentro de criterios).
    - Si el contenido excede la altura, aparece scroll vertical interno suave.
    - El encabezado de cada card (título + subtítulo) permanece visible fuera del área scrollable.
    - No se rompe el layout responsive ni el diseño "papel de caja".
    - "npm run lint --prefix client" y "npm run build --prefix client" pasan.
  evidencia_requerida: |
    Ejecutar:
      npm run lint --prefix client
      npm run build --prefix client
    Reportar: salida de ambos comandos (éxito/error) y breve descripción de los cambios.
```

## T-002 — Frontend: agregar contador "Mostrando N de M" en las cards de barras

```yaml
T-002:
  spec: specs/mejora-ux-dashboard-001/spec.md
  objetivo: Informar al usuario cuántos items hay en cada card de barras mediante un contador visible en el encabezado.
  capa: client
  alcance:
    permite:
      - client/src/paginas/Inicio.jsx
    prohibe:
      - server/**
      - client/src/componentes/GraficoBarras.jsx
      - client/src/componentes/GraficoVentas.jsx
      - client/src/hooks/useTablero.js
      - client/src/servicios/tablero.js
      - .env
  contrato_api_v1:
    recurso: Tablero de inicio
    metodo_path: "GET /api/v1/tablero/inicio"
    request: { dias: { tipo: "integer", obligatorio: false }, sucursal_id: { tipo: "integer", obligatorio: false } }
    data: { "top_productos": "array", "ventas_por_sucursal": "array" }
    codigos: [200, 401, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: n/a
    roles: [administrador, superadmin]
  criterios_aceptacion:
    - Cada card con datos muestra "Mostrando N de M" en el encabezado.
    - N y M usan formatearNumero.
    - El contador no aparece cuando la card está vacía.
    - Al cambiar el periodo, el contador se actualiza con los nuevos datos.
    - "npm run lint --prefix client" y "npm run build --prefix client" pasan.
  evidencia_requerida: |
    Ejecutar:
      npm run lint --prefix client
      npm run build --prefix client
    Reportar: salida de ambos comandos y confirmación de que el contador se renderiza correctamente.
```

## T-003 — QA: verificación visual y build/lint

```yaml
T-003:
  spec: specs/mejora-ux-dashboard-001/spec.md
  objetivo: Verificar que las cards de barras no se estiren con datos extensos, que el scroll y el contador funcionen, y que no haya regresiones de lint/build.
  capa: tests
  alcance:
    permite:
      - tests/**
      - ejecutar "npm run lint --prefix client"
      - ejecutar "npm run build --prefix client"
    prohibe:
      - server/**
      - client/**
      - .env
  contrato_api_v1:
    recurso: Tablero de inicio
    metodo_path: "GET /api/v1/tablero/inicio"
    request: { dias: { tipo: "integer", obligatorio: false } }
    data: { "top_productos": "array", "ventas_por_sucursal": "array" }
    codigos: [200, 401, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: n/a
    roles: [administrador, superadmin]
  criterios_aceptacion:
    - Lint y build del frontend pasan sin errores.
    - Visualmente, las cards "Top productos" y "Ventas por sucursal" mantienen altura máxima fija en desktop con muchos datos.
    - El scroll interno permite ver todas las barras.
    - El contador "Mostrando N de M" es correcto.
    - No hay regresiones en el layout responsive.
  evidencia_requerida: |
    Ejecutar:
      npm run lint --prefix client
      npm run build --prefix client
    Reportar veredicto APROBADO o RECHAZADO con lista de Fallos / Faltantes / Riesgos.
```

## Dependencias entre tareas

```
T-001 → T-002 → T-003
```

T-001 y T-002 pueden ejecutarse juntas en una sola pasada de frontend porque ambas tocan `Inicio.jsx`. T-003 siempre al final.
