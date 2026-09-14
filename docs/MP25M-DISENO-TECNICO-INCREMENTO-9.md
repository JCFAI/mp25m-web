# MP25M — Diseño técnico Incremento 9A

## Modelo

El incremento agrega `mp25m.projects`, `mp25m.project_status_history` y `mp25m.project_followups`. La relación con `opportunity_articulations` es única para evitar la duplicación accidental de una misma ejecución acordada.

## Acceso y auditoría

Las tablas usan RLS y quedan sin privilegios para clientes públicos. Las operaciones se realizan mediante funciones en `mp25m_api`, ejecutadas por el servidor con `service_role`. Cada alta, transición y novedad deja un evento en `mp25m.audit_events`.

## Interfaz

`/panel/proyectos` lista proyectos y permite iniciar uno desde una articulación elegible. `/panel/proyectos/[id]` reúne el estado, el responsable y el seguimiento. La ficha de una articulación cerrada ofrece un acceso directo a la creación, sin ejecutar ninguna conversión automática.
