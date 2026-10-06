-- ============================================================================
--  StockDaily — Esquema de base de datos (PostgreSQL / Supabase)
-- ----------------------------------------------------------------------------
--  Convenciones:
--    * Identificadores, tablas y columnas en español.
--    * Dinero en numeric(14,2); una sola moneda por empresa (empresa.moneda).
--    * Borrado lógico mediante la columna "activo" (no se borra historial).
--    * Integridad reforzada con PRIMARY KEY, FOREIGN KEY y CHECK.
--    * Requiere PostgreSQL 12+ (columnas IDENTITY).
--  Ejecutar sobre una base de datos vacía.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. empresa  (raíz multi-tenant: una fila por PYME)
-- ----------------------------------------------------------------------------
CREATE TABLE empresa (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre          varchar(150) NOT NULL,
    documento       varchar(30),                          -- NIT / RUC / RFC
    moneda          char(3)      NOT NULL DEFAULT 'COP',  -- ISO-4217
    direccion       varchar(200),
    telefono        varchar(30),
    correo          varchar(150),
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. sucursal  (locales/bodegas de una empresa)
-- ----------------------------------------------------------------------------
CREATE TABLE sucursal (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint       NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
    nombre          varchar(150) NOT NULL,
    direccion       varchar(200),
    telefono        varchar(30),
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, nombre)
);

-- ----------------------------------------------------------------------------
-- 3. usuario  (administradores por empresa + superadmins de plataforma)
--    - administrador: pertenece a una empresa (empresa_id NOT NULL).
--    - superadmin:    rol de plataforma, SIN empresa (empresa_id NULL);
--                     crea empresas y administradores, no opera en sucursales.
-- ----------------------------------------------------------------------------
CREATE TABLE usuario (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint       REFERENCES empresa(id) ON DELETE RESTRICT, -- NULL = superadmin
    nombre          varchar(150) NOT NULL,
    correo          varchar(150) NOT NULL,                -- normalizar en minúsculas
    password_hash   varchar(255) NOT NULL,                -- bcrypt / argon2
    rol             varchar(20)  NOT NULL DEFAULT 'administrador'
                        CHECK (rol IN ('administrador', 'superadmin')),
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, correo),
    -- el rol determina si el usuario pertenece o no a una empresa
    CONSTRAINT usuario_rol_empresa_check CHECK (
        (rol = 'superadmin'  AND empresa_id IS NULL)
        OR (rol <> 'superadmin' AND empresa_id IS NOT NULL)
    )
);

-- ----------------------------------------------------------------------------
-- 4. metodo_pago  (catálogo por empresa: efectivo, tarjeta, transferencia...)
-- ----------------------------------------------------------------------------
CREATE TABLE metodo_pago (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id  bigint       NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
    nombre      varchar(50)  NOT NULL,
    activo      boolean      NOT NULL DEFAULT true,
    UNIQUE (empresa_id, nombre)
);

-- ----------------------------------------------------------------------------
-- 5. categoria  (catálogo por empresa; un producto pertenece a una sola)
-- ----------------------------------------------------------------------------
CREATE TABLE categoria (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      bigint       NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
    nombre          varchar(100) NOT NULL,
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, nombre)
);

-- ----------------------------------------------------------------------------
-- 6. cliente  (pertenece a una sucursal concreta)
-- ----------------------------------------------------------------------------
CREATE TABLE cliente (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sucursal_id     bigint       NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    nombre          varchar(150) NOT NULL,
    documento       varchar(30),                          -- NIT / cédula
    telefono        varchar(30),
    correo          varchar(150),
    direccion       varchar(200),
    activo          boolean      NOT NULL DEFAULT true,
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    actualizado_en  timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (sucursal_id, documento)                       -- varios NULL permitidos
);

