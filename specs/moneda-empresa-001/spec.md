# SD-021 — Moneda por empresa

**Spec ID:** moneda-empresa-001
**Backlog ID:** SD-021
**Estado:** Listo para ejecutar
**Capas afectadas:** /server, /client
**Fecha:** 2026-10-06

## Contexto

client/src/utilidades/formatoMoneda.js tiene la constante MONEDA = 'COP' quemada. Como consecuencia, aunque empresa.moneda sea 'USD', todo el sistema muestra precios y totales en pesos colombianos. Además, el login y el perfil no devuelven la moneda de la empresa.

## Objetivo

Hacer que la UI respete la moneda configurada en empresa.moneda, con el formato adecuado: COP sin decimales, otras monedas con 2 decimales.

## Decisiones de producto confirmadas

1. **Formato:** ormatearMoneda(valor, moneda). Si moneda === 'COP', sin decimales; cualquier otra moneda, 2 decimales.
2. **Moneda editable:** el superadmin puede cambiar moneda de una empresa existente vía PATCH /api/v1/admin/empresas/:id.
3. **Aplicación:** cambio visual inmediato en toda la UI (histórico y futuro); no se alteran valores guardados.

## Requisitos funcionales (EARS)

- **RF-001** CUANDO un usuario inicie sesión, EL SISTEMA DEBE incluir la moneda de su empresa en la respuesta de login.
- **RF-002** CUANDO un usuario autenticado consulte su perfil, EL SISTEMA DEBE incluir la moneda de su empresa.
- **RF-003** CUANDO ormatearMoneda reciba un valor y una moneda, EL SISTEMA DEBE usar Intl.NumberFormat con el código de moneda recibido.
- **RF-004** CUANDO la moneda sea COP, EL SISTEMA DEBE mostrar el valor sin decimales.
- **RF-005** CUANDO la moneda sea distinta de COP, EL SISTEMA DEBE mostrar el valor con 2 decimales.
- **RF-006** CUANDO ormatearMoneda no reciba moneda, EL SISTEMA DEBE usar COP como default.
- **RF-007** CUANDO el frontend renderice un valor monetario, EL SISTEMA DEBE pasar usuario.empresa?.moneda a ormatearMoneda.
- **RF-008** CUANDO el superadmin edite una empresa, EL SISTEMA DEBE permitir cambiar el campo moneda.

## Casos límite

- **EC-001** Empresa sin moneda: default a COP.
- **EC-002** Superadmin (empresa_id = NULL): default a COP.
- **EC-003** Moneda inválida en PATCH empresa: 400.
- **EC-004** Cambio de moneda: facturas históricas cambian de símbolo visualmente, no su valor numérico.

## Criterios de aceptación verificables

1. Login y perfil devuelven data.usuario.empresa.moneda.
2. PATCH /api/v1/admin/empresas/:id acepta moneda.
3. ormatearMoneda(1000, 'COP') sin decimales; ormatearMoneda(1000, 'USD') con 2 decimales.
4. Todas las llamadas a ormatearMoneda pasan la moneda de la empresa.
5. Lint/build pasan; tests críticos pasan (QA light).