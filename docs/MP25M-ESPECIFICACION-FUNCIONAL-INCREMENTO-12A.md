# MP25M — Especificación funcional — Incremento 12A

## Agenda operativa

## 1. Objetivo

El Incremento 12A incorpora una Agenda operativa transversal para reunir
en un único lugar fechas, vencimientos y actividades programadas que hoy
se encuentran distribuidas entre distintos módulos del MP25M.

La Agenda no reemplaza a las entidades que originan esas fechas ni crea
relaciones operativas implícitas.

Debe permitir responder, entre otras, estas preguntas:

- ¿Qué tenemos que atender hoy?
- ¿Qué vence próximamente?
- ¿Qué está atrasado?
- ¿Qué reuniones, visitas o actividades están programadas?
- ¿Quién es responsable?
- ¿De qué Oportunidad, Articulación, Proyecto, Tema o Necesidad/Oferta proviene?
- ¿Qué actividades ya fueron realizadas o canceladas?

## 2. Principio de diseño

12A no crea un segundo sistema general de tareas.

La Agenda combina dos clases de información:

1. fechas operativas que ya existen en otras entidades;
2. entradas manuales de Agenda para hechos futuros que no tienen un campo
   temporal propio en esas entidades.

Las fechas ya existentes no se copiarán a una nueva tabla.

La Agenda las proyectará desde su fuente original, manteniendo una única
fuente de verdad.

## 3. Información calendarizable existente

### 3.1 Oportunidades

`mp25m.opportunities.due_date`

Representa una fecha límite opcional de la Oportunidad.

Podrá aparecer en Agenda mientras la Oportunidad no se encuentre en un
estado terminal que haga irrelevante ese vencimiento.

La Agenda no modifica directamente `due_date`.

Cualquier corrección de esa fecha se realiza sobre la Oportunidad.

### 3.2 Entregables de Proyectos

`mp25m.project_deliverables.target_date`

Representa la fecha objetivo de un entregable.

Podrá aparecer en Agenda mientras el entregable se encuentre pendiente
de ejecución o finalización.

La Agenda no modifica directamente `target_date`.

Cualquier corrección de esa fecha se realiza sobre el entregable.

### 3.3 Temas

`mp25m.theme_followups.next_due_at`

Representa la próxima fecha operativa registrada en un seguimiento de Tema.

Para evitar convertir seguimientos históricos en vencimientos vigentes,
Agenda utilizará únicamente el `next_due_at` correspondiente al seguimiento
más reciente de cada Tema.

Si el seguimiento más reciente no posee `next_due_at`, el Tema no tendrá
un próximo vencimiento derivado en Agenda.

La Agenda no modifica directamente esa fecha.

### 3.4 Información que NO se calendariza automáticamente

No se convertirán automáticamente en entradas de Agenda:

- seguimientos históricos de Oportunidades;
- seguimientos históricos de Articulaciones;
- seguimientos históricos de Proyectos;
- seguimientos históricos de Necesidades/Ofertas;
- acciones de brechas que no posean una fecha explícita;
- fechas de creación o actualización;
- cierres históricos;
- resultados;
- inferencias extraídas de textos libres;
- criterios textuales de requerimientos que mencionen plazos.

Una fecha histórica no equivale a una acción futura.

## 4. Entradas manuales de Agenda

12A permitirá registrar explícitamente actividades programadas que no
tengan una representación temporal suficiente en otro módulo.

Tipos iniciales:

- reunión;
- visita;
- capacitación;
- demostración;
- llamada;
- seguimiento;
- vencimiento;
- otra actividad.

Cada entrada manual deberá registrar:

- tipo;
- título;
- detalle;
- fecha;
- hora opcional;
- responsable interno opcional;
- origen relacionado opcional;
- usuario que la creó;
- fecha de creación;
- estado.

Una entrada podrá existir sin estar vinculada a otra entidad.

### 4.1 Reuniones presenciales, virtuales e híbridas

