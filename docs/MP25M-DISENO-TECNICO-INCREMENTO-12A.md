# MP25M — Diseño técnico — Incremento 12A

## Agenda operativa

## 1. Objetivo técnico

12A incorporará una superficie transversal de Agenda sin duplicar fechas que
ya poseen una fuente de verdad en otros módulos.

La implementación combinará:

1. una tabla propia para entradas manuales de Agenda;
2. proyecciones derivadas de fechas existentes;
3. una interfaz de lectura unificada;
4. operaciones gobernadas y auditadas exclusivamente para las entradas
   manuales.

La Agenda no será una tabla materializada de todos los vencimientos del
sistema.

## 2. Principios de arquitectura

### 2.1 Fuente única de verdad

Las fechas existentes continúan perteneciendo a su entidad original.

No se copiarán a `agenda_entries`:

- `opportunities.due_date`;
- `project_deliverables.target_date`;
- `theme_followups.next_due_at`.

Modificar una de esas fechas modifica automáticamente su representación
posterior en Agenda.

### 2.2 Entrada manual ≠ elemento derivado

Una entrada manual es una entidad propia.

Un elemento derivado es una proyección de otra entidad.

La vista unificada deberá permitir distinguirlos explícitamente.

### 2.3 Sin relaciones inferidas

Una entrada vinculada a un Proyecto no obtiene automáticamente:

- Oportunidades;
- Articulaciones;
- participantes;
- responsables adicionales.

Una entrada vinculada a una Articulación tampoco adquiere relaciones
transitivas.

### 2.4 Sin DELETE físico

Las entradas manuales no se eliminan físicamente.

Su ciclo operativo será:

```text
scheduled -> completed
scheduled -> cancelled
```

Las correcciones de contenido no alteran por sí mismas el estado.

## 3. Modelo `mp25m.agenda_entries`

Se creará:

```text
mp25m.agenda_entries
```

Campos propuestos:

```text
id
entry_type
title
detail

scheduled_date
scheduled_time
time_zone

meeting_mode
location_text
meeting_provider
meeting_url

status

responsible_internal_user_id

opportunity_id
articulation_id
project_id
theme_id
need_offer_id

created_by_internal_user_id
created_at
updated_at

completed_at
cancelled_at
status_rationale
```

### 3.1 Tipos

`entry_type` admitirá inicialmente:

```text
meeting
visit
training
demonstration
call
follow_up
deadline
other
```

Etiquetas de interfaz:

```text
meeting        -> Reunión
visit          -> Visita
training       -> Capacitación
demonstration  -> Demostración
call           -> Llamada
follow_up      -> Seguimiento
deadline       -> Vencimiento
other          -> Otra actividad
```

### 3.2 Fecha y hora

`scheduled_date date` será obligatorio.

`scheduled_time time without time zone` será opcional.

No se inventará una hora para actividades que sólo tienen fecha.

`time_zone text` será obligatorio y tendrá inicialmente:

```text
America/Argentina/Buenos_Aires
```

como valor por defecto de la interfaz.

La zona horaria se conservará aun cuando `scheduled_time` sea nulo para que
el modelo sea compatible con futuras integraciones de calendario y
notificaciones.

12A no implementa conversión ni sincronización con calendarios externos.

### 3.3 Estados

`status`:

```text
scheduled
completed
cancelled
```

Consistencia:

```text
scheduled -> completed_at IS NULL
             cancelled_at IS NULL

completed -> completed_at IS NOT NULL
             cancelled_at IS NULL

cancelled -> cancelled_at IS NOT NULL
             completed_at IS NULL
```

`status_rationale` será requerido para transiciones a `completed` o
`cancelled`.

La corrección de una entrada no reabre automáticamente una entrada terminal.

### 3.4 Origen explícito opcional

La tabla tendrá FKs independientes y anulables:

```text
opportunity_id
articulation_id
project_id
theme_id
need_offer_id
```

Una restricción deberá garantizar:

```text
cantidad de FKs no nulas <= 1
```

Cero FKs:

```text
entrada independiente
```

Una FK:

```text
entrada explícitamente vinculada
```

