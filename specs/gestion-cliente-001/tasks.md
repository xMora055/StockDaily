# Tareas — Gestión de clientes (gestion-cliente-001)

> Orden por dependencia. El backend va primero (recurso nuevo); el POS (T-005) depende del backend.

## T-001 — Backend: GET /api/v1/clientes (listado paginado y filtrable)
```yaml
T-001:
  spec: specs/gestion-cliente-001/spec.md
  objetivo: Listar los clientes de las sucursales de la empresa del token, paginados y filtrables.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**, server/controladores/**, server/rutas/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql]
  contrato_api_v1:
    recurso: cliente
    metodo_path: "GET /api/v1/clientes"
    request:
      pagina: { tipo: integer, obligatorio: false, validacion: ">=1, default 1, 0/decimal/texto -> 400" }
      por_pagina: { tipo: integer, obligatorio: false, validacion: "1..100, default 10, fuera -> 400" }
      sucursal_id: { tipo: integer, obligatorio: false, validacion: ">0; solo filtro" }
      activo: { tipo: boolean, obligatorio: false, validacion: "true|false" }
      buscar: { tipo: string, obligatorio: false, validacion: "<=150; nombre o documento; comodines escapados" }
    data: { items: "Cliente[]", pagina: integer, por_pagina: integer, total: integer, total_paginas: integer }
    codigos: [200, 400, 401, 403, 500]
    sobre: '{ "success": true, "data": { items, pagina, por_pagina, total, total_paginas } } | { "success": false, "error": "..." }'
    casteo: [bigint/integer -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id desde el token (JOIN sucursal); NUNCA del body/query"
    roles: [administrador]
  criterios_aceptacion: ["sobre paginado exacto; orden nombre ASC, id ASC", "cada item incluye sucursal_nombre", "total = COUNT con los mismos filtros", "400 en pagina/por_pagina/sucursal_id/activo invalidos", "IDOR: empresa_id falso ignorado", "superadmin -> 403"]
  evidencia_requerida: "HTTP real: defaults 1/10, filtros combinados, 400 invalidos, 403 superadmin"
```

## T-002 — Backend: POST/GET:id/PATCH + registro de ruta
```yaml
T-002:
  spec: specs/gestion-cliente-001/spec.md
  objetivo: Crear, consultar y editar clientes por sucursal con unicidad de documento y aislamiento multi-tenant.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**, server/controladores/**, server/rutas/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql]
  contrato_api_v1:
    recurso: cliente
    metodo_path: "POST /api/v1/clientes | GET /api/v1/clientes/:id | PATCH /api/v1/clientes/:id"
    request:
      sucursal_id: { tipo: integer, obligatorio: true_en_post, validacion: ">0; debe pertenecer a la empresa -> 404" }
      nombre: { tipo: string, obligatorio: true, validacion: "<=150, no vacio" }
      documento: { tipo: string|null, obligatorio: false, validacion: "<=30; unico por sucursal -> 409; NULL permitido multiples" }
      telefono: { tipo: string|null, obligatorio: false, validacion: "<=30" }
      correo: { tipo: string|null, obligatorio: false, validacion: "<=150, formato basico si viene" }
      direccion: { tipo: string|null, obligatorio: false, validacion: "<=200" }
      activo: { tipo: boolean, obligatorio: false, validacion: "solo PATCH" }
      id: { tipo: integer, obligatorio: true_en_get_patch, validacion: "solo digitos, entero seguro >0; si no -> 400" }
    data: { cliente: "Cliente" }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": { cliente } } | { "success": false, "error": "..." }'
    casteo: [bigint/integer -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "sucursal referida y cliente buscado SIEMPRE acotados a empresa_id del token; sucursal_id en PATCH se ignora"
    roles: [administrador]
  criterios_aceptacion: ["POST 201 con Cliente y sucursal_nombre", "documento duplicado misma sucursal -> 409; documento NULL repetido -> permitido", "mismo documento en sucursal distinta -> permitido", "sucursal ajena/inexistente -> 404", "GET:id 404 ajena/inexistente y 400 id invalido (nunca 500)", "PATCH edita campos y activo; sin campos -> 400; sucursal_id ignorado", "23505->409 y 22003->400", "401 sin token, 403 superadmin"]
  evidencia_requerida: "HTTP real: crear, duplicado 409, sucursal ajena 404, id invalido 400, patch activo, IDOR"
```