-- ----------------------------------------------------------------------------
-- 7. producto  (catálogo simple por empresa, sin variantes ni lotes)
--    Precio SIN impuesto; el impuesto se calcula por línea en la factura.
-- ----------------------------------------------------------------------------
CREATE TABLE producto (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          bigint       NOT NULL REFERENCES empresa(id) ON DELETE RESTRICT,
    categoria_id        bigint       REFERENCES categoria(id) ON DELETE SET NULL,
    codigo              varchar(50)  NOT NULL,            -- SKU interno
    nombre              varchar(150) NOT NULL,
    descripcion         text,
    precio_unitario     numeric(14,2) NOT NULL DEFAULT 0
                            CHECK (precio_unitario >= 0),
    impuesto_porcentaje numeric(5,2)  NOT NULL DEFAULT 0
                            CHECK (impuesto_porcentaje BETWEEN 0 AND 100),
    activo              boolean      NOT NULL DEFAULT true,
    creado_en           timestamptz  NOT NULL DEFAULT now(),
    actualizado_en      timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, codigo)
);

-- ----------------------------------------------------------------------------
-- 8. stock  (saldo por producto + sucursal)
--    cantidad PUEDE ser negativa: la sobreventa está permitida por regla de
--    negocio; un saldo < 0 indica faltante de inventario por regularizar.
-- ----------------------------------------------------------------------------
CREATE TABLE stock (
    producto_id     bigint      NOT NULL REFERENCES producto(id) ON DELETE RESTRICT,
    sucursal_id     bigint      NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    cantidad        integer     NOT NULL DEFAULT 0,
    actualizado_en  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (producto_id, sucursal_id)
);

