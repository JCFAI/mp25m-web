# MP25M — Diseño técnico previsto del Incremento 7

## Estado y alcance de este documento

Diseño previsto, **sin implementación en 7.0**. Se apoya en la [especificación funcional](MP25M-ESPECIFICACION-FUNCIONAL-INCREMENTO-7.md) y en la [visión general](MP25M-DOCUMENTO-FUNCIONAL-V1.md). No contiene una migración ni autoriza cambios de esquema. Los nombres de tablas futuras describen intención arquitectónica; columnas, restricciones y contratos finales se definirán en cada subincremento.

La inspección de partida corresponde a `main`, commit `27d1535`, con el Incremento 6 cerrado. El repositorio usa Next.js App Router, clientes de servidor y acceso interno por rol/ámbito. Ya existen registro, detalle, edición, responsable, estados y seguimiento de oportunidades, actores de origen y candidatos provisionales; directorios de personas, nodos y organizaciones; habilidades personales, capacidades organizacionales, actividades y gobernanza de catálogos.

La ruta `/panel/oportunidades` se conserva. Algunos tipos, variables y vistas históricas usan `articulation` para lecturas de oportunidades, por ejemplo `person_articulation_list`, `node_articulation_list` y `organization_articulation_list`. 7.0 sólo corrige sus etiquetas visibles; no renombra esos contratos ni los interpreta como tablas del futuro módulo de articulaciones.

## Entidades actuales reutilizadas

| Entidad o infraestructura | Reutilización prevista |
|---|---|
| `mp25m.opportunities` | Identidad de la oportunidad y sus operaciones actuales. El análisis la amplía, no la reemplaza. |
| `mp25m.persons` | Actor persona canónico. |
| `mp25m.organizations` | Actor organización canónico, sin inferir pertenencia al MP25M por su mera existencia. |
| `mp25m.actor_candidates` | Candidatos provisionales de actores existentes; distintos de las futuras oportunidades candidatas del Radar. |
| `mp25m.person_skills` | Evidencia inicial de habilidades personales. |
| `mp25m.organization_capabilities` | Evidencia inicial de capacidades organizacionales. |
| `mp25m.organization_activities` | Evidencia de lo que realiza la organización; no sustituye capacidad ni disponibilidad. |
| Catálogos `mp25m.skills` y `mp25m.activities` | Referencias canónicas opcionales de los requerimientos. |
| `mp25m.audit_events` | Auditoría de decisiones y cambios gobernados. |
| `mp25m.data_sources` y `mp25m.ingestion_records` | Fuentes y captura/ingesta para procedencia; evitar un segundo subsistema paralelo. |
| Roles/scopes y acceso interno actuales | Autenticación, autorización y alcance de lectura y operación. |

Se mantienen relaciones actuales de origen y nodos de oportunidades. Una coincidencia analítica no se incorpora a esas relaciones. El responsable actual de oportunidad no se convierte en un nuevo rol global.

## Arquitectura futura y tablas previstas

**Todas las tablas de esta sección son diseño previsto. 7.0 NO las crea.** Se prevé mantener entidades de dominio en `mp25m`, operaciones y lecturas gobernadas en `mp25m_api`, y consumidores server-only siguiendo la arquitectura actual.

