# MP25M — Incremento 10A: Necesidades y ofertas

## Objetivo

Incorporar un registro operativo y trazable de necesidades y ofertas, independiente de oportunidades, articulaciones y proyectos. Cada registro podrá servir como contexto para esas entidades, pero ninguna relación se creará automáticamente.

## Alcance

Cada necesidad u oferta tendrá título, descripción, estado, responsable interno y, opcionalmente, un nodo territorial. Los estados iniciales serán **borrador**, **vigente**, **pausada**, **cerrada** y **cancelada**. Todo cambio de estado requerirá una explicación y quedará en el historial.

La pantalla permitirá crear registros, consultar el listado y operar una ficha individual con seguimiento manual. No se calcula coincidencia, disponibilidad, cobertura ni compromiso.

## Límites

- Necesidad u oferta no equivale a oportunidad.
- Registrar una oferta no confirma disponibilidad, precio, capacidad ni compromiso.
- Registrar una necesidad no convoca, asigna ni contacta a ninguna persona u organización.
- No se incluyen economía, pagos, inventario, agenda, notificaciones, cruces automáticos ni IA.
- Las relaciones con oportunidades, articulaciones o proyectos se resolverán explícitamente en incrementos posteriores.

## Criterios de aceptación

1. Un usuario autorizado puede crear una necesidad o una oferta con información mínima verificable.
2. Cada registro conserva responsable, estado, motivo de cada transición y novedades manuales.
3. La navegación presenta Necesidades y ofertas como módulo independiente.
4. La ficha no altera otras entidades ni produce acciones externas.