No se utilizará un par genérico:

```text
source_type + source_id
```

como única representación física, porque impediría integridad referencial
nativa.

### 3.5 Responsable

`responsible_internal_user_id` será opcional y referenciará
`mp25m.internal_users`.

El responsable deberá existir y encontrarse activo al momento de ser
asignado.

Responsable de Agenda no implica:

- participante de la entidad;
- responsable de la entidad;
- integrante de un Proyecto;
- disponibilidad futura inferida.

### 3.6 Modalidad y ubicación de reuniones

Cuando `entry_type = 'meeting'`, la entrada podrá describir de manera
estructurada cómo se realizará la reunión.

`meeting_mode` podrá ser:

```text
in_person
virtual
hybrid
```

Etiquetas:

```text
in_person -> Presencial
virtual   -> Virtual
hybrid    -> Híbrida
```

Para entradas que no sean reuniones:

```text
meeting_mode IS NULL
meeting_provider IS NULL
meeting_url IS NULL
```

`location_text` será opcional y podrá almacenar una ubicación física o una
referencia comprensible para las personas convocadas.

A diferencia de los campos `meeting_*`, `location_text` podrá utilizarse
también en otras entradas manuales que requieran ubicación, por ejemplo:

- visitas;
- capacitaciones;
- demostraciones.

La ubicación no convierte esas actividades en reuniones.

Ejemplos:

```text
Sede La Plata
Sala de reuniones del Nodo
Av. ...
```

`meeting_provider` será opcional y quedará preparado para valores como:

```text
google_meet
jitsi
other
```

`meeting_url` será opcional.

Una reunión virtual o híbrida podrá existir inicialmente sin URL. Esto permite
crear primero la actividad de Agenda y generar posteriormente la sala virtual
desde el módulo de Comunicaciones y Convocatorias.

12A no generará salas de Google Meet ni Jitsi.

12A sólo conservará, cuando exista, la información necesaria para identificar
y mostrar dónde se realizará la reunión.

La futura generación de una sala virtual será una acción explícita del usuario
en 12B.

Crear una sala virtual no equivaldrá a enviar una convocatoria.

## 4. Historial de estado

Se creará:

```text
mp25m.agenda_entry_status_history
```

Campos:

```text
id
agenda_entry_id
transition_no
status
rationale
changed_by_internal_user_id
changed_at
```

Será append-oriented.

La creación de una entrada insertará:

```text
transition_no = 1
status = scheduled
```

Toda transición posterior agregará una nueva fila.

No habrá UPDATE ni DELETE funcional sobre el historial.

## 5. Auditoría

Las mutaciones de `agenda_entries` generarán eventos en
`mp25m.audit_events`.

Acciones implementadas:

```text
agenda.entry.create
agenda.entry.update
agenda.entry.transition
```

`agenda.entry.update` conservará en `old_data` y `new_data` los campos
modificables relevantes:

```text
entry_type
title
detail
scheduled_date
scheduled_time
time_zone
meeting_mode
location_text
meeting_provider
meeting_url
responsible_internal_user_id
opportunity_id
articulation_id
project_id
theme_id
need_offer_id
```

La corrección exigirá un `rationale`, almacenado como motivo del evento de
auditoría.

Cambiar, quitar o incorporar el origen será una corrección explícita y
auditada.

Las transiciones terminales registrarán además el estado anterior, el estado
nuevo y el fundamento correspondiente.

## 6. Autorización

Se creará:

```text
mp25m_api.can_manage_agenda_entry(
  p_actor_internal_user_id uuid,
  p_agenda_entry_id uuid
)
```

### 6.1 Entrada vinculada a Oportunidad

Delegará en:

```text
mp25m_api.can_operate_opportunity_requirement(
  actor,
  opportunity_id,
  'formulate'
)
```

No se usará ninguna relación transitiva.

### 6.2 Entrada vinculada a Articulación

Delegará exclusivamente en:

```text
mp25m_api.can_manage_articulation(
  actor,
  articulation_id
)
```

### 6.3 Entrada vinculada a Proyecto

Delegará exclusivamente en:

```text
mp25m_api.can_manage_project(
  actor,
  project_id
)
```

No se inferirá permiso desde una Oportunidad o Articulación relacionada.

### 6.4 Entrada vinculada a Tema

Delegará en:

```text
mp25m_api.can_operate_theme(
  actor,
  theme_id,
  'manage'
)
```

### 6.5 Entrada vinculada a Necesidad/Oferta

Delegará en:

```text
mp25m_api.can_operate_need_offer(
  actor,
  need_offer_id,
  'manage'
)
```

### 6.6 Entrada independiente

Podrá ser administrada por:

```text
created_by_internal_user_id = actor
```

y por usuarios con autoridad administrativa global vigente.

La implementación reutilizará las tablas existentes de:

```text
internal_users
access_role_assignments
access_roles
access_scopes
```

sin crear un sistema de permisos paralelo.

## 7. Creación de entradas

Se creará una RPC server-only:

```text
mp25m_api.create_agenda_entry(...)
```

Validará:

- actor interno activo;
- tipo permitido;
- título;
- detalle;
- fecha;
- hora opcional;
- zona horaria;
- responsable activo cuando exista;
- cero o exactamente un origen;
- existencia del origen;
- permiso exacto sobre el origen cuando exista.

Para una entrada independiente sólo se requerirá que el actor sea un usuario
interno activo con acceso vigente al backoffice.

La creación será auditada.

## 8. Corrección de entradas

Se creará:

```text
mp25m_api.update_agenda_entry(...)
```

Permitirá modificar una entrada `scheduled`.

Campos corregibles:

- tipo;
- título;
- detalle;
- fecha;
- hora;
- zona horaria;
- responsable;
- origen explícito.

Exigirá:

```text
rationale
```

La corrección de origen deberá volver a validar el permiso sobre el nuevo
origen.

No será posible utilizar una corrección para modificar:

- creador;
- fecha de creación;
- estado;
- timestamps terminales.

Los estados se modificarán sólo mediante transición explícita.

## 9. Transición de entradas

Se creará:

```text
mp25m_api.transition_agenda_entry(...)
```

Estados destino permitidos desde `scheduled`:

```text
completed
cancelled
```

No se permitirá cambiar una entrada terminal nuevamente a `scheduled` en
12A.

Si posteriormente se requiere reprogramar una actividad ya cancelada, deberá
definirse expresamente si corresponde reabrirla o crear una nueva actividad.

12A no adelantará esa decisión.

La transición:

- actualizará la fila principal;
- insertará historial;
- generará auditoría.

## 10. Fuentes derivadas

La Agenda unificada tendrá inicialmente tres fuentes derivadas.

### 10.1 Vencimiento de Oportunidad

Fuente:

```text
mp25m.opportunities.due_date
```

Se proyectará cuando:

```text
due_date IS NOT NULL
status NOT IN ('resolved', 'discarded')
```

El elemento derivado tendrá:

```text
item_kind = opportunity_due
source_type = opportunity
source_id = opportunity.id
source_record_id = opportunity.id
agenda_status = scheduled
```

Responsable:

```text
assigned_to_internal_user_id
```

No se crea ninguna fila de `agenda_entries`.

### 10.2 Fecha objetivo de entregable

Fuente:

```text
mp25m.project_deliverables.target_date
```

Se proyectará cuando:

```text
target_date IS NOT NULL
status IN ('planned', 'in_progress')
project.status NOT IN ('completed', 'cancelled')
```

La segunda condición evita mantener en Agenda entregables pendientes
residuales cuando el Proyecto completo ya se encuentra en estado terminal.

El elemento tendrá:

```text
item_kind = project_deliverable
source_type = project
source_id = project_id
source_record_id = deliverable.id
agenda_status = scheduled
```

Responsable:

```text
deliverable.responsible_internal_user_id
```

No se inferirá ninguna Oportunidad ni Articulación del Proyecto.

### 10.3 Próximo vencimiento de Tema

Fuente:

```text
mp25m.theme_followups.next_due_at
```

Primero se resolverá exclusivamente el seguimiento más reciente del Tema:

