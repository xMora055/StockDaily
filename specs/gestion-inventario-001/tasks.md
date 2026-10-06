# Tareas — Inventario (gestion-inventario-001)

## T-001 — Backend: validaciones, repositorio y servicio transaccional
```yaml
T-001:
  spec: specs/gestion-inventario-001/spec.md
  objetivo: Registrar movimientos (carga_inicial/ajuste) en una transaccion y consultar stock/movimientos.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql sin autorizacion]
  contrato_api_v1:
    recurso: inventario
    metodo_path: "POST /api/v1/inventario/movimientos | GET /api/v1/inventario/stock | GET /api/v1/inventario/movimientos"
    request: { producto_id: int, sucursal_id: int, tipo: "carga_inicial|ajuste", cantidad: int, observacion: "string|null" }
    data: { movimiento: Movimiento, stock: { producto_id, sucursal_id, cantidad } }
    codigos: [200, 201, 400, 401, 403, 404, 500]
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: enTransaccion
    afecta_stock: true
    multi_tenant: "empresa_id desde req.usuario, NUNCA del body/query"
    roles: [administrador]
  criterios_aceptacion: ["Movimiento en transaccion; stock resultante = suma de movimientos", "tipo limitado a carga_inicial/ajuste", "cantidad !=0 y |cantidad|<=1000000", "producto/sucursal de la empresa", "solo_faltantes usa vista_stock_faltante", "paginacion en stock y movimientos (pagina/por_pagina, total/total_paginas) con COUNT de los mismos filtros", "22003 -> 400"]
  evidencia_requerida: "HTTP real: carga y ajuste; stock antes/despues; rollback"
```

## T-002 — Backend: rutas y controlador bajo /api/v1
```yaml
T-002:
  spec: specs/gestion-inventario-001/spec.md
  objetivo: Exponer los endpoints de inventario con auth y rol.
  capa: server
  alcance:
    permite: [server/rutas/**, server/controladores/**]
    prohibe: [server/validaciones/**, server/repositorios/**, server/servicios/**, client/**, .env]
  contrato_api_v1:
    recurso: inventario
    metodo_path: "POST/GET /api/v1/inventario/movimientos | GET /api/v1/inventario/stock"
    request: { ver plan.md }
    data: { movimiento: Movimiento, stock: Stock } | [ Stock ] | [ Movimiento ]
    codigos: [200, 201, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: enTransaccion (en el servicio)
    afecta_stock: true
    multi_tenant: "empresa_id desde el token"
    roles: [administrador]
  criterios_aceptacion: ["Router montado en rutas/index.js", "autenticacion + autorizacion('administrador') + validarEntrada", "Errores via ErrorApp/manejadorErrores", "Sobre JSON sin campos raiz extra"]
  evidencia_requerida: "GET /api/v1/salud OK y endpoints con/sin token"
```

## T-003 — Frontend: servicios y hooks
```yaml
T-003:
  spec: specs/gestion-inventario-001/spec.md
  objetivo: Encapsular stock, movimientos y creacion de movimiento.
  capa: client
  alcance:
    permite: [client/src/servicios/**, client/src/hooks/**, client/src/utilidades/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: inventario
    metodo_path: "POST/GET /api/v1/inventario/movimientos | GET /api/v1/inventario/stock"
    request: { ver plan.md }
    data: { movimiento: Movimiento, stock: Stock } | [ Stock ] | [ Movimiento ]
    codigos: [200, 201, 400, 401, 403, 404, 500]
    sobre: 'clienteApi.js desempaqueta el sobre y devuelve data'
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: n/a (la maneja backend)
    afecta_stock: true
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["Servicios usan api/clienteApi.js y constantes", "Hooks exponen datos/cargando/error/recargar", "Sin fetch en componentes"]
  evidencia_requerida: "npm run lint --prefix client"
```

## T-004 — Frontend: pagina Inventario
```yaml
T-004:
  spec: specs/gestion-inventario-001/spec.md
  objetivo: UI de inventario (existencias, registro de movimiento e historial).
  capa: client
  alcance:
    permite: [client/src/paginas/**, client/src/componentes/**, client/src/App.jsx]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: inventario
    metodo_path: "POST/GET /api/v1/inventario/movimientos | GET /api/v1/inventario/stock"
    request: { ver plan.md }
    data: { movimiento: Movimiento, stock: Stock }
    codigos: [200, 201, 400, 401, 403, 404, 500]
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: true
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["Tabla de existencias con filtros (sucursal, buscar, solo faltantes)", "**Paginacion** en existencias y movimientos (Anterior/Siguiente, 'Pagina X de Y', total; por_pagina; reset a pagina 1 al cambiar filtros)", "Resaltar faltantes (cantidad < 0)", "Formulario de movimiento (producto, sucursal, tipo, entrada/salida, cantidad, observacion)", "Historial de movimientos paginado", "Cantidades con formatearNumero", "Estados carga/error/vacio", "Habilitar 'Inventario' en el panel", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client && npm run build --prefix client"
```

## T-005 — QA: verificacion independiente
```yaml
T-005:
  spec: specs/gestion-inventario-001/spec.md
  objetivo: Verificar contrato, transaccion, IDOR, filtros y UI.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env, scripts test de package.json sin autorizacion]
  contrato_api_v1:
    recurso: inventario
    metodo_path: "POST/GET /api/v1/inventario/movimientos | GET /api/v1/inventario/stock"
    request: { ver plan.md }
    data: { movimiento: Movimiento, stock: Stock }
    codigos: [200, 201, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: enTransaccion
    afecta_stock: true
    multi_tenant: "test IDOR: empresa_id falso en body/query se ignora"
    roles: [administrador]
  criterios_aceptacion: ["carga_inicial y ajuste 201; stock = suma de movimientos", "400 tipo invalido/cantidad 0 o fuera de cota", "401/403", "404 producto/sucursal ajena", "GET stock con filtros, solo_faltantes y paginacion (total/total_paginas correctos)", "GET movimientos con filtros y paginacion", "400 con pagina/por_pagina invalidos", "rollback ante fallo (sin movimiento ni cambio de stock)", "lint + build verdes"]
  evidencia_requerida: "npm test en la raiz + reporte APROBADO/RECHAZADO con evidencia"
```