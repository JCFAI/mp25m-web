# MP25M — Diseño técnico — Incremento 12B

## Comunicaciones y convocatorias asistidas

## 1. Alcance técnico

El Incremento 12B incorpora un núcleo de comunicaciones trazables separado
de los proveedores externos de entrega.

La implementación se divide en dos capas:

### 12B.A — Preparación, audiencia y confirmación

Incluye:

- creación y edición de borradores;
- contexto de origen opcional y exacto;
- definición explícita de audiencia;
- resolución de audiencia a destinatarios concretos;
- exclusiones y agregados manuales;
- detección de duplicados;
- diagnóstico de disponibilidad de canal;
- confirmación humana de destinatarios;
- snapshot inmutable de cada resolución;
- trazabilidad de cambios;
- integración con Agenda mediante `Preparar comunicación`.

12B.A no envía mensajes.

### 12B.B — Contactabilidad y entrega

Quedan para una etapa posterior:

- política de consentimiento por canal;
- autorización efectiva de uso de un contacto;
- adaptadores Email;
- adaptadores WhatsApp;
- intentos de envío;
- resultados de proveedor;
- entregas confirmadas;
- plantillas externas;
- webhooks;
- creación de salas Google Meet;
- creación de salas Jitsi.

La ausencia de 12B.B deberá impedir cualquier envío real.

---

## 2. Principio central

El sistema deberá preservar técnicamente:

```text
contexto
≠ audiencia

audiencia
≠ destinatarios resueltos

destinatarios resueltos
≠ destinatarios confirmados

contacto disponible
≠ consentimiento

destinatarios confirmados
≠ mensaje enviado
```

---

## 3. Situación actual relevante

### Personas y contactos

Los contactos de Personas se encuentran en:

```text
mp25m.person_contacts
```

Actualmente contienen, entre otros datos:

```text
person_id
contact_type
value_original
label
is_primary
visibility
verified_at
active
```

Los tipos actualmente utilizados incluyen:

```text
email
phone
whatsapp
other
```

El esquema actual no contiene una autorización explícita de contacto
por canal.

Por lo tanto 12B.A podrá detectar la existencia técnica de un canal,
pero no considerarlo autorizado para envío.

### Organizaciones

Las Organizaciones poseen capacidades, relaciones territoriales y
participación operativa, pero no existe actualmente un modelo general
de contactos de Organización equivalente a `person_contacts`.

Una Organización podrá ser integrante de una audiencia.

Esto no autoriza a convertir silenciosamente a ninguna Persona vinculada
en su destinatario.

Mientras no exista un contacto institucional gobernado, una Organización
podrá aparecer como destinatario sin canal disponible.

### Responsables de Temas

Las responsabilidades de Temas utilizan:

```text
mp25m.theme_responsibilities.internal_user_id
```

Un responsable de Tema es por lo tanto un usuario interno.

No se deberá inferir automáticamente una Persona canónica ni reutilizar
el email de autenticación como canal de comunicación externo.

### Participantes

Los participantes vigentes de Proyectos se encuentran en:

```text
mp25m.project_participants
```

y pueden ser:

```text
person
organization
```

Las Articulaciones tienen el mismo concepto de participante autónomo.

La resolución de audiencia deberá conservar el tipo real del actor.

---

## 4. Entidad principal

Se propone:

```text
mp25m.communications
```

Campos principales:

```text
id uuid
communication_type text
status text

planned_channels text[]
audience_revision integer not null default 0

subject text
body text

generation_mode text
generation_metadata jsonb

person_id uuid
node_id uuid
organization_id uuid
opportunity_id uuid
articulation_id uuid
project_id uuid
theme_id uuid
need_offer_id uuid
agenda_entry_id uuid

current_resolution_id uuid

created_by_internal_user_id uuid
created_at timestamptz
updated_at timestamptz

cancelled_at timestamptz
cancelled_by_internal_user_id uuid
cancellation_rationale text
```

`generation_mode` inicialmente admitirá:

```text
manual
assisted
```

Registrar `assisted` no significa que 12B.A deba implementar todavía un
proveedor de IA.

El modelo simplemente preserva esa procedencia para cuando exista.

---

## 5. Contexto de origen

Una comunicación podrá tener cero o exactamente un contexto.

Contextos iniciales:

```text
person
node
organization
opportunity
articulation
project
theme
need_offer
agenda_entry
independent
```

La implementación utilizará claves foráneas explícitas.

Una restricción deberá garantizar que como máximo una FK de contexto
sea no nula.

El contexto:

- sirve para presentar información;
- puede sugerir una audiencia;
- puede ayudar a redactar;
- no crea relaciones operativas nuevas.

No se inferirán relaciones transitivas.

Ejemplo:

```text
Agenda → Proyecto → Articulación
```

no convierte automáticamente a la Articulación en contexto de la
comunicación.

---

## 6. Estados

12B.A utilizará inicialmente:

```text
draft
audience_resolved
recipients_confirmed
cancelled
```

Las transiciones deberán ser gobernadas.

No existirá estado `sent` operativo en 12B.A.

12B.B podrá extender posteriormente el ciclo con estados propios de
entrega sin reescribir el historial de 12B.A.

---

## 7. Definición de audiencia

Se propone:

```text
mp25m.communication_audience_criteria
```

Cada criterio tendrá:

```text
id
communication_id
audience_revision
group_no
criterion_type
criterion_operation

person_id
node_id
articulation_id
project_id
skill_id
theme_id
verification_statuses

created_by_internal_user_id
created_at
```

Tipos iniciales:

```text
person
node_participants
articulation_participants
project_participants
person_skill
organization_capability
theme_responsibles
```

Cada tipo utilizará solamente los identificadores que correspondan:

```text
person
→ person_id

node_participants
→ node_id

articulation_participants
→ articulation_id

project_participants
→ project_id

person_skill
→ skill_id + verification_statuses

organization_capability
→ skill_id + node_id opcional + verification_statuses

theme_responsibles
→ theme_id
```

Los identificadores no aplicables al tipo deberán permanecer en `null`.

No se utilizará `organization_id` para expresar el criterio
`organization_capability`: la capacidad se selecciona mediante el catálogo
común `mp25m.skills` y se resuelven las Organizaciones que la poseen.

`verification_statuses` se utilizará únicamente para:

```text
person_skill
organization_capability
```

y podrá contener solamente una combinación no vacía de:

```text
confirmed
candidate
self_reported
```

Nunca podrá contener:

```text
rejected
```

Si el usuario no amplía explícitamente el criterio, al guardarlo se
normalizará como:

```text
verification_statuses = ['confirmed']
```

La lista normalizada quedará persistida dentro de la revisión del criterio,
de modo que una resolución histórica no dependa de defaults futuros de UI.

`audience_revision` identifica la versión de la definición de audiencia a la
que pertenece cada criterio.

Los criterios de revisiones anteriores se conservarán como historia y no se
reescribirán.

`criterion_operation` permitirá inicialmente:

```text
include
exclude
```

`group_no` permitirá expresar combinaciones explícitas.

Los criterios de un mismo grupo deberán ser compatibles de acuerdo con la
semántica de conjuntos definida más adelante.

La resolución nunca creará:

```text
participaciones
responsabilidades
habilidades
capacidades
disponibilidad
compromisos
```

---

## 8. Semántica de resolución

### Persona explícita

Produce la Persona indicada.

La Persona deberá existir y ser visible para el actor según las reglas
vigentes del backoffice.

Resolverla como destinatario no crea ni modifica la Persona.

### Participantes de Nodo

Utiliza exclusivamente:

```text
mp25m.node_participations
```

Se considerarán vigentes solamente las participaciones que cumplan:

```text
status = active
verification_status = confirmed
started_on IS NULL OR started_on <= current_date
ended_on IS NULL OR ended_on >= current_date
```

