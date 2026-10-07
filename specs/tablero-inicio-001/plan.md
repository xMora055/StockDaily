# Plan — `tablero-inicio-001`

## 1. Decisión de diseño

- **Un solo endpoint de lectura** `GET /api/v1/tablero/inicio` que devuelve todo el
  tablero en una llamada (KPIs + serie + top + sucursales + faltantes). Evita N
  round-trips al abrir Inicio y concentra la lógica de agregación en el backend.
- **Gráficos SVG nativos + Tailwind.** No se instala ninguna librería (Recharts,
  Chart.js, etc.). Motivo: guardarraíl del proyecto (preguntar antes de instalar) y
  coherencia con la identidad visual "papel de caja".
- **Zona horaria:** los buckets diarios y "hoy" se calculan con
  `(fecha AT TIME ZONE 'America/Bogota')::date`. Se documenta como decisión.
- **Multi-tenant:** `empresa_id` sale SIEMPRE de `req.usuario` (token). Se acota
  vía `JOIN sucursal` (las tablas `factura`/`stock` no tienen `empresa_id`).

## 2. Contrato `/api/v1` (fuente de verdad)

### Recurso: `tablero`

| Método | Path | Rol | Descripción |
|---|---|---|---|
| GET | `/api/v1/tablero/inicio` | administrador | Agregados del panel de Inicio |

### Request (query)

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `dias` | entero | no | 7–90, default 30 |
| `sucursal_id` | entero positivo | no | debe pertenecer a la empresa del token; si no → 404 |

`empresa_id` NUNCA se lee del body/query.

### Response `data` (200)

```json
{
  "periodo_dias": 30,
  "resumen": {
    "ventas_hoy": 1500000,
    "tickets_hoy": 12,
    "ticket_promedio_hoy": 125000,
    "ventas_periodo": 45000000,
    "tickets_periodo": 320
  },
  "serie_ventas": [
    { "fecha": "2026-09-06", "total": 1200000, "tickets": 9 }
  ],
  "top_productos": [
    { "producto_id": 10, "producto_codigo": "P-010", "producto_nombre": "Arroz 500g", "unidades": 120, "total": 480000 }
  ],
  "ventas_por_sucursal": [
    { "sucursal_id": 3, "sucursal_nombre": "Centro", "total": 28000000, "tickets": 190 }
  ],
  "stock_faltante": {
    "total": 4,
    "items": [
      { "producto_id": 7, "producto_codigo": "P-007", "producto_nombre": "Aceite 1L", "sucursal_nombre": "Centro", "cantidad": -3, "faltante": 3 }
    ]
  }
}
```

Reglas del contrato:

- `serie_ventas` **siempre** tiene exactamente `periodo_dias` elementos, ordenados
  por `fecha` ascendente, con días sin ventas en `0`.
- `fecha` es `YYYY-MM-DD` (día calendario en `America/Bogota`).
- `top_productos`: máx. 5, ordenado por `unidades` DESC.
- `ventas_por_sucursal`: incluye sucursales con 0 ventas; orden por `total` DESC.
- `stock_faltante.items`: máx. 5, orden por `faltante` DESC; `cantidad` negativa,
  `faltante = -cantidad`.
- Dinero (numeric) y bigint se castean a `Number` en el repositorio.
- Facturas `estado = 'anulada'` se excluyen de todos los agregados.

### Códigos

| Código | Cuándo |
|---|---|
| 200 | OK |
| 400 | `dias` inválido |
| 401 | sin token / token inválido o expirado |
| 403 | `superadmin` sin empresa |
| 404 | `sucursal_id` de otra empresa / inexistente |
| 500 | error inesperado |

### Sobre

- Éxito: `{ "success": true, "data": { ... } }`
- Error: `{ "success": false, "error": "Mensaje legible" }`

## 3. Archivos por capa

### Backend (`server/**`)

| Archivo | Acción |
|---|---|
| `server/repositorios/tablero.js` | nuevo — queries de agregación + casteo a `Number` |
| `server/servicios/tablero.js` | nuevo — deriva `empresa_id` del token, valida sucursal, arma la respuesta |
| `server/validaciones/tablero.js` | nuevo — `validarFiltrosTablero` (`dias`, `sucursal_id`) |
| `server/controladores/tablero.js` | nuevo — `obtenerInicio` |
| `server/rutas/tablero.js` | nuevo — `GET /inicio` con `autenticacion` + `autorizacion('administrador')` |
| `server/rutas/index.js` | editar — montar `router.use('/tablero', tablero)` |

No se toca `server/db/schema.sql` (la vista `vista_stock_faltante` ya existe).

### Frontend (`client/**`)

| Archivo | Acción |
|---|---|
| `client/src/utilidades/constantes.js` | editar — `RUTA_TABLERO = '/tablero/inicio'` |
| `client/src/servicios/tablero.js` | nuevo — `obtenerTablero({ dias, sucursal_id })` con normalización numérica |
| `client/src/hooks/useTablero.js` | nuevo — carga, `cargando`, `error`, `recargar`, `dias`, `cambiarDias` |
| `client/src/componentes/TarjetaKpi.jsx` | nuevo — tarjeta de indicador |
| `client/src/componentes/GraficoVentas.jsx` | nuevo — serie diaria en SVG (área/línea) |
| `client/src/componentes/GraficoBarras.jsx` | nuevo — barras horizontales reutilizable (top productos y sucursales) |
| `client/src/componentes/AlertaStockFaltante.jsx` | nuevo — lista de faltantes |
| `client/src/paginas/Inicio.jsx` | editar — integrar KPIs + gráficos + alerta; conservar "Estado del sistema" |

### Tests (`tests/**`)

| Archivo | Acción |
|---|---|
| `tests/tablero-inicio.test.js` | nuevo (lo escribe `qa`) — contrato, auth, validaciones, forma de `data` |

## 4. Orden de trabajo

1. **T-001** (backend) — repositorio + servicio.
2. **T-002** (backend) — validación + controlador + ruta + registro.
3. *(verificación integrada:* leer rutas, arrancar server, `GET /api/v1/salud`)*
4. **T-003** (frontend) — constante + servicio + hook.
5. **T-004** (frontend) — componentes SVG (KPI, serie, barras, faltantes).
6. **T-005** (frontend) — integración en `Inicio.jsx`.
7. **T-006** (qa) — pruebas + lint + build + veredicto.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Zona horaria: "hoy" mal calculado si se usa `now()` en UTC | Usar `AT TIME ZONE 'America/Bogota'` en buckets y "hoy" (RF-011) |
| Serie con días faltantes | `generate_series` + `LEFT JOIN` (EC-006) |
| `numeric`/`bigint` como string rompe sumas en JS/UI | Casteo a `Number` en el repositorio (EC-004) |
| IDOR vía `sucursal_id` | Validar pertenencia a la empresa → 404 (EC-003) |
| División por cero en ticket promedio | Si `tickets_hoy = 0` → promedio `0` (EC-001) |
| Superadmin (sin empresa) | `403` explícito (RF-002) |
| Gráficos SVG sin librería = más código | Componentes pequeños y reutilizables; sin dependencias |
| Datos escasos en dev → gráficos "vacíos" | Estados vacíos claros; no romper |

## 6. Verificación integrada (la hace el orquestador)

- Leer `server/rutas/index.js` y `server/rutas/tablero.js` para confirmar el path.
- Arrancar `npm run dev --prefix server` y `GET http://localhost:3000/api/v1/salud`.
- `npm run lint --prefix client` y `npm run build --prefix client`.
- Cerrar con `qa`.