```text
ORDER BY occurred_at DESC, id DESC
LIMIT 1
```

Sólo si ese seguimiento más reciente tiene:

```text
next_due_at IS NOT NULL
```

se proyectará un elemento.

No se buscará "el último seguimiento que tenga next_due_at".

Esta diferencia es deliberada.

Si el seguimiento más reciente no tiene próximo vencimiento, el Tema no
posee vencimiento operativo actual aunque un seguimiento histórico anterior
sí lo haya tenido.

El elemento tendrá:

```text
item_kind = theme_next_due
source_type = theme
source_id = theme_id
source_record_id = followup.id
agenda_status = scheduled
```

Responsable:

```text
followup.responsible_internal_user_id
```

Los Temas `closed` no se proyectarán.

### 10.4 Normalización temporal de fuentes derivadas

La Agenda utilizará como zona operativa inicial:

```text
America/Argentina/Buenos_Aires
```

Para fuentes que contienen solamente `date`:

```text
opportunities.due_date
project_deliverables.target_date
```

la proyección será:

```text
scheduled_date = fecha de origen
scheduled_time = NULL
time_zone = America/Argentina/Buenos_Aires
```

Se consideran elementos de día completo.

No se inventará una hora.

Para:

```text
theme_followups.next_due_at
```

que es `timestamptz`, la proyección deberá convertir explícitamente el instante
a la zona operativa antes de separar fecha y hora:

```text
local_timestamp =
  next_due_at AT TIME ZONE 'America/Argentina/Buenos_Aires'

scheduled_date = local_timestamp::date
scheduled_time = local_timestamp::time
time_zone = America/Argentina/Buenos_Aires
```

No se utilizará la zona horaria de la sesión PostgreSQL como semántica
implícita.

Esto evita que un vencimiento cercano a medianoche cambie de día según la
configuración del servidor.

Para entradas manuales, `time_zone` deberá contener una zona IANA válida.

En 12A la interfaz utilizará por defecto:

```text
America/Argentina/Buenos_Aires
```

La migración/RPC deberá rechazar zonas horarias inexistentes.

## 11. Elementos derivados terminales

12A no fabricará historial de Agenda para elementos derivados.

Cuando:

- una Oportunidad se resuelve o descarta;
- un entregable se entrega, acepta o cancela;
- un Tema se cierra o reemplaza su próximo vencimiento;

el elemento deja de aparecer como pendiente en Agenda.

El historial real permanece en la entidad de origen.

Por lo tanto:

```text
realizados
cancelados
```

se aplicará inicialmente a entradas manuales.

Los elementos derivados son una vista de pendientes operativos actuales.

## 12. Vista unificada

Se creará una vista server-only:

```text
mp25m_api.agenda_item_list
```

mediante `UNION ALL` de:

1. entradas manuales;
2. vencimientos pendientes de Oportunidades;
3. entregables pendientes;
4. próximo vencimiento vigente de cada Tema.

Campos normalizados:

```text
item_key text
item_kind text
item_origin text

agenda_entry_id uuid

source_type text
source_id uuid
source_record_id uuid
source_title text

entry_type text
title text
detail text

scheduled_date date
scheduled_time time
time_zone text

meeting_mode text
location_text text
meeting_provider text
meeting_url text

agenda_status text

responsible_internal_user_id uuid
responsible_display_name text

created_by_internal_user_id uuid
created_by_display_name text

created_at timestamptz
updated_at timestamptz
```

### 12.1 Identidad estable

`item_key` será estable y único.

Formato conceptual:

```text
manual:<agenda_entry_id>
opportunity_due:<opportunity_id>
project_deliverable:<deliverable_id>
theme_next_due:<followup_id>
```

La aplicación no deberá interpretar la clave para obtener relaciones.

Los campos estructurados de la vista serán la fuente de información.

### 12.2 `item_origin`

Valores:

```text
manual
derived
```

Esto permitirá identificar visualmente si un elemento puede gestionarse
desde Agenda o debe corregirse en su entidad de origen.

## 13. Estado operativo mostrado

La base expondrá el estado canónico:

