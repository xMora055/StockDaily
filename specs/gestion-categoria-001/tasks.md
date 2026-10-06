# Tareas — Catálogo de categorías (gestion-categoria-001)

> Orden por dependencia. El backend va primero (recurso nuevo); la integración con Productos (T-005) depende de T-001/T-002.

## T-001 — Backend: GET /api/v1/categorias (listado paginado y filtrable)
```yaml
T-001:
  spec: specs/gestion-categoria-001/spec.md
  objetivo: Listar las categorías de la empresa del token, paginadas y filtrables.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**, server/controladores/**, server/rutas/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql]
  contrato_api_v1:
    recurso: categoria
    metodo_path: "GET /api/v1/categorias"
    request:
      pagina: { tipo: integer, obligatorio: false, validacion: ">=1, default 1, 0/decimal/texto -> 400" }
      por_pagina: { tipo: integer, obligatorio: false, validacion: "1..100, default 10, fuera -> 400" }
      activo: { tipo: boolean, obligatorio: false, validacion: "true|false" }
      buscar: { tipo: string, obligatorio: false, validacion: "<=100; por nombre; comodines escapados" }
    data: { items: "Categoria[]", pagina: integer, por_pagina: integer, total: integer, total_paginas: integer }
    codigos: [200, 400, 401, 403, 500]
    sobre: '{ "success": true, "data": { items, pagina, por_pagina, total, total_paginas } } | { "success": false, "error": "..." }'
    casteo: [bigint/integer -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "empresa_id desde el token; NUNCA del body/query"
    roles: [administrador]
  criterios_aceptacion: ["sobre paginado exacto; orden nombre ASC, id ASC", "total = COUNT con los mismos filtros", "400 en pagina/por_pagina/activo invalidos", "buscar %/_ literal", "IDOR: empresa_id falso ignorado", "superadmin -> 403"]
  evidencia_requerida: "HTTP real: defaults 1/10, filtros combinados, 400 invalidos, 403 superadmin"
```

## T-002 — Backend: POST/GET:id/PATCH + registro de ruta
```yaml
T-002:
  spec: specs/gestion-categoria-001/spec.md
  objetivo: Crear, consultar y editar categorías con unicidad por empresa.
  capa: server
  alcance:
    permite: [server/validaciones/**, server/repositorios/**, server/servicios/**, server/controladores/**, server/rutas/**]
    prohibe: [client/**, tests/**, .env, server/db/schema.sql]
  contrato_api_v1:
    recurso: categoria
    metodo_path: "POST /api/v1/categorias | GET /api/v1/categorias/:id | PATCH /api/v1/categorias/:id"
    request:
      nombre: { tipo: string, obligatorio: true_en_post, validacion: "<=100, no vacio tras trim" }
      activo: { tipo: boolean, obligatorio: false, validacion: "solo PATCH" }
      id: { tipo: integer, obligatorio: true_en_get_patch, validacion: "solo digitos, entero seguro >0; si no -> 400" }
    data: { categoria: "Categoria" }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": { categoria } } | { "success": false, "error": "..." }'
    casteo: [bigint/integer -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "categoria buscada/editada SIEMPRE acotada a empresa_id del token"
    roles: [administrador]
  criterios_aceptacion: ["POST 201 con Categoria sin empresa_id", "nombre duplicado misma empresa -> 409 (trim previo)", "GET:id 404 ajena/inexistente y 400 id invalido (nunca 500)", "PATCH edita nombre/activo; sin campos -> 400; 409 duplicado", "23505->409 y 22003->400", "401 sin token, 403 superadmin"]
  evidencia_requerida: "HTTP real: crear, duplicado 409, id invalido 400, patch activo, IDOR"
```

## T-003 — Frontend: página Categorías (listado, filtros y paginación)
```yaml
T-003:
  spec: specs/gestion-categoria-001/spec.md
  objetivo: Ver y filtrar las categorías de la empresa desde el panel.
  capa: client
  alcance:
    permite: [client/src/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: categoria
    metodo_path: "GET /api/v1/categorias"
    request: { pagina: integer, por_pagina: integer, activo: boolean, buscar: string }
    data: { items: "Categoria[]", pagina, por_pagina, total, total_paginas }
    codigos: [200, 400, 401, 403, 500]
    sobre: '{ "success": true, "data": { items, pagina, por_pagina, total, total_paginas } } | { "success": false, "error": "..." }'
    casteo: [bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "Bearer automatico; no enviar empresa_id"
    roles: [administrador]
  criterios_aceptacion: ["RUTA_CATEGORIAS en constantes", "servicios/categorias.js normaliza paginado y Categoria", "hook con reset a pagina 1 al filtrar/cambiar tamano", "FiltrosCategorias (estado/buscar) y CategoriasTabla con Paginacion (5/10/15/20) y tarjetas movil", "estados carga/error/vacio; contadores con formatearNumero", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client; npm run build --prefix client"
```