El Nodo de contexto de una comunicación no se utilizará silenciosamente como
criterio de audiencia. Si se desea la audiencia de un Nodo deberá existir el
criterio explícito correspondiente.

### Participantes de Articulación

Utiliza únicamente:

```text
mp25m.opportunity_articulation_participants
```

con:

```text
removed_at IS NULL
```

No utiliza actores de Oportunidades vinculadas.

La resolución deberá conservar si el participante es:

```text
person
organization
```

### Participantes de Proyecto

Utiliza únicamente:

```text
mp25m.project_participants
```

con:

```text
removed_at IS NULL
```

No utilizará:

```text
mp25m_api.project_source_participant_list
```

ni incorporará automáticamente participantes de una Articulación de origen
o vinculada.

La resolución deberá conservar si el participante es:

```text
person
organization
```

### Personas por habilidad

Utiliza:

```text
mp25m.person_skills
```

y el catálogo:

```text
mp25m.skills
```

La relación deberá cumplir:

```text
person_skills.active = true
skills.active = true
skills.applies_to_person = true
```

Además, `verification_status` deberá pertenecer a la lista
`verification_statuses` guardada en el criterio.

Por defecto esa lista será:

```text
['confirmed']
```

El usuario podrá ampliar explícitamente la audiencia a:

```text
candidate
self_reported
```

`rejected` nunca será un estado admisible para resolución.

### Organizaciones por capacidad

Utiliza:

```text
mp25m.organization_capabilities
```

y el mismo catálogo:

```text
mp25m.skills
```

La relación deberá cumplir:

```text
organization_capabilities.active = true
skills.active = true
skills.applies_to_organization = true
```

Además, `verification_status` deberá pertenecer a la lista
`verification_statuses` guardada en el criterio.

Por defecto:

```text
['confirmed']
```

El usuario podrá ampliar explícitamente a:

```text
candidate
self_reported
```

`rejected` nunca será admisible.

Cuando el criterio no indique `node_id`, podrán resolverse capacidades
institucionales generales o capacidades registradas para cualquier Nodo.

Cuando el criterio indique explícitamente un `node_id`, solamente calificará
una capacidad que sea:

```text
organization_capabilities.node_id IS NULL
```

o:

```text
organization_capabilities.node_id = criterio.node_id
```

Una capacidad restringida a otro Nodo no calificará.

El Nodo del contexto de la comunicación no se aplicará automáticamente como
filtro de capacidades.

El resultado será una Organización.

No se transformará automáticamente la Organización en una Persona.

### Responsables de Tema

Utiliza responsabilidades vigentes de:

```text
mp25m.theme_responsibilities
```

con:

```text
ended_at IS NULL
```

El resultado será un:

```text
internal_user
```

No se inferirá una Persona asociada.

Tampoco se utilizará automáticamente el email de autenticación del usuario
interno como dato de contacto externo.

---

## 9. Resoluciones de audiencia

Resolver una audiencia producirá un snapshot nuevo.

Se propone:

```text
mp25m.communication_audience_resolutions
```

Campos principales:

```text
id uuid
communication_id uuid
resolution_no integer
criteria_snapshot jsonb

resolved_by_internal_user_id uuid
resolved_at timestamptz

confirmed_by_internal_user_id uuid
confirmed_at timestamptz
```

Cada resolución pertenece a una única comunicación.

`resolution_no` será creciente dentro de la comunicación.

Una resolución anterior nunca será reescrita.

Si se modifican los criterios después de resolver la audiencia, deberá
generarse una nueva resolución.

La comunicación podrá apuntar a la resolución vigente mediante:

```text
communications.current_resolution_id
```

La resolución deberá conservar una copia estructurada de los criterios
que efectivamente se utilizaron.

No deberá reconstruirse históricamente desde los criterios actuales.

---

## 10. Destinatarios resueltos

Se propone:

```text
mp25m.communication_resolution_recipients
```

Cada fila representa un actor concreto dentro de una resolución.

Campos principales:

```text
id uuid
resolution_id uuid

recipient_kind text

person_id uuid
organization_id uuid
internal_user_id uuid

display_name_snapshot text

manually_added boolean

included boolean
exclusion_reason text

email_availability_status text
whatsapp_availability_status text

duplicate_status text
diagnostic_detail text

created_at timestamptz
```

`recipient_kind` admitirá inicialmente:

```text
person
organization
internal_user
```

Exactamente una de las siguientes claves deberá estar informada:

```text
person_id
organization_id
internal_user_id
```

El nombre mostrado deberá conservarse también como snapshot para que
el historial siga siendo comprensible aunque cambie posteriormente el
nombre actual del actor.

---

## 11. Procedencia de destinatarios

Un destinatario puede haber sido encontrado por más de un criterio.

No se deberán crear múltiples destinatarios efectivos para el mismo
actor dentro de una resolución.

Para conservar la procedencia se propone:

```text
mp25m.communication_recipient_sources
```

Campos principales:

```text
id uuid
recipient_id uuid
criterion_id uuid
criterion_type text
source_detail jsonb
created_at timestamptz
```

De esta manera:

```text
Persona A
→ participante del Nodo X
→ además posee Habilidad Y
```

seguirá siendo un único destinatario, pero quedarán registradas ambas
razones por las que integró la audiencia.

Una incorporación manual utilizará una procedencia explícita:

```text
manual
```

y no fingirá provenir de un criterio automático.

---

## 12. Diagnóstico de canal en 12B.A

12B.A solamente diagnosticará disponibilidad técnica.

No autorizará el uso del canal.

Los estados de disponibilidad podrán distinguir inicialmente:

```text
available_unverified
available_verified
missing
restricted
unsupported_recipient
```

La condición de duplicado se registrará separadamente.

Estos valores son diagnósticos y no permisos de envío.

En particular:

```text
available_verified
≠ consentimiento
```

### Personas

Para una Persona podrán inspeccionarse únicamente los contactos que
el usuario actual tenga permitido utilizar o visualizar de acuerdo con
las reglas existentes.

Implementar Comunicaciones no ampliará el acceso actual a contactos
privados.

Para Email se observarán contactos:

```text
contact_type = email
```

Para WhatsApp se observarán contactos:

```text
contact_type = whatsapp
```

La existencia solamente de un contacto `phone` no deberá convertirlo
automáticamente en WhatsApp.

### Contacto verificado

`verified_at` permitirá diferenciar:

```text
available_verified
```

de:

```text
available_unverified
```

pero ninguna de las dos situaciones implica consentimiento.

Hasta que exista la política de 12B.B, la condición conceptual será:

```text
consentimiento = desconocido
```

12B.A no interpretará ni persistirá esta condición como autorización de uso del canal.

### Organizaciones

Mientras no exista un modelo de contacto institucional gobernado,
una Organización deberá aparecer con diagnóstico:

```text
unsupported_recipient
```

o:

```text
missing
```

según la situación implementada.

No se elegirá automáticamente una Persona relacionada con esa
Organización.

### Usuarios internos

Un `internal_user` podrá integrar una audiencia por responsabilidad
operativa.

12B.A no deberá utilizar automáticamente:

```text
auth.users.email
```

ni ninguna credencial de autenticación como canal externo.

---

## 13. Duplicados

La resolución deberá detectar al menos dos clases de duplicado.

### Duplicado por actor

El mismo actor puede aparecer a través de varios criterios.

Ejemplo:

```text
Persona A
→ participante de Proyecto
→ además seleccionada manualmente
```

Debe existir una única fila efectiva de destinatario.

Las distintas procedencias deberán conservarse en
`communication_recipient_sources`.

### Duplicado por canal

Cuando el dato de contacto sea visible y pueda normalizarse, podrá
detectarse que actores distintos comparten un mismo valor de canal.

