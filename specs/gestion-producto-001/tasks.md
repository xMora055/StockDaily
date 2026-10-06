# Tareas — Gestión de productos (gestion-producto-001)

Orden por dependencia. Cada tarea es atómica (20–30 min).

## T-001 — Backend: modelo de datos y reglas (repositorio + servicio + validaciones)
```yaml
T-001:
  spec: specs/gestion-producto-001/spec.md
  objetivo: Implementar la capa de datos y reglas del CRUD de productos por empresa.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql sin autorización]
  contrato_api_v1:
    recurso: producto
    metodo_path: "n/a (capa interna)"
    request: { codigo: { tipo: string, obligatorio: true, max: 50 }, nombre: { tipo: string, obligatorio: true, max: 150 }, precio_unitario: { tipo: number, obligatorio: false, default: 0, min: 0 }, impuesto_porcentaje: { tipo: number, obligatorio: false, default: 0, min: 0, max: 100 }, categoria_id: { tipo: int, obligatorio: false } }
    data: { id: number, codigo: string, nombre: string, descripcion: string|null, precio_unitario: number, impuesto_porcentaje: number, categoria_id: number|null, activo: boolean }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    casteo: [numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id desde req.usuario, NUNCA del body/query"
    roles: [administrador]
  criterios_aceptacion: ["Unicidad (empresa_id, codigo) -> 409", "Categoria de otra empresa -> 400", "Borrado logico con activo=false", "Casteo numeric -> Number"]
  evidencia_requerida: "Pruebas de endpoint o consulta directa; el servicio no rompe con categoria_id nulo"
```

## T-002 — Backend: rutas, controlador y montaje bajo /api/v1
```yaml
T-002:
  spec: specs/gestion-producto-001/spec.md
  objetivo: Exponer GET/POST/GET:id/PATCH /api/v1/productos con auth y rol.
  capa: server
  alcance:
    permite: [server/rutas/**, server/controladores/**]
    prohibe: [server/validaciones/**, server/repositorios/**, server/servicios/**, client/**, .env]
  contrato_api_v1:
    recurso: producto
    metodo_path: "GET /api/v1/productos | POST /api/v1/productos | GET /api/v1/productos/:id | PATCH /api/v1/productos/:id"
    request: { ver plan.md }
    data: { producto: Producto }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id desde el token"
    roles: [administrador]
  criterios_aceptacion: ["Router montado en rutas/index.js", "auth + autorizacion('administrador') + validarEntrada", "Errores via ErrorApp/manejadorErrores", "Sobre JSON sin campos raiz extra"]
  evidencia_requerida: "GET /api/v1/salud OK y llamadas con/sin token verificadas"
```

## T-003 — Frontend: servicio, hook y formateo de moneda
```yaml
T-003:
  spec: specs/gestion-producto-001/spec.md
  objetivo: Encapsular el consumo del contrato y preparar estado/formato.
  capa: client
  alcance:
    permite: [client/src/servicios/**, client/src/hooks/**, client/src/utilidades/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: producto
    metodo_path: "GET/POST/GET:id/PATCH /api/v1/productos"
    request: { ver plan.md }
    data: { producto: Producto } | [ Producto ]
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: 'clienteApi.js desempaqueta el sobre y devuelve data'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "el Bearer lo adjunta api/clienteApi.js"
    roles: [administrador]
  criterios_aceptacion: ["Servicios usan api/clienteApi.js y constantes", "Hook expone datos, cargando, error y recargar", "formatoMoneda.js con Intl.NumberFormat", "Sin fetch en componentes"]
  evidencia_requerida: "npm run lint --prefix client"
```

## T-004 — Frontend: pagina Productos (listar, crear, editar, activar/desactivar)
```yaml
T-004:
  spec: specs/gestion-producto-001/spec.md
  objetivo: UI de gestion de productos con estados completos y acceso desde Inicio.
  capa: client
  alcance:
    permite: [client/src/paginas/**, client/src/componentes/**, client/src/App.jsx, client/src/paginas/Inicio.jsx]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: producto
    metodo_path: "GET/POST/GET:id/PATCH /api/v1/productos"
    request: { ver plan.md }
    data: { producto: Producto }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    casteo: [numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["Tabla con estados carga/error/vacio", "Formulario crear/editar con validacion y mensajes en espanol", "Activar/desactivar sin DELETE", "Diseno 'papel de caja' (cargar skills impeccable + ui-ux-pro-max)", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client && npm run build --prefix client"
```

## T-005 — QA: verificacion independiente de SD-003
```yaml
T-005:
  spec: specs/gestion-producto-001/spec.md
  objetivo: Verificar contrato, multi-tenant, validaciones y UI.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env, scripts test de package.json sin autorizacion]
  contrato_api_v1:
    recurso: producto
    metodo_path: "GET/POST/GET:id/PATCH /api/v1/productos"
    request: { ver plan.md }
    data: { producto: Producto }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "test IDOR: empresa_id falso en body/query se ignora"
    roles: [administrador]
  criterios_aceptacion: ["Caso feliz 201", "400 validaciones", "401 sin token", "403 rol no autorizado", "409 duplicado", "404 ajeno", "numeric es Number", "lint + build verdes"]
  evidencia_requerida: "npm test en la raiz (node --test) + reporte APROBADO/RECHAZADO con evidencia"
```