```text
scheduled
completed
cancelled
```

La aplicación derivará para elementos `scheduled`:

```text
overdue
today
upcoming
```

comparando `scheduled_date` con la fecha local de operación.

No se persistirán `overdue`, `today` ni `upcoming`.

Son categorías de presentación dependientes del tiempo.

## 14. Lectura y permisos

El navegador no tendrá acceso directo a las tablas ni vistas.

Se mantendrá el patrón:

```text
browser
-> Server Component / Route Handler
-> service_role
-> mp25m_api
```

La lectura transversal no debe ampliar permisos.

En el modelo de lectura actualmente vigente, los usuarios internos activos
pueden consultar las entidades operativas que alimentan 12A.

La función/página de Agenda exigirá acceso interno activo.

Si en el futuro alguna fuente incorpora restricciones adicionales de lectura,
la Agenda deberá aplicar las mismas restricciones antes de mostrarla.

## 15. Paginación, búsqueda y filtros

No se cargará indefinidamente toda la Agenda en el cliente.

La lectura paginada se implementa mediante:

```text
mp25m_api.agenda_item_page(...)
```

Parámetros relevantes:

```text
p_from_date
p_to_date
p_item_kinds
p_entry_types
p_source_types
p_responsible_internal_user_id
p_unassigned_only
p_statuses
p_query
p_after_date
p_after_time
p_after_title
p_after_item_key
p_limit
```

`p_unassigned_only = true` permite distinguir explícitamente:

```text
sin filtro de responsable
```

de:

```text
mostrar sólo elementos sin responsable
```

No puede combinarse con un `p_responsible_internal_user_id` concreto.

### 15.1 Búsqueda

`p_query` se aplica server-side sobre:

```text
title
detail
source_title
```

La búsqueda es tolerante a mayúsculas/minúsculas y normaliza los caracteres
españoles utilizados actualmente:

```text
á é í ó ú ü ñ
a e i o u u n
```

La API limita la consulta textual a 100 caracteres.

### 15.2 Orden estable

El orden implementado es conceptualmente:

```text
scheduled_date ASC
(scheduled_time IS NULL) ASC
scheduled_time ASC
normalized_title ASC
item_key ASC
```

Por lo tanto, dentro de una misma fecha:

1. aparecen primero las actividades con hora;
2. las actividades con hora se ordenan por hora;
3. para la misma hora se ordenan alfabéticamente por título normalizado;
4. las actividades de todo el día aparecen después;
5. las actividades de todo el día se ordenan alfabéticamente por título;
6. `item_key` resuelve cualquier empate restante.

### 15.3 Cursor

El cursor de aplicación contiene:

```text
date
time
title
itemKey
```

La comparación keyset utiliza los mismos componentes y la misma normalización
que el `ORDER BY`.

Esto evita saltos o duplicados al continuar una página y permite que la
búsqueda y el orden se mantengan estables entre páginas.

La API limita además el tamaño máximo de cada página.

## 16. API de aplicación

Se incorpora:

```text
app/api/panel/agenda/route.ts
```

Responsabilidades:

- autenticar;
- comprobar acceso interno;
- parsear filtros;
- validar la búsqueda `q`;
- limitar `q` a 100 caracteres;
- validar el tamaño de página;
- decodificar el cursor;
- invocar la capa server-only;
- devolver páginas JSON;
- responder con `Cache-Control: no-store`.

No realiza mutaciones.

Para la selección de un origen manual se incorpora además:

```text
app/api/panel/agenda/origins/route.ts
```

Esta ruta resuelve listas de referencia para:

```text
opportunity
articulation
project
theme
need_offer
```

La búsqueda de orígenes es server-side y no exige descargar catálogos
completos al navegador.

## 17. Capa server-only

Se incorpora:

```text
lib/agenda/agenda.ts
```

Tipos principales:

```text
AgendaItem
AgendaItemKind
AgendaEntryType
AgendaStatus
AgendaSourceType
AgendaMeetingMode
AgendaMeetingProvider
AgendaUserOption
AgendaCursor
```

`AgendaCursor` contiene:

```text
date
time
title
itemKey
```

