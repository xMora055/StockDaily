---
description: Arranca una feature nueva bajo el flujo Spec-Driven de StockDaily (crea la spec y orquesta backend/frontend/qa).
agent: planeador
---

Vas a arrancar una nueva unidad de trabajo Spec-Driven en StockDaily.

Petición del usuario: $ARGUMENTS

Pasos:
1. Confirma el objetivo, las capas implicadas (`/server`, `/client` o ambas) y los supuestos pendientes. Si falta información del contrato `/api/v1`, pregunta antes de continuar.
2. Asigna un identificador `<accion>-<recurso>-<NNN>` en español (p. ej. `creacion-facturacion-001`); usa el siguiente `NNN` libre dentro de `specs/`.
3. Crea `specs/<accion>-<recurso>-<NNN>/` con:
   - `spec.md` — requisitos en sintaxis EARS (RF-###, EC-###), alcance dentro/fuera y criterios de aceptación.
   - `plan.md` — contrato `/api/v1` (recurso, método/path, request, forma de `data`, códigos), archivos por capa, orden de trabajo y riesgos.
   - `tasks.md` — tareas atómicas `T-###` ordenadas por dependencia, cada una con su bloque de handoff.
4. Fija el contrato `/api/v1` como fuente de verdad y decide el orden de despacho (backend/frontend/paralelo).
5. Delega en `backend` y/o `frontend` con la herramienta Task; al terminar ambos, cierra con `qa`; si QA rechaza, corrige y re-prueba hasta aprobar.
6. Reporta qué se especificó, qué cambió cada subagente y el veredicto de QA.
