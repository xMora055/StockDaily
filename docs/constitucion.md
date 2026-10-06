# Constitución de StockDaily

1. **Simplicidad y Desacoplamiento:** Frontend (`/client`) y Backend (`/server`) están 100% separados.
2. **Integridad Transaccional:** Toda venta o ajuste de inventario DEBE ejecutarse dentro de una transacción SQL atómica (`BEGIN ... COMMIT`).
3. **Tests como Puerta de Entrada:** Ninguna tarea se da por finalizada si las pruebas unitarias o de integración están en rojo. El runner nativo es `node --test`: `npm test` en la raíz descubre `tests/**/*.test.js`.
4. **La Spec Manda:** Ningún agente escribirá código fuera de lo aprobado explícitamente en la spec correspondiente. Cada unidad de trabajo vive en `specs/<accion>-<recurso>-<NNN>/` (por ejemplo `specs/creacion-facturacion-001/`) con `spec.md`, `plan.md` y `tasks.md`, redactados por el agente `planeador`.
5. **Formato de Respuesta Estándar:** La API responderá siempre con JSON estructurado `{ "success": boolean, "data": ..., "error": ... }`.
6. **Idiomas del Proyecto:** Código, nombres de variables, funciones, tablas, carpetas, specs y commits en **Español**. Interfaz de usuario (UI), especificaciones y documentación también en **Español**.