Cuando la actividad sea una reunión, podrá indicarse su modalidad:

- presencial;
- virtual;
- híbrida.

Una reunión podrá registrar además:

- ubicación física opcional;
- proveedor de reunión virtual opcional;
- enlace de acceso opcional.

Una reunión virtual podrá crearse inicialmente sin enlace.

Esto permitirá registrar primero la actividad y generar posteriormente una
sala de reunión mediante el módulo de Comunicaciones y Convocatorias.

12A no generará salas externas ni enviará invitaciones.

## 5. Vinculación opcional

Una entrada manual podrá vincularse explícitamente con, como máximo,
una de estas entidades:

- Oportunidad;
- Articulación;
- Proyecto;
- Tema;
- Necesidad/Oferta.

El vínculo es opcional.

No se inferirán vínculos transitivos.

Ejemplos:

- una reunión vinculada a un Proyecto no queda vinculada automáticamente
  a sus Articulaciones u Oportunidades;
- una visita vinculada a una Articulación no crea una Oportunidad;
- una actividad vinculada a un Tema no crea participantes ni responsables
  en ese Tema.

## 6. Estados de una entrada manual

Los estados iniciales serán:

- `scheduled`: programada;
- `completed`: realizada;
- `cancelled`: cancelada.

El cambio de estado será explícito y trazable.

Realizar o cancelar una entrada no cambia automáticamente el estado de
la entidad vinculada.

No habrá eliminación física de entradas manuales.

## 7. Correcciones

Una entrada manual podrá corregirse manteniendo trazabilidad.

La corrección podrá modificar:

- tipo;
- título;
- detalle;
- fecha/hora;
- responsable;
- ubicación;
- modalidad de reunión;
- proveedor de reunión virtual;
- enlace de reunión;
- vínculo explícito.

Las correcciones relevantes deberán quedar auditadas.

No se reescribirá silenciosamente el historial.

## 8. Agenda unificada

La pantalla `/panel/agenda` mostrará en una única representación:

- vencimientos de Oportunidades;
- fechas objetivo de entregables de Proyectos;
- próximos vencimientos vigentes de Temas;
- entradas manuales de Agenda.

Cada elemento deberá identificar claramente:

- fecha y hora, cuando corresponda;
- tipo;
- título;
- entidad de origen;
- responsable, cuando exista;
- estado;
- si es una entrada derivada o manual;
- enlace a la entidad correspondiente.

## 9. Vistas operativas

La primera versión deberá permitir consultar:

- próximos;
- hoy;
- vencidos;
- realizados;
- cancelados.

Los elementos derivados cuyo origen ya haya sido completado, aceptado,
resuelto, descartado o cancelado según su propio modelo no deberán permanecer
como pendientes.

El historial permanece en la entidad de origen.

## 10. Filtros, búsqueda y orden

La Agenda deberá permitir filtrar al menos por:

- período;
- tipo de elemento;
- tipo de origen;
- responsable;
- estado.

Deberá existir una forma clara de mostrar elementos sin responsable.

La Agenda incluirá además una búsqueda textual server-side sobre:

- título;
- detalle;
- título de la entidad de origen.

La búsqueda será tolerante a diferencias de mayúsculas/minúsculas y a los
acentos españoles más frecuentes.

El orden operativo de los resultados será determinista:

1. fecha ascendente;
2. dentro de una misma fecha, primero actividades con hora;
3. actividades con hora ordenadas por hora y luego por título;
4. actividades de todo el día ordenadas alfabéticamente por título;
5. una clave técnica estable resolverá empates finales.

La búsqueda y el orden deberán conservarse correctamente al paginar.

## 11. Vencido

Un elemento se considera vencido únicamente cuando:

- posee una fecha explícita;
- esa fecha ya pasó;
- continúa pendiente según la semántica de su fuente.

La Agenda no inferirá atraso a partir de textos, antigüedad o falta de
actividad.

## 12. Permisos

La Agenda es una superficie transversal del backoffice.