## T-003 — Frontend: página Clientes (listado, filtros y paginación)
```yaml
T-003:
  spec: specs/gestion-cliente-001/spec.md
  objetivo: Ver y filtrar los clientes de la empresa desde el panel.
  capa: client
  alcance:
    permite: [client/src/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: cliente
    metodo_path: "GET /api/v1/clientes"
    request: { pagina: integer, por_pagina: integer, sucursal_id: integer, activo: boolean, buscar: string }
    data: { items: "Cliente[]", pagina, por_pagina, total, total_paginas }
    codigos: [200, 400, 401, 403, 500]
    sobre: '{ "success": true, "data": { items, pagina, por_pagina, total, total_paginas } } | { "success": false, "error": "..." }'
    casteo: [bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "Bearer automatico; no enviar empresa_id"
    roles: [administrador]
  criterios_aceptacion: ["RUTA_CLIENTES en constantes", "servicios/clientes.js normaliza paginado y Cliente", "hook con reset a pagina 1 al filtrar/cambiar tamano", "FiltrosClientes (sucursal/estado/buscar) y ClientesTabla con Paginacion (5/10/15/20) y tarjetas movil", "estados carga/error/vacio; contadores con formatearNumero", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client; npm run build --prefix client"
```

## T-004 — Frontend: formulario, acciones y navegación
```yaml
T-004:
  spec: specs/gestion-cliente-001/spec.md
  objetivo: Crear/editar clientes y activarlos/desactivarlos; habilitar la sección en el panel.
  capa: client
  alcance:
    permite: [client/src/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: cliente
    metodo_path: "POST /api/v1/clientes | PATCH /api/v1/clientes/:id"
    request:
      sucursal_id: { tipo: integer, obligatorio: true_en_post, validacion: "select de sucursales" }
      nombre: { tipo: string, obligatorio: true }
      documento: { tipo: string|null, obligatorio: false }
      telefono: { tipo: string|null, obligatorio: false }
      correo: { tipo: string|null, obligatorio: false }
      direccion: { tipo: string|null, obligatorio: false }
      activo: { tipo: boolean, obligatorio: false, validacion: "solo PATCH" }
    data: { cliente: "Cliente" }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": { cliente } } | { "success": false, "error": "..." }'
    casteo: [bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["FormularioCliente con validacion local (nombre, longitudes, correo) y errores del backend en linea", "409/404/400 con mensaje legible", "activar/desactivar con confirmacion de 2 pasos y recarga del listado", "seccion 'Clientes' en ArmazonPanel y App.jsx", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client; npm run build --prefix client"
```

## T-005 — Frontend: selector de cliente registrado en el POS
```yaml
T-005:
  spec: specs/gestion-cliente-001/spec.md
  objetivo: Asociar un cliente registrado a la venta enviando cliente_id + snapshot.
  capa: client
  alcance:
    permite: [client/src/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: factura
    metodo_path: "POST /api/v1/facturas"
    request: { cliente_id: "integer|null", cliente_nombre: "string|null", cliente_documento: "string|null" }
    data: { id: integer, numero_factura: integer, total: number }
    codigos: [200, 201, 400, 401, 403, 500]
    sobre: '{ "success": true, "data": { id, numero_factura, total } } | { "success": false, "error": "..." }'
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: "la maneja el backend (SD-006), sin cambios"
    afecta_stock: true
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["SelectorCliente con clientes activos de la sucursal elegida (por_pagina=100, activo=true) y opcion consumidor final", "al elegir cliente: autocompleta nombre/documento y envia cliente_id", "consumidor final: cliente_id null y texto libre operativo", "cambiar de sucursal limpia el cliente y recarga opciones", "sin clientes: no bloquea la venta", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client; npm run build --prefix client"
```

## T-006 — QA: verificación independiente de SD-004
```yaml
T-006:
  spec: specs/gestion-cliente-001/spec.md
  objetivo: Verificar CRUD de clientes, multi-tenant, unicidad, paginacion y sin regresion del POS.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env]
  contrato_api_v1:
    recurso: cliente
    metodo_path: "GET/POST /api/v1/clientes | GET/PATCH /api/v1/clientes/:id"
    request: { pagina: integer, por_pagina: integer, sucursal_id: integer, activo: boolean, buscar: string, id: integer, nombre: string, documento: string }
    data: { items: "Cliente[]", pagina, por_pagina, total, total_paginas; cliente: "Cliente" }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint/integer -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "cliente/sucursal ajena -> 404; empresa_id falso ignorado; superadmin -> 403"
    roles: [administrador]
  criterios_aceptacion: ["defaults 1/10 y sobre exacto; orden y total", "documento duplicado misma sucursal 409; NULL repetido OK; mismo documento otra sucursal OK", "sucursal ajena 404; id invalido 400 (nunca 500)", "PATCH edita/activa y 409; sin campos 400", "IDOR con token de otra empresa", "401/403", "sin regresion en POST /facturas", "lint + build verdes"]
  evidencia_requerida: "npm test en la raiz + reporte APROBADO/RECHAZADO con Fallos/Faltantes/Riesgos"
```
