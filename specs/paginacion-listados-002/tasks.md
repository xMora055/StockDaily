# Tareas — Selector de tamaño de página y default 10 (paginacion-listados-002)

## T-001 — Backend: default `por_pagina = 10`
```yaml
T-001:
  spec: specs/paginacion-listados-002/spec.md
  objetivo: Cambiar el default de por_pagina de 20 a 10 en los cuatro listados.
  capa: server
  alcance:
    permite: [server/validaciones/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql sin autorizacion]
  contrato_api_v1:
    recurso: productos | sucursales | inventario/stock | inventario/movimientos
    metodo_path: "GET /api/v1/productos | GET /api/v1/sucursales | GET /api/v1/inventario/stock | GET /api/v1/inventario/movimientos"
    request: { pagina: int, por_pagina: int }
    data: { items: [], pagina: number, por_pagina: number, total: number, total_paginas: number }
    codigos: [200, 400, 401, 403, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id desde el token"
    roles: [administrador]
  criterios_aceptacion:
    - "POR_PAGINA_DEFAULT = 10 en validaciones/productos.js, sucursales.js e inventario.js"
    - "Rango 1..100 intacto; por_pagina=0/101/1.5 -> 400"
    - "GET sin por_pagina responde data.por_pagina = 10 en los cuatro listados"
    - "Comentarios actualizados (default 10)"
  evidencia_requerida: "HTTP real: GET de cada listado sin por_pagina -> data.por_pagina = 10; por_pagina=0 -> 400"
```

## T-002 — Frontend: selector 5/10/15/20 + default 10 en las 4 tablas
```yaml
T-002:
  spec: specs/paginacion-listados-002/spec.md
  objetivo: Que el usuario elija el tamaño de página (5/10/15/20) en todas las tablas, con default 10.
  capa: client
  alcance:
    permite: [client/src/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: productos | sucursales | inventario/stock | inventario/movimientos
    metodo_path: "GET /api/v1/productos | GET /api/v1/sucursales | GET /api/v1/inventario/stock | GET /api/v1/inventario/movimientos"
    request: { pagina: int, por_pagina: int }
    data: { items: [], pagina, por_pagina, total, total_paginas }
    codigos: [200, 400, 401, 403, 500]
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion:
    - "Paginacion muestra select 'Por página' con 5/10/15/20 (sin 0)"
    - "Al cambiar el tamaño recarga y vuelve a la página 1 en Productos, Sucursales, Existencias y Movimientos"
    - "PAGINA_POR_DEFECTO = 10; POR_PAGINA_INICIAL = 10 en los hooks de inventario"
    - "No dispara recarga si el valor no cambió; convierte el valor del select a entero"
    - "POS/Inventario siguen pidiendo por_pagina=100 en sus selectores de catálogo"
    - "Accesibilidad: label asociada, foco visible, estilo 'papel de caja'; sin fetch en componentes"
    - "npm run lint --prefix client y npm run build --prefix client verdes"
  evidencia_requerida: "npm run lint --prefix client && npm run build --prefix client; descripcion del cambio de tamano reseteando a pagina 1"
```

## T-003 — QA: verificación independiente de paginacion-listados-002
```yaml
T-003:
  spec: specs/paginacion-listados-002/spec.md
  objetivo: Verificar default 10, selector 5/10/15/20 y ausencia de regresiones.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env, scripts test de package.json sin autorizacion]
  contrato_api_v1:
    recurso: productos | sucursales | inventario/stock | inventario/movimientos
    metodo_path: "GET /api/v1/productos | GET /api/v1/sucursales | GET /api/v1/inventario/stock | GET /api/v1/inventario/movimientos"
    request: { pagina: int, por_pagina: int }
    data: { items: [], pagina, por_pagina, total, total_paginas }
    codigos: [200, 400, 401, 403, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "total respeta empresa_id del token"
    roles: [administrador]
  criterios_aceptacion:
    - "Tests actualizados: default por_pagina = 10 en los cuatro listados"
    - "por_pagina=0 sigue rechazado con 400"
    - "Paginar con tamanos 5/10/15/20 no repite ni omite filas; total_paginas coherente"
    - "Sin regresiones en la suite completa (npm test en la raiz)"
    - "lint + build verdes (evidencia del frontend)"
  evidencia_requerida: "npm test en la raiz + reporte APROBADO/RECHAZADO con Fallos/Faltantes/Riesgos"
```
