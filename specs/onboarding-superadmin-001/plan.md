# Plan de ejecución — SD-010

## Contrato de API

Base path: `/api/v1/admin`

Todas las rutas requieren `Authorization: Bearer <token>` de un usuario con rol `superadmin`. Cualquier otro rol → **403**.

### Empresas

#### `POST /api/v1/admin/empresas`

Crea una empresa y su primer administrador en una transacción.

- **Request body:**
  ```json
  {
    "nombre": "Mi PYME",
    "documento": "900123456",
    "moneda": "COP",
    "direccion": "Calle 1 # 2-3",
    "telefono": "3001234567",
    "correo": "contacto@pyme.com",
    "admin": {
      "nombre": "Ana Pérez",
      "correo": "ana@pyme.com"
    }
  }
  ```
  Campos obligatorios: `nombre`, `admin.nombre`, `admin.correo`.  
  `moneda` default `"COP"` si no se envía.

- **Response 201:**
  ```json
  {
    "success": true,
    "data": {
      "empresa": {
        "id": 1,
        "nombre": "Mi PYME",
        "documento": "900123456",
        "moneda": "COP",
        "direccion": "Calle 1 # 2-3",
        "telefono": "3001234567",
        "correo": "contacto@pyme.com",
        "activo": true,
        "creado_en": "...",
        "actualizado_en": "..."
      },
      "administrador": {
        "id": 2,
        "empresa_id": 1,
        "nombre": "Ana Pérez",
        "correo": "ana@pyme.com",
        "rol": "administrador",
        "activo": true,
        "creado_en": "...",
        "actualizado_en": "..."
      },
      "password": "123"
    }
  }
  ```

#### `GET /api/v1/admin/empresas`

Listado paginado de empresas.

- **Query params:** `pagina` (default 1), `por_pagina` (default 10, max 100), `activo` (boolean opcional).
- **Response 200:**
  ```json
  {
    "success": true,
    "data": {
      "items": [ /* Empresa */ ],
      "pagina": 1,
      "por_pagina": 10,
      "total": 50,
      "total_paginas": 5
    }
  }
  ```

#### `GET /api/v1/admin/empresas/:id`

- **Response 200:**
  ```json
  {
    "success": true,
    "data": {
      "empresa": { /* Empresa */ },
      "administradores": [ /* Usuario[] */ ]
    }
  }
  ```

#### `PATCH /api/v1/admin/empresas/:id`

- **Request body:** cualquier subconjunto de `{ nombre, documento, moneda, direccion, telefono, correo, activo }`.
- **Response 200:** `{ success: true, data: { empresa } }`.
- **Regla especial:** si `activo` pasa a `false`, todos los administradores de esa empresa también pasan a `activo = false`.

### Administradores

#### `POST /api/v1/admin/usuarios`

Crea un administrador adicional para una empresa existente.

- **Request body:**
  ```json
  {
    "empresa_id": 1,
    "nombre": "Luis Gómez",
    "correo": "luis@pyme.com"
  }
  ```
- **Response 201:** `{ success: true, data: { usuario, password: "123" } }`.

#### `GET /api/v1/admin/usuarios`

- **Query params:** `pagina`, `por_pagina`, `empresa_id` (filtro opcional), `activo` (filtro opcional).
- **Response 200:** sobre paginado con `items` de usuarios.

#### `GET /api/v1/admin/usuarios/:id`

- **Response 200:** `{ success: true, data: { usuario } }`.

#### `PATCH /api/v1/admin/usuarios/:id`

- **Request body:** `{ nombre, correo, activo }` (subconjunto).
- **Response 200:** `{ success: true, data: { usuario } }`.

### Errores

Todos los errores usan el sobre `{ success: false, error: "Mensaje legible" }`:

- **400** — datos inválidos o faltantes.
- **401** — sin token o token inválido.
- **403** — usuario autenticado pero no superadmin.
- **404** — empresa o administrador no encontrado.
- **409** — correo duplicado dentro de la misma empresa.
- **500** — error interno.

## Archivos por capa

### `/server`

- **`server/rutas/index.js`** — agregar `router.use('/admin', admin);`.
- **`server/rutas/admin.js`** (nuevo) — definir rutas y aplicar `autenticacion` + `autorizacion('superadmin')`.
- **`server/controladores/admin.js`** (nuevo) — handlers de empresas y administradores.
- **`server/servicios/admin.js`** (nuevo) — lógica de negocio, transacciones y validaciones de dominio.
- **`server/repositorios/empresas.js`** (nuevo) — acceso a tabla `empresa`.
- **`server/repositorios/usuarios.js`** (nuevo o reutilizar existente) — acceso a tabla `usuario` para administradores.
- **`server/validaciones/admin.js`** (nuevo) — normalización de body/query/params.

### `/client`

- **`client/src/App.jsx`** — agregar vista `admin` a `VISTAS`.
- **`client/src/componentes/ArmazonPanel.jsx`** — agregar sección "Administración" condicional para `superadmin`.
- **`client/src/paginas/AdminEmpresas.jsx`** (nuevo) — listado, filtros, crear/ver/editar empresas.
- **`client/src/paginas/AdminUsuarios.jsx`** (nuevo) — listado, filtros, crear/ver/editar administradores.
- **`client/src/componentes/FormularioEmpresa.jsx`** (nuevo) — formulario de empresa con subformulario de admin inicial.
- **`client/src/componentes/FormularioUsuario.jsx`** (nuevo) — formulario de administrador adicional.
- **`client/src/servicios/admin.js`** (nuevo) — cliente HTTP para `/api/v1/admin/**`.

### No se tocan

- `server/db/schema.sql` (el schema ya soporta el modelo).
- `.env` ni credenciales.
- Lógica de login (SD-013 atacará el 409 multi-tenant después).

## Orden de trabajo

1. **Backend (T-001 y T-002):** construir endpoints CRUD de empresas y administradores, repositorios, validaciones y reglas de negocio.
2. **Frontend (T-003 y T-004):** una vez cerrado el contrato, construir la sección Administración y pantallas de empresas/administradores.
3. **QA (T-005):** verificar integración end-to-end, roles, paginación y contraseña visible.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Dejar empresa huérfana si falla la creación del admin | Envolver empresa + admin en `enTransaccion` (BEGIN/COMMIT/ROLLBACK). |
| Confusión de roles (superadmin vs admin) | El middleware `autorizacion('superadmin')` en toda la ruta `/admin`. El servicio valida que un admin tenga `empresa_id`. |
| Login multi-tenant no resuelto (409 por correo repetido) | Documentar que SD-013 lo resolverá; por ahora los correos de admin deben ser únicos globalmente o probar con correos distintos. |
| Contraseña `"123"` en producción | Advertencia explícita en spec, código y UI; no habilitar en builds de producción hasta reemplazarla. |
| Duplicidad de lógica de paginación | Reutilizar helpers de paginación del proyecto (ver `servicios/sucursales.js`). |

## Notas de diseño

- UI "papel de caja": bordes finos, sombra sólida, tipografía `font-display`/`font-mono`.
- Al crear empresa, mostrar un modal o banner de confirmación con los datos del admin y la contraseña `"123"` destacada, con botón para copiar.
- Los listados usan el componente `Paginacion` existente con opciones 5/10/15/20.
- Para superadmin, ocultar/separar las secciones operativas (Productos, POS, etc.) de las de administración de plataforma.
