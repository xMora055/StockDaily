# Tasks — `tablero-inicio-001`

Orden por dependencia. Cada tarea es atómica (20–30 min) y lleva su bloque de handoff.

---

## T-001 — Backend: repositorio y servicio de agregación

```yaml
T-001:
  spec: specs/tablero-inicio-001/spec.md
  objetivo: Implementar las consultas de agregación del tablero y el servicio que deriva el tenant y arma la respuesta.
  capa: server
  alcance:
    permite: [server/repositorios/tablero.js, server/servicios/tablero.js]
    prohibe: [client/**, tests/**, server/db/schema.sql, .env]
  contrato_api_v1:
    recurso: tablero
    metodo_path: "GET /api/v1/tablero/inicio"
    request:
      dias: { tipo: "entero", obligatorio: false, validacion: "7..90, default 30" }
      sucursal_id: { tipo: "entero positivo", obligatorio: false, validacion: "debe pertenecer a la empresa del token" }
    data:
      periodo_dias: number
      resumen: { ventas_hoy: number, tickets_hoy: number, ticket_promedio_hoy: number, ventas_periodo: number, tickets_periodo: number }
      serie_ventas: "array de { fecha: 'YYYY-MM-DD', total: number, tickets: number }, exactamente periodo_dias elementos"
      top_productos: "array (max 5) de { producto_id, producto_codigo, producto_nombre, unidades, total }"
      ventas_por_sucursal: "array de { sucursal_id, sucursal_nombre, total, tickets }"
      stock_faltante: { total: number, items: "array (max 5) de { producto_id, producto_codigo, producto_nombre, sucursal_nombre, cantidad(negativo), faltante(positivo) }" }
    codigos: [200, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id/sucursal_id desde el token, NUNCA del body/query"
    roles: [administrador]
  criterios_aceptacion: ["lint backend", "serie con exactamente dias puntos", "anuladas excluidas", "casteo a Number"]
  evidencia_requerida: "Archivos creados + revisión de SQL (generate_series, JOIN sucursal por empresa, AT TIME ZONE 'America/Bogota')"
```

### Detalle de queries (referencia obligatoria)

- **Resumen hoy:** `SUM(total)`, `COUNT(*)` de `factura` join `sucursal` por `empresa_id`,
  `estado='emitida'`, `(fecha AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date`.
  `ticket_promedio_hoy = tickets_hoy > 0 ? ventas_hoy / tickets_hoy : 0`.
- **Resumen periodo:** mismas reglas, `fecha >= now() - (dias || ' days')::interval`.
- **Serie:** `generate_series` de `dias` días hasta hoy (Bogotá) LEFT JOIN factura emitida.
- **Top productos:** `detalle_factura` JOIN `factura` (emitida) JOIN `sucursal` (empresa) JOIN `producto`,
  `SUM(cantidad)`, `SUM(total)`, `GROUP BY producto`, `ORDER BY unidades DESC LIMIT 5`.
- **Ventas por sucursal:** `sucursal` LEFT JOIN factura emitida del periodo, `GROUP BY sucursal`,
  `ORDER BY total DESC`.
- **Stock faltante:** `vista_stock_faltante WHERE empresa_id = $1`; `COUNT(*)` para `total` y
  top 5 por `faltante DESC`.

---

## T-002 — Backend: validación, controlador y ruta

```yaml
T-002:
  spec: specs/tablero-inicio-001/spec.md
  objetivo: Exponer GET /api/v1/tablero/inicio con validación de query, autorización y sobre de respuesta.
  capa: server
  alcance:
    permite: [server/validaciones/tablero.js, server/controladores/tablero.js, server/rutas/tablero.js, server/rutas/index.js]
    prohibe: [client/**, tests/**, server/db/schema.sql, .env]
  contrato_api_v1:
    recurso: tablero
    metodo_path: "GET /api/v1/tablero/inicio"
    request:
      dias: { tipo: "entero", obligatorio: false, validacion: "7..90, default 30" }
      sucursal_id: { tipo: "entero positivo", obligatorio: false, validacion: "debe pertenecer a la empresa del token" }
    data:
      periodo_dias: number
      resumen: { ventas_hoy: number, tickets_hoy: number, ticket_promedio_hoy: number, ventas_periodo: number, tickets_periodo: number }
      serie_ventas: "array de { fecha, total, tickets } (exactamente periodo_dias)"
      top_productos: "array (max 5)"
      ventas_por_sucursal: "array"
      stock_faltante: { total: number, items: "array (max 5)" }
    codigos: [200, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id/sucursal_id desde el token, NUNCA del body/query"
    roles: [administrador]
  criterios_aceptacion:
    - "GET /api/v1/tablero/inicio responde 200 con sobre correcto"
    - "sin token -> 401; superadmin -> 403; dias=0 -> 400; sucursal ajena -> 404"
    - "lint backend"
  evidencia_requerida: "Salida de GET /api/v1/salud tras arrancar server + lectura de rutas/tablero.js"
```

