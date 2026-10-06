# Tareas — Gestión de sucursales (gestion-sucursal-001)

Orden por dependencia. Cada tarea es atómica (20–30 min).

## T-001 — Backend: repositorio, servicio y validaciones
```yaml
T-001:
  spec: specs/gestion-sucursal-001/spec.md
  objetivo: Implementar la capa de datos y reglas del CRUD de sucursales por empresa.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql sin autorizacion]
  contrato_api_v1:
    recurso: sucursal
    metodo_path: "n/a (capa interna)"
    request: { nombre: { tipo: string, obligatorio: true, max: 150 }, direccion: { tipo: string, obligatorio: false, max: 200 }, telefono: { tipo: string, obligatorio: false, max: 30 } }
    data: { id: number, nombre: string, direccion: string|null, telefono: string|null, activo: boolean }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    casteo: [bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id desde req.usuario, NUNCA del body/query"
    roles: [administrador]
  criterios_aceptacion: ["Unicidad (empresa_id, nombre) -> 409", "Borrado logico con activo=false", "Casteo bigint -> Number", "direccion/telefono vacios -> null"]
  evidencia_requerida: "Pruebas de endpoint o consulta directa"
```

## T-002 — Backend: rutas, controlador y montaje bajo /api/v1
```yaml
T-002:
  spec: specs/gestion-sucursal-001/spec.md
  objetivo: Exponer GET/POST/GET:id/PATCH /api/v1/sucursales con auth y rol.
  capa: server
  alcance:
    permite: [server/rutas/**, server/controladores/**]
    prohibe: [server/validaciones/**, server/repositorios/**, server/servicios/**, client/**, .env]
  contrato_api_v1:
    recurso: sucursal
    metodo_path: "GET /api/v1/sucursales | POST /api/v1/sucursales | GET /api/v1/sucursales/:id | PATCH /api/v1/sucursales/:id"
    request: { ver plan.md }
    data: { sucursal: Sucursal }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id desde el token"
    roles: [administrador]
  criterios_aceptacion: ["Router montado en rutas/index.js", "autenticacion + autorizacion('administrador') + validarEntrada", "Errores via ErrorApp/manejadorErrores", "Sobre JSON sin campos raiz extra"]
  evidencia_requerida: "GET /api/v1/salud OK y llamadas con/sin token verificadas"
```

## T-003 — Frontend: servicio, hook y navegación
```yaml
T-003:
  spec: specs/gestion-sucursal-001/spec.md
  objetivo: Encapsular el consumo del contrato y exponer la seccion Sucursales.
  capa: client
  alcance:
    permite: [client/src/servicios/**, client/src/hooks/**, client/src/utilidades/**, client/src/componentes/ArmazonPanel.jsx, client/src/App.jsx]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: sucursal
    metodo_path: "GET/POST/GET:id/PATCH /api/v1/sucursales"
    request: { ver plan.md }
    data: { sucursal: Sucursal } | [ Sucursal ]
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: 'clienteApi.js desempaqueta el sobre y devuelve data'
    casteo: [bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "el Bearer lo adjunta api/clienteApi.js"
    roles: [administrador]
  criterios_aceptacion: ["Servicios usan api/clienteApi.js", "Hook expone datos, cargando, error y recargar", "Seccion Sucursales agregada al panel", "Sin fetch en componentes"]
  evidencia_requerida: "npm run lint --prefix client"
```

## T-004 — Frontend: pagina Sucursales
```yaml
T-004:
  spec: specs/gestion-sucursal-001/spec.md
  objetivo: UI de gestion de sucursales con estados completos.
  capa: client
  alcance:
    permite: [client/src/paginas/**, client/src/componentes/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: sucursal
    metodo_path: "GET/POST/GET:id/PATCH /api/v1/sucursales"
    request: { ver plan.md }
    data: { sucursal: Sucursal }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    casteo: [bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["Tabla responsive (patron table-fixed/colgroup) con estados carga/error/vacio", "Formulario crear/editar con validacion y mensajes en espanol", "Activar/desactivar sin DELETE", "Diseno 'papel de caja'", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client && npm run build --prefix client"
```

## T-005 — QA: verificacion independiente de SD-001
```yaml
T-005:
  spec: specs/gestion-sucursal-001/spec.md
  objetivo: Verificar contrato, multi-tenant, validaciones y UI.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env, scripts test de package.json sin autorizacion]
  contrato_api_v1:
    recurso: sucursal
    metodo_path: "GET/POST/GET:id/PATCH /api/v1/sucursales"
    request: { ver plan.md }
    data: { sucursal: Sucursal }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "test IDOR: empresa_id falso en body/query se ignora"
    roles: [administrador]
  criterios_aceptacion: ["Caso feliz 201", "400 validaciones", "401 sin token", "403 rol", "409 duplicado", "404 ajeno", "id es Number", "lint + build verdes"]
  evidencia_requerida: "npm test en la raiz + reporte APROBADO/RECHAZADO con evidencia"
```