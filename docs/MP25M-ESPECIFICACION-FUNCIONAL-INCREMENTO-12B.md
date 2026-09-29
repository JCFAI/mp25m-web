# MP25M — Especificación funcional inicial — Incremento 12B

## Comunicaciones y convocatorias asistidas

## 1. Objetivo

El Incremento 12B deberá permitir preparar, revisar, autorizar, enviar y
registrar comunicaciones relacionadas con la actividad del MP25M.

Las comunicaciones podrán originarse desde cualquier contexto operativo
relevante del sistema o iniciarse de manera independiente.

El sistema podrá asistir en la generación del contenido, pero ninguna
comunicación será enviada sin una orden explícita de un usuario autorizado.

## 2. Flujo general

El flujo será:

contexto
→ definición de audiencia
→ resolución de destinatarios
→ generación de borrador
→ revisión humana
→ confirmación de destinatarios
→ orden explícita de envío
→ entrega por canal
→ registro de resultados

Generar un borrador no equivale a enviarlo.

Resolver una audiencia no equivale a contactar a sus integrantes.

## 3. Contextos de origen

Una comunicación podrá iniciarse desde:

- una Persona;
- un Nodo;
- una Organización;
- una Oportunidad;
- una Articulación;
- un Proyecto;
- un Tema;
- una Necesidad/Oferta;
- una entrada de Agenda;
- otra actividad operativa que se incorpore posteriormente;
- un contexto independiente.

El contexto proporciona información para redactar o seleccionar audiencia,
pero no crea relaciones nuevas entre entidades.

## 4. Audiencias

12B deberá admitir inicialmente audiencias definidas mediante:

- una Persona concreta;
- selección manual de Personas;
- participantes de un Nodo;
- participantes de una Articulación;
- participantes de un Proyecto;
- Personas con determinadas habilidades;
- Organizaciones con determinadas capacidades;
- responsables de Temas;
- combinaciones explícitas de criterios compatibles.

La arquitectura deberá permitir incorporar posteriormente otros criterios.

## 5. Criterio de audiencia y destinatarios efectivos

Un criterio de audiencia no es todavía una lista de envío.

Antes de autorizar el envío, el sistema deberá resolver el criterio y mostrar
los destinatarios concretos resultantes.

El usuario deberá poder:

- revisar la lista;
- excluir destinatarios;
- agregar destinatarios cuando tenga permiso para hacerlo;
- identificar duplicados;
- identificar destinatarios sin un canal disponible;
- confirmar la lista definitiva.

La selección de audiencia no crea participación, responsabilidad, habilidad,
capacidad, disponibilidad ni compromiso.

## 6. Snapshot de destinatarios

Al autorizar un envío se deberá conservar una instantánea de los destinatarios
efectivos.

La instantánea permitirá conocer posteriormente a quién se intentó enviar la
comunicación aunque hayan cambiado:

- las personas de un Nodo;
- los participantes de un Proyecto;
- las habilidades;
- las capacidades;
- las responsabilidades;
- los datos de contacto.

El historial del envío no deberá reconstruirse dinámicamente a partir del
estado actual de la red.

## 7. Borradores

Toda comunicación tendrá primero estado de borrador.

El borrador podrá contener al menos:

- asunto, cuando el canal lo admita;
- cuerpo;
- contexto de origen;
- criterio de audiencia;
- destinatarios resueltos;
- canal o canales previstos;
- creador;
- fecha de creación.

El usuario podrá modificar libremente el texto antes de enviarlo.

## 8. Generación asistida

El sistema podrá generar automáticamente un borrador cuando un usuario lo
solicite.

La generación podrá utilizar exclusivamente información del contexto para la
que el usuario tenga acceso.

La asistencia podrá considerar:

- tipo de comunicación;
- contexto;
- objetivo indicado por el usuario;
- audiencia;
- fecha o actividad relacionada;
- tono solicitado;
- datos operativos explícitos disponibles.

