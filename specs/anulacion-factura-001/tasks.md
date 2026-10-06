# Tareas — Anulación de factura (anulacion-factura-001)

## T-001 — Backend: servicio transaccional de anulacion
```yaml
T-001:
  spec: specs/anulacion-factura-001/spec.md
  objetivo: Anular una factura emitida y revertir su stock en una transaccion.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql sin autorizacion]
  contrato_api_v1:
    recurso: factura
    metodo_path: "PATCH /api/v1/facturas/:id/anular"
    request: {}
    data: { factura: FacturaAnulada }
    codigos: [200, 400, 401, 403, 404, 409, 500]
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: enTransaccion
    afecta_stock: true
    multi_tenant: "empresa_id desde req.usuario; factura ajena -> 404"
    roles: [administrador]
  criterios_aceptacion: ["FOR UPDATE + estado=emitida; ya anulada -> 409", "UPDATE factura (anulada_en/anulada_por)", "movimiento anulacion (+cantidad) por linea; stock revertido", "ROLLBACK ante fallo", "id invalido -> 400"]
  evidencia_requerida: "HTTP real: anular, stock revertido, 409 al reintentar, rollback"
```

## T-002 — Backend: ruta y controlador
```yaml
T-002:
  spec: specs/anulacion-factura-001/spec.md
  objetivo: Exponer PATCH /api/v1/facturas/:id/anular con auth y rol.
  capa: server
  alcance:
    permite: [server/rutas/**, server/controladores/**]
    prohibe: [server/validaciones/**, server/repositorios/**, server/servicios/**, client/**, .env]
  contrato_api_v1:
    recurso: factura
    metodo_path: "PATCH /api/v1/facturas/:id/anular"
    request: {}
    data: { factura: FacturaAnulada }
    codigos: [200, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: enTransaccion (en el servicio)
    afecta_stock: true
    multi_tenant: "empresa_id desde el token"
    roles: [administrador]
  criterios_aceptacion: ["Ruta anadida sin romper POST /facturas", "autenticacion + autorizacion('administrador')", "Errores via ErrorApp/manejadorErrores"]
  evidencia_requerida: "PATCH con/sin token; 404 ajena; 409 repetida"
```

## T-003 — Frontend: accion de anulacion en el recibo
```yaml
T-003:
  spec: specs/anulacion-factura-001/spec.md
  objetivo: Permitir anular la venta recien emitida desde el recibo.
  capa: client
  alcance:
    permite: [client/src/servicios/**, client/src/componentes/**, client/src/paginas/**, client/src/hooks/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: factura
    metodo_path: "PATCH /api/v1/facturas/:id/anular"
    request: {}
    data: { factura: FacturaAnulada }
    codigos: [200, 400, 401, 403, 404, 409, 500]
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: true
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["ReciboEmitido con 'Anular venta' + confirmacion de 2 pasos", "Reflejar estado anulada y deshabilitar la accion", "Manejar 409/errores con mensaje", "Diseno 'papel de caja'", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client && npm run build --prefix client"
```

## T-004 — QA: verificacion independiente de SD-007
```yaml
T-004:
  spec: specs/anulacion-factura-001/spec.md
  objetivo: Verificar anulacion, reversion de stock, transaccion e IDOR.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env, scripts test de package.json sin autorizacion]
  contrato_api_v1:
    recurso: factura
    metodo_path: "PATCH /api/v1/facturas/:id/anular"
    request: {}
    data: { factura: FacturaAnulada }
    codigos: [200, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: enTransaccion
    afecta_stock: true
    multi_tenant: "factura ajena -> 404; empresa_id falso ignorado"
    roles: [administrador]
  criterios_aceptacion: ["Anular 200 con estado/anulada_en/anulada_por", "stock revertido = previo + cantidades", "movimiento anulacion por linea", "409 al reintentar", "404 ajena", "400 id invalido", "401/403", "rollback ante fallo", "lint + build verdes"]
  evidencia_requerida: "npm test en la raiz + reporte APROBADO/RECHAZADO con evidencia"
```