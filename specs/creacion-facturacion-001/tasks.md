# Tareas — POS registrar venta (creacion-facturacion-001)

Orden por dependencia. Cada tarea es atomica (20-30 min).

## T-001 — Backend: validaciones, repositorio y servicio transaccional
```yaml
T-001:
  spec: specs/creacion-facturacion-001/spec.md
  objetivo: Implementar el servicio transaccional de venta y su persistencia.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql sin autorizacion]
  contrato_api_v1:
    recurso: factura
    metodo_path: "POST /api/v1/facturas"
    request: { sucursal_id: int, metodo_pago_id: "int|null", cliente_id: "int|null", cliente_nombre: "string|null", cliente_documento: "string|null", descuento: number, lineas: [ { producto_id: int, cantidad: int, descuento_porcentaje: number } ] }
    data: { factura: Factura }
    codigos: [201, 400, 401, 403, 404, 500]
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: enTransaccion
    afecta_stock: true
    multi_tenant: "empresa_id desde req.usuario, NUNCA del body/query"
    roles: [administrador]
  criterios_aceptacion: ["Cabecera+detalle+movimiento en la MISMA transaccion", "total = subtotal - descuento + impuesto y >= 0", "Productos inactivos/ajenos -> 400", "Duplicado de producto -> 400", "Snapshot de precio/impuesto", "ROLLBACK ante fallo"]
  evidencia_requerida: "Venta e2e contra Supabase + prueba de rollback"
```

## T-002 — Backend: rutas y controlador bajo /api/v1
```yaml
T-002:
  spec: specs/creacion-facturacion-001/spec.md
  objetivo: Exponer POST /api/v1/facturas con auth y rol.
  capa: server
  alcance:
    permite: [server/rutas/**, server/controladores/**]
    prohibe: [server/validaciones/**, server/repositorios/**, server/servicios/**, client/**, .env]
  contrato_api_v1:
    recurso: factura
    metodo_path: "POST /api/v1/facturas"
    request: { ver plan.md }
    data: { factura: Factura }
    codigos: [201, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: enTransaccion (en el servicio)
    afecta_stock: true
    multi_tenant: "empresa_id desde el token"
    roles: [administrador]
  criterios_aceptacion: ["Router montado en rutas/index.js", "autenticacion + autorizacion('administrador') + validarEntrada", "Errores via ErrorApp/manejadorErrores", "Sobre JSON sin campos raiz extra"]
  evidencia_requerida: "GET /api/v1/salud OK y POST verificado con/sin token"
```

## T-003 — Frontend: servicio y hook del POS
```yaml
T-003:
  spec: specs/creacion-facturacion-001/spec.md
  objetivo: Encapsular crearFactura y la logica del carrito/totales.
  capa: client
  alcance:
    permite: [client/src/servicios/**, client/src/hooks/**, client/src/utilidades/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: factura
    metodo_path: "POST /api/v1/facturas"
    request: { ver plan.md }
    data: { factura: Factura }
    codigos: [201, 400, 401, 403, 404, 500]
    sobre: 'clienteApi.js desempaqueta el sobre y devuelve data'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a (la maneja backend)
    afecta_stock: true
    multi_tenant: "el Bearer lo adjunta api/clienteApi.js"
    roles: [administrador]
  criterios_aceptacion: ["Servicios usan api/clienteApi.js y constantes", "Carrito consolida productos repetidos", "Totales calculados coinciden con el backend", "Sin fetch en componentes"]
  evidencia_requerida: "npm run lint --prefix client"
```

## T-004 — Frontend: pagina Punto de venta
```yaml
T-004:
  spec: specs/creacion-facturacion-001/spec.md
  objetivo: UI de POS con busqueda, carrito, descuentos y envio.
  capa: client
  alcance:
    permite: [client/src/paginas/**, client/src/componentes/**, client/src/App.jsx]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: factura
    metodo_path: "POST /api/v1/facturas"
    request: { ver plan.md }
    data: { factura: Factura }
    codigos: [201, 400, 401, 403, 404, 500]
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: true
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["Seleccion de sucursal activa", "Busqueda de productos activos", "Carrito con cantidad y descuento por linea", "Descuento global y resumen de totales", "Estados carga/error/vacio y exito con numero_factura", "Diseno 'papel de caja'", "Habilitar 'Punto de venta' en el panel", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client && npm run build --prefix client"
```

## T-005 — QA: verificacion independiente de SD-006
```yaml
T-005:
  spec: specs/creacion-facturacion-001/spec.md
  objetivo: Verificar contrato, transaccion/rollback, multi-tenant y UI.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env, scripts test de package.json sin autorizacion]
  contrato_api_v1:
    recurso: factura
    metodo_path: "POST /api/v1/facturas"
    request: { ver plan.md }
    data: { factura: Factura }
    codigos: [201, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: enTransaccion
    afecta_stock: true
    multi_tenant: "test IDOR: empresa_id falso en body/query se ignora"
    roles: [administrador]
  criterios_aceptacion: ["Venta feliz 201 con totales coherentes", "Numeracion consecutiva por sucursal", "Movimiento salida_venta por linea y stock ajustado", "ROLLBACK ante fallo", "400 validaciones e inactivos/ajenos", "401/403", "lint + build verdes"]
  evidencia_requerida: "npm test en la raiz + reporte APROBADO/RECHAZADO con evidencia"
```