Ejemplo:

```text
Persona A → email x@example.com
Persona B → email x@example.com
```

Esto deberá marcarse para revisión humana.

12B.A no decidirá automáticamente cuál actor debe conservarse.

La deduplicación de identidad y la deduplicación de canal son problemas
diferentes y deberán permanecer diferenciados.

---

## 14. Inclusiones y exclusiones manuales

Antes de confirmar destinatarios el usuario podrá:

```text
excluir un destinatario resuelto
volver a incluirlo
agregar una Persona existente
```

Toda exclusión deberá poder registrar una razón.

La exclusión afecta únicamente esa resolución.

No elimina:

```text
la Persona
la participación
la habilidad
la capacidad
la responsabilidad
el criterio de audiencia
```

Agregar manualmente una Persona:

- no crea una Persona nueva;
- no crea una participación;
- no crea una relación con el contexto;
- no modifica habilidades;
- no modifica capacidades.

La Persona deberá existir previamente como registro canónico activo.

En 12B.A no se admitirán destinatarios manuales consistentes solamente
en:

```text
una dirección de email libre
un número telefónico libre
un número de WhatsApp libre
```

La incorporación manual siempre referenciará un actor existente.

---

## 15. Confirmación de destinatarios

Confirmar destinatarios será una operación explícita y gobernada.

El RPC deberá verificar como mínimo:

```text
la comunicación existe
la comunicación no está cancelada
el actor puede administrar la comunicación
la resolución pertenece a la comunicación
la resolución es la resolución vigente
la resolución todavía no fue confirmada
existe al menos un destinatario incluido
los criterios utilizados siguen correspondiendo a esa resolución
```

La confirmación registrará:

```text
confirmed_by_internal_user_id
confirmed_at
```

Una resolución confirmada será inmutable.

No se podrán modificar después de la confirmación:

```text
destinatarios
inclusiones
exclusiones
procedencias
diagnósticos históricos de canal
diagnósticos de esa resolución
```

Si el usuario necesita cambiar la audiencia después de confirmar:

```text
modifica criterios
→ resuelve nuevamente
→ obtiene nueva resolución
→ revisa nuevamente
→ confirma nuevamente
```

La resolución confirmada anterior permanecerá en el historial.

La confirmación de destinatarios no equivale a envío:

```text
recipients_confirmed
≠ sent
```

12B.A terminará en este punto.


---

## 16. Historial de contenido

El contenido vigente de la comunicación se mantendrá en:

```text
mp25m.communications
```

y cada modificación relevante deberá conservar una revisión histórica.

Se propone:

```text
mp25m.communication_content_history
```

Campos principales:

```text
id uuid
communication_id uuid
revision_no integer

subject text
body text

generation_mode text
generation_metadata jsonb

changed_by_internal_user_id uuid
change_rationale text
created_at timestamptz
```

`revision_no` será creciente por comunicación.

La primera versión del contenido deberá registrarse como revisión 1.

Cada modificación posterior generará una nueva fila.

No se actualizarán revisiones históricas.

El historial deberá permitir distinguir contenido:

```text
manual
assisted
```

sin que `assisted` implique envío ni aprobación automática.

Si en el futuro una comunicación llega a enviarse mediante 12B.B,
el contenido definitivo enviado deberá referenciar una revisión concreta
o conservar su propio snapshot inmutable.

Nunca se reconstruirá el contenido histórico enviado a partir de:

```text
communications.subject
communications.body
```

actuales.

---

## 17. Historial de estado

Se propone:

```text
mp25m.communication_status_history
```

Campos principales:

```text
id uuid
communication_id uuid
transition_no integer

status text
rationale text

changed_by_internal_user_id uuid
changed_at timestamptz
```

`transition_no` será creciente por comunicación.

La creación registrará la primera transición:

```text
draft
```

Las transiciones iniciales previstas son:

```text
draft
→ audience_resolved

audience_resolved
→ audience_resolved

audience_resolved
→ recipients_confirmed

audience_resolved
→ draft

recipients_confirmed
→ draft

draft
→ cancelled

audience_resolved
→ cancelled

recipients_confirmed
→ cancelled
```

La transición:

```text
audience_resolved
→ audience_resolved
```

representa una nueva resolución de la misma definición de audiencia,
sin modificar los criterios.

Las transiciones a `draft` representan una modificación posterior de los criterios de audiencia.

En esos casos se invalida la resolución vigente, sin modificar ni eliminar ninguna resolución histórica. Será necesario resolver y confirmar nuevamente la audiencia.

El historial anterior permanecerá intacto.

No habrá transición:

```text
cancelled
→ otro estado
```

en 12B.A.

---

## 18. Auditoría

Además de los historiales específicos, las operaciones gobernadas
registrarán eventos en:

```text
mp25m.audit_events
```

Acciones previstas:

```text
communication.create
communication.update
communication.cancel

communication.audience.criteria_replace
communication.audience.resolve

communication.recipient.exclude
communication.recipient.include
communication.recipient.add

communication.recipients.confirm
```

Los eventos deberán conservar, según corresponda:

```text
actor_internal_user_id
target_id
reason
old_data
new_data
metadata
result
```

La metadata podrá registrar identificadores tales como:

```text
communication_id
resolution_id
recipient_id
criterion_type
context_type
context_id
```

No se deberán copiar datos privados innecesarios dentro de
`audit_events`.

En particular, los valores completos de email o WhatsApp no deberán
duplicarse indiscriminadamente en metadata de auditoría.

---

## 19. Permisos

12B.A no deberá ampliar permisos de lectura de ninguna entidad fuente.

Principio:

```text
poder crear una comunicación
≠
poder leer cualquier contexto
```

y:

```text
poder resolver una audiencia
≠
poder consultar cualquier dato privado de contacto
```

### Creación

Toda creación requerirá primero:

```text
internal_user activo
```

y al menos una asignación de acceso vigente del backoffice.

La comunicación podrá tener cero o exactamente un contexto.

Cuando el contexto disponga de un helper operativo existente, se reutilizará
la autorización actual:

```text
Oportunidad
→ can_operate_opportunity_requirement(..., 'formulate')

Articulación
→ can_manage_articulation(...)

Proyecto
→ can_manage_project(...)

Tema
→ can_operate_theme(..., 'manage')

Necesidad/Oferta
→ can_operate_need_offer(..., 'manage')

Entrada manual de Agenda
→ can_manage_agenda_entry(...)
```

Para:

```text
Persona
Nodo
Organización
```

12B.A no inventará capacidades nuevas de modificación sobre esas entidades.

Inicialmente, crear una comunicación con uno de esos contextos requerirá:

```text
actor interno activo
+ asignación de acceso vigente
+ existencia de la entidad
+ acceso server-side permitido por las reglas actuales del backoffice
```

Esto habilita preparar la comunicación, pero no modificar la entidad ni
ampliar el acceso a sus datos privados.

Una comunicación independiente utilizará el mismo requisito base:

```text
actor interno activo
+ asignación de acceso vigente
```

### Contexto

Conocer un UUID nunca otorgará permiso sobre la entidad.

El helper:

```text
can_create_communication
```

deberá validar que exista cero o exactamente un contexto y comprobar la rama
de autorización correspondiente.

Para elementos derivados de Agenda no se fabricará un `agenda_entry_id`.

Se utilizará el origen real admitido:

```text
opportunity
project
theme
```

según corresponda.

### Administración de la comunicación

El helper:

```text
can_manage_communication
```

requerirá siempre un usuario interno activo.

Para contextos con helper operativo existente se volverá a comprobar el
permiso actual sobre el contexto.

Por lo tanto, conservar el acceso histórico a una comunicación no implica
conservar indefinidamente permiso para modificarla.