La generación asistida no podrá:

- enviar mensajes;
- ampliar silenciosamente la audiencia;
- crear destinatarios;
- inferir consentimiento;
- inferir disponibilidad;
- comprometer a una persona u organización;
- alterar datos operativos;
- crear relaciones entre entidades.

El contenido generado siempre será editable antes del envío.

## 9. Canales

Los primeros canales previstos son:

- Email;
- WhatsApp.

La arquitectura deberá separar el modelo funcional de los proveedores
concretos utilizados para entregar mensajes.

Cada canal podrá requerir reglas específicas.

El sistema deberá poder distinguir entre:

- destinatario apto para el canal;
- destinatario sin dato de contacto disponible;
- destinatario excluido;
- intento de envío;
- envío aceptado por proveedor;
- entregado, cuando el proveedor pueda informarlo;
- fallido.

## 10. Email

Para Email se deberá registrar como mínimo:

- dirección utilizada;
- asunto;
- cuerpo enviado;
- fecha de intento;
- resultado técnico disponible;
- identificador del proveedor cuando exista.

No se almacenarán credenciales de proveedor dentro de los mensajes.

## 11. WhatsApp

WhatsApp deberá implementarse mediante un adaptador de canal.

El modelo funcional no dependerá de un proveedor determinado.

La implementación deberá contemplar que el proveedor o la plataforma puedan
exigir:

- plantillas aprobadas;
- ventanas de conversación;
- formatos específicos;
- identificadores externos;
- estados de entrega.

La existencia de un número telefónico no implica automáticamente autorización
para contactar por WhatsApp.

## 12. Revisión y autorización

Antes del envío se deberá presentar al usuario:

- contexto;
- mensaje definitivo;
- canal;
- cantidad de destinatarios;
- lista concreta de destinatarios;
- destinatarios excluidos o sin canal disponible.

El envío requerirá una acción explícita de confirmación.

No habrá envío automático por el solo hecho de:

- crear una Articulación;
- iniciar un Proyecto;
- registrar una actividad;
- crear una entrada de Agenda;
- cambiar un estado;
- detectar una habilidad;
- encontrar una coincidencia;
- registrar un Resultado.

## 13. Trazabilidad

Deberá conservarse trazabilidad de:

- quién creó el borrador;
- si el borrador fue generado asistidamente;
- contexto utilizado;
- criterio de audiencia;
- destinatarios resueltos;
- cambios relevantes antes del envío;
- quién autorizó el envío;
- cuándo se autorizó;
- canal;
- contenido definitivo enviado;
- resultado de cada destinatario.

No se deberá reescribir el mensaje histórico enviado cuando cambie
posteriormente el borrador o la entidad de origen.

## 14. Integración con Agenda

Una entrada de Agenda podrá ofrecer la acción:

`Preparar comunicación`

Por ejemplo:

- convocar a una reunión;
- recordar un vencimiento;
- avisar un cambio de horario;
- enviar información previa;
- realizar un seguimiento posterior.

La Agenda aporta contexto.

Comunicaciones resuelve audiencia, borrador, autorización y envío.

Una entrada de Agenda nunca envía por sí misma.

## 15. Integración con Articulaciones y Proyectos

Desde una Articulación o Proyecto se podrá solicitar, entre otras acciones:

- preparar mensaje a participantes;
- preparar convocatoria;
- preparar pedido de información;
- preparar actualización;
- preparar recordatorio;
- preparar comunicación a una audiencia construida mediante otros criterios.

La audiencia predeterminada podrá sugerirse a partir del contexto, pero deberá
ser visible y confirmada antes del envío.

## 16. Consentimiento y contacto

El módulo deberá respetar las reglas de privacidad, consentimiento y
visibilidad existentes en MP25M.

Dato de contacto disponible ≠ autorización automática de uso.

Pertenencia a un Nodo ≠ consentimiento para cualquier comunicación.