La lectura de una entrada derivada no amplía los permisos sobre su entidad
de origen.

Las operaciones sobre una entrada manual vinculada deberán respetar el
permiso de gestión de la entidad vinculada.

Para entradas manuales sin origen, el creador podrá gestionarlas.

Los permisos globales administrativos existentes podrán prevalecer cuando
corresponda.

12A no utilizará una relación con Oportunidades para conceder permisos sobre
Articulaciones o Proyectos autónomos.

## 13. Auditoría

Las siguientes operaciones sobre entradas manuales deberán quedar auditadas:

- creación;
- corrección;
- cambio de estado;
- cambio de responsable;
- cambio de vínculo.

Las entradas derivadas no generan auditoría adicional por el hecho de
aparecer en Agenda, porque su fuente de verdad continúa siendo la entidad
original.

## 14. Invariantes

Agenda ≠ estado de la entidad.

Fecha ≠ compromiso automático.

Responsable ≠ participante.

Evento ≠ convocatoria.

Entrada de Agenda ≠ seguimiento histórico.

Mostrar en Agenda ≠ crear una relación.

Vencimiento derivado ≠ nueva entidad.

Modificar una fuente modifica su representación en Agenda; no crea una copia.

Ninguna fecha se inferirá desde texto libre.

## 15. Fuera de alcance de 12A

Quedan fuera de este incremento:

- convocatorias;
- selección masiva de destinatarios;
- registro de respuestas a convocatorias;
- envío de correo;
- WhatsApp;
- SMS;
- Google Calendar;
- Outlook Calendar;
- sincronización CalDAV;
- notificaciones automáticas;
- recordatorios externos;
- recurrencias;
- disponibilidad de participantes;
- reservas;
- IA;
- sugerencias automáticas de fechas;
- creación automática de reuniones;
- economía;
- agenda pública.

Estos alcances podrán incorporarse posteriormente sin modificar la semántica
central de 12A.

## 16. Criterios de aceptación

12A se considerará funcionalmente implementado cuando:

1. exista `/panel/agenda`;
2. una Oportunidad con `due_date` pendiente aparezca sin duplicar sus datos;
3. un entregable con `target_date` pendiente aparezca sin duplicar sus datos;
4. el próximo `next_due_at` vigente de un Tema aparezca correctamente;
5. seguimientos históricos anteriores no generen vencimientos fantasmas;
6. pueda registrarse una actividad manual;
7. pueda vincularse opcionalmente a una entidad soportada;
8. pueda marcarse realizada o cancelada conservando trazabilidad;
9. pueda corregirse sin eliminación física;
10. pueda distinguirse visualmente una entrada manual de una derivada;
11. puedan filtrarse próximos, vencidos y realizados;
12. cada elemento permita navegar a su origen cuando exista;
13. no se creen relaciones, participantes, asignaciones ni convocatorias
    automáticamente;
14. pueda buscarse por título, detalle o entidad de origen sin cargar toda la
    Agenda en el navegador;
15. la paginación conserve un orden determinista por fecha, hora y título,
    colocando las actividades con hora antes de las de todo el día;
16. las pruebas de autonomía de Oportunidades, Articulaciones y Proyectos
    continúen pasando.

## 17. Integración futura con Comunicaciones y Convocatorias

La Agenda deberá quedar preparada para actuar como contexto de origen de una
comunicación futura, sin incorporar funciones de mensajería dentro de 12A.

Una entrada de Agenda podrá servir posteriormente para iniciar acciones como:

- preparar una convocatoria;
- preparar un recordatorio;
- preparar un aviso de cambio;
- preparar un mensaje de seguimiento.

Esta integración no implicará envío automático.

Agenda continuará siendo la fuente del hecho programado y el módulo de
Comunicaciones será responsable de audiencia, borrador, revisión, autorización,
envío y trazabilidad.

La existencia de una entrada de Agenda no crea destinatarios ni autoriza una
comunicación.
