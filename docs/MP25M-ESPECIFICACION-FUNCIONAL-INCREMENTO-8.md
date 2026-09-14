# MP25M — Especificación funcional del Incremento 8

## Objetivo

El Incremento 8 inicia el módulo de **Articulaciones**: la gestión operativa y explícita que conecta una oportunidad con personas u organizaciones para intentar lograr un resultado.

El recorrido queda deliberadamente separado:

```text
oportunidad analizada → articulación → acuerdo explícito → proyecto futuro
```

Una articulación no es una coincidencia analítica, no confirma disponibilidad, no crea compromisos automáticos y no se convierte en proyecto por el solo hecho de existir.

## 8A — Articulación inicial

Pregunta operativa: **¿Cómo coordinamos una oportunidad concreta con los actores que decidimos convocar?**

Cada articulación tendrá:

- Una oportunidad de origen obligatoria.
- Título, objetivo y estado.
- Un responsable interno obligatorio al activarla.
- Participantes canónicos seleccionados explícitamente: personas u organizaciones.
- Seguimiento manual: novedades, reuniones, compromisos o próximos pasos.
- Historial y auditoría de altas, estados, responsables, participantes y novedades.

Los estados iniciales son:

| Estado | Significado |
|---|---|
| Borrador | Registrada pero aún no iniciada. |
| Activa | Tiene responsable y gestión en curso. |
| En seguimiento | Espera respuesta, reunión, tarea o decisión posterior. |
| Pausada | Se detiene temporalmente con motivo. |
| Cerrada con resultado | Finaliza y registra una síntesis del resultado. |
| Cerrada sin resultado | Finaliza sin resultado concreto, preservando aprendizaje. |
| Cancelada | Se decide no continuar. |

### Decisiones y límites

- Crear una articulación exige una decisión explícita de un usuario autorizado; no se genera desde coincidencias, coberturas, brechas o acciones.
- Agregar un participante no confirma su disponibilidad, aceptación ni compromiso. Es una decisión de coordinación que deberá conservar su fundamento.
- Sólo se pueden incorporar personas u organizaciones canónicas activas. Los candidatos provisionales deberán resolverse antes.
- La articulación reutiliza la oportunidad como contexto; no modifica sus requerimientos, coincidencias, cobertura, brechas ni estado automáticamente.
- Una oportunidad puede tener varias articulaciones. Cada una conserva su propio responsable, participantes e historia.
- Una articulación puede abrirse con la oportunidad en análisis, activa o en articulación. La oportunidad no cambia de estado como efecto colateral: dicho cambio es una operación independiente y trazable.
- La consulta de contactos privados continúa fuera de este primer alcance; registrar un participante no habilita por sí mismo el acceso a sus datos de contacto.

## Gobernanza inicial

`administrator` y `articulator` podrán crear y gestionar articulaciones dentro de sus ámbitos autorizados. El responsable actual de la oportunidad podrá operar las articulaciones de esa oportunidad cuando su acceso existente lo permita. Las validaciones de permiso se hacen en servidor y en la operación de base; la interfaz no es una frontera de autorización.

Las transiciones de cierre requieren responsable y fundamento. Todas las operaciones relevantes registran actor, fecha, datos anteriores y posteriores, motivo y resultado en la auditoría existente.

## Fuera de alcance

El Incremento 8A no implementa:

- Proyectos, presupuestos, ingresos, costos, distribución económica ni cobros.
- Confirmación de disponibilidad, aceptación o contratación de participantes.
- Convocatorias, envío de comunicaciones o acceso automático a contactos privados.
- Actividades de agenda con calendario, recordatorios o notificaciones.
- Creación automática de oportunidades, actores, relaciones, resultados o proyectos.
- Medición de impacto, informes agregados o Radar externo.

Estas exclusiones evitan presentar como compromiso una hipótesis analítica o una coordinación aún no confirmada.

## Criterios de aceptación de 8A

1. Desde el detalle de una oportunidad autorizada se puede registrar una articulación en borrador con objetivo claro.
2. Activarla exige un responsable interno activo.
3. Se pueden agregar y quitar explícitamente personas u organizaciones canónicas activas, dejando historial.
4. Se pueden registrar novedades de seguimiento sin alterar la cobertura ni los requerimientos.
5. Pausar, cerrar o cancelar exige un motivo; cerrar exige además una síntesis del resultado o aprendizaje.
6. La pantalla de oportunidad muestra las articulaciones relacionadas, su estado, responsable, participantes y último seguimiento.
7. Todas las operaciones quedan auditadas y ninguna crea proyectos, compromisos o acceso a contactos por efecto colateral.
