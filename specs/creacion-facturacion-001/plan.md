# Plan técnico — POS registrar venta (creacion-facturacion-001)

## Contrato `/api/v1` (fuente de verdad)

### POST /api/v1/facturas
Auth: `Authorization: Bearer <token>`, rol `administrador`. Usuario y empresa desde el token.

**Request:**
```json
{
  "sucursal_id": 1,
  "metodo_pago_id": null,
  "cliente_id": null,
  "cliente_nombre": null,
  "cliente_documento": null,
  "descuento": 0,
  "lineas": [
    { "producto_id": 1, "cantidad": 2, "descuento_porcentaje": 0 }
  ]
}
```
- `sucursal_id`: int obligatorio (de la empresa).
- `metodo_pago_id`: int | null (opcional).
- `cliente_id`: int | null (opcional; si viene, de la empresa).
- `cliente_nombre` (max 150) / `cliente_documento` (max 30): string | null (opcionales, snapshot).
- `descuento`: number | null, default 0, `>= 0` (monto absoluto).
- `lineas`: array obligatorio, `>= 1`; `producto_id` int, `cantidad` int `> 0`, `descuento_porcentaje` number `0..100` (default 0); sin `producto_id` repetido.

**201:**
```json
{
  "success": true,
  "data": {
    "factura": {
      "id": 10,
      "numero_factura": 1,
      "sucursal_id": 1,
      "usuario_id": 3,
      "cliente_id": null,
      "cliente_nombre": null,
      "cliente_documento": null,
      "metodo_pago_id": null,
      "estado": "emitida",
      "fecha": "2026-10-05T00:00:00.000Z",
      "subtotal": 2000,
      "descuento": 0,
      "impuesto": 380,
      "total": 2380,
      "detalles": [
        { "id": 1, "producto_id": 1, "cantidad": 2, "precio_unitario": 1000, "descuento_porcentaje": 0, "impuesto_porcentaje": 19, "subtotal": 2000, "impuesto": 380, "total": 2380 }
      ]
    }
  }
}
```
- Todos los `numeric`/`bigint` → `Number`.
- **Errores:** `400` validación / líneas inválidas / producto inactivo o ajeno / descuento excede total; `401`; `403`; `404` sucursal inexistente; `500`.

## Reglas de cálculo

- Línea: `subtotal = cantidad * precio_unitario * (1 - descuento_porcentaje/100)`; `impuesto = subtotal * impuesto_porcentaje/100`; `total = subtotal + impuesto`.
- Cabecera: `subtotal = Σ subtotal_linea`; `impuesto = Σ impuesto_linea`; `descuento` global; `total = subtotal - descuento + impuesto` (debe ser `>= 0`).
- `precio_unitario` e `impuesto_porcentaje` del producto se congelan en `detalle_factura`.

## Flujo transaccional (enTransaccion)

1. Validar `sucursal_id` en la empresa.
2. Validar `metodo_pago_id`/`cliente_id` (si vienen) en la empresa.
3. Cargar productos por `empresa_id` y validar existan y `activo=true`.
4. Calcular totales.
5. `siguiente_numero_factura(sucursal_id)` (bloquea la fila de la sucursal).
6. `INSERT factura` (snapshot, totales, estado `emitida`).
7. `INSERT detalle_factura` por línea.
8. `INSERT movimiento_inventario` (`salida_venta`, cantidad negativa) por línea → el trigger ajusta `stock`.
9. `COMMIT`; devolver factura + detalles.

## Archivos por capa

**Backend (`/server`):**
- `validaciones/facturas.js` — esquema del request.
- `repositorios/facturas.js` — SQL parametrizado, carga de sucursal/productos, inserción y casteo.
- `servicios/facturas.js` — reglas + `enTransaccion`.
- `controladores/facturas.js` — parsea `req.validado`, responde 201.
- `rutas/facturas.js` — router + `autenticacion` + `autorizacion('administrador')` + `validarEntrada`.
- `rutas/index.js` — montar `/facturas`.

**Frontend (`/client`):**
- `servicios/facturas.js` — `crearFactura(datos)`.
- `hooks/usePuntoDeVenta.js` — carrito, sucursal, descuentos, totales, envío.
- `paginas/PuntoDeVenta.jsx` — búsqueda de productos (activos), carrito, descuentos, resumen y envío.
- `componentes/` — piezas de carrito/buscador/resumen.
- `ArmazonPanel.jsx` — habilitar "Punto de venta" (hoy "Pronto").
- `App.jsx` — vista `punto-de-venta`.
- `utilidades/constantes.js` — `RUTA_FACTURAS`.

## Orden de trabajo

1. **Backend** (contrato + transacción) y verificación con healthcheck/fetch.
2. **Frontend** consumiendo el contrato + navegación.
3. **QA** integración, rollback, multi-tenant y lint/build.

## Riesgos

- **Atomicidad:** el commit/rollback debe ser real; sin él, quedan facturas a medias o stock descuadrado.
- **Totales:** coherencia estricta con el CHECK (`total = subtotal - descuento + impuesto`, `total >= 0`).
- **Productos inactivos/ajenos** no deben venderse (validación por empresa).
- **Duplicados de línea:** consolidar en frontend; backend rechaza duplicados.
- **Sobreventa:** permitida; no bloquear por stock (el saldo puede quedar negativo).
- **Casteo** de numeric/bigint a Number en toda la respuesta.