Funciones principales implementadas:

```text
listAgendaPage(...)
listAgendaUserOptions(...)
createAgendaEntry(...)
updateAgendaEntry(...)
transitionAgendaEntry(...)
```

`listAgendaPage(...)` transmite a PostgreSQL tanto los filtros como la
búsqueda y el cursor keyset.

Las mutaciones se realizan exclusivamente mediante las RPCs gobernadas de
Agenda.

La capa server-only utiliza el acceso administrativo del servidor; el
navegador no recibe credenciales privilegiadas ni accede directamente a
las tablas.

No se reutiliza la relación con Oportunidades para decidir relaciones ni
permisos sobre Articulaciones o Proyectos autónomos.

## 18. Server Actions

Se incorpora:

```text
app/panel/agenda/actions.ts
```

Acciones implementadas:

```text
createAgendaEntryAction
updateAgendaEntryAction
transitionAgendaEntryAction
```

Creación y corrección reutilizan un parser común para los campos de una
entrada manual.

`updateAgendaEntryAction` exige un fundamento de corrección y sólo puede
operar sobre una entrada que PostgreSQL continúe considerando editable.

`transitionAgendaEntryAction` admite únicamente los estados terminales:

```text
completed
cancelled
```

y exige un fundamento.

Cada action:

1. valida la sintaxis recibida;
2. obtiene el usuario autenticado;
3. resuelve `InternalAccess`;
4. delega la autorización de dominio a PostgreSQL;
5. ejecuta la mutación mediante la capa server-only;
6. revalida `/panel/agenda`.

La autorización final permanece en PostgreSQL.

## 19. Interfaz

Ruta:

```text
/panel/agenda
```

Componentes principales implementados:

```text
AgendaWorkspace
AgendaDirectory
AgendaCreateForm
AgendaEditForm
AgendaLifecycleControls
```

### 19.1 Directorio

`AgendaDirectory` integra:

- vistas Próximos, Hoy, Vencidos, Completados y Cancelados;
- búsqueda textual remota;
- filtros;
- paginación remota;
- representación diferenciada de elementos Manual y Derivado.

Cada tarjeta muestra, cuando corresponde:

- fecha;
- hora o indicación de todo el día;
- tipo;
- estado;
- título;
- detalle;
- responsable;
- origen exacto;
- ubicación;
- modalidad de reunión.

Los elementos vinculados conservan un enlace explícito a su entidad de
origen.

### 19.2 Creación

`AgendaCreateForm` permite crear una entrada manual con:

- tipo;
- título;
- detalle;
- fecha;
- hora opcional;
- responsable opcional;
- ubicación opcional;
- origen exacto opcional.

Para reuniones permite además:

```text
meeting_mode
meeting_provider
meeting_url
```

La selección de origen utiliza búsqueda server-side.

### 19.3 Edición

`AgendaEditForm` se muestra únicamente para entradas:

```text
item_origin = manual
agenda_status = scheduled
```

El formulario se precarga con los valores vigentes y permite corregir los
mismos datos estructurados de la entrada manual.

La corrección exige un fundamento.

Cambiar o quitar el origen continúa representando como máximo un único
vínculo explícito; no se infieren relaciones transitivas.

Los datos de reunión que no sean modificados se conservan.

### 19.4 Ciclo de vida

`AgendaLifecycleControls` permite, para entradas manuales programadas:

```text
Completar
Cancelar
```

Ambas transiciones exigen fundamento.

Una entrada completada o cancelada deja de mostrar controles de edición y
de transición.

12A no implementa reapertura.

### 19.5 Elementos derivados

Los elementos derivados no muestran controles propios de edición ni cambio
de estado en Agenda.

Su fuente de verdad continúa siendo la entidad de origen.

### 19.6 Responsive

La pantalla utiliza los mismos datos y operaciones en escritorio y móvil.

## 20. Navegación

`Agenda` se incorpora a:

```text
app/panel/panel-navigation.tsx
app/panel/panel-mobile-navigation.tsx
```

Ruta:

```text
/panel/agenda
```

Desktop y móvil mantienen el mismo orden funcional de módulos:

```text
Inicio
Articulaciones
Proyectos
Temas
Nodos
Personas
Organizaciones
Habilidades
Agenda
Oportunidades
Necesidades y ofertas
Informes
```

La navegación móvil conserva el comportamiento existente de drawer, scroll
y cierre por cambio de ruta.

## 21. Selección de origen

La creación manual deberá permitir:

```text
Sin origen
Oportunidad
Articulación
Proyecto
Tema
Necesidad/Oferta
```

La selección utilizará listas de referencia server-only.

No se enviarán catálogos completos al navegador si pueden crecer
indefinidamente.

Se reutilizarán patrones de paginación existentes cuando sea posible, pero
no se cambiará la semántica de APIs compartidas para adaptarlas a Agenda.

## 22. Selección de responsable

La selección de responsable utilizará usuarios internos activos.

El responsable es opcional.

12A no crea automáticamente responsabilidades en ningún otro módulo.

## 23. Preparación para 12B

`agenda_entries.id` será una identidad estable que 12B podrá utilizar como
contexto explícito de una comunicación.

12A no creará tablas de:

- mensajes;
- audiencias;
- destinatarios;
- canales;
- envíos.

La futura relación será:

```text
communication.context_agenda_entry_id
```

o una representación equivalente definida por 12B.

La integración deberá ser explícita.

## 24. Seguridad

Las nuevas tablas tendrán RLS habilitado.

Se aplicará el patrón:

```text
revoke all from public, anon, authenticated, service_role
grant mínimo necesario to service_role
```

Para `agenda_entries`:

```text
SELECT
INSERT
UPDATE
```

Sin `DELETE`.

Para historial:

```text
SELECT
INSERT
```

Sin `UPDATE`.
Sin `DELETE`.

Las vistas:

```text
SELECT
```

sólo para `service_role`.

Las RPCs:

```text
REVOKE EXECUTE
public
anon
authenticated
service_role
```

y luego:

```text
GRANT EXECUTE TO service_role
```

Las RPCs serán:

```text
SECURITY INVOKER
```

salvo que exista una razón técnica explícita, documentada y probada para
otra cosa.

## 25. Índices

Índices mínimos previstos:

```text
agenda_entries(scheduled_date, scheduled_time, id)
agenda_entries(responsible_internal_user_id, scheduled_date)
agenda_entries(status, scheduled_date)
agenda_entries(opportunity_id) WHERE opportunity_id IS NOT NULL
agenda_entries(articulation_id) WHERE articulation_id IS NOT NULL
agenda_entries(project_id) WHERE project_id IS NOT NULL
agenda_entries(theme_id) WHERE theme_id IS NOT NULL
agenda_entries(need_offer_id) WHERE need_offer_id IS NOT NULL

agenda_entry_status_history(
  agenda_entry_id,
  transition_no DESC
)
```

Los índices finales deberán validarse contra las consultas reales.

## 26. Migración

Archivo previsto:

```text
supabase/migrations/<timestamp>_incremento_12a_agenda_operativa.sql
```

La migración deberá contener:

1. tablas;
2. constraints;
3. índices;
4. RLS;
5. grants/revokes;
6. historial;
7. helpers de autorización;
8. RPCs de escritura;
9. vista unificada;
10. función de lectura paginada;
11. comentarios de contrato.

No habrá migración de datos históricos.

## 27. Pruebas de base de datos

Antes de aplicar remoto se realizará un `supabase db reset --local` para
comprobar que la migración completa funciona desde una base limpia.

La validación funcional de 12A cubre:

1. creación de entrada independiente;
2. creación con origen explícito;
3. validación de un único origen;
4. permisos sobre el origen exacto;
5. autonomía de Articulaciones y Proyectos;
6. ausencia de inferencia transitiva desde Oportunidades;
7. corrección de una entrada programada;
8. fundamento obligatorio de corrección;
9. conservación de modalidad, proveedor y enlace de reunión;
10. auditoría de corrección mediante `old_data`, `new_data` y `reason`;
11. transición a `completed`;
12. transición a `cancelled`;
13. historial y auditoría de transiciones;
14. rechazo de corrección de entradas terminales;
15. ausencia de DELETE funcional;
16. proyección de vencimiento de Oportunidad;
17. proyección de entregable de Proyecto;
18. proyección del próximo vencimiento vigente de Tema;
19. ausencia de reaparición de seguimientos históricos;
20. desaparición de fuentes derivadas terminales;
21. filtros por tipo, origen, responsable y estado;
22. filtro explícito de elementos sin responsable;
23. búsqueda por título;
24. búsqueda por detalle;
25. búsqueda por título de entidad de origen;
26. búsqueda tolerante a mayúsculas/minúsculas y acentos;
27. orden por fecha, hora y título;
28. actividades con hora antes de las de todo el día;
29. orden alfabético entre elementos de todo el día;
30. continuidad de cursor sin duplicados entre páginas.

Las pruebas destructivas o con datos descartables deberán ejecutarse sólo
contra la base local.

## 28. Pruebas permanentes

La cobertura automatizada permanente específica de Agenda podrá incorporarse
en archivos propios del módulo.

Cuando se incorpore, deberá proteger al menos:

- fuentes derivadas exactas;
- ausencia de duplicación;
- cero o un origen manual;
- autonomía de Articulación y Proyecto;
- permisos delegados al origen exacto;
- historial y auditoría;
- ausencia de DELETE;
- selección del último seguimiento de Tema;
- API paginada;
- búsqueda server-side;
- orden estable fecha/hora/título;
- cursor consistente con el orden;
- ausencia de duplicados al paginar;
- creación y edición de entradas manuales;
- conservación de datos de reunión;
- transiciones completar/cancelar;
- UI Manual/Derivada;
- navegación;
- responsive básico.

Las suites existentes de autonomía deberán continuar pasando.

## 29. Validación previa a despliegue

Antes de cualquier `supabase db push` remoto:

```text
tests específicos
regresión completa
TypeScript
ESLint
next build
git diff --check
supabase db reset --local
smoke local
supabase db push --dry-run
```

El `dry-run` deberá mostrar exclusivamente las migraciones deliberadamente
pendientes.

No se aplicará una migración remota como mecanismo de prueba.

## 30. Archivos implementados

Nuevos en 12A:

```text
app/api/panel/agenda/route.ts
app/api/panel/agenda/origins/route.ts
app/panel/agenda/page.tsx
app/panel/agenda/actions.ts
app/panel/agenda/agenda-workspace.tsx
app/panel/agenda/agenda-directory.tsx
app/panel/agenda/agenda-create-form.tsx
app/panel/agenda/agenda-edit-form.tsx
app/panel/agenda/agenda-lifecycle-controls.tsx
lib/agenda/agenda.ts
docs/MP25M-ESPECIFICACION-FUNCIONAL-INCREMENTO-12A.md
docs/MP25M-DISENO-TECNICO-INCREMENTO-12A.md
docs/MP25M-ESPECIFICACION-FUNCIONAL-INCREMENTO-12B.md
supabase/migrations/20260929093426_incremento_12a_agenda_operativa.sql
```

Modificados:

```text
app/panel/panel-navigation.tsx
app/panel/panel-mobile-navigation.tsx
```

Las fichas de Oportunidades, Articulaciones, Proyectos, Temas y
Necesidades/Ofertas no necesitan modificarse para considerar 12A
funcionalmente completo.

Los accesos contextuales `Agregar a Agenda` podrán incorporarse en un
incremento posterior sin cambiar el modelo de 12A.

## 31. Invariantes técnicas

```text
Agenda != estado de fuente
Agenda != seguimiento
Agenda != convocatoria
Manual != derivado
Fecha != compromiso inferido
Responsable != participante
Origen explícito != relación transitiva
Vencido != antiguo
Fecha histórica != fecha futura
Editar derivado != editar Agenda
```

Un elemento derivado nunca se convierte silenciosamente en entrada manual.

Una entrada manual nunca modifica automáticamente su fuente.

12A no envía comunicaciones.

12A no crea destinatarios.

12A no crea relaciones operativas implícitas.