### Notas de implementación

- Patrón de errores: lanzar `ErrorApp` (como en `servicios/facturas.js`) y `next(error)`.
- `autorizacion('administrador')` (igual que `rutas/facturas.js`).
- `validarEntrada({ query: validarFiltrosTablero })` de `middlewares/validarEntrada`.
- `res.status(200).json({ success: true, data })`.
- No se modifica el contrato de rutas existentes; solo se registra el prefijo `/tablero`.

---

## T-003 — Frontend: constante, servicio y hook

```yaml
T-003:
  spec: specs/tablero-inicio-001/spec.md
  objetivo: Consumir el endpoint del tablero y exponer estado de carga/error/recarga al componente Inicio.
  capa: client
  alcance:
    permite: [client/src/utilidades/constantes.js, client/src/servicios/tablero.js, client/src/hooks/useTablero.js]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: tablero
    metodo_path: "GET /api/v1/tablero/inicio"
    request: { dias: { tipo: "entero", obligatorio: false }, sucursal_id: { tipo: "entero", obligatorio: false } }
    data: "resumen, serie_ventas, top_productos, ventas_por_sucursal, stock_faltante (ver spec)"
    codigos: [200, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "no aplica en cliente; el backend deriva el tenant"
    roles: [administrador]
  criterios_aceptacion: ["normalización numérica con Number", "hook expone cargando/error/recargar/dias/cambiarDias", "lint"]
  evidencia_requerida: "npm run lint --prefix client (sin errores nuevos)"
```

### Notas de implementación

- Usar `solicitar` de `client/src/api/clienteApi.js` (Bearer automático, manejo 401).
- Construir query con `URLSearchParams`; solo enviar `dias` y `sucursal_id` si existen.
- Normalizar a `Number` los campos numéricos de `resumen`, `serie_ventas`, `top_productos`,
  `ventas_por_sucursal` y `stock_faltante` (evita sorpresas si llegan strings).
- `useTablero` sigue el patrón de `useFacturas` (clave de petición, `activo` en el effect,
  `recargar`). Default `dias = 30`.

---

## T-004 — Frontend: componentes de gráficos SVG

```yaml
T-004:
  spec: specs/tablero-inicio-001/spec.md
  objetivo: Crear los componentes visuales del tablero (KPI, serie de ventas, barras, alerta de faltantes) sin librerías externas.
  capa: client
  alcance:
    permite: [client/src/componentes/TarjetaKpi.jsx, client/src/componentes/GraficoVentas.jsx, client/src/componentes/GraficoBarras.jsx, client/src/componentes/AlertaStockFaltante.jsx]
    prohibe: [server/**, tests/**, client/package.json, .env]
  contrato_api_v1:
    recurso: tablero
    metodo_path: "GET /api/v1/tablero/inicio"
    request: {}
    data: "resumen, serie_ventas, top_productos, ventas_por_sucursal, stock_faltante"
    codigos: [200]
    sobre: '{ "success": true, "data": ... }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "no aplica"
    roles: [administrador]
  criterios_aceptacion:
    - "Gráficos SVG nativos, sin dependencias nuevas"
    - "formatearMoneda/formatearNumero en etiquetas y tooltips"
    - "estados vacíos claros; responsive; aria-label en gráficos"
    - "lint"
  evidencia_requerida: "npm run lint --prefix client y npm run build --prefix client"
```

### Notas de implementación

