---
name: creador-agentes
description: Úsala siempre que necesites crear, definir o estructurar un nuevo agente o subagente especializado para un proyecto.
---

# Generador de Agentes y Subagentes Especializados

Esta skill define la estructura, reglas y formato estándar para crear archivos de definición de agentes (subagentes) dentro de un proyecto.

## Reglas de Creación

1. **Formato:** Los agentes siempre se definen en un archivo Markdown con un bloque de encabezado YAML (frontmatter).
2. **Estructura fija:** Todos los agentes deben incluir:
   - Frontmatter con `description` y `mode: subagent`.
   - Título principal con el Rol y Nombre del Proyecto.
   - Declaración explícita de rol ("Actúas como...").
   - Reglas de arquitectura y código (delimitando claramente el alcance de carpetas).
   - Comandos de desarrollo y verificación.
   - Guardarraíles (límites estrictos de lo que NO puede hacer).
   - Flujo de trabajo paso a paso.
3. **Aislamiento de Alcance:** Cada subagente debe tener delimitadas las carpetas que **puede editar** y las que **tiene prohibido modificar**.
4. **Idioma:** Español por defecto para la definición, comentarios y documentación.

---

## Plantilla Base para el Nuevo Agente

Usa la siguiente plantilla como estructura obligatoria al generar el archivo del nuevo agente:

```markdown
---
description: [Descripción clara de qué hace el agente, qué carpetas gestiona y cuáles no]. Úsalo para [casos de uso específicos].
mode: subagent
---

# [Nombre del Agente] — [Nombre del Proyecto]

Actúas como un [Rol / Especialidad Senior]. Tu responsabilidad exclusiva es [misión principal del agente].

## Reglas de Arquitectura y Código

1. **Alcance:** Modifica únicamente archivos dentro de `[carpeta/asignada]`. No edites `[carpeta/prohibida]`.
2. **Estructura de carpetas obligatoria:**
3. **Estándares de Código:** [Patrones de diseño, convenciones de nombrado, consumo de APIs o base de datos].
4. **Manejo de Errores y Seguridad:** [Políticas de excepciones, autenticación, contratos de respuesta JSON].
5. **Idioma:** Español para variables, mensajes, comentarios y documentación.

## Comandos

- **Dev:** `[comando de desarrollo]`
- **Lint / Check:** `[comando de verificación]`
- **Build:** `[comando de compilación si aplica]`

## Guardarraíles

- **Pregunta antes de** instalar dependencias nuevas o modificar configuraciones/esquemas compartidos.
- **Nunca** edites archivos fuera de tu alcance asignado (`[carpeta/prohibida]`).
- **Nunca** escribas credenciales, llaves de API o secretos en el código.

## Flujo de trabajo

1. Confirma el requerimiento y verifica que los archivos objetivo estén dentro de `[carpeta/asignada]`.
2. Diseña la solución respetando la arquitectura del módulo.
3. Implementa los cambios siguiendo la cadena de responsabilidades.
4. Ejecuta las verificaciones o linters correspondientes.
5. Reporta brevemente los cambios realizados y los supuestos pendientes.