| Tabla futura | Responsabilidad y relación conceptual |
|---|---|
| `opportunity_requirements` | Identidad estable del requerimiento, ligada a una oportunidad; determina su inclusión activa. |
| `opportunity_requirement_revisions` | Contenido inmutable de cada revisión del requerimiento, condiciones, criterio de satisfacción, obligatoriedad, peso y procedencia. |
| `opportunity_requirement_matches` | Coincidencia entre una revisión y un actor, con decisión gobernada. |
| `opportunity_requirement_match_foundations` | Múltiples fundamentos de una coincidencia: habilidad, capacidad, actividad o explicación manual y evidencia. |
| `opportunity_requirement_coverage_assessments` | Evaluación histórica inmutable de una revisión, responsable, fundamento, confianza y vigencia. |
| `opportunity_requirement_coverage_layers` | Lectura de una evaluación por capa de cobertura, con conclusión explícita. |
| `opportunity_requirement_coverage_contributions` | Coincidencias y aportes considerados en una capa de la evaluación; justifica combinaciones. |
| `opportunity_requirement_coverage_checks` | Verificaciones de adecuación técnica, escala, ubicación, plazo, disponibilidad, evidencia y otras dimensiones pertinentes. |
| `opportunity_gaps` | Brecha abierta por decisión explícita, vinculada a la oportunidad y al requerimiento que la motiva. |
| `opportunity_gap_actions` | Acciones de tratamiento de una brecha, con responsables, información y resultados. |
| `opportunity_analysis_snapshots` | Captura histórica explícita del análisis global de una oportunidad. |
| `opportunity_analysis_snapshot_requirements` | Requerimientos/revisiones y evaluaciones considerados por un snapshot, incluidos los no evaluados. |
| `opportunity_source_links` | Vínculos de la oportunidad con fuentes e ingestas existentes y su evidencia de origen. |
| `opportunity_candidates` | Futuras oportunidades externas candidatas a revisión; no oportunidades operativas directas. |
| `opportunity_candidate_signals` | Señales y evidencias de detección de una candidata, enlazadas al modelo de procedencia existente. |

Relaciones conceptuales principales:

```text
opportunity → requirement → immutable revision
revision → match → foundations
revision → coverage assessment → layers → contributions from matches
coverage assessment → checks
opportunity / requirement → explicitly opened gap → actions
opportunity → explicit snapshot → revisions and assessments considered
search profile / broad radar → radar → external finding → human review / classification
finding accepted as opportunity → candidate → review / acceptance → opportunity → 7A–7F
source / ingestion → opportunity source links
```

Este esquema expresa dependencias funcionales, no define todavía cardinalidades finales de todos los vínculos. Las relaciones deben preservar integridad referencial cuando se implementen y evitar atribuir cobertura a coincidencias de otra revisión.

## Identidad, revisiones y validación

El requerimiento conserva identidad estable mientras su contenido semántico se guarda en revisiones inmutables. No se pisan versiones anteriores. La obligatoriedad, peso 1–5, criterio, tipo, condiciones y referencias canónicas pertenecen al contenido evaluado y deben poder reconstruirse históricamente.

Una modificación semántica de contenido validado exige nueva revisión y validación. Deben conservarse decisiones, motivos, responsables y fechas de los estados Declarado, Pendiente de validación, Validado y Rechazado. La forma técnica de registrar eventos de validación se resolverá en 7A.2; la inmutabilidad del contenido no autoriza borrar la secuencia de decisiones.

Las coincidencias y evaluaciones apuntarán a una revisión concreta. Una revisión nueva no hereda automáticamente decisiones ni cobertura de la anterior. Archivar un requerimiento no elimina revisiones, evaluaciones o snapshots históricos.

## Coincidencias y búsqueda explicable

La búsqueda inicial será **READ-ONLY**. Consultará personas, organizaciones y candidatos provisionales pertinentes y devolverá posibles correspondencias directa, relacionada, contextual o manual, con sus fundamentos. No persistirá masivamente resultados de cada consulta.

Se persistirá ante decisión explícita o cuando corresponda materializar una sugerencia gobernada. Los estados funcionales serán sugerida, aceptada para análisis y descartada. Cada decisión debe conservar actor interno, fecha y motivo.

Un actor aparece una sola vez por revisión del requerimiento aunque existan múltiples fundamentos. La implementación deberá definir una clave de unicidad por revisión e identidad/tipo de actor. La representación física de las referencias a persona, organización o candidato se decidirá en 7B, con FKs hacia entidades existentes y sin referencias polimórficas no verificables. La canonicalización de un candidato debe resolver duplicaciones explícitamente, sin perder el fundamento histórico.

