# StockDaily

Sistema web full-stack de facturación, punto de venta y control de inventario en tiempo real para PYMES.

## Descripción

StockDaily permite a pequeñas y medianas empresas gestionar sucursales, productos, categorías, clientes, inventario y ventas desde un solo panel. El superadmin de la plataforma puede provisionar nuevas empresas y asignarles administradores iniciales.

## Stack tecnológico

- **Frontend:** React 19, Vite 8, Tailwind CSS v4, ESLint 10.
- **Backend:** Node.js, Express 5, PostgreSQL (pg), JWT (jsonwebtoken), bcrypt.
- **Base de datos:** PostgreSQL en Supabase.
- **Tests:** Node.js native test runner (`node --test`).

## Estructura del proyecto

```
StockDaily/
├── client/          # Aplicación React + Vite
├── server/          # API REST con Express
├── tests/           # Tests de integración
├── docs/            # Documentación de producto y backlog
├── specs/           # Especificaciones técnicas por feature
├── AGENTS.md        # Guía para agentes de código
├── MEMORY.md        # Memoria activa del proyecto
└── README.md        # Este archivo
```

## Requisitos previos

- Node.js (versión recomendada: 20 LTS o superior).
- PostgreSQL (o una instancia de Supabase).
- Cuenta de GitHub (si deseas subir el repositorio).

## Instalación

Cada paquete se instala de forma independiente:

```bash
# Backend
npm install --prefix server

# Frontend
npm install --prefix client
```

## Variables de entorno

### Backend (`server/.env`)

```env
DATABASE_URL=postgresql://usuario:password@host:puerto/bd
JWT_SECRETO=tu_secreto_jwt
JWT_EXPIRACION=24h
PORT=3000
```

### Frontend (`client/.env`)

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_USAR_MOCK_AUTH=false
```

> **Nota:** nunca commitees archivos `.env` con valores reales. Ambos paquetes ya incluyen `.env.example` como referencia.

## Comandos útiles

### Backend

```bash
# Desarrollo con nodemon
npm run dev --prefix server

# Producción
npm run start --prefix server
```

El backend expone la API bajo `/api/v1`. Healthcheck: `GET /api/v1/salud`.

### Frontend

```bash
# Desarrollo
npm run dev --prefix client

# Build de producción
npm run build --prefix client

# Lint
npm run lint --prefix client
```

### Tests

```bash
# Tests de integración (raíz)
npm test

# Tests del servidor (actualmente no hay tests en server/)
npm test --prefix server
```

## Convenciones importantes

- Idioma unificado: español en UI, variables, funciones, tablas y commits.
- Formato de dinero COP/USD centralizado en `client/src/utilidades/formatoMoneda.js`.
- Paginación obligatoria en todos los listados de API y tablas de UI.
- Errores API con sobre `{ success: false, error: "Mensaje" }`.
- Operaciones de facturación e inventario dentro de transacciones SQL.

## Estado actual del proyecto

Consulta `docs/backlog.md` y `MEMORY.md` para el estado detallado. Features principales implementadas:

- Autenticación JWT + bcrypt.
- Gestión de sucursales, productos, categorías y clientes.
- Punto de venta (POS) y facturación transaccional.
- Anulación de facturas.
- Inventario: carga inicial, ajustes y consulta de faltantes.
- Dashboard con métricas reales.
- Onboarding superadmin: empresas y administradores.
- Moneda por empresa (COP sin decimales, otras con 2 decimales).

## Despliegue

- **Frontend:** compatible con Vercel (build desde `client/`).
- **Backend:** compatible con Render o cualquier servicio Node.js (ejecutar `npm run start --prefix server`).
- **Base de datos:** migraciones y schema en `server/db/schema.sql`.

## Contribución

Este proyecto sigue un flujo Spec-Driven:

1. El `product-owner` define el alcance en `docs/backlog.md`.
2. El `planeador` redacta la spec en `specs/<accion>-<recurso>-<NNN>/`.
3. Los agentes `backend` y `frontend` implementan.
4. `qa` verifica y aprueba/rechaza.

Consulta `AGENTS.md` para más detalles.

## Licencia

ISC
