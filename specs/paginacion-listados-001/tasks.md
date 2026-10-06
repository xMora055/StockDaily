# Tareas — Paginación de productos y sucursales (paginacion-listados-001)

## T-001 — Backend: paginar GET /productos y GET /sucursales
```yaml
T-001:
  spec: specs/paginacion-listados-001/spec.md
  objetivo: Añadir paginacion a los listados de productos y sucursales.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**, server/controladores/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql sin autorizacion]
  contrato_api_v1:
    recurso: productos | sucursales
    metodo_path: "GET /api/v1/productos | GET /api/v1/sucursales"
    request: { pagina: int, por_pagina: int }
    data: { items: [], pagina: number, por_pagina: number, total: number, total_paginas: number }
    codigos: [200, 400, 401, 403, 500]
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id desde req.usuario en el COUNT y la consulta"
    roles: [administrador]
  criterios_aceptacion: ["Sobre paginado en ambos GET", "total = COUNT con los mismos filtros", "total_paginas = ceil(total/por_pagina)", "400 con pagina/por_pagina invalidos", "orden determinista nombre ASC, id ASC", "POST/PATCH/GET:id sin cambios"]
  evidencia_requerida: "HTTP real: pagina 1 vs 2 sin repetir; total con filtros; 400 invalidos"
```

## T-002 — Frontend: tablas Productos y Sucursales paginadas + consumidores
```yaml
T-002:
  spec: specs/paginacion-listados-001/spec.md
  objetivo: Consumir el sobre paginado en las tablas y adaptar los selectores.
  capa: client
  alcance:
    permite: [client/src/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: productos | sucursales
    metodo_path: "GET /api/v1/productos | GET /api/v1/sucursales"
    request: { pagina: int, por_pagina: int }
    data: { items: [], pagina, por_pagina, total, total_paginas }
    codigos: [200, 400, 401, 403, 500]
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["Productos y Sucursales usan el componente Paginacion", "Reset a pagina 1 al cambiar filtros", "POS e Inventario consumen items (selectores con por_pagina=100)", "Sin fetch en componentes", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client && npm run build --prefix client"
```

## T-003 — QA: verificacion independiente de SD-018
```yaml
T-003:
  spec: specs/paginacion-listados-001/spec.md
  objetivo: Verificar paginacion de productos/sucursales y no regresion.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env, scripts test de package.json sin autorizacion]
  contrato_api_v1:
    recurso: productos | sucursales
    metodo_path: "GET /api/v1/productos | GET /api/v1/sucursales"
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
  criterios_aceptacion: ["Actualizar tests de productos/sucursales al sobre paginado", "Paginar sin repetir/omitir", "total cotejado con COUNT y filtros", "400 invalidos", "sin regresiones en la suite completa", "lint + build verdes"]
  evidencia_requerida: "npm test en la raiz + reporte APROBADO/RECHAZADO con evidencia"
```