Un fundamento identifica el dato de origen y explica qué parte es inferencia o hipótesis. No transforma automáticamente una actividad en capacidad, ni una capacidad registrada en disponibilidad. La búsqueda y la persistencia de coincidencias no escriben asignaciones, actores operativos, participaciones o vínculos territoriales.

## Evaluaciones, capas y contribuciones

Las evaluaciones confirmadas serán históricas e inmutables. Una nueva evaluación sustituye la lectura actual mediante una nueva conclusión trazable, no mediante sobreescritura. La selección de la evaluación vigente debe considerar revisión, confirmación, alcance, vigencia y necesidad de revisión, no sólo la última fecha.

Capas iniciales:

- `network_mp25m`: contribuciones verificadas dentro del alcance de la red MP25M.
- `expanded_argentina`: lectura ampliada que incorpora actores argentinos externos pertinentes.

Extensiones futuras reservadas conceptualmente: `expanded_region` y `expanded_global`. No se activan por documentarlas. La pertenencia y la clasificación territorial necesitan evidencia y vigencia; la existencia de una persona u organización en el catálogo no prueba que integre la red.

Las contribuciones identifican coincidencias concretas y su aporte evaluado. La capa ampliada no se suma aritméticamente a la capa de red: puede incluir los mismos actores. Se deben evitar doble conteo y sumas automáticas de capacidades; la combinación requiere evaluación de dependencias y restricciones.

Las verificaciones distinguen adecuación técnica, escala, ubicación, plazo, disponibilidad, evidencia y otros controles. La conclusión será No evaluado, Cubierto, Parcialmente cubierto o Faltante, con confianza baja/media/alta. Cubierto con confianza baja debe rechazarse por reglas de dominio en las operaciones futuras. Una evaluación de cobertura no constituye compromiso operativo.

## Cobertura global, completitud y snapshots

La lectura global actual se calcula dinámicamente a partir de requerimientos activos y evaluaciones confirmadas vigentes. La fórmula funcional acordada es:

> Cobertura productiva = Σ(peso × valor de cobertura) / Σ(pesos de los requerimientos activos con evaluación confirmada vigente).

Valores: **Cubierto = 1; Parcialmente cubierto = 0,5; Faltante = 0**. Los requerimientos no evaluados no forman parte del denominador de cobertura; su ausencia se refleja mediante completitud.

`network_mp25m` y `expanded_argentina` usan el **mismo universo de requerimientos evaluados y el mismo denominador**. No se calculan sobre universos diferentes: varían las contribuciones evaluadas y el valor de cobertura de cada requerimiento, no el universo comparado. La cobertura ampliada Argentina representa la cobertura posible utilizando la red MP25M más contribuciones argentinas externas evaluadas. 7D implementará y verificará esta regla ya definida funcionalmente.

Si no existe ningún requerimiento con evaluación confirmada vigente, se informa que **todavía no existe cobertura calculable**, sin interpretarla como 0 %. La completitud debe mostrar la ausencia de análisis.

La completitud es independiente: requerimientos activos con evaluación confirmada vigente / requerimientos activos identificados. La interfaz deberá mostrar numerador, denominador, capa y pendientes; sin universo identificado no se afirmará cobertura completa.

Se muestran separadamente obligatorio faltante (bloqueante confirmado), obligatorio parcial (cobertura crítica incompleta) y obligatorio no evaluado (incertidumbre crítica). Ningún score agregado reemplaza estas explicaciones.

Los snapshots se generan explícitamente y conservan el universo considerado, revisiones, evaluaciones o ausencia de ellas, capas, pesos, fórmula/versión de cálculo, fecha, responsable y resultados. Deben permitir reconstruir el análisis aun si cambian los datos actuales. Una evaluación vencida o un cambio posterior puede señalar **requiere revisión** en la lectura actual, sin reescribir el snapshot ni la evaluación histórica.

## Brechas y acciones