Para comunicaciones:

```text
independientes
con contexto Persona
con contexto Nodo
con contexto Organización
```

podrá administrar inicialmente:

```text
el creador
```

o:

```text
un administrador global
```

El administrador global deberá poseer una asignación vigente con:

```text
role.is_administrative = true
scope.scope_type = 'global'
```

La posibilidad de incorporar responsables específicos de Comunicaciones
podrá agregarse posteriormente sin modificar la estructura histórica.

### Resolución de audiencia

Cada criterio deberá respetar las reglas de lectura de su fuente.

Resolver una audiencia se hará server-side y no otorgará permisos nuevos
sobre Personas, Nodos, Organizaciones, Articulaciones, Proyectos, Temas,
habilidades o capacidades.

La resolución utilizará únicamente relaciones explícitas y vigentes.

### Contactos

Los contactos privados conservarán las reglas actuales.

12B no convierte:

```text
service_role
```

en autorización funcional para mostrar o utilizar cualquier contacto.

El `service_role` será exclusivamente el mecanismo técnico server-only.

La autorización funcional deberá comprobarse antes de exponer o incorporar
información privada en una resolución.

### Patrón técnico

Se conservará el patrón actual:

```text
cliente autenticado
→ Server Component / Server Action / Route Handler
→ identificación de internal_user
→ service_role server-only
→ RPC gobernado
→ validación de permisos en PostgreSQL
```

Los RPC de escritura recibirán siempre:

```text
p_actor_internal_user_id
```

---

## 20. RPC y vistas previstas

Los nombres definitivos deberán verificarse al implementar la migración,
pero el contrato conceptual será el siguiente.

### Permisos

```text
mp25m_api.can_create_communication(
  p_actor_internal_user_id
)

mp25m_api.can_manage_communication(
  p_actor_internal_user_id,
  p_communication_id
)
```

### Comunicación

```text
mp25m_api.create_communication(...)
mp25m_api.update_communication(...)
mp25m_api.cancel_communication(...)
```

`create_communication` deberá:

```text
validar actor
validar contexto exacto
crear communications
crear revisión de contenido 1
crear transición draft
crear audit_event
```

`update_communication` deberá:

```text
validar administración
impedir edición de una comunicación cancelada
actualizar contenido vigente
crear nueva revisión si cambia contenido
registrar auditoría
```

### Criterios de audiencia

Se propone una operación atómica:

```text
mp25m_api.replace_communication_audience_criteria(...)
```

La operación reemplazará la definición vigente completa de criterios.

Esto evita estados intermedios incoherentes generados por múltiples
altas y bajas independientes desde la interfaz.

Deberá:

```text
validar todos los criterios
validar compatibilidad
registrar la nueva definición
invalidar current_resolution_id cuando corresponda
llevar el estado a draft si todavía no se volvió a resolver
registrar auditoría
```

Las resoluciones históricas no se modificarán.

### Resolución

```text
mp25m_api.resolve_communication_audience(...)
```

Deberá ejecutarse de manera transaccional.

Conceptualmente:

```text
bloquear comunicación
→ validar criterios vigentes
→ resolver cada criterio
→ deduplicar actores
→ crear audience_resolution
→ copiar criteria_snapshot
→ crear recipients
→ crear recipient_sources
→ diagnosticar canales permitidos
→ establecer current_resolution_id
→ registrar estado audience_resolved
→ registrar auditoría
```

No deberá modificar ninguna entidad fuente.

### Ajustes sobre destinatarios

```text
mp25m_api.set_communication_recipient_included(
  p_actor_internal_user_id,
  p_recipient_id,
  p_included,
  p_reason
)
```

y:

```text
mp25m_api.add_communication_person_recipient(
  p_actor_internal_user_id,
  p_resolution_id,
  p_person_id,
  p_reason
)
```

Solo podrán operar sobre una resolución:

```text
actual
no confirmada
```

### Confirmación

```text
mp25m_api.confirm_communication_recipients(
  p_actor_internal_user_id,
  p_communication_id,
  p_resolution_id,
  p_reason
)
```

Deberá bloquear la resolución y volverla inmutable.

### Lectura

Se prevén vistas o funciones server-only para:

```text
communication_page
communication_detail
communication_criteria_list
communication_resolution_list
communication_recipient_page
communication_content_history
communication_status_history
```

Las listas deberán utilizar paginación determinística.

La búsqueda textual deberá conservar el patrón utilizado en módulos
actuales:

```text
case-insensitive
accent-insensitive
```

---

## 21. Interfaz de usuario

Se incorporará inicialmente:

```text
/panel/comunicaciones
/panel/comunicaciones/nueva
/panel/comunicaciones/[id]
```

### Directorio

`/panel/comunicaciones` deberá permitir consultar como mínimo:

```text
estado
tipo
contexto
creador
fecha
búsqueda por asunto o cuerpo
```

Estados visibles:

```text
Borrador
Audiencia resuelta
Destinatarios confirmados
Cancelada
```

La interfaz no utilizará:

```text
Enviada
Entregada
```

mientras 12B.B no exista.

### Nueva comunicación

El flujo deberá presentar de manera progresiva:

```text
1. Contexto
2. Audiencia
3. Destinatarios
4. Mensaje
5. Confirmación
```

No será obligatorio completar todas las etapas en una misma sesión.

### Contexto

Permitirá crear una comunicación:

```text
independiente
```

o vinculada exactamente a una entidad soportada.

Cuando la navegación provenga desde una entidad, el contexto podrá
venir precargado pero deberá permanecer visible.

### Audiencia

La interfaz permitirá construir criterios explícitos.

Cada criterio deberá indicar claramente por qué una persona,
organización o usuario interno podría resultar incluido.

No se ocultará la procedencia de la audiencia.

### Destinatarios

Luego de resolver se mostrará:

```text
nombre
tipo de destinatario
por qué fue incluido
estado Email
estado WhatsApp
incluido / excluido
diagnósticos
```

Los casos sin canal deberán permanecer visibles.

No se eliminarán silenciosamente de la lista.

### Mensaje

Permitirá editar:

```text
asunto
cuerpo
```

El contenido seguirá siendo editable mientras la comunicación no esté
cancelada.

Si una modificación afecta una comunicación con destinatarios ya
confirmados, la interfaz deberá dejar claro que:

```text
editar el mensaje
≠ cambiar los destinatarios confirmados
```

La futura etapa de envío deberá exigir igualmente una revisión final
del contenido.

### Confirmación

Antes de confirmar destinatarios se mostrará como mínimo:

```text
contexto
criterios
cantidad total resuelta
cantidad incluida
cantidad excluida
personas sin canal
organizaciones sin canal institucional
usuarios internos sin canal externo
duplicados detectados
```

El usuario deberá ejecutar una acción explícita:

```text
Confirmar destinatarios
```

Una vez confirmados, 12B.A mostrará:

```text
Destinatarios confirmados.

El envío externo todavía no está habilitado.
```

No se mostrará un botón de envío simulado o inoperante.


---

## 22. Integración con Agenda

Agenda podrá ofrecer una acción:

```text
Preparar comunicación
```

La acción creará o iniciará una comunicación en estado:

```text
draft
```

Nunca enviará un mensaje.

### Entrada manual de Agenda

Cuando el elemento provenga de:

```text
mp25m.agenda_entries
```

la comunicación podrá utilizar:

```text
agenda_entry_id
```

como contexto exacto.

Esto no copiará ni inferirá otros contextos relacionados con esa
entrada.

Por ejemplo:

```text
Agenda
→ Proyecto
→ Articulación
```

no convierte automáticamente a Proyecto ni Articulación en contexto
adicional de la comunicación.

### Elementos derivados de Agenda

Los elementos derivados mostrados por Agenda no necesariamente poseen
una fila en:

```text
mp25m.agenda_entries
```

En esos casos no se fabricará una entrada manual únicamente para poder
referenciarla desde Comunicaciones.

Si el elemento derivado posee un origen real y soportado, podrá
precargarse ese origen exacto.

Ejemplos:

```text
vencimiento de Oportunidad
→ context = opportunity

entregable de Proyecto
→ context = project

seguimiento de Tema
→ context = theme
```

No se utilizarán relaciones transitivas.

Si no existe un origen exacto soportado, la comunicación podrá
iniciarse como independiente.

### Efecto de la comunicación sobre Agenda

Crear, editar, resolver o confirmar una comunicación:

```text
no completa una entrada de Agenda
no cancela una entrada de Agenda
no modifica fechas
no crea reuniones
no modifica responsables
```

Cualquier modificación futura de Agenda deberá realizarse mediante una
operación explícita y gobernada del propio módulo Agenda.

---

## 23. Canales previstos y frontera con 12B.B

12B.A deberá permitir indicar los canales previstos para la
comunicación.

Se propone incorporar en:

```text
mp25m.communications
```

el campo conceptual:

```text
planned_channels text[]
```

Valores inicialmente admitidos:

```text
email
whatsapp
```

Una comunicación en `draft` podrá existir temporalmente sin canal
seleccionado.

Antes de confirmar destinatarios deberá existir al menos un canal
previsto.

Seleccionar un canal:

```text
no autoriza el envío
no implica consentimiento
no prueba disponibilidad
```

Solo indica por qué canales el usuario pretende eventualmente
comunicarse.

### Diagnóstico separado de consentimiento

La implementación deberá mantener separados:

```text
disponibilidad técnica
verificación del dato
consentimiento / autorización
duplicados
```

Por ejemplo:

```text
email_availability_status
whatsapp_availability_status
```

podrán utilizar estados como:

```text
available_verified
available_unverified
missing
restricted
unsupported_recipient
```

La condición de duplicado deberá permanecer separada.

En 12B.A:

```text
consentimiento = desconocido
```

salvo que en el futuro exista una fuente institucional explícita que
permita determinarlo.

No se inferirá consentimiento a partir de:

```text
existencia del contacto
verified_at
participación en un Nodo
participación en una Articulación
participación en un Proyecto
responsabilidad sobre un Tema
```

### Datos de contacto históricos

12B.A no necesita persistir una copia completa de la dirección de email
o del número de WhatsApp dentro de cada resolución.

Debe conservar:

```text
actor
procedencia
diagnóstico de disponibilidad
estado de inclusión
```

El snapshot del valor concreto utilizado para una entrega pertenece a
la futura autorización de envío de 12B.B.

Esto evita duplicar datos privados antes de que exista una operación
real de entrega.

Por lo tanto, en 12B.A la resolución conservará:

```text
diagnóstico histórico del canal
```

y no una copia obligatoria del email o número completo.

### Futuro 12B.B

12B.B deberá introducir una operación explícita posterior a:

```text
recipients_confirmed
```

Conceptualmente:

```text
revisar contenido definitivo
→ revisar destinatarios confirmados
→ revisar canales
→ resolver autorización / consentimiento
→ confirmar envío
→ crear snapshot de envío
→ entregar mediante adaptador
→ registrar resultado
```

La autorización de envío deberá congelar al menos:

```text
communication_id
content_revision
recipient_resolution
destinatarios efectivamente autorizados
canal elegido por destinatario
dato de contacto utilizado
actor que autorizó
fecha de autorización
```

El envío histórico nunca deberá reconstruirse utilizando información
actual de Personas, Organizaciones o contactos.

La confirmación realizada en 12B.A seguirá significando solamente:

```text
destinatarios revisados y confirmados
```

y nunca:

```text
autorización de envío
```

---

## 24. Generación asistida

12B deberá admitir dos formas de elaboración del contenido:

```text
manual
assisted
```

La generación asistida podrá utilizar exclusivamente información a la
que el usuario tenga acceso.

Podrá recibir como contexto, según corresponda:

```text
comunicación actual
entidad de contexto exacta
criterios de audiencia
cantidad y clases de destinatarios
contenido escrito previamente
```

La asistencia podrá:

```text
proponer asunto
proponer cuerpo
reescribir
resumir
adaptar tono
generar una variante
```

La propuesta nunca reemplazará silenciosamente el contenido actual.

El usuario deberá poder:

```text
aceptar
editar
descartar
```

la propuesta.

Toda versión aceptada deberá ingresar al historial de contenido como
una nueva revisión.

### Límites

La generación asistida no podrá:

```text
enviar
autorizar un envío
confirmar destinatarios
agregar destinatarios por decisión propia
ampliar una audiencia
crear Personas
crear Organizaciones
crear participaciones
crear responsabilidades
crear habilidades
crear capacidades
inferir consentimiento
inferir disponibilidad
inferir compromisos
crear reuniones
modificar Agenda
```

La IA podrá sugerir texto.

No podrá transformar una sugerencia en una acción externa sin una
operación humana posterior y explícita.

### Trazabilidad

Cuando una revisión haya sido originada mediante asistencia se
registrará:

```text
generation_mode = assisted
```

y podrá conservarse metadata técnica mínima como:

```text
provider
model
operation
generated_at
```

No será obligatorio conservar prompts completos cuando contengan datos
personales o información que no sea necesaria para auditoría.

La existencia de metadata de generación:

```text
no implica aprobación
no implica autoría institucional automática
no implica envío
```


---

## 25. Reuniones virtuales

La preparación de una comunicación podrá estar relacionada con una
reunión presencial, virtual o híbrida.

12B.A no creará salas virtuales.

En particular, seleccionar:

```text
virtual
híbrida
```

como modalidad de una reunión o de una entrada de Agenda no deberá
provocar automáticamente:

```text
crear Google Meet
crear sala Jitsi
crear evento externo
enviar invitaciones
modificar Agenda
```

### Enlace existente

Si ya existe un enlace válido y el usuario tiene acceso a él, podrá
incorporarlo manualmente al contenido de la comunicación.

Esto será tratado simplemente como contenido del mensaje.

No significará que Comunicaciones sea propietaria de esa sala ni que
pueda administrarla.

### Creación futura de sala

La integración con proveedores de reuniones pertenecerá a una etapa
posterior.

Los adaptadores deberán permanecer separados del núcleo de
Comunicaciones.

Proveedores inicialmente previstos:

```text
Google Meet
Jitsi
```

La creación de una sala deberá originarse siempre en una acción humana
explícita, por ejemplo:

```text
Crear sala virtual
```

Antes de ejecutar la operación el usuario deberá poder conocer como
mínimo:

```text
proveedor
contexto
título
fecha y hora, cuando corresponda
```

Una vez creada, deberá mostrarse al usuario el resultado:

```text
proveedor
room_id o identificador equivalente
URL final
fecha de creación
```

### Crear sala no equivale a invitar

Se mantiene la separación:

```text
crear sala
≠
agregar destinatarios

crear sala
≠
confirmar destinatarios

crear sala
≠
enviar invitación
```

La existencia de una sala nunca podrá disparar automáticamente una
comunicación.

### Agenda

Si el usuario decide incorporar posteriormente la URL de la sala a una
entrada de Agenda, deberá existir una acción explícita y gobernada.

Conceptualmente:

```text
Crear sala
→ revisar URL
→ opcionalmente actualizar Agenda
→ preparar comunicación
→ revisar destinatarios
→ confirmar
→ futuro envío
```

No se modificará Agenda como efecto secundario de crear la sala.

### Invitación

La futura invitación por Email o WhatsApp deberá seguir exactamente el
mismo flujo de autorización que cualquier otra comunicación.

