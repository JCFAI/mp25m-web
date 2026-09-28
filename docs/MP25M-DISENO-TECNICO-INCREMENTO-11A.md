# MP25M — Diseño técnico Incremento 11A
## Resultados y aprendizaje

## 1. Objetivo técnico

Implementar un modelo explícito y trazable para Resultados de Articulaciones
y Proyectos, manteniendo la autonomía entre:

- Opportunity;
- Articulación;
- Proyecto;
- entregable;
- seguimiento;
- Resultado.

11A no incorpora economía monetaria ni automatizaciones.

## 2. Modelo de datos

### 2.1 `mp25m.results`

Tabla principal de Resultados.

Columnas propuestas:

```text
id                              uuid PK
articulation_id                 uuid NULL
project_id                      uuid NULL
result_type                     text NOT NULL
title                           text NOT NULL
description                     text NOT NULL
result_date                     date NOT NULL
evidence_reference              text NULL
created_by_internal_user_id     uuid NOT NULL
created_at                      timestamptz NOT NULL
updated_at                      timestamptz NOT NULL
voided_at                       timestamptz NULL
voided_by_internal_user_id      uuid NULL
void_rationale                  text NULL
```

### Origen exactamente uno

Debe cumplirse:

```text
(articulation_id IS NOT NULL) XOR (project_id IS NOT NULL)
```

Nunca ambos y nunca ninguno.

Foreign keys:

```text
articulation_id
  -> mp25m.opportunity_articulations(id)
  ON DELETE RESTRICT

project_id
  -> mp25m.projects(id)
  ON DELETE RESTRICT

created_by_internal_user_id
  -> mp25m.internal_users(id)
  ON DELETE RESTRICT

voided_by_internal_user_id
  -> mp25m.internal_users(id)
  ON DELETE RESTRICT
```

No existe `opportunity_id` en `results`.

Una Opportunity relacionada con la Articulación o Proyecto no se copia,
infiere ni materializa en el Resultado.

### Tipos

`result_type` admite inicialmente:

```text
productive
economic
territorial
organizational
strategic
institutional
communication
learning
other
```

`economic` es exclusivamente una clasificación cualitativa en 11A.

### Validaciones

- `title`: 3 a 200 caracteres.
- `description`: 3 a 10000 caracteres.
- `evidence_reference`: NULL o 3 a 2000 caracteres.
- `result_date`: obligatoria.
- La API de escritura rechazará fechas futuras.
- La anulación exige conjuntamente `voided_at`,
  `voided_by_internal_user_id` y `void_rationale`.
- `void_rationale`: 3 a 10000 caracteres.

Un Resultado anulado no se elimina físicamente.

### 2.2 `mp25m.result_contributions`

Registra contribuciones explícitas de actores a un Resultado.

Columnas propuestas:

```text
id                              uuid PK
result_id                       uuid NOT NULL
person_id                       uuid NULL
organization_id                 uuid NULL
contribution_summary            text NOT NULL
evidence_reference              text NULL
added_by_internal_user_id       uuid NOT NULL
added_at                        timestamptz NOT NULL
updated_at                      timestamptz NOT NULL
removed_at                      timestamptz NULL
removed_by_internal_user_id     uuid NULL
removal_rationale               text NULL
```

Foreign keys:

```text
result_id
  -> mp25m.results(id)
  ON DELETE RESTRICT

person_id
  -> mp25m.persons(id)
  ON DELETE RESTRICT

organization_id
  -> mp25m.organizations(id)
  ON DELETE RESTRICT

added_by_internal_user_id
  -> mp25m.internal_users(id)
  ON DELETE RESTRICT

removed_by_internal_user_id
  -> mp25m.internal_users(id)
  ON DELETE RESTRICT
```

### Actor exactamente uno

Debe cumplirse:

```text
(person_id IS NOT NULL) XOR (organization_id IS NOT NULL)
```

### Validaciones

- `contribution_summary`: 3 a 10000 caracteres.
- `evidence_reference`: NULL o 3 a 2000 caracteres.
- Una remoción exige conjuntamente:
  - `removed_at`;
  - `removed_by_internal_user_id`;
  - `removal_rationale`.