- `TarjetaKpi`: recibe `{ titulo, valor, detalle? }`.
- `GraficoVentas`: serie con `viewBox`, área con gradiente (`--color-marca`), línea,
  y etiquetas mínimas; `aria-hidden` en lo decorativo y un `aria-label` con el resumen.
- `GraficoBarras`: reutilizable, recibe `items` con `{ etiqueta, valor, secundario? }`;
  barra horizontal con ancho relativo al máximo; valor formateado.
- `AlertaStockFaltante`: recibe `{ total, items }`; si `total === 0`, mensaje positivo
  "Sin faltantes de inventario".
- Respetar la paleta `@theme` (`marca`, `petroleo`, `acento`, `tinta`, `borde`) y las
  cifras en `font-mono`.
- No usar `<canvas>` ni librerías; SVG puro.

---

## T-005 — Frontend: integración en Inicio

```yaml
T-005:
  spec: specs/tablero-inicio-001/spec.md
  objetivo: Reemplazar el placeholder "Movimiento de hoy" por el tablero real (KPIs + gráficos + alerta).
  capa: client
  alcance:
    permite: [client/src/paginas/Inicio.jsx]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: tablero
    metodo_path: "GET /api/v1/tablero/inicio"
    request: { dias: "7 | 30 | 90" }
    data: "resumen, serie_ventas, top_productos, ventas_por_sucursal, stock_faltante"
    codigos: [200, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "no aplica"
    roles: [administrador]
  criterios_aceptacion:
    - "En Inicio se ven KPIs, serie, top productos, ventas por sucursal y alerta"
    - "Selectores de periodo 7/30/90 recargan el tablero"
    - "cargando -> esqueletos; error -> mensaje + Reintentar; vacío -> estados claros"
    - "se conserva la sección Estado del sistema"
    - "lint + build"
  evidencia_requerida: "npm run lint --prefix client y npm run build --prefix client"
```

### Notas de implementación

- `useTablero()` expone `{ datos, cargando, error, recargar, dias, cambiarDias, cambiarSucursal?, sucursales? }`.
  Si se añade selector de sucursal, usar el hook existente `useSucursales`.
- Conservar el encabezado ("Hola, {nombre}") y el bloque "Estado del sistema".
- Grillas responsive: KPIs `sm:grid-cols-2 xl:grid-cols-4`; serie a ancho completo;
  top productos y sucursales en `xl:grid-cols-2`.

---

## T-006 — QA: verificación integrada

```yaml
T-006:
  spec: specs/tablero-inicio-001/spec.md
  objetivo: Verificar contrato, seguridad multi-tenant y render del tablero; emitir veredicto.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env, server/db/schema.sql]
  contrato_api_v1:
    recurso: tablero
    metodo_path: "GET /api/v1/tablero/inicio"
    request:
      dias: { tipo: "entero", obligatorio: false, validacion: "7..90, default 30" }
      sucursal_id: { tipo: "entero positivo", obligatorio: false, validacion: "de la empresa del token" }
    data:
      periodo_dias: number
      resumen: { ventas_hoy: number, tickets_hoy: number, ticket_promedio_hoy: number, ventas_periodo: number, tickets_periodo: number }
      serie_ventas: "array de { fecha, total, tickets } (exactamente periodo_dias)"
      top_productos: "array (max 5)"
      ventas_por_sucursal: "array"
      stock_faltante: { total: number, items: "array (max 5)" }
    codigos: [200, 400, 401, 403, 404, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id/sucursal_id desde el token, NUNCA del body/query"
    roles: [administrador]
  criterios_aceptacion:
    - "caso QA: sin token -> 401"
    - "caso QA: dias inválido -> 400"
    - "caso QA: serie_ventas.length === periodo_dias"
    - "caso QA: sobre success/data correcto"
    - "npm test (raíz), npm run lint --prefix client, npm run build --prefix client"
  evidencia_requerida: "Veredicto APROBADO o RECHAZADO con lista de Fallos/Faltantes/Riesgos y salida de comandos"
```

### Notas para QA

- Escribir `tests/tablero-inicio.test.js` con `node --test`.
- Probar el endpoint real (levantar server) o validar forma del contrato; incluir los
  casos de aceptación anteriores.
- Reportar veredicto explícito y, si rechaza, los pendientes exactos.