El hecho de tratarse de una reunión no habilita un camino abreviado de
envío.

---

## 26. Versionado de audiencia y semántica exacta de criterios

Antes de implementar la migración se deberá hacer explícito el
versionado de la definición de audiencia.

Se propone incorporar en:

```text
mp25m.communications
```

el campo:

```text
audience_revision integer not null
```

Su valor inicial será:

```text
0
```

Una comunicación recién creada podrá no tener todavía criterios.

Cada reemplazo exitoso de la definición de audiencia incrementará:

```text
audience_revision
```

en una unidad.

Por ejemplo:

```text
creación
→ audience_revision = 0

primera definición
→ audience_revision = 1

modificación posterior
→ audience_revision = 2
```

### Criterios versionados

`mp25m.communication_audience_criteria` deberá incorporar:

```text
audience_revision integer
```

Los criterios de revisiones anteriores no se eliminarán físicamente.

Cada reemplazo de criterios:

```text
incrementa communications.audience_revision
→ inserta la nueva colección de criterios
→ conserva las revisiones anteriores
→ invalida current_resolution_id
→ lleva la comunicación a draft cuando corresponda
```

De esta forma no será necesario reconstruir históricamente una
definición de audiencia a partir de filas actuales.

### Resoluciones versionadas

`mp25m.communication_audience_resolutions` deberá incorporar:

```text
audience_revision integer
```

Toda resolución registrará simultáneamente:

```text
communication_id
resolution_no
audience_revision
criteria_snapshot
```

Por lo tanto podrán existir varias resoluciones de una misma revisión:

```text
audience_revision = 2
resolution_no = 3

audience_revision = 2
resolution_no = 4
```

Esto representa volver a resolver exactamente los mismos criterios
contra datos fuente que pueden haber cambiado.

Modificar los criterios, en cambio, producirá:

```text
audience_revision = 3
```

### Resolución vigente

`communications.current_resolution_id` deberá apuntar solamente a una
resolución perteneciente a:

```text
la misma communication_id
la audience_revision vigente
```

La migración deberá proteger que una comunicación no pueda apuntar a
una resolución de otra comunicación.

Cuando resulte conveniente, esto podrá reforzarse mediante una
restricción compuesta agregada luego de crear ambas tablas.

Además de la restricción estructural, todos los RPC deberán volver a
validarlo.

### Protección contra resolución obsoleta

La confirmación deberá exigir:

```text
resolution.communication_id
=
communication.id
```

y:

```text
resolution.audience_revision
=
communication.audience_revision
```

y:

```text
resolution.id
=
communication.current_resolution_id
```

Si cualquiera falla:

```text
la resolución es obsoleta
```

y no podrá confirmarse.

Esto evita el caso:

```text
resolver audiencia
→ modificar criterios
→ intentar confirmar la resolución anterior
```

### Semántica de grupos

Todos los criterios resolverán conjuntos de actores tipados:

```text
(recipient_kind, recipient_id)
```

Ejemplos:

```text
(person, <uuid>)
(organization, <uuid>)
(internal_user, <uuid>)
```

No se convertirán tipos entre sí para hacer coincidir conjuntos.

En particular:

```text
organization
≠ person

internal_user
≠ person
```

aunque en el mundo real puedan representar personas vinculadas.

### Operaciones dentro de un grupo

Cada `group_no` deberá contener al menos un criterio:

```text
include
```

Dentro de un mismo grupo:

```text
los criterios include se intersectan
```

y luego:

```text
se resta la unión de los criterios exclude del mismo grupo
```

Formalmente:

```text
grupo =
(intersección de includes)
-
(unión de excludes)
```

### Operación entre grupos

Los diferentes grupos se combinan mediante unión:

```text
audiencia resuelta =
grupo 1
∪ grupo 2
∪ grupo 3
...
```

Esto permite expresar de manera determinística:

```text
AND dentro de un grupo
OR entre grupos
NOT mediante exclude
```

Ejemplo:

```text
Grupo 1:
  participantes de Nodo A
  AND habilidad Soldadura

Grupo 2:
  Persona B

Resultado:
  (participantes de Nodo A con Soldadura)
  OR Persona B
```

### Conjuntos tipados

La intersección se realizará sobre identidad tipada.

Por ejemplo:

```text
project_participants
```

puede producir:

```text
person
organization
```

mientras:

```text
person_skill
```

solo produce:

```text
person
```

La intersección natural conservará únicamente las Personas que aparezcan
en ambos conjuntos.

No se buscará una Persona representante de cada Organización para
forzar coincidencias.

### Exclusiones

Los criterios `exclude` se aplicarán solamente al grupo al que
pertenecen.

Por ejemplo:

```text
Grupo 1:
  participantes de Proyecto X
  EXCLUDE Persona A

Grupo 2:
  Persona A
```

El resultado final podrá contener a Persona A por el Grupo 2.

Esto es intencional: los grupos representan expresiones independientes
que luego se unen.

### Duplicados entre grupos

Si el mismo actor llega por varios grupos:

```text
se conservará un único destinatario efectivo
```

pero todas las procedencias deberán registrarse.

La deduplicación se hará después de resolver los conjuntos.

### Incorporaciones manuales posteriores

Agregar una Persona manualmente después de resolver:

```text
no modifica audience_revision
no modifica los criterios
```

La incorporación pertenece exclusivamente a esa resolución.

Si posteriormente se genera una nueva resolución, esa incorporación
manual no se arrastrará automáticamente.

Si el usuario desea que esa Persona forme parte estable de la
definición de audiencia deberá incorporarla como criterio:

```text
criterion_type = person
```

### Tipos iniciales de comunicación

Para evitar una taxonomía abierta durante la implementación inicial,
`communication_type` admitirá en 12B.A:

```text
general
convocation
reminder
follow_up
request_information
update
```

Estos valores describen la finalidad operativa.

No modifican permisos, consentimiento ni reglas de envío.

Podrán ampliarse posteriormente mediante una migración explícita.


---

## 27. Criterios de aceptación, pruebas e invariantes

Antes de implementar la migración, las siguientes decisiones se
consideran definitivas para 12B.A.

### 27.1. Decisiones definitivas de modelo

#### Contexto

Una comunicación tendrá:

```text
cero o un contexto exacto
```

Cero claves de contexto informadas significa:

```text
independent
```

No será necesario persistir `independent` como una entidad ficticia.

Nunca se inferirán contextos transitivos.

#### Canales previstos

`mp25m.communications` deberá incluir:

```text
planned_channels text[]
```

limitado inicialmente a:

```text
email
whatsapp
```

Los canales previstos describen intención operativa futura.

No representan consentimiento ni autorización.

#### Revisión de audiencia

`mp25m.communications` deberá incluir:

```text
audience_revision integer not null default 0
```

Toda modificación de criterios incrementará la revisión.

#### Criterios

Los criterios históricos permanecerán versionados por:

```text
communication_id
audience_revision
group_no
```

No se borrarán físicamente al definir una nueva audiencia.

#### Resoluciones

Toda resolución deberá conservar:

```text
communication_id
resolution_no
audience_revision
criteria_snapshot
```

`resolution_no` será único y creciente dentro de cada comunicación.

#### Resolución vigente

`current_resolution_id` solo podrá identificar una resolución:

```text
de la misma comunicación
de la revisión de audiencia vigente
```

La migración y los RPC deberán proteger ambas condiciones.

#### Diagnóstico de canales

Los nombres técnicos definitivos para 12B.A serán:

```text
email_availability_status
whatsapp_availability_status
```

Los estados iniciales admitidos serán:

```text
available_verified
available_unverified
missing
restricted
unsupported_recipient
```

La condición de duplicado se registrará separadamente.

12B.A no almacenará un estado positivo de consentimiento.

Conceptualmente:

```text
consentimiento = desconocido
```

hasta que 12B.B incorpore una fuente institucional explícita.

#### Valores concretos de contacto

12B.A no copiará obligatoriamente a la resolución:

```text
email completo
número completo de WhatsApp
```

La resolución conservará el diagnóstico histórico del canal.

El valor concreto utilizado deberá congelarse recién dentro del futuro
snapshot de autorización/envío de 12B.B.

#### Destinatarios

Cada destinatario resuelto tendrá exactamente una identidad tipada:

```text
person
organization
internal_user
```

No se realizarán conversiones implícitas entre esas identidades.

#### Confirmación

La operación:

```text
Confirmar destinatarios
```

confirma únicamente:

```text
quiénes integran la audiencia revisada
```

No confirma:

```text
contenido definitivo para envío
consentimiento
canal definitivo
dato de contacto definitivo
envío
```

La futura autorización de envío deberá vincular una revisión concreta
de contenido con una resolución concreta de destinatarios.

---

### 27.2. Pruebas de creación

Deberá verificarse:

```text
crear comunicación independiente
crear comunicación con Persona
crear comunicación con Nodo
crear comunicación con Organización
crear comunicación con Oportunidad
crear comunicación con Articulación
crear comunicación con Proyecto
crear comunicación con Tema
crear comunicación con Necesidad/Oferta
crear comunicación con entrada manual de Agenda
```

Cada prueba deberá comprobar:

```text
estado inicial draft
audience_revision = 0
revisión de contenido = 1
historial de estado creado
audit_event creado
ningún envío externo
```

También deberá rechazarse:

```text
más de un contexto simultáneo
contexto inexistente
contexto no accesible
tipo de comunicación inválido
canal previsto inválido
```

---

### 27.3. Pruebas de criterios

Deberán probarse individualmente:

```text
person
node_participants
articulation_participants
project_participants
person_skill
organization_capability
theme_responsibles
```

Se comprobará que cada criterio:

```text
respeta permisos de lectura
resuelve solamente relaciones explícitas
preserva recipient_kind
no crea relaciones nuevas
```

Casos especialmente importantes:

```text
Proyecto relacionado con Articulación
→ no incorporar participantes de Articulación

Articulación relacionada con Oportunidad
→ no incorporar actores de Oportunidad

Organización con capacidad
→ resolver Organization

Responsable de Tema
→ resolver internal_user
```

No deberá inferirse una Persona en los dos últimos casos.

Para Nodo deberá probarse que quedan fuera:

```text
participaciones pending
participaciones rejected
participaciones inactive
participaciones todavía no iniciadas
participaciones ya finalizadas
```

Para `person_skill` deberá comprobarse:

```text
default → solamente confirmed

confirmed + candidate
→ solamente esos dos estados

self_reported solicitado explícitamente
→ puede incorporarse

rejected
→ nunca puede configurarse ni resolverse
```

Para `organization_capability` deberán repetirse las mismas pruebas de
validación.

Además, con filtro territorial explícito:

```text
criterio node_id = Nodo A
```

deberá incluir:

```text
capacidad general con node_id IS NULL
capacidad específica de Nodo A
```

y excluir:

```text
capacidad específica de Nodo B
```

Un contexto de comunicación:

```text
Nodo A
```

no deberá aplicar silenciosamente `Nodo A` a un criterio de habilidad o
capacidad que no lo declare.

La resolución de participantes de Proyecto deberá operar sobre:

```text
mp25m.project_participants
```

y nunca sobre:

```text
mp25m_api.project_source_participant_list
```

---

### 27.4. Pruebas de álgebra de audiencia

Deberá verificarse:

```text
AND dentro de grupo
OR entre grupos
EXCLUDE dentro de grupo
```

Ejemplo de intersección:

```text
Nodo A
AND
Habilidad X
```

deberá devolver únicamente Personas presentes en ambos conjuntos.

Ejemplo de unión:

```text
Grupo 1 = Nodo A
Grupo 2 = Persona B
```

deberá devolver:

```text
Nodo A ∪ Persona B
```

Ejemplo de exclusión:

```text
Grupo 1:
  Proyecto X
  EXCLUDE Persona A
```

deberá excluir a Persona A solamente de ese grupo.

Si otro grupo incorpora explícitamente a Persona A, deberá poder formar
parte del resultado final.

---

### 27.5. Pruebas de versionado

Secuencia obligatoria:

```text
crear comunicación
→ audience_revision = 0

definir criterios
→ audience_revision = 1

resolver
→ resolution 1 / revision 1

volver a resolver sin cambiar criterios
→ resolution 2 / revision 1

modificar criterios
→ audience_revision = 2
→ current_resolution_id = null

resolver
→ resolution 3 / revision 2
```

Deberá comprobarse que:

```text
resolution 1 permanece intacta
resolution 2 permanece intacta
criterios revision 1 permanecen intactos
```

Intentar confirmar:

```text
resolution 1
resolution 2
```

cuando la comunicación está en:

```text
audience_revision = 2
```

deberá fallar.

Solo podrá confirmarse:

```text
resolution 3
```

si además es `current_resolution_id`.

---

### 27.6. Pruebas de destinatarios

Deberá verificarse:

```text
deduplicación por actor
conservación de múltiples procedencias
exclusión manual
reinclusión manual
agregado manual de Persona existente
```

Agregar manualmente una Persona no deberá:

```text
crear relaciones
cambiar audience_revision
alterar criterios
```

Resolver nuevamente no deberá arrastrar automáticamente esa
incorporación manual.

Una resolución confirmada deberá rechazar:

```text
excluir destinatario
reincluir destinatario
agregar destinatario
modificar procedencias
```


---

### 27.7. Pruebas de contactos y privacidad

Para Personas deberán verificarse como mínimo estos casos:

```text
email visible y verificado
email visible y no verificado
sin email
WhatsApp visible y verificado
WhatsApp visible y no verificado
sin WhatsApp
solo phone
contacto restringido para el actor actual
```

Se deberá comprobar:

```text
email verificado
→ available_verified

email no verificado
→ available_unverified

sin email utilizable
→ missing

contacto existente pero no utilizable por permisos
→ restricted
```

La existencia de:

```text
contact_type = phone
```

no deberá producir automáticamente:

```text
whatsapp_availability_status = available_*
```

Para Organizaciones sin modelo institucional de contacto se deberá
obtener:

```text
unsupported_recipient
```

o el diagnóstico equivalente definido por la migración.

Para `internal_user` no se deberá utilizar automáticamente:

```text
auth.users.email
```

como dirección externa.

También deberá comprobarse que resolver una audiencia no amplía la
visibilidad de contactos privados en ninguna otra pantalla o API.

### Duplicados de canal

Cuando dos Personas visibles posean el mismo dato normalizado de canal,
el sistema deberá poder señalar el conflicto para revisión humana.

No deberá:

```text
fusionar Personas
eliminar una Persona
elegir automáticamente cuál conservar
```

La identidad de actor y el dato de canal seguirán siendo conceptos
separados.

---

### 27.8. Pruebas de contenido y estados

Al crear una comunicación deberá existir:

```text
content revision 1
status = draft
```

Editar asunto o cuerpo deberá:

```text
actualizar contenido vigente
crear una nueva revisión
preservar revisiones anteriores
```

Una edición asistida aceptada deberá registrar:

```text
generation_mode = assisted
```

Una edición manual posterior deberá poder volver a registrar:

```text
generation_mode = manual
```

sin modificar las revisiones anteriores.

### Contenido después de confirmar destinatarios

Editar el contenido después de:

```text
recipients_confirmed
```

no deberá modificar:

```text
audience_revision
current_resolution_id
destinatarios confirmados
```

porque confirmar destinatarios no equivale a autorizar el envío.

