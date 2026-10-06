# Plan técnico — Anulación de factura (anulacion-factura-001)

## Contrato `/api/v1` (fuente de verdad)

### PATCH /api/v1/facturas/:id/anular
- Auth: `Bearer`, rol `administrador`; empresa/usuario desde el token. Sin body.
- **200:** `{ "success": true, "data": { "factura": { "id", "numero_factura", "sucursal_id", "usuario_id", "cliente_id", "cliente_nombre", "cliente_documento", "metodo_pago_id", "estado": "anulada", "fecha", "subtotal", "descuento", "impuesto", "total", "anulada_en", "anulada_por", "detalles": [ ... ] } } }`
- **Errores:** `400` `:id` no numérico/fuera de rango; `401`; `403`; `404` factura inexistente o de otra empresa; `409` ya anulada; `500`.

## Flujo transaccional (`enTransaccion`)

1. `SELECT ... FROM factura f JOIN sucursal s ON s.id=f.sucursal_id WHERE f.id=$1 AND s.empresa_id=$2 FOR UPDATE` → si no hay fila, `404`.
2. Si `estado = 'anulada'` → `409`.
3. `UPDATE factura SET estado='anulada', anulada_en=now(), anulada_por=$usuario WHERE id=$1`.
4. Para cada `detalle_factura` de la factura: `INSERT movimiento_inventario (producto_id, sucursal_id=factura.sucursal_id, usuario_id=$usuario, factura_id=factura.id, tipo='anulacion', cantidad=+detalle.cantidad)` → el trigger sube el `stock`.
5. `COMMIT`. Devolver la factura actualizada con sus `detalles`.

Notas: `FOR UPDATE` evita doble anulación concurrente; `anulacion` es cantidad positiva; numeric/bigint → `Number`; si falla cualquier paso → ROLLBACK.

## Archivos por capa

**Backend (`/server`):**
- `rutas/facturas.js` — añadir `PATCH /:id/anular` con `autenticacion` + `autorizacion('administrador')` + validación de `:id`.
- `controladores/facturas.js` — handler `anular`.
- `servicios/facturas.js` — `anularFactura` con `enTransaccion`.
- `repositorios/facturas.js` — `buscarParaAnular(id, empresa)` (FOR UPDATE), `actualizarAnulada`, `listarDetalles`, `insertarMovimientosAnulacion`.
- `validaciones/facturas.js` — validación de `:id`.
- `POST /facturas` **no cambia**.

**Frontend (`/client`):**
- `servicios/facturas.js` — `anularFactura(id)`.
- `componentes/ReciboEmitido.jsx` — acción "Anular venta" con confirmación de dos pasos; llamada al endpoint; reflejar `estado='anulada'` (y deshabilitar la acción). Manejo de `409` (ya anulada) y errores.
- `paginas/PuntoDeVenta.jsx` — cablear el estado del recibo si aplica.

## Orden
1. Backend (transacción) y verificación HTTP.
2. Frontend (acción de anulación en el recibo).
3. QA (transacción, rollback, 409, IDOR, stock revertido) y lint/build.

## Riesgos
- **Doble anulación / carrera:** `FOR UPDATE` + chequeo de estado → 409.
- **Reversión de stock exacta:** un movimiento por línea con `+cantidad`.
- **Multi-tenant:** factura ajena → 404 sin fuga.
- **UI sin listado:** solo se anula desde el recibo recién emitido hasta SD-009.