# Tareas — SD-021

## T-001 — Backend: exponer moneda en auth y permitir editarla

- spec: specs/moneda-empresa-001/spec.md
- objetivo: Incluir empresa.moneda en login/perfil y permitir editar moneda en PATCH empresa.
- capa: server
- alcance permite: server/servicios/auth.js, server/repositorios/**, server/validaciones/admin.js
- alcance prohibe: client/**, server/db/schema.sql, .env
- criterios:
  1. Login/perfil devuelven empresa.moneda.
  2. PATCH /api/v1/admin/empresas/:id acepta moneda.
  3. npm test pasa (o se identifican fallos preexistentes).
- evidencia: salida de npm test y descripcion de cambios.

## T-002 — Frontend: formatearMoneda por empresa

- spec: specs/moneda-empresa-001/spec.md
- objetivo: Hacer que formatearMoneda use la moneda de la empresa y actualizar todos los llamados.
- capa: client
- alcance permite: client/src/utilidades/formatoMoneda.js, client/src/**
- alcance prohibe: server/**, .env
- criterios:
  1. formatearMoneda(valor, moneda) funciona para COP y USD.
  2. Todos los valores monetarios usan la moneda de la empresa.
  3. npm run lint --prefix client y npm run build --prefix client pasan.
- evidencia: salida de lint/build y descripcion de cambios.

## T-003 — QA light

- spec: specs/moneda-empresa-001/spec.md
- objetivo: Verificacion reducida: lint/build, healthcheck y tests criticos de moneda.
- capa: tests
- alcance permite: tests/**, ejecutar comandos
- alcance prohibe: server/**, client/**, .env
- criterios:
  1. npm test pasa (o fallos preexistentes identificados).
  2. Lint/build frontend pasan.
  3. Healthcheck OK.
- evidencia: veredicto APROBADO/RECHAZADO con Fallos/Faltantes/Riesgos.