- `removal_rationale`: 3 a 10000 caracteres.

No se requiere que el actor sea participante actual ni histórico de la
Articulación o Proyecto.

La participación podrá utilizarse para priorizar candidatos en la interfaz,
pero nunca como requisito ni como creación automática de una contribución.

## 3. Índices

### Resultados

```text
results_articulation_idx
  (articulation_id, result_date desc, created_at desc)
  WHERE articulation_id IS NOT NULL

results_project_idx
  (project_id, result_date desc, created_at desc)
  WHERE project_id IS NOT NULL
```

### Contribuciones

```text
result_contributions_result_idx
  (result_id, added_at)
  WHERE removed_at IS NULL
```

Índices únicos parciales:

```text
(result_id, person_id)
WHERE removed_at IS NULL
  AND person_id IS NOT NULL

(result_id, organization_id)
WHERE removed_at IS NULL
  AND organization_id IS NOT NULL
```

Un mismo actor no puede tener dos contribuciones activas separadas para el
mismo Resultado en 11A.

Si necesita ampliarse la descripción, se corrige la contribución existente
con trazabilidad.

## 4. Permisos

Se incorpora:

```text
mp25m_api.can_manage_result(
  p_actor_internal_user_id uuid,
  p_result_id uuid
) returns boolean
```

La función resuelve el origen del Resultado y delega:

```text
articulation_id != NULL
  -> mp25m_api.can_manage_articulation(...)

project_id != NULL
  -> mp25m_api.can_manage_project(...)
```

No se crea un sistema paralelo de permisos para Resultados.

Para crear un Resultado:

```text
Articulación
  -> can_manage_articulation(...)

Proyecto
  -> can_manage_project(...)
```

Para modificar, anular o administrar contribuciones:

```text
can_manage_result(...)
```

## 5. API de escritura de Resultados

### 5.1 Crear Resultado

```text
mp25m_api.create_result(
  p_actor_internal_user_id uuid,
  p_articulation_id uuid,
  p_project_id uuid,
  p_result_type text,
  p_title text,
  p_description text,
  p_result_date date,
  p_evidence_reference text default null
)
returns table (
  result_id uuid,
  created_at timestamptz
)
```

Responsabilidades:

- validar origen XOR;
- validar tipo;
- validar textos;
- rechazar fecha futura;
- comprobar permiso sobre el origen;
- insertar Resultado;
- registrar `result.create` en `audit_events`.

No modifica ninguna otra entidad.

### 5.2 Corregir Resultado

```text
mp25m_api.update_result(
  p_actor_internal_user_id uuid,
  p_result_id uuid,
  p_result_type text,
  p_title text,
  p_description text,
  p_result_date date,
  p_evidence_reference text,
  p_rationale text
)
returns void
```

No permite cambiar el origen ni los datos de creación.

Responsabilidades:

- exigir Resultado no anulado;
- validar permiso;
- validar datos;
- exigir motivo;
- actualizar;
- registrar `result.update`;
- guardar `old_data` y `new_data`.

Cambiar el origen exige crear un Resultado nuevo y anular el incorrecto.

### 5.3 Anular Resultado

```text
mp25m_api.void_result(
  p_actor_internal_user_id uuid,
  p_result_id uuid,
  p_rationale text
)
returns void
```

Responsabilidades:

- validar permiso;
- impedir doble anulación;
- exigir motivo;
- completar datos de anulación;
- registrar `result.void`.

No borra contribuciones ni registros históricos.
La interfaz no ofrece DELETE físico.

## 6. API de contribuciones

### 6.1 Agregar contribución

```text
mp25m_api.add_result_contribution(
  p_actor_internal_user_id uuid,
  p_result_id uuid,
  p_person_id uuid,
  p_organization_id uuid,
  p_contribution_summary text,
  p_evidence_reference text default null
)
returns uuid
```

Responsabilidades:

- validar actor XOR;
- comprobar existencia del actor;
- comprobar `can_manage_result`;
- exigir Resultado no anulado;
- validar descripción y evidencia;
- impedir contribución activa duplicada;
- insertar contribución;
- registrar `result.contribution.add`.