-- ----------------------------------------------------------------------------
-- 9. factura  (cabecera de venta; numeración consecutiva por sucursal)
--    cliente_id NULL = "consumidor final".
--    Se guarda snapshot de cliente para que el histórico no cambie.
-- ----------------------------------------------------------------------------
CREATE TABLE factura (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sucursal_id          bigint       NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    usuario_id           bigint       NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
    cliente_id           bigint       REFERENCES cliente(id) ON DELETE RESTRICT,
    cliente_nombre       varchar(150),                    -- snapshot (NULL = consumidor final)
    cliente_documento    varchar(30),
    metodo_pago_id       bigint       REFERENCES metodo_pago(id) ON DELETE RESTRICT,
    numero_factura       integer      NOT NULL,
    estado               varchar(15)  NOT NULL DEFAULT 'emitida'
                            CHECK (estado IN ('emitida', 'anulada')),
    fecha                timestamptz  NOT NULL DEFAULT now(),
    subtotal             numeric(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    descuento            numeric(14,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    impuesto             numeric(14,2) NOT NULL DEFAULT 0 CHECK (impuesto >= 0),
    total                numeric(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    anulada_en           timestamptz,
    anulada_por          bigint       REFERENCES usuario(id) ON DELETE RESTRICT,
    creado_en            timestamptz  NOT NULL DEFAULT now(),
    actualizado_en       timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (sucursal_id, numero_factura),                 -- número no reutilizable
    CHECK (total = subtotal - descuento + impuesto),      -- coherencia de totales
    CHECK (
        (estado = 'anulada' AND anulada_en IS NOT NULL)
        OR (estado = 'emitida' AND anulada_en IS NULL)
    )
);

-- ----------------------------------------------------------------------------
-- 10. detalle_factura  (líneas de producto; precios congelados al momento)
--     subtotal = cantidad * precio_unitario * (1 - descuento_porcentaje/100)
--     impuesto = subtotal * impuesto_porcentaje/100
--     total    = subtotal + impuesto
-- ----------------------------------------------------------------------------
CREATE TABLE detalle_factura (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    factura_id           bigint       NOT NULL REFERENCES factura(id) ON DELETE CASCADE,
    producto_id          bigint       NOT NULL REFERENCES producto(id) ON DELETE RESTRICT,
    cantidad             integer      NOT NULL CHECK (cantidad > 0),
    precio_unitario      numeric(14,2) NOT NULL CHECK (precio_unitario >= 0),
    descuento_porcentaje numeric(5,2)  NOT NULL DEFAULT 0
                            CHECK (descuento_porcentaje BETWEEN 0 AND 100),
    impuesto_porcentaje  numeric(5,2)  NOT NULL DEFAULT 0
                            CHECK (impuesto_porcentaje BETWEEN 0 AND 100),
    subtotal             numeric(14,2) NOT NULL CHECK (subtotal >= 0),
    impuesto             numeric(14,2) NOT NULL CHECK (impuesto >= 0),
    total                numeric(14,2) NOT NULL CHECK (total >= 0),
    UNIQUE (factura_id, producto_id)                      -- una línea por producto
);

-- ----------------------------------------------------------------------------
-- 11. movimiento_inventario  (bitácora de entradas/salidas)
--     La columna stock es el saldo consolidado; esta tabla es el histórico.
--     Cantidad: positiva = entrada, negativa = salida.
-- ----------------------------------------------------------------------------
CREATE TABLE movimiento_inventario (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    producto_id     bigint       NOT NULL REFERENCES producto(id) ON DELETE RESTRICT,
    sucursal_id     bigint       NOT NULL REFERENCES sucursal(id) ON DELETE RESTRICT,
    usuario_id      bigint       REFERENCES usuario(id) ON DELETE RESTRICT,
    factura_id      bigint       REFERENCES factura(id) ON DELETE RESTRICT,
    tipo            varchar(20)  NOT NULL
                        CHECK (tipo IN ('carga_inicial', 'ajuste', 'salida_venta', 'anulacion')),
    cantidad        integer      NOT NULL CHECK (cantidad <> 0),
    observacion     varchar(255),
    creado_en       timestamptz  NOT NULL DEFAULT now(),
    -- una salida por venta siempre debe referenciar su factura
    CHECK (tipo <> 'salida_venta' OR factura_id IS NOT NULL)
);

-- ----------------------------------------------------------------------------
-- 12. Mantener "actualizado_en" de forma automática
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS trigger AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_empresa_timestamp    BEFORE UPDATE ON empresa    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();
CREATE TRIGGER trg_sucursal_timestamp   BEFORE UPDATE ON sucursal   FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();
CREATE TRIGGER trg_usuario_timestamp    BEFORE UPDATE ON usuario    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();
CREATE TRIGGER trg_categoria_timestamp  BEFORE UPDATE ON categoria  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();
CREATE TRIGGER trg_cliente_timestamp    BEFORE UPDATE ON cliente    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();
CREATE TRIGGER trg_producto_timestamp   BEFORE UPDATE ON producto   FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();
CREATE TRIGGER trg_factura_timestamp    BEFORE UPDATE ON factura    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- ----------------------------------------------------------------------------
-- 13. Numeración consecutiva por sucursal (llamar DENTRO de la transacción)
--     Bloquea la fila de la sucursal para evitar números duplicados.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION siguiente_numero_factura(p_sucursal_id bigint)
RETURNS integer AS $$
DECLARE
    v_numero integer;
BEGIN
    PERFORM 1 FROM sucursal WHERE id = p_sucursal_id FOR UPDATE;
    SELECT COALESCE(MAX(numero_factura), 0) + 1
      INTO v_numero
      FROM factura
     WHERE sucursal_id = p_sucursal_id;
    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 14. El saldo de stock se actualiza solo con cada movimiento.
--     La sobreventa está permitida: una salida puede dejar el saldo negativo
--     (no hay CHECK que lo bloquee). Un saldo < 0 señala faltante de inventario.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION aplicar_movimiento_inventario()
RETURNS trigger AS $$
BEGIN
    INSERT INTO stock (producto_id, sucursal_id, cantidad, actualizado_en)
    VALUES (NEW.producto_id, NEW.sucursal_id, NEW.cantidad, now())
    ON CONFLICT (producto_id, sucursal_id)
    DO UPDATE SET cantidad       = stock.cantidad + EXCLUDED.cantidad,
                  actualizado_en = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimiento_inventario
    AFTER INSERT ON movimiento_inventario
    FOR EACH ROW EXECUTE FUNCTION aplicar_movimiento_inventario();

-- ----------------------------------------------------------------------------
-- 15. Índices (PostgreSQL no indexa las FK automáticamente)
-- ----------------------------------------------------------------------------
CREATE INDEX idx_sucursal_empresa          ON sucursal (empresa_id);
CREATE INDEX idx_usuario_empresa           ON usuario (empresa_id);
-- El correo del superadmin (empresa_id NULL) es único a nivel plataforma.
CREATE UNIQUE INDEX uq_usuario_superadmin_correo
    ON usuario (lower(correo)) WHERE empresa_id IS NULL;
CREATE INDEX idx_metodo_pago_empresa       ON metodo_pago (empresa_id);
CREATE INDEX idx_categoria_empresa         ON categoria (empresa_id);
CREATE INDEX idx_cliente_sucursal          ON cliente (sucursal_id);
CREATE INDEX idx_producto_empresa          ON producto (empresa_id);
CREATE INDEX idx_producto_categoria        ON producto (categoria_id);
CREATE INDEX idx_stock_sucursal            ON stock (sucursal_id);
CREATE INDEX idx_factura_sucursal_fecha    ON factura (sucursal_id, fecha DESC);
CREATE INDEX idx_factura_cliente           ON factura (cliente_id);
CREATE INDEX idx_factura_usuario           ON factura (usuario_id);
CREATE INDEX idx_factura_estado            ON factura (estado);
CREATE INDEX idx_detalle_producto          ON detalle_factura (producto_id);
CREATE INDEX idx_movimiento_producto_suc   ON movimiento_inventario (producto_id, sucursal_id);
CREATE INDEX idx_movimiento_factura        ON movimiento_inventario (factura_id);
CREATE INDEX idx_movimiento_fecha          ON movimiento_inventario (creado_en);
-- Índice parcial: acelera la consulta de faltantes (solo filas con saldo negativo)
CREATE INDEX idx_stock_cantidad_negativa   ON stock (sucursal_id, producto_id)
    WHERE cantidad < 0;

-- ----------------------------------------------------------------------------
-- 16. Vista de alerta: stock negativo (faltante por regularizar)
--     Una venta puede dejar el saldo en negativo (sobreventa permitida); esta
--     vista expone esos casos para que el negocio los regularice con un ajuste.
--     security_invoker: respeta las RLS del rol que consulta (no del dueño).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vista_stock_faltante
    WITH (security_invoker = true) AS
SELECT
    e.id                    AS empresa_id,
    e.nombre                AS empresa_nombre,
    s.id                    AS sucursal_id,
    s.nombre                AS sucursal_nombre,
    s.activo                AS sucursal_activa,
    p.id                    AS producto_id,
    p.codigo                AS producto_codigo,
    p.nombre                AS producto_nombre,
    p.activo                AS producto_activo,
    st.cantidad             AS cantidad,          -- negativa
    (-st.cantidad)          AS faltante,          -- unidades a reponer (positivo)
    st.actualizado_en
FROM stock st
JOIN sucursal s ON s.id = st.sucursal_id
JOIN empresa  e ON e.id = s.empresa_id
JOIN producto p ON p.id = st.producto_id
WHERE st.cantidad < 0;

COMMIT;

-- ============================================================================
--  Flujo esperado al registrar una venta (todo en UNA transacción):
--    1) SELECT siguiente_numero_factura(:sucursal_id);
--    2) INSERT INTO factura  (... numero_factura, totales calculados ...);
--    3) INSERT INTO detalle_factura (...);
--    4) INSERT INTO movimiento_inventario (tipo='salida_venta', cantidad=-(...))
--       por cada producto => el trigger ajusta "stock" (puede quedar negativo).
--    5) COMMIT;
--  Al anular: UPDATE factura (estado='anulada') + INSERT movimiento
--    (tipo='anulacion', cantidad positiva) para revertir el stock.
--
--  Primer superadmin (seed manual, una sola vez). El hash debe generarlo la
--  aplicación con bcrypt/argon2; nunca guardar la contraseña en claro:
--    INSERT INTO usuario (empresa_id, nombre, correo, password_hash, rol)
--    VALUES (NULL, 'Administrador de plataforma', 'admin@stockdaily.app',
--            '<hash_bcrypt>', 'superadmin');
--
--  Un superadmin NO se usa en facturas ni movimientos de inventario
--  (esos usuario_id siempre referencian usuarios con empresa).
-- ============================================================================