Participación en un Proyecto ≠ autorización para cualquier canal.

Las reglas definitivas de contacto deberán poder evolucionar sin modificar
el modelo histórico de mensajes.

## 17. Invariantes

Borrador ≠ mensaje enviado.

Audiencia ≠ destinatarios confirmados.

Destinatario ≠ participante.

Habilidad ≠ disponibilidad.

Dato de contacto ≠ consentimiento.

Generación asistida ≠ autorización.

Contexto ≠ vínculo operativo.

Convocatoria ≠ asignación.

Envío aceptado por proveedor ≠ entrega confirmada.

Ninguna IA envía mensajes por decisión propia.

## 18. Fuera de alcance inicial

La primera versión de 12B no deberá incluir automáticamente:

- campañas de marketing;
- envíos periódicos autónomos;
- selección autónoma de audiencias por IA;
- modificación automática de datos de Personas u Organizaciones;
- creación automática de participantes;
- respuestas automáticas en nombre del usuario;
- conversaciones autónomas con terceros;
- compromisos contractuales o económicos;
- contacto externo sin confirmación humana.

## 19. Criterio central de seguridad operativa

Toda automatización de 12B termina antes del envío.

El último paso siempre será una decisión humana explícita:

`Revisar → Confirmar destinatarios → Enviar`


## 20. Invitaciones a reuniones virtuales

Cuando una comunicación tenga como objetivo convocar a una reunión virtual o
híbrida, el sistema deberá permitir trabajar con una sala de reunión.

Proveedores inicialmente previstos:

- Google Meet;
- Jitsi Meet.

La arquitectura utilizará un adaptador de proveedor y no incorporará reglas
de Google Meet o Jitsi dentro del modelo central de Comunicaciones.

El usuario podrá optar por:

- utilizar un enlace de reunión ya existente;
- solicitar la generación de una nueva sala virtual.

La generación de una sala será siempre una acción explícitamente solicitada
por el usuario.

El flujo previsto será:

```text
Reunión de Agenda
→ Preparar convocatoria
→ Elegir audiencia
→ Elegir Virtual/Híbrida
→ Elegir proveedor
→ Generar o utilizar sala
→ Generar borrador
→ Revisar mensaje
→ Revisar destinatarios
→ Confirmar
→ Enviar
```

Cuando se genere una sala, deberán conservarse cuando estén disponibles:

- proveedor;
- URL de acceso;
- identificador externo;
- usuario que solicitó su creación;
- fecha de creación;
- referencia a la entrada de Agenda correspondiente.

El enlace deberá incorporarse al borrador de la convocatoria y permanecer
visible y editable antes del envío.

Si la reunión corresponde a una entrada de Agenda, la información de acceso
podrá actualizar también los campos estructurados de esa entrada mediante una
operación gobernada.

### Google Meet

Google Meet deberá implementarse mediante un adaptador independiente.

Cuando la generación requiera una cuenta o servicio externo conectado, el
sistema deberá utilizar únicamente una conexión autorizada por el usuario o
por la organización.

El modelo de MP25M no dependerá de identificadores internos específicos del
proveedor.

### Jitsi Meet

Jitsi Meet deberá implementarse mediante un adaptador independiente.

La configuración deberá permitir definir qué servicio o servidor Jitsi se
utiliza, sin fijarlo permanentemente en el modelo funcional.

### Seguridad operativa

Crear una sala virtual ≠ enviar una convocatoria.

Generar un enlace ≠ agregar destinatarios.

Generar un enlace ≠ confirmar asistencia.

Crear una reunión externa ≠ crear participantes del Proyecto o Articulación.

La creación de una sala no podrá dispararse automáticamente por el solo hecho
de crear una actividad de Agenda.

Si falla la generación de la sala, el sistema no deberá enviar una
convocatoria que dependa de ese enlace sin que el usuario revise la situación.

El usuario siempre deberá ver el enlace definitivo antes de ordenar el envío.