No exige participación previa en la Articulación o Proyecto.

No modifica participantes existentes.

### 6.2 Corregir contribución

```text
mp25m_api.update_result_contribution(
  p_actor_internal_user_id uuid,
  p_contribution_id uuid,
  p_contribution_summary text,
  p_evidence_reference text,
  p_rationale text
)
returns void
```

No permite cambiar:

- `result_id`;
- `person_id`;
- `organization_id`;
- `added_by_internal_user_id`;
- `added_at`.

No permite sustituir silenciosamente una Persona por una Organización,
ni cambiar la identidad del actor.

Responsabilidades:

- exigir contribución activa;
- resolver su Resultado;
- validar `can_manage_result`;
- validar descripción y evidencia;
- exigir motivo de 3 a 10000 caracteres;
- actualizar;
- registrar `result.contribution.update`;
- guardar `old_data` y `new_data`.

Si se atribuyó la contribución al actor equivocado, debe retirarse la
contribución incorrecta y registrarse otra explícitamente.

### 6.3 Retirar contribución

```text
mp25m_api.remove_result_contribution(
  p_actor_internal_user_id uuid,
  p_contribution_id uuid,
  p_rationale text
)
returns void
```

Responsabilidades:

- exigir contribución activa;
- resolver su Resultado;
- validar `can_manage_result`;
- exigir motivo de 3 a 10000 caracteres;
- completar:
  - `removed_at`;
  - `removed_by_internal_user_id`;
  - `removal_rationale`;
- registrar `result.contribution.remove`.

La contribución retirada permanece en historial.

Una contribución retirada no cuenta como contribución activa.

El mismo actor puede volver a registrarse posteriormente como contribuyente,
mediante una nueva decisión explícita y un nuevo registro.

No existe DELETE físico operativo.

## 7. API de lectura

### 7.1 `mp25m_api.result_list`

Vista de lectura de Resultados.

Debe exponer como mínimo:

```text
result_id
articulation_id
project_id
source_type
source_id
source_title
result_type
title
description
result_date
evidence_reference
created_by_internal_user_id
created_by_display_name
created_at
updated_at
voided_at
voided_by_internal_user_id
voided_by_display_name
void_rationale
active_contribution_count
```

`source_type` sólo admite:

```text
articulation
project
```

`source_id` y `source_title` se obtienen exclusivamente de la FK propia
del Resultado.

La vista no:

- busca una Opportunity relacionada;
- infiere una Opportunity a través de una Articulación;
- infiere una Articulación a través de un Proyecto;
- modifica el origen registrado.

Por defecto, la interfaz operativa mostrará Resultados no anulados.

Los Resultados anulados seguirán disponibles para trazabilidad cuando una
vista o consulta histórica los solicite explícitamente.

### 7.2 `mp25m_api.result_contribution_list`

Vista de lectura de contribuciones.

Debe exponer como mínimo:

```text
contribution_id
result_id
person_id
organization_id
actor_type
actor_id
display_name
contribution_summary
evidence_reference
added_by_internal_user_id
added_by_display_name
added_at
updated_at
removed_at
removed_by_internal_user_id
removed_by_display_name
removal_rationale
```

`actor_type` sólo admite:

```text
person
organization
```

`actor_id` corresponde exclusivamente a `person_id` u `organization_id`
según el actor registrado.

Por defecto, la interfaz operativa mostrará contribuciones activas.

Las contribuciones retiradas seguirán disponibles para trazabilidad cuando
se solicite historial.

### 7.3 `mp25m_api.result_contributor_candidate_list`

Vista auxiliar para priorizar actores con participación histórica.

Debe exponer, como mínimo:

```text
source_type
source_id
actor_type
actor_id
display_name
is_current_participant
last_participated_at
```

La vista combinará exclusivamente participaciones directas de:

```text
opportunity_articulation_participants
project_participants
```

y no filtrará globalmente por `removed_at IS NULL`.

Deberá deduplicar por:

```text
source_type
source_id
actor_type
actor_id
```

`is_current_participant` indicará si existe al menos una participación activa
del actor en la entidad correspondiente.

`last_participated_at` conservará la fecha más reciente de alta registrada.

La vista no convertirá participantes de una Articulación vinculada en
participantes de un Proyecto.

Tampoco limitará el alta de contribuciones a los actores presentes en esta
vista: seguirá existiendo búsqueda general de Personas y Organizaciones
canónicas.

## 8. Selección de contribuyentes en la interfaz

La base de datos no restringirá las contribuciones a participantes previos.

La interfaz seguirá este criterio:

1. presentar primero actores que participaron en la Articulación o Proyecto;
2. incluir tanto participantes actuales como históricos como candidatos;
3. permitir además buscar otra Persona u Organización canónica;
4. exigir selección y confirmación explícitas;
5. no crear una contribución por el solo hecho de participar.

Para una Articulación se podrán reutilizar como fuente de candidatos los
registros de `opportunity_articulation_participants`.

Para un Proyecto se podrán reutilizar como fuente de candidatos los registros
de `project_participants`.

La condición `removed_at IS NULL` no se utilizará para excluir candidatos
históricos del selector de Resultados.

La interfaz deberá evitar duplicar visualmente un mismo actor si tuvo más de
un ciclo de participación.

La selección de un candidato histórico no reactiva su participación.

La selección de un contribuyente tampoco:

- modifica participantes;
- modifica habilidades;
- modifica capacidades;
- modifica disponibilidad;
- asigna responsabilidades;
- crea vínculos con Opportunities.


## 9. Auditoría

Las operaciones de escritura de 11A deberán registrar eventos en
`mp25m.audit_events`.

Acciones nuevas:

```text
result.create
result.update
result.void
result.contribution.add
result.contribution.update
result.contribution.remove
```

### Resultado

Para operaciones sobre un Resultado:

```text
target_schema = 'mp25m'
target_table  = 'results'
target_id     = result_id
```

### Contribución

Para operaciones sobre una contribución:

```text
target_schema = 'mp25m'
target_table  = 'result_contributions'
target_id     = contribution_id
```

### Datos de auditoría

Las altas deberán conservar en `new_data` la información relevante del
registro creado.

Las correcciones deberán conservar:

```text
reason
old_data
new_data
```

Las anulaciones o retiros deberán conservar el motivo y el estado anterior
y posterior cuando corresponda.

`metadata` deberá incluir contexto suficiente para interpretar el evento sin
inferir relaciones transitivas.

Para Resultados podrá incluir:

```text
result_id
articulation_id
project_id
```

Para contribuciones podrá incluir:

```text
result_id
articulation_id
project_id
person_id
organization_id
```

Los campos no aplicables permanecerán ausentes o nulos.

La auditoría no deberá fabricar `opportunity_id` a partir del origen.

## 10. Seguridad y acceso

Las tablas:

```text
mp25m.results
mp25m.result_contributions
```

tendrán RLS habilitado.

Se revocará el acceso directo operativo a:

```text
public
anon
authenticated
```

La lectura utilizada por la aplicación se expondrá mediante objetos
controlados de `mp25m_api`, siguiendo el patrón vigente del sistema.

Las vistas de lectura de 11A se limitarán a `service_role`, salvo que una
decisión posterior amplíe explícitamente ese contrato.

Las funciones de escritura:

- no confiarán en permisos enviados por el cliente;
- recibirán el `internal_user_id` del actor;
- resolverán permisos mediante las funciones existentes;
- validarán nuevamente el estado del registro dentro de la operación;
- no permitirán saltar las invariantes mediante escritura directa desde la
  interfaz.

Todas las funciones de escritura de 11A utilizarán explícitamente:

```text
SECURITY INVOKER
```

Este criterio replica el comportamiento efectivo de las APIs operativas
actuales y evita depender del valor por defecto de PostgreSQL.

Las funciones revocarán `EXECUTE` a:

```text
public
anon
authenticated
service_role
```

y luego otorgarán `EXECUTE` exclusivamente a `service_role`.

Las tablas revocarán acceso directo a `public`, `anon` y `authenticated`.
`service_role` recibirá únicamente los privilegios necesarios para lectura y
para ejecutar las operaciones de inserción y actualización utilizadas por las
funciones. No se otorgará `DELETE` operativo.

## 11. Integración de interfaz

### 11.1 Articulación

La ficha:

```text
/panel/articulaciones/[id]
```

incorporará una sección independiente:

```text
Resultados
```

Debe diferenciarse visual y conceptualmente de:

```text
Novedades y seguimiento
Síntesis de cierre
Participantes
Vínculos
```

La sección permitirá:

- listar Resultados activos;
- registrar un Resultado;
- consultar su evidencia;
- consultar contribuciones;
- agregar contribuciones;
- corregir un Resultado con motivo;
- retirar una contribución con motivo;
- anular un Resultado con motivo;
- consultar información histórica cuando corresponda.

Registrar un Resultado no cambia el estado de la Articulación.

Cerrar o reabrir una Articulación no crea, elimina ni modifica automáticamente
sus Resultados.

### 11.2 Proyecto

La ficha:

```text
/panel/proyectos/[id]
```

incorporará la misma sección:

```text
Resultados
```

Debe diferenciarse visual y conceptualmente de:

```text
Novedades y seguimiento
Participantes
Entregables y evidencia
Resumen final
Vínculos
```

Registrar un Resultado no cambia el estado del Proyecto.

Completar o reabrir un Proyecto no crea, elimina ni modifica automáticamente
sus Resultados.

Aceptar o modificar un entregable tampoco crea ni modifica un Resultado
estructurado.

### 11.3 Presentación

Cada Resultado deberá mostrar como mínimo:

```text
tipo
título
descripción
fecha del resultado
evidencia, si existe
cantidad de contribuyentes activos
fecha y usuario de registro
```

Una marca de Resultado económico deberá expresarse como clasificación
cualitativa y no como importe.

La interfaz de 11A no mostrará campos de:

```text
monto
moneda
costo
precio
ingreso
margen
honorario
aporte
pago
cobro
```


## 12. Integración con trayectoria futura

11A registra evidencia estructurada de resultados y contribuciones.

No convierte automáticamente esa evidencia en:

```text
habilidad
capacidad organizacional
validación
disponibilidad
cobertura de requerimiento
coincidencia
asignación
Opportunity
entrada del Radar
```

Una contribución histórica podrá ser utilizada en el futuro como evidencia
para construir trayectoria productiva verificable, pero esa utilización
deberá tener reglas propias y explícitas.

En particular:

```text
Resultado histórico != capacidad actual
Resultado histórico != disponibilidad actual
Contribución histórica != asignación actual
```

## 13. Alcance de la migración

La implementación de 11A se realizará mediante una migración nueva y
autocontenida.

La migración deberá crear, como mínimo:

```text
mp25m.results
mp25m.result_contributions
mp25m_api.result_list
mp25m_api.result_contribution_list
mp25m_api.result_contributor_candidate_list
mp25m_api.can_manage_result(...)
mp25m_api.create_result(...)
mp25m_api.update_result(...)
mp25m_api.void_result(...)
mp25m_api.add_result_contribution(...)
mp25m_api.update_result_contribution(...)
mp25m_api.remove_result_contribution(...)
```

También deberá incorporar:

- constraints;
- foreign keys;
- índices;
- RLS;
- grants y revokes;
- comentarios de esquema cuando correspondan;
- auditoría en las operaciones de escritura.

La migración no modificará registros históricos para fabricar Resultados.

No copiará automáticamente contenido desde:

```text
opportunity_articulations.closing_summary
projects.completion_summary
project_deliverables.result_summary
followups de tipo result
```

Tampoco alterará los vínculos existentes entre Opportunities, Articulaciones
y Proyectos.

## 14. Pruebas mínimas

La implementación deberá verificar como mínimo:

1. una Articulación puede tener múltiples Resultados;
2. un Proyecto puede tener múltiples Resultados;
3. un Resultado no puede tener dos orígenes;
4. un Resultado no puede quedar sin origen;
5. crear un Resultado de Articulación no exige Opportunity;
6. crear un Resultado de Proyecto no exige Opportunity;
7. no se infiere Opportunity desde la Articulación;
8. no se infiere Opportunity desde el Proyecto;
9. un usuario sin permiso sobre el origen no puede crear Resultados;
10. un usuario sin permiso no puede modificar ni anular Resultados;
11. una fecha futura es rechazada;
12. un Resultado anulado no puede modificarse;
13. una Persona y una Organización son mutuamente excluyentes como actor de
    una contribución;