Una brecha no se crea automáticamente desde Faltante. Su apertura, responsable, tipo, estado y fundamento son decisiones explícitas. La brecha mantiene la relación con la oportunidad y la revisión que motivó su apertura; el tratamiento de revisiones posteriores deberá ser explícito.

Las acciones tienen identidad propia y pertenecen a una brecha. Registrar una acción de búsqueda, contacto, verificación, desarrollo o reanálisis no implica que se haya ejecutado. La evidencia obtenida puede sustentar coincidencias y nuevas evaluaciones. Resolver la brecha no actualiza la cobertura: acción → información → coincidencia/evidencia → nueva evaluación → mejora de cobertura → resolución explícita.

Tipos y estados funcionales se detallan en la especificación. No se fija aún un catálogo técnico exhaustivo de transiciones o cardinalidad para brechas que afecten a varios requerimientos.

## Seguridad y auditoría previstas

Se reutilizarán `getInternalAccess()`, clientes de servidor y el patrón de operaciones en `mp25m_api`. Las credenciales administrativas permanecen server-only. Las futuras operaciones deberán comprobar usuario activo, permisos y alcance tanto en la capa de servidor como en la operación de base pertinente; la UI no es una frontera de autorización.

Se contemplan `administrator`, `validator`, `articulator`, `node_referent`, `participant` y `authority_analyst`. La matriz de lectura, formulación, validación, evaluación y confirmación por ámbito se definirá antes de cada operación; no se concede permiso global por listar un rol en este documento. Responsable de oportunidad es una relación concreta, compatible con la asignación existente.

Las operaciones futuras seguirán los patrones actuales: privilegios mínimos, funciones con `security invoker` y `search_path` explícito donde corresponda, acceso administrativo restringido, validación transaccional y control de concurrencia de decisiones incompatibles. Esto es intención de diseño; 7.0 no cambia SQL, RLS, auth, roles ni scopes.

Las decisiones relevantes deberán producir eventos en `mp25m.audit_events`, conservando responsable, fecha, fundamento, alcance, vigencia, revisión, entidad afectada y estados antes/después cuando corresponda. Confirmaciones, descartes, nuevas revisiones, evaluaciones, aperturas/cierres de brechas y snapshots requieren trazabilidad. Los nombres de eventos nuevos se definirán en sus subincrementos; no se renombran eventos existentes.

Quien consulta no necesariamente confirma; quien formula no necesariamente valida. La auditoría acompaña a la historia de dominio, no la sustituye. El endurecimiento 7F no posterga la autorización y auditoría básicas de 7A–7E.

## Procedencia externa y Radar

Reutilizar `data_sources` e `ingestion_records`, evitando fuentes/ingestas paralelas. Se prevén origen, método de detección, fuente, captura histórica, país, mercado objetivo, publicación, detección, vencimiento, organización emisora, identificador externo y procedencia por requerimiento.

El Radar futuro producirá primero una señal o hallazgo externo, con fuente e ingesta trazables, para revisión humana y clasificación. Sólo una señal aceptada como oportunidad podrá materializarse en `opportunity_candidates` y conservar sus señales de procedencia. Detectada, pendiente de revisión, aceptada, descartada, duplicada y expirada siguen siendo estados conceptuales de la candidata. Su revisión/aceptación gobernada podrá producir una oportunidad MP25M, conservando la procedencia y recorriendo el mismo núcleo 7A–7F; no se crea una ruta analítica alternativa a la manual. `opportunity_candidate_signals` no presupone que todo hallazgo externo sea una candidata.

7G será preparación mínima de procedencia, no implementación de detección automática. La necesidad de materializar cada tabla de candidatas/señales se confirmará en ese alcance o se diferirá al Radar. 7.0 no crea ninguna de ellas.

### Punto de extensión futuro: Radar dirigido y perfiles de búsqueda

**Perfil de búsqueda productiva: intención de búsqueda definida manualmente a partir de actores, capacidades, combinaciones de capacidades, temas, mercados u objetivos de interés, utilizada para detectar señales externas potencialmente relevantes para el MP25M.**

