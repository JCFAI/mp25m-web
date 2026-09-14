# MP25M — Diseño técnico previsto del Incremento 8

## Alcance técnico de 8A

Este diseño implementará Articulaciones como un módulo nuevo y separado de Oportunidades, reutilizando autenticación, accesos internos, auditoría y patrones server-only existentes.

Entidades previstas:

| Entidad | Propósito |
|---|---|
| `mp25m.opportunity_articulations` | Articulación ligada obligatoriamente a una oportunidad: objetivo, estado, responsable, cierre y fechas. |
| `mp25m.opportunity_articulation_participants` | Participantes explícitos con FK verificable a persona u organización canónica. |
| `mp25m.opportunity_articulation_followups` | Novedades, reuniones, compromisos o avances registrados manualmente. |
| `mp25m_api.opportunity_articulation_list` | Lectura server-only para el detalle de oportunidad. |

No se utilizarán referencias polimórficas sin integridad. Los participantes se modelarán con columnas excluyentes para persona u organización y una restricción que garantice exactamente una de ellas.

## Operaciones previstas

Las escrituras se resolverán con funciones `security invoker` en `mp25m_api`, `search_path` explícito y privilegios sólo para `service_role`:

- `create_opportunity_articulation`
- `transition_opportunity_articulation`
- `set_opportunity_articulation_responsible`
- `add_opportunity_articulation_participant`
- `remove_opportunity_articulation_participant`
- `create_opportunity_articulation_followup`

Cada operación validará usuario interno activo, permiso, alcance sobre la oportunidad y coherencia de estado en forma transaccional. Las operaciones de transición registrarán estados anterior y posterior; no se permitirá cerrar sin responsable, motivo y síntesis.

## Interfaz prevista

El detalle `/panel/oportunidades/[id]` incorporará una sección **Articulaciones** con listado, formulario de alta y controles de gestión. La navegación lateral sólo habilitará la ruta independiente cuando exista un listado propio útil; 8A se concentra en el contexto de la oportunidad para evitar un módulo vacío.

`lib/opportunities/articulations.ts` contendrá tipos, lecturas y operaciones de servidor. Las acciones de la página validarán formularios, traducirán errores de dominio y revalidarán el detalle después de cada cambio.

## Auditoría y pruebas

Los eventos seguirán la convención `opportunity.articulation.*` y guardarán responsable, estado, motivo, participantes y datos antes/después según corresponda. Las pruebas cubrirán creación, activación, participantes, seguimiento, cierre, restricciones de permisos y ausencia de efectos sobre cobertura/requerimientos.

## Compatibilidad

No se renombrarán contratos históricos que usan `articulation` para lecturas de oportunidades. Las entidades de este incremento tendrán nombres completos `opportunity_articulation_*` y FKs hacia tablas reales. No se crean tablas de proyectos, participaciones de proyecto, economía, agenda ni comunicaciones.
