# Tareas — SD-010

## T-001 — Backend: CRUD de empresas

```yaml
T-001:
  spec: specs/onboarding-superadmin-001/spec.md
  objetivo: Implementar el backend para crear, listar, obtener y editar empresas desde el rol superadmin.
  capa: server
  alcance:
    permite:
      - server/rutas/admin.js (nuevo)
      - server/rutas/index.js (registrar ruta)
      - server/controladores/admin.js (nuevo)
      - server/servicios/admin.js (nuevo)
      - server/repositorios/empresas.js (nuevo)
      - server/validaciones/admin.js (nuevo)
    prohibe:
      - client/**
      - server/db/schema.sql (solo lectura; sin cambios)
      - .env
  contrato_api_v1:
    recurso: Empresas
    metodo_path: "POST /api/v1/admin/empresas"
    request:
      nombre: { tipo: "string", obligatorio: true, max: 150 }
      documento: { tipo: "string", obligatorio: false, max: 30 }
      moneda: { tipo: "string", obligatorio: false, default: "COP" }
      direccion: { tipo: "string", obligatorio: false, max: 200 }
      telefono: { tipo: "string", obligatorio: false, max: 30 }
      correo: { tipo: "string", obligatorio: false, max: 150 }
    data: { empresa: "object" }
    codigos: [201, 400, 401, 403, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint -> Number]
  negocio:
    transaccion: n/a (empresa sola; la creación con admin va en T-002)
    afecta_stock: false
    multi_tenant: n/a (superadmin ve todas las empresas)
    roles: [superadmin]
  criterios_aceptacion:
    - Endpoints GET/GET:id/PATCH de empresas funcionan bajo /api/v1/admin/empresas.
    - Listado paginado con pagina/por_pagina/activo.
    - PATCH permite editar campos de empresa y activar/desactivar.
    - Solo superadmin accede; administrador -> 403.
    - "npm test" en raíz pasa (tests nuevos o existentes).
  evidencia_requerida: |
    Ejecutar:
      npm test
      GET http://localhost:3000/api/v1/salud
    Reportar: salida de los comandos y confirmación de rutas registradas.
```

## T-002 — Backend: CRUD de administradores + creación atómica empresa + admin

```yaml
T-002:
  spec: specs/onboarding-superadmin-001/spec.md
  objetivo: Implementar CRUD de administradores y la creación atómica de empresa con su primer administrador, asignando contraseña "123".
  capa: server
  alcance:
    permite:
      - server/rutas/admin.js
      - server/controladores/admin.js
      - server/servicios/admin.js
      - server/repositorios/usuarios.js (nuevo o extender existente)
      - server/validaciones/admin.js
    prohibe:
      - client/**
      - server/db/schema.sql
      - .env
  contrato_api_v1:
    recurso: Administradores
    metodo_path: "POST /api/v1/admin/empresas"
    request:
      empresa: { nombre: "string" }
      admin: { nombre: "string", correo: "string" }
    data: { empresa: "object", administrador: "object", password: "string" }
    codigos: [201, 400, 401, 403, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint -> Number]
  negocio:
    transaccion: enTransaccion (empresa + admin deben crearse juntas o fallar juntas)
    afecta_stock: false
    multi_tenant: superadmin crea admins con empresa_id explícita del body
    roles: [superadmin]
  criterios_aceptacion:
    - POST /api/v1/admin/empresas crea empresa + admin en transacción y devuelve password "123".
    - POST /api/v1/admin/usuarios crea admin adicional para empresa existente.
    - GET/PATCH de administradores funcionan con paginación y filtro por empresa_id.
    - Desactivar empresa desactiva sus administradores.
    - Correo duplicado en misma empresa -> 409.
    - "npm test" pasa.
  evidencia_requerida: |
    Ejecutar:
      npm test
    Reportar: salida y descripción de la transacción implementada.
```

## T-003 — Frontend: sección Administración y gestión de empresas

```yaml
T-003:
  spec: specs/onboarding-superadmin-001/spec.md
  objetivo: Construir la UI para que el superadmin gestione empresas, incluyendo la creación con admin inicial y la visualización de la contraseña "123".
  capa: client
  alcance:
    permite:
      - client/src/App.jsx
      - client/src/componentes/ArmazonPanel.jsx
      - client/src/paginas/AdminEmpresas.jsx (nuevo)
      - client/src/componentes/FormularioEmpresa.jsx (nuevo)
      - client/src/servicios/admin.js (nuevo)
    prohibe:
      - server/**
      - .env
  contrato_api_v1:
    recurso: Empresas
    metodo_path: "POST /api/v1/admin/empresas"
    request: { nombre, documento, moneda, direccion, telefono, correo, admin }
    data: { empresa, administrador, password }
    codigos: [201, 400, 401, 403, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: n/a
    roles: [superadmin]
  criterios_aceptacion:
    - Sección "Administración" visible solo para superadmin en ArmazonPanel.
    - Pantalla AdminEmpresas lista, filtra, crea y edita empresas.
    - Formulario de creación incluye datos del admin inicial.
    - Tras crear, se muestra modal/banner con correo y contraseña "123" del admin.
    - "npm run lint --prefix client" y "npm run build --prefix client" pasan.
  evidencia_requerida: |
    Ejecutar:
      npm run lint --prefix client
      npm run build --prefix client
    Reportar: salida y breve descripción de la UI.
```

## T-004 — Frontend: gestión de administradores

```yaml
T-004:
  spec: specs/onboarding-superadmin-001/spec.md
  objetivo: Construir la UI para listar, crear y editar administradores de una empresa.
  capa: client
  alcance:
    permite:
      - client/src/paginas/AdminUsuarios.jsx (nuevo)
      - client/src/componentes/FormularioUsuario.jsx (nuevo)
      - client/src/servicios/admin.js
    prohibe:
      - server/**
      - .env
  contrato_api_v1:
    recurso: Administradores
    metodo_path: "POST /api/v1/admin/usuarios"
    request: { empresa_id: "number", nombre: "string", correo: "string" }
    data: { usuario, password }
    codigos: [201, 400, 401, 403, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [numeric/bigint -> Number]
  negocio:
    transaccion: n/a
    afecta_stock: false
    multi_tenant: empresa_id desde el body (superadmin la selecciona)
    roles: [superadmin]
  criterios_aceptacion:
    - Pantalla AdminUsuarios lista admins con filtro por empresa.
    - Formulario crea admin adicional y muestra password "123".
    - Se puede activar/desactivar un admin.
    - Lint y build del frontend pasan.
  evidencia_requerida: |
    Ejecutar:
      npm run lint --prefix client
      npm run build --prefix client
    Reportar: salida y confirmación de funcionalidad.
```

## T-005 — QA: verificación end-to-end

```yaml
T-005:
  spec: specs/onboarding-superadmin-001/spec.md
  objetivo: Verificar que superadmin pueda crear empresas y administradores, que los roles se respeten, y que no haya regresiones.
  capa: tests
  alcance:
    permite:
      - tests/**
      - ejecutar "npm test"
      - ejecutar "npm run lint --prefix client"
      - ejecutar "npm run build --prefix client"
    prohibe:
      - server/**
      - client/**
      - .env
  contrato_api_v1:
    recurso: Empresas y administradores
    metodo_path: "POST /api/v1/admin/empresas"
    request: { nombre, admin }
    data: { empresa, administrador, password }
    codigos: [201, 400, 401, 403, 409, 500]
    sobre: '{ "success": true, "data": ... } | { "success": false, "error": "..." }'
    casteo: [bigint -> Number]
  negocio:
    transaccion: enTransaccion
    afecta_stock: false
    multi_tenant: superadmin
    roles: [superadmin]
  criterios_aceptacion:
    - Tests de integración cubren creación de empresa + admin, 403 para no superadmin, 409 por correo duplicado, desactivación de empresa.
    - Lint y build del frontend pasan.
    - Backend healthcheck responde OK.
  evidencia_requerida: |
    Ejecutar:
      npm test
      npm run lint --prefix client
      npm run build --prefix client
      GET /api/v1/salud
    Reportar veredicto APROBADO o RECHAZADO con Fallos / Faltantes / Riesgos.
```

## Dependencias entre tareas

```
T-001 ─┐
       ├→ T-003 ─┐
T-002 ─┘          ├→ T-005
       ├→ T-004 ─┘
```

T-001 y T-002 pueden ir juntas en una sola pasada de backend. T-003 y T-004 pueden ir juntas en una sola pasada de frontend. T-005 siempre al final.
