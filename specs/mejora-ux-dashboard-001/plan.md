# Plan de ejecución — SD-020

## Contrato de API

Este cambio es **solo de frontend**. El contrato existente no se modifica:

- **Recurso:** Tablero de inicio
- **Método y path:** `GET /api/v1/tablero/inicio`
- **Query params:** `dias` (entero > 0, opcional, default 30), `sucursal_id` (entero, opcional)
- **Headers:** `Authorization: Bearer <token>`
- **Respuesta exitosa:**
  ```json
  {
    "success": true,
    "data": {
      "periodo_dias": 30,
      "resumen": { ... },
      "serie_ventas": [ ... ],
      "top_productos": [
        { "producto_id": 1, "producto_nombre": "...", "unidades": 10, "total": 50000 }
      ],
      "ventas_por_sucursal": [
        { "sucursal_id": 1, "sucursal_nombre": "...", "total": 100000, "tickets": 5 }
      ],
      "stock_faltante": { "total": 0, "items": [] }
    }
  }
  ```
- **Errores:** sin cambios (`401` sin token, `500` error interno).

> Nota: el backend ya normaliza `numeric`/`bigint` a `Number`; el frontend también defiende con `aNumero` en `client/src/servicios/tablero.js`.

## Archivos por capa

### `/client`

- **`client/src/paginas/Inicio.jsx`** (modificar)
  - Envolver las dos secciones de `GraficoBarras` (`Top productos` y `Ventas por sucursal`) en un contenedor con altura máxima fija y scroll interno.
  - Agregar el contador `Mostrando N de M` en el encabezado de cada card.
  - Asegurar que el encabezado (título + subtítulo + contador) quede fuera del área scrollable.

- **`client/src/componentes/GraficoBarras.jsx`** (posible tocar, no modificar comportamiento)
  - Opcional: exponer el total de items renderizados si se necesita para el contador; preferir calcularlo desde `Inicio.jsx` con `items.length`.
  - **No** cambiar la lógica interna de barras, formateo ni estados vacíos.

### No se tocan

- `/server` (sin cambios de API ni BD).
- `client/src/componentes/GraficoVentas.jsx` (no es parte del alcance).
- `client/src/hooks/useTablero.js` ni `client/src/servicios/tablero.js`.

## Orden de trabajo

1. **Frontend:** ajustar `Inicio.jsx` para aplicar altura máxima, scroll interno y contador en las dos cards de barras.
2. **QA:** verificar visualmente el comportamiento, ejecutar `lint`/`build` y reportar.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Scroll interno quede oculto o poco usable en móvil | Probar en viewport móvil; si es necesario, reducir la altura máxima en pantallas pequeñas. |
| El contador o el encabezado se desalineen al cambiar el periodo | Volver a calcular `items.length` desde los datos recargados; no cachear valores. |
| Barras demasiado comprimidas o ilegibles | Mantener la altura mínima de cada fila de `GraficoBarras`; si es necesario, ajustar `max-h` en lugar de tocar el componente. |
| Regresión en el diseño "papel de caja" | Reutilizar clases existentes (`border-borde`, `bg-superficie`, `shadow-impresa`, `rounded-lg`, etc.). |

## Notas de diseño

- Altura máxima propuesta para el cuerpo scrollable: `320px` en desktop (`max-h-80`). El implementador puede ajustar a `max-h-72` (288px) o `max-h-96` (384px) si el diseño lo justifica, siempre dentro de los criterios de aceptación.
- El contador debe ir alineado a la derecha del encabezado, junto al subtítulo existente, usando `font-mono text-xs text-tinta-suave`.
- Ejemplo de texto: `Mostrando 12 de 48`.