El **Radar amplio** parte del mapa general de capacidades; el **Radar dirigido** parte de un perfil manual seleccionado. Ambos producirán señales gobernadas y explicables, no oportunidades operativas, articulaciones, proyectos ni asignaciones directas. Se admiten conceptualmente entradas combinables **capacidades → mercado**, **actores → oportunidades** e **interés → oportunidades**.

Los criterios futuros podrán incluir actores, capacidades, habilidades, actividades, combinaciones, temas, sectores, tecnologías, mercados, territorios, países/regiones, modalidad presencial/remota/exportable, objetivo y preferencia económica rentada/no rentada/indistinta. Objetivos ilustrativos: trabajo, producto, servicio, subcontratación, proyecto conjunto, I+D, cooperación, capacitación, financiamiento, fortalecimiento institucional o alianzas. No se fija todavía taxonomía ni estructura técnica definitiva.

La búsqueda puntual corresponde a una consulta concreta. Un perfil guardado será persistente y reutilizable; su persistencia, monitoreo periódico, alertas recurrentes y búsqueda continua quedan fuera del Incremento 7.

**Señal / hallazgo externo:** información externa detectada por el Radar que podría resultar relevante para el MP25M y que requiere revisión humana antes de generar cualquier entidad operativa. Puede representar una convocatoria, licitación, demanda, búsqueda de socios, financiamiento, cooperación, organización, fuente o tema/mercado de interés, incluida una iniciativa rentada o no rentada. La clasificación humana podrá derivar en oportunidad candidata, actor externo de interés, fuente relevante, tema/mercado a seguir, duplicado o irrelevante. Sólo la rama aceptada como oportunidad continúa por candidata → revisión/aceptación → oportunidad MP25M → 7A–7F.

Fuera de la lista de tablas previstas del Incremento 7, se registran únicamente estos **nombres ilustrativos de extensiones futuras**, no contratos definitivos ni tablas para implementación inmediata:

- `productive_search_profiles`.
- `productive_search_profile_actors`.
- `productive_search_profile_capabilities`.
- `productive_search_runs`.
- `external_radar_signals`.

La estructura definitiva se diseñará cuando se implemente el Radar. **7G sólo preserva compatibilidad y procedencia; 7.0 no crea ninguna tabla para Radar dirigido ni la entidad técnica de hallazgo.** No se crean IDs ni referencias sin FK a entidades inexistentes. La futura integración reutilizará fuentes/ingesta existentes y deberá diseñar sus relaciones verificables cuando existan los módulos correspondientes.

Para explicar por qué apareció un hallazgo se deberá conservar el perfil o búsqueda que lo originó, criterios utilizados, actores/capacidades semilla, temas/mercados, señales justificativas de relevancia, fecha de búsqueda/detección y fuente externa. La trazabilidad de una búsqueda puntual no exige implementar ahora perfiles persistentes.

**Un actor utilizado como semilla de una búsqueda del Radar no queda asignado, asociado ni comprometido con las oportunidades que esa búsqueda descubra.** Actor semilla ≠ coincidencia aceptada; actor semilla ≠ actor asignado; actor semilla ≠ participante de articulación; actor semilla ≠ participante de proyecto. Debe pasar por 7B antes de cualquier decisión analítica, y ésta tampoco equivale a participación operativa.

Los perfiles futuros podrán usar trayectoria productiva comprobada, combinaciones de actores que trabajaron juntos, contribuciones y resultados anteriores, además de capacidades declaradas. Una combinación exitosa de electrónica + software + IoT puede orientar la búsqueda de demanda similar; no prueba disponibilidad actual ni genera asignación automática. Por ejemplo, una convocatoria IoT agrícola detectada por criterios IoT/electrónica/software/Mercosur y proyectos rentados o de cooperación debe explicar esos criterios y sus semillas Organización A/Persona B, sin vincularlas operativamente a la oportunidad.

