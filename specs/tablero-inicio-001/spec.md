# Spec — Tablero de Inicio con gráficos

- **ID:** `tablero-inicio-001`
- **Acción / recurso:** tablero-inicio
- **Capas:** `server` + `client` + `tests`
- **Estado:** aprobada para ejecución

## 1. Objetivo

Reemplazar el placeholder "Movimiento de hoy" de la página **Inicio** por un tablero
real con indicadores y gráficos construidos a partir de las facturas y el inventario
de la empresa. El objetivo es que un administrador vea de un vistazo cómo va el
negocio al entrar al panel.

Toda la información es **multi-tenant**: se deriva del `empresa_id` del token, nunca
del body ni del query.

## 2. Alcance

**Incluye**

- Endpoint de agregación de solo lectura `GET /api/v1/tablero/inicio`.
- KPIs: ventas de hoy, tickets de hoy, ticket promedio de hoy, ventas del periodo.
- Serie de ventas diarias del periodo (por defecto 30 días; permitido 7–90).
- Top 5 productos por unidades vendidas en el periodo.
- Ventas por sucursal en el periodo.
- Alerta de stock faltante (`stock.cantidad < 0`), con total y top 5.
- Gráficos SVG nativos + Tailwind (sin dependencias nuevas).
- Estados de carga, error y vacío; responsive.

**No incluye**

- Exportación a CSV/PDF.
- Filtros por rango de fechas libre (solo `dias`).
- Comparativas interanuales.
- Instalación de librerías de gráficos (prohibido en esta spec).

## 3. Requisitos funcionales (EARS)

- **RF-001** EL SISTEMA DEBE exponer `GET /api/v1/tablero/inicio`, autenticado con
  token Bearer y autorizado solo para el rol `administrador`.
- **RF-002** DONDE el usuario es `superadmin` (sin empresa), ENTONCES EL SISTEMA
  DEBE responder `403` con `{ success: false, error }`.
- **RF-003** CUANDO el administrador abre la página Inicio, EL SISTEMA DEBE mostrar
  las tarjetas KPI: ventas de hoy, tickets de hoy, ticket promedio de hoy y ventas
  del periodo.
- **RF-004** CUANDO el administrador abre la página Inicio, EL SISTEMA DEBE mostrar
  la serie de ventas diarias del periodo seleccionado (por defecto 30 días).
- **RF-005** CUANDO el administrador cambia el periodo a 7, 30 o 90 días, EL SISTEMA
  DEBE recargar la serie, los KPIs de periodo, el top de productos y las ventas por
  sucursal.
- **RF-006** CUANDO el administrador abre la página Inicio, EL SISTEMA DEBE mostrar
  el top 5 de productos por unidades vendidas en el periodo.
- **RF-007** CUANDO el administrador abre la página Inicio, EL SISTEMA DEBE mostrar
  las ventas por sucursal del periodo.
- **RF-008** CUANDO existen productos con saldo de stock negativo, EL SISTEMA DEBE
  mostrar una alerta con el total de casos y los 5 mayores faltantes.
- **RF-009** MIENTRAS los datos se están cargando, EL SISTEMA DEBE mostrar un estado
  de carga (esqueletos) sin bloquear la navegación.
- **RF-010** SI la petición falla, ENTONCES EL SISTEMA DEBE mostrar un mensaje de
  error legible y un botón "Reintentar".
- **RF-011** EL SISTEMA DEBE calcular "hoy" y los buckets diarios según el calendario
  de la zona horaria `America/Bogota`.
- **RF-012** EL SISTEMA DEBE formatear el dinero con `formatearMoneda` y los
  contadores/unidades con `formatearNumero` (nunca a mano ni dentro de inputs).
- **RF-013** EL SISTEMA DEBE presentar el tablero de forma responsive (una columna en
  móvil, grillas de 2–4 columnas en pantallas grandes).
- **RF-014** EL SISTEMA DEBE excluir del cálculo las facturas con `estado = 'anulada'`.

## 4. Casos límite (EC)

- **EC-001** Empresa sin facturas ni stock negativo: la respuesta llega con KPIs en
  0, serie con todos los días en 0, arreglos vacíos; la UI muestra estados vacíos
  claros (sin romper ni dividir entre cero).
- **EC-002** `dias` ausente → 30. `dias` no entero o fuera de `[7, 90]` → `400`.
- **EC-003** `sucursal_id` presente pero de otra empresa o inexistente → `404`
  "Sucursal no encontrada". Ausente → todas las sucursales de la empresa.
- **EC-004** `numeric(14,2)` y `bigint` llegan como string desde `pg`: el backend
  los castea a `Number` antes de responder.
- **EC-005** Mes/día con facturas anuladas: se excluyen del total y del ticketing.
- **EC-006** La serie debe tener exactamente `dias` puntos, rellenando con 0 los días
  sin ventas (usar `generate_series`).
- **EC-007** Token ausente o inválido → `401`; expirado → `401`.
- **EC-008** Productos con `cantidad < 0` (sobreventa permitida): aparecen como
  faltante con el valor absoluto.

## 5. Contrato `/api/v1` (resumen — detalle en `plan.md`)

`GET /api/v1/tablero/inicio?dias=30&sucursal_id=<opcional>`

Respuesta `200`:

```json
{
  "success": true,
  "data": {
    "periodo_dias": 30,
    "resumen": { "ventas_hoy": 0, "tickets_hoy": 0, "ticket_promedio_hoy": 0, "ventas_periodo": 0, "tickets_periodo": 0 },
    "serie_ventas": [{ "fecha": "2026-09-06", "total": 0, "tickets": 0 }],
    "top_productos": [{ "producto_id": 1, "producto_codigo": "P-001", "producto_nombre": "…", "unidades": 0, "total": 0 }],
    "ventas_por_sucursal": [{ "sucursal_id": 1, "sucursal_nombre": "…", "total": 0, "tickets": 0 }],
    "stock_faltante": { "total": 0, "items": [{ "producto_id": 1, "producto_codigo": "P-001", "producto_nombre": "…", "sucursal_nombre": "…", "cantidad": -3, "faltante": 3 }] }
  }
}
```

Errores: `{ "success": false, "error": "Mensaje legible" }` con status `400/401/403/404/500`.

## 6. Criterios de aceptación verificables

- [ ] `GET /api/v1/tablero/inicio` responde `200` con el sobre y la forma exacta de
      `data` para un administrador autenticado.
- [ ] Sin token → `401`; con `superadmin` → `403`; `dias=0` → `400`.
- [ ] `serie_ventas` tiene exactamente `periodo_dias` elementos.
- [ ] Las facturas `anulada` no suman en `resumen`, `serie_ventas`,
      `top_productos` ni `ventas_por_sucursal`.
- [ ] La página Inicio muestra KPIs, gráfico de serie, top productos, ventas por
      sucursal y alerta de faltantes, con estados de carga/error/vacío.
- [ ] `npm run lint --prefix client` pasa.
- [ ] `npm run build --prefix client` pasa.
- [ ] `npm test` (raíz) pasa, incluidos los casos de QA del endpoint.
- [ ] Nada de dependencias npm nuevas.
