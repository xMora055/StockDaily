-- ============================================================================
--  StockDaily — Limpieza total de datos (NO borra el esquema)
-- ----------------------------------------------------------------------------
--  Vacía todas las tablas y reinicia los contadores IDENTITY a 1.
--  CASCADE resuelve las FOREIGN KEY con ON DELETE RESTRICT.
--  ADVERTENCIA: elimina TODOS los datos de forma irreversible.
-- ============================================================================

BEGIN;

TRUNCATE TABLE
    movimiento_inventario,
    detalle_factura,
    factura,
    stock,
    cliente,
    producto,
    categoria,
    metodo_pago,
    usuario,
    sucursal,
    empresa
RESTART IDENTITY CASCADE;

COMMIT;
