# Plan de ejecución — SD-021

## Contrato de API

### POST /api/v1/auth/login

Response 200:
  { success: true, data: { token, usuario: { id, nombre, correo, rol, empresa_id, empresa: { id, nombre, moneda } } } }

### GET /api/v1/auth/perfil

Response 200: mismo usuario con empresa.moneda.

### PATCH /api/v1/admin/empresas/:id

Request body: { moneda: "USD" } entre otros campos.
Validacion: moneda string de 3 caracteres ISO 4217.

## Archivos por capa

### /server
- server/servicios/auth.js — incluir empresa con moneda en login/perfil.
- server/repositorios/usuarios.js o empresas.js — JOIN con empresa.
- server/validaciones/admin.js — permitir moneda en PATCH empresa.

### /client
- client/src/utilidades/formatoMoneda.js — formatearMoneda(valor, moneda) con decimales condicionales.
- Todos los componentes que llaman formatearMoneda deben pasar usuario.empresa?.moneda.
- client/src/servicios/auth.js — guardar usuario.empresa.moneda.
- client/src/componentes/FormularioEmpresa.jsx — campo moneda.

## QA light
1. npm run lint --prefix client
2. npm run build --prefix client
3. npm test (identificar fallos preexistentes)
4. Healthcheck /api/v1/salud