14. una contribución requiere exactamente un actor;
15. participar no genera una contribución automáticamente;
16. contribuir no modifica la participación;
17. contribuir no modifica habilidades ni capacidades;
18. una contribución retirada permanece en historial;
19. una contribución retirada puede registrarse nuevamente de forma explícita;
20. corregir un Resultado registra motivo, `old_data` y `new_data`;
21. corregir una contribución registra motivo, `old_data` y `new_data`;
22. anular un Resultado queda auditado;
23. retirar una contribución queda auditado;
24. cerrar una Articulación no crea Resultados;
25. reabrir una Articulación no elimina Resultados;
26. completar un Proyecto no crea Resultados;
27. reabrir un Proyecto no elimina Resultados;
28. aceptar un entregable no crea Resultados;
29. un seguimiento de tipo `result` no crea un Resultado estructurado;
30. no se crean campos ni operaciones de economía monetaria.

## 15. Decisiones técnicas cerradas antes de la migración

### 15.1 Seguridad de funciones

Las funciones nuevas utilizarán explícitamente:

```text
SECURITY INVOKER
```

La aplicación accederá a ellas mediante `service_role`, siguiendo el patrón
vigente.

No se otorgará ejecución directa a `public`, `anon` ni `authenticated`.

### 15.2 Auditoría

11A reutilizará directamente:

```text
mp25m.audit_events
```

con el patrón vigente:

```text
action
target_schema
target_table
target_id
reason
old_data
new_data
result = 'allowed'
metadata
```

Las altas usarán `new_data`.

Las correcciones conservarán `old_data`, `new_data` y `reason`.

Las anulaciones y retiros conservarán motivo y contexto suficiente para
reconstruir la operación.

### 15.3 Nombres visibles

Se reutilizará la convención actual:

```text
Persona       -> mp25m.persons.display_name
Organización  -> mp25m.organizations.name
Usuario       -> mp25m.internal_users.display_name
```

Cuando una vista combine Personas y Organizaciones utilizará conceptualmente:

```text
COALESCE(person.display_name, organization.name)
```

### 15.4 Participantes históricos

Las vistas operativas actuales de participantes muestran solamente
participaciones activas y no son suficientes para construir el selector
histórico de 11A.

Por ese motivo se incorporará:

```text
mp25m_api.result_contributor_candidate_list
```

que considerará participaciones activas y retiradas, deduplicará actores y
marcará si la participación continúa activa.

La vista será sólo una fuente priorizada de candidatos y no una restricción
para registrar contribuciones.

### 15.5 Contribuciones múltiples del mismo actor

En 11A se adopta la regla:

```text
un actor -> como máximo una contribución activa por Resultado
```

Se crearán índices únicos parciales para Personas y Organizaciones.

Si un actor realizó varias acciones que contribuyeron al mismo Resultado,
éstas se describirán conjuntamente en `contribution_summary`.

Las correcciones posteriores conservarán trazabilidad mediante auditoría.

Una contribución retirada podrá registrarse nuevamente mediante un nuevo
registro explícito.

Si un incremento futuro necesita distinguir múltiples contribuciones
simultáneas del mismo actor, deberá incorporar una dimensión funcional
adicional antes de retirar esta restricción.

## 16. Invariantes técnicas finales

La implementación deberá preservar siempre:

1. Resultado pertenece exactamente a una Articulación o Proyecto.
2. Resultado no pertenece directamente a una Opportunity.
3. Ningún vínculo se infiere por transitividad.
4. Cierre no implica Resultado.
5. Entregable no implica Resultado.
6. Seguimiento no implica Resultado.
7. Participación no implica contribución.
8. Contribución no implica participación.
9. Contribución histórica no implica disponibilidad actual.
10. Resultado económico en 11A no contiene economía monetaria.
11. No existe borrado físico desde la operación normal.
12. Toda corrección relevante conserva trazabilidad.