La futura 12B.B deberá exigir una revisión final del contenido y
referenciar la revisión exacta utilizada.

### Canales previstos después de confirmar destinatarios

Modificar:

```text
planned_channels
```

tampoco cambiará por sí solo:

```text
audience_revision
current_resolution_id
destinatarios confirmados
```

porque los canales previstos no constituyen autorización de envío.

La resolución deberá conservar diagnóstico para los canales soportados
de forma que una modificación de `planned_channels` no requiera
reconstruir la identidad de la audiencia.

12B.B deberá volver a validar:

```text
canal
contactabilidad
autorización
consentimiento
```

antes de cualquier entrega.

### Estados

Deberán verificarse las transiciones permitidas:

```text
draft
→ audience_resolved

audience_resolved
→ audience_resolved

audience_resolved
→ recipients_confirmed

audience_resolved
→ draft

recipients_confirmed
→ draft

draft
→ cancelled

audience_resolved
→ cancelled

recipients_confirmed
→ cancelled
```

Y deberán rechazarse transiciones no previstas.

En particular:

```text
cancelled
→ cualquier otro estado
```

deberá fallar en 12B.A.

---

### 27.9. Pruebas de Agenda

Desde una entrada manual de Agenda deberá poder iniciarse:

```text
Preparar comunicación
```

con:

```text
context = agenda_entry
```

sin crear otra relación.

Para elementos derivados deberá comprobarse:

```text
vencimiento de Oportunidad
→ context = opportunity

entregable de Proyecto
→ context = project

seguimiento de Tema
→ context = theme
```

No deberá crearse artificialmente:

```text
agenda_entry
```

para representar un elemento derivado.

También deberá comprobarse que crear, editar, resolver o confirmar una
comunicación no:

```text
completa Agenda
cancela Agenda
cambia fechas de Agenda
crea reuniones
cambia responsables
```

---

### 27.10. Pruebas de generación asistida

La generación asistida deberá poder:

```text
proponer asunto
proponer cuerpo
reescribir
resumir
adaptar tono
```

El resultado generado no deberá modificar el contenido vigente hasta
que exista una acción explícita de aceptación.

Deberán probarse las acciones:

```text
aceptar
editar
descartar
```

Descartar una propuesta no deberá crear una revisión histórica como si
hubiera sido aceptada.

Aceptar una propuesta sí deberá crear una nueva revisión.

La generación asistida no podrá ejecutar:

```text
confirmación de destinatarios
cambio de criterios
incorporación autónoma de destinatarios
envío
creación de reunión
modificación de Agenda
creación de relaciones de dominio
```

---

### 27.11. Pruebas de reuniones virtuales

En 12B.A deberá comprobarse que una comunicación puede contener
manualmente un enlace de reunión existente.

Esto no deberá crear ningún recurso externo.

Seleccionar o mencionar:

```text
Google Meet
Jitsi
virtual
híbrida
```

no deberá provocar llamadas a proveedores.

Cuando se implemente una etapa posterior de creación de salas se deberá
mantener:

```text
crear sala
≠ enviar invitación
```

y:

```text
crear sala
≠ modificar Agenda automáticamente
```

---

### 27.12. Pruebas de permisos y aislamiento

Deberá verificarse con distintos usuarios internos que:

```text
conocer un UUID
≠ poder utilizarlo como contexto

poder crear comunicación
≠ poder administrar cualquier comunicación

poder resolver audiencia
≠ poder leer cualquier contacto
```

Los RPC deberán validar siempre:

```text
p_actor_internal_user_id
```

y no confiar exclusivamente en que la llamada proviene del backend.

El uso técnico de:

```text
service_role
```

no deberá sustituir las comprobaciones funcionales de autorización.

También deberá verificarse que las funciones server-only no queden
expuestas directamente a:

```text
anon
authenticated
```

cuando contengan información que requiera mediación del backend.

---

### 27.13. Pruebas de no regresión

La incorporación de Comunicaciones no deberá alterar el comportamiento
existente de:

```text
Personas
Nodos
Organizaciones
Articulaciones
Proyectos
Temas
Oportunidades
Necesidades y ofertas
Habilidades
Agenda
```

En especial deberá comprobarse:

```text
navegación desktop
navegación móvil
búsquedas
paginación
permisos existentes
lectura de contactos
```

No se reutilizarán relaciones históricas o legacy para ampliar
audiencias.

Casos críticos:

```text
Vasos Articulación
≠
Vasos Oportunidad histórica
```

y:

```text
project_source_participant_list
```

no deberá utilizarse para construir la audiencia autónoma de un
Proyecto.

---

### 27.14. Invariantes globales de 12B.A

La implementación se considerará incorrecta si viola cualquiera de
estos invariantes.

```text
1. Una comunicación tiene cero o un contexto exacto.

2. El contexto nunca crea una relación de dominio.

3. La audiencia se define mediante criterios explícitos.

4. Resolver audiencia nunca contacta a nadie.

5. Resolver audiencia nunca modifica las entidades fuente.

6. Una resolución pertenece a una revisión concreta de audiencia.

7. Una resolución obsoleta nunca puede confirmarse.

8. Una resolución confirmada es inmutable.

9. Un actor aparece una sola vez como destinatario efectivo dentro de
   una resolución, aunque tenga múltiples procedencias.

10. Person, Organization e internal_user son identidades distintas.

11. Nunca se infiere una Persona desde una Organización.

12. Nunca se infiere una Persona desde un internal_user.

13. Nunca se infieren participantes desde entidades relacionadas.

14. Existencia de contacto no equivale a consentimiento.

15. Contacto verificado no equivale a consentimiento.

16. planned_channels no equivale a autorización.

17. Confirmar destinatarios no equivale a autorizar envío.

18. 12B.A no realiza envíos externos.

19. 12B.A no crea salas virtuales.

20. IA puede proponer contenido, pero no ejecutar acciones externas.

21. Agenda aporta contexto, pero no dispara comunicaciones.

22. Comunicaciones no modifica Agenda como efecto secundario.

23. Las revisiones históricas no se reescriben.

24. Los criterios históricos no se eliminan al crear una nueva revisión.

25. Los datos privados no se duplican innecesariamente en auditoría.

26. service_role no sustituye autorización funcional.

27. No se crean Personas, Organizaciones, participaciones,
    responsabilidades, habilidades, capacidades ni compromisos como
    efecto secundario de preparar una comunicación.

28. No se reconstruye una futura entrega histórica desde datos actuales.

29. Toda futura entrega deberá tener una autorización humana explícita.

30. La automatización siempre se detiene antes del envío.
```

La regla operativa central permanece:

```text
Preparar
→ Revisar
→ Resolver audiencia
→ Revisar destinatarios
→ Confirmar destinatarios
→ DETENER
```

12B.A finaliza en:

```text
Destinatarios confirmados
```

No existe en este incremento:

```text
Enviar
Enviado
Entregado
```

---

## Cierre del diseño técnico 12B.A

Con estas decisiones, 12B.A queda limitado a:

```text
preparación
contexto
definición de audiencia
resolución
revisión
confirmación de destinatarios
trazabilidad
```

Quedan expresamente fuera y reservados para 12B.B o incrementos
posteriores:

```text
consentimiento por canal
autorización de uso del canal
snapshots de envío
Email provider
WhatsApp provider
intentos de entrega
confirmación de proveedor
entregado / fallido
webhooks
respuestas
conversaciones
automatizaciones periódicas
creación de Google Meet
creación de Jitsi
envío de invitaciones
```

El siguiente paso, antes de escribir la migración, será revisar este
documento completo contra:

```text
la especificación funcional 12B
el esquema real actual
las migraciones existentes
los patrones de permisos y RPC del proyecto
```

Solo después de esa revisión se definirá la migración de 12B.A.