## T-004 — Frontend: formulario, acciones y navegación
```yaml
T-004:
  spec: specs/gestion-categoria-001/spec.md
  objetivo: Crear/editar categorías y activarlas/desactivarlas; habilitar la sección en el panel.
  capa: client
  alcance:
    permite: [client/src/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: categoria
    metodo_path: "POST /api/v1/categorias | PATCH /api/v1/categorias/:id"
    request:
      nombre: { tipo: string, obligatorio: true_en_post, validacion: "no vacio, <=100" }
      activo: { tipo: boolean, obligatorio: false, validacion: "solo PATCH" }
    data: { categoria: "Categoria" }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": { categoria } } | { "success": false, "error": "..." }'
    casteo: [bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["FormularioCategoria con validacion local (nombre no vacio <=100) y errores del backend en linea", "409/404/400 con mensaje legible", "activar/desactivar con confirmacion de 2 pasos y recarga del listado", "seccion 'Categorias' en ArmazonPanel y App.jsx", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client; npm run build --prefix client"
```

## T-005 — Frontend: integración del catálogo en Productos
```yaml
T-005:
  spec: specs/gestion-categoria-001/spec.md
  objetivo: Usar las categorías reales en el formulario, el filtro y la tabla de productos (sin cambiar el contrato de /productos).
  capa: client
  alcance:
    permite: [client/src/**]
    prohibe: [server/**, tests/**, .env]
  contrato_api_v1:
    recurso: producto
    metodo_path: "POST/PATCH /api/v1/productos | GET /api/v1/productos"
    request:
      categoria_id: { tipo: "integer|null", obligatorio: false, validacion: "select; null = sin categoria" }
      categoria_id_filtro: { tipo: integer, obligatorio: false, validacion: "select del listado" }
    data: { producto: "Producto (ya incluye categoria_id)"; items: "Producto[]", pagina, por_pagina, total, total_paginas }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint/numeric -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "Bearer automatico"
    roles: [administrador]
  criterios_aceptacion: ["FormularioProducto usa select de categorias activas + 'Sin categoria' (null); ya no pide un numero", "si el producto tiene categoria inactiva, se muestra marcada '(inactiva)'", "FiltrosProductos agrega select de categoria que envia categoria_id", "ProductosTabla muestra el nombre de la categoria (mapa en cliente) o '—'", "sin cambios en la respuesta de /api/v1/productos", "lint y build verdes"]
  evidencia_requerida: "npm run lint --prefix client; npm run build --prefix client"
```

## T-006 — QA: verificación independiente de SD-002
```yaml
T-006:
  spec: specs/gestion-categoria-001/spec.md
  objetivo: Verificar CRUD de categorías, multi-tenant, unicidad, paginación y sin regresión de productos.
  capa: tests
  alcance:
    permite: [tests/**]
    prohibe: [server/**, client/**, .env]
  contrato_api_v1:
    recurso: categoria
    metodo_path: "GET/POST /api/v1/categorias | GET/PATCH /api/v1/categorias/:id"
    request: { pagina: integer, por_pagina: integer, activo: boolean, buscar: string, id: integer, nombre: string }
    data: { items: "Categoria[]", pagina, por_pagina, total, total_paginas; categoria: "Categoria" }
    codigos: [200, 201, 400, 401, 403, 404, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint/integer -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: "categoria ajena -> 404; empresa_id falso ignorado; superadmin -> 403"
    roles: [administrador]
  criterios_aceptacion: ["defaults 1/10 y sobre exacto; orden y total", "nombre duplicado misma empresa 409; nombre vacio/>100 400", "id invalido 400 (nunca 500); ajena 404", "PATCH edita/activa y 409; sin campos 400", "IDOR con token de otra empresa", "401/403", "desactivar categoria no altera productos", "regresion suite productos", "lint + build verdes"]
  evidencia_requerida: "npm test en la raiz + reporte APROBADO/RECHAZADO con Fallos/Faltantes/Riesgos"
```