Esta extensión permanece dentro de la visión futura de 7G: no altera el roadmap 7.0 → 7A.1 → 7A.2 → 7B.1 → 7B.2 → 7C.1 → 7C.2 → 7D → 7E.1 → 7E.2 → 7F → 7G ni agrega 7H. Quedan fuera del Incremento 7 búsqueda web automática, scraping, APIs externas, monitoreo periódico, alertas automáticas, IA, ranking semántico, generación automática de requerimientos, creación automática de actores/oportunidades/articulaciones/proyectos y contacto automático con actores externos.

## Extensión futura: trayectoria productiva

La trayectoria productiva es el historial verificable de participación de una persona u organización en oportunidades, articulaciones y proyectos, con rol, contribución, resultados y evidencia. Futuras participaciones en articulaciones/proyectos y contribuciones/resultados podrán aportar fundamentos a coincidencias y cobertura.

Figurar como actor de origen, contacto o actor relacionado con una oportunidad no constituye por sí mismo trayectoria productiva comprobada. La trayectoria utilizable como fundamento futuro de coincidencia o evidencia de cobertura debe basarse en participación/contribución verificable, registrando según corresponda rol, contribución, contexto, resultado, evidencia y validación.

**Experiencia pasada ≠ disponibilidad actual ≠ asignación automática.** Esta precisión no crea tablas de articulaciones, proyectos, participaciones o contribuciones.

No se crean `project_participations`, `articulation_participations` ni referencias sin FK hacia tablas de módulos inexistentes. Cuando existan articulaciones y proyectos, nuevas migraciones podrán extender fundamentos con referencias verificables y evidencia histórica contextualizada.

Los resultados deberán retroalimentar capacidades y Radar mediante decisiones gobernadas. La experiencia pasada no prueba disponibilidad actual ni asigna participación en otra oportunidad. Se preservará quién hizo qué, en qué contexto, con qué evidencia y resultado.

## Orden exacto de implementación

| Subincremento | Entrega prevista |
|---|---|
| 7.0 | Alineación funcional/documental y nomenclatura. Único trabajo de esta etapa. |
| 7A.1 | Modelo y lectura de requerimientos. |
| 7A.2 | Gobernanza de requerimientos. |
| 7B.1 | Búsqueda explicable de candidatos. |
| 7B.2 | Persistencia y gobernanza de coincidencias. |
| 7C.1 | Modelo de evaluaciones. |
| 7C.2 | Cobertura explicable y confirmación. |
| 7D | Cobertura global, completitud y snapshots. |
| 7E.1 | Brechas. |
| 7E.2 | Acciones de brecha. |
| 7F | Endurecimiento transversal: permisos, auditoría, vigencia, consistencia y prueba end-to-end. |
| 7G | Preparación mínima para procedencia externa y Radar futuro. |

7.0 no implementa ninguno de los subincrementos posteriores. Cada uno requerirá diseño revisable, validación y autorización de su propio alcance.

## Decisiones diferidas

- Columnas, claves, índices, restricciones, catálogos de tipos/condiciones y contratos concretos de lectura/escritura.
- Matriz exacta de permisos y alcance; separación entre formular, validar y confirmar.
- Reglas de vigencia, invalidación y revisión, sin alterar evaluaciones históricas.
- Representación física de actores candidatos/canónicos y tratamiento de canonicalizaciones.
- Criterios verificables de pertenencia a la red y de inclusión territorial en las capas.
- Condiciones técnicas de confirmación y detalles técnicos finales de composición de capacidades.
- Transiciones de brechas/acciones y vínculos entre varias revisiones o requerimientos.
- Alcance mínimo de 7G y materialización posterior de candidatas/señales; fuentes, deduplicación y automatización del Radar.
- Entidades reales de articulaciones/proyectos, participaciones y contribuciones; se extenderán cuando esos módulos existan.

Estas decisiones no alteran los invariantes funcionales. No habilitan a crear relaciones operativas implícitas ni a presentar funciones futuras como implementadas.
