# Tareas — Listado y consulta de facturas (listado-facturas-001)

## T-001 — Backend: GET /api/v1/facturas (listado paginado y filtrable)
```yaml
T-001:
  spec: specs/listado-facturas-001/spec.md
  objetivo: Listar las facturas de la empresa del token, paginadas y filtrables.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**, server/controladores/**, server/rutas/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql]
  contrato_api_v1:
    recurso: factura
    metodo_path: "GET /api/v1/facturas"
    request:
      pagina: { tipo: integer, obligatorio: false, validacion: ">=1, default 1, 0/decimal/texto -> 400" }
      por_pagina: { tipo: integer, obligatorio: false, validacion: "1..100, default 10, fuera -> 400" }
      sucursal_id: { tipo: integer, obligatorio: false, validacion: ">0; solo filtro" }
      estado: { tipo: string, obligatorio: false, validacion: "emitida|anulada; otro -> 400" }
      desde: { tipo: ISO date, obligatorio: false, validacion: "fecha válida" }
      hasta: { tipo: ISO date, obligatorio: false, validacion: "fecha válida" }
      buscar: { tipo: string, obligatorio: false, validacion: "<=150; numero_factura o cliente_nombre; comodines escapados" }
    data: { items: "FacturaResumen[]", pagina: integer, por_pagina: integer, total: integer, total_paginas: integer }
    codigos: [200, 400, 401, 403, 500]
    sobre: '{ "success": true, "data": { items, pagina, por_pagina, total, total_paginas } } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint/integer -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id desde el token (JOIN sucursal); NUNCA del body/query"
    roles: [administrador]
  criterios_aceptacion: ["sobre paginado exacto; orden fecha DESC, id DESC", "total = COUNT con los mismos filtros", "400 en pagina/por_pagina/estado/sucursal_id/fechas inválidos", "IDOR: empresa_id falso ignorado", "superadmin -> 403"]
  evidencia_requerida: "HTTP real: default 1/10, filtros combinados, 400 inválidos, 403 superadmin"
```

## T-002 — Backend: GET /api/v1/facturas/:id (detalle con líneas)
```yaml
T-002:
  spec: specs/listado-facturas-001/spec.md
  objetivo: Consultar una factura con su encabezado, sucursal, totales y líneas.
  capa: server
  alcance:
    permite: [server/repositorios/**, server/servicios/**, server/controladores/**, server/rutas/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql]
  contrato_api_v1:
    recurso: factura
    metodo_path: "GET /api/v1/facturas/:id"
    request: { id: { tipo: integer, obligatorio: true, validacion: "solo dígitos, entero seguro >0; si no -> 400" } }
    data: { factura: "FacturaDetalle con detalles[] (producto_codigo, producto_nombre, totales)" }
    codigos: [200, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": { factura } } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint/integer -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "factura ajena/inexistente -> 404 (JOIN sucursal por empresa_id del token)"
    roles: [administrador]
  criterios_aceptacion: ["200 con detalles ordenados id ASC", "404 ajena/inexistente", "400 :id inválido (0/negativo/abc/fuera de bigint) nunca 500", "401/403", "numeric -> Number"]
  evidencia_requerida: "HTTP real: detalle multi-línea, 404 ajena, 400 id inválido"
```

## T-003 — Frontend: página Facturación con listado paginado y filtros
```yaml
T-003:
  spec: specs/listado-facturas-001/spec.md
  objetivo: Ver el histórico de facturas paginado y filtrable desde el panel.
  capa: client
  alcance:
    permite: [client/src/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: factura
    metodo_path: "GET /api/v1/facturas"
    request: { pagina: integer, por_pagina: integer, sucursal_id: integer, estado: string, desde: ISO, hasta: ISO, buscar: string }
    data: { items: "FacturaResumen[]", pagina, por_pagina, total, total_paginas }
    codigos: [200, 400, 401, 403, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "Bearer automático; no enviar empresa_id"
    roles: [administrador]
  criterios_aceptacion: ["sección Facturación activa en el panel", "tabla + tarjetas móvil con Paginacion (5/10/15/20) y reset a página 1 al filtrar", "filtros sucursal/estado/fechas/buscar", "estados carga/error/vacío", "dinero con formatearMoneda y contadores con formatearNumero", "celdas que recortan (sin solapamiento)", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client && npm run build --prefix client"
```

## T-004 — Frontend: detalle de factura y anulación desde el histórico
```yaml
T-004:
  spec: specs/listado-facturas-001/spec.md
  objetivo: Consultar el tique histórico y anular facturas emitidas antiguas.
  capa: client
  alcance:
    permite: [client/src/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: factura
    metodo_path: "GET /api/v1/facturas/:id | PATCH /api/v1/facturas/:id/anular"
    request: {}
    data: { factura: "FacturaDetalle con detalles[] y estado" }
    codigos: [200, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": { factura } } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a (la anulación es transaccional en el backend SD-007)
    afecta_stock: true
    multi_tenant: "Bearer automático"
    roles: [administrador]
  criterios_aceptacion: ["detalle con sucursal, cliente, líneas y totales", "botón 'Anular venta' con confirmación de 2 pasos solo si estado=emitida", "reutiliza anularFactura existente", "tras anular refleja estado y actualiza el listado", "409/errores con mensaje legible y reconciliación", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client && npm run build --prefix client"
```

## T-005 — QA: verificación independiente de SD-009
```yaml
T-005:
  spec: specs/listado-facturas-001/spec.md
  objetivo: Verificar listado, detalle, filtros, paginación, seguridad y regresión.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env]
  contrato_api_v1:
    recurso: factura
    metodo_path: "GET /api/v1/facturas | GET /api/v1/facturas/:id"
    request: { pagina: integer, por_pagina: integer, sucursal_id: integer, estado: string, desde: ISO, hasta: ISO, buscar: string, id: integer }
    data: { items: "FacturaResumen[]", pagina, por_pagina, total, total_paginas; factura: "FacturaDetalle" }
    codigos: [200, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "factura ajena -> 404; empresa_id falso ignorado; superadmin -> 403"
    roles: [administrador]
  criterios_aceptacion: ["defaults 1/10 y sobre exacto", "filtros combinados y total con COUNT", "400 en pagina/por_pagina/estado/sucursal_id/fechas inválidos", "detalle con detalles ordenados; 404 ajena; 400 id inválido", "401/403", "IDOR (empresa_id falso)", "sin regresión en POST /facturas ni PATCH /anular", "lint + build verdes"]
  evidencia_requerida: "npm test en la raíz + reporte APROBADO/RECHAZADO con Fallos/Faltantes/Riesgos"
```
