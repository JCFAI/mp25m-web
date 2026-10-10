# MP25M_S — tutorial contextual

## Propósito

Ofrecer una orientación visual breve para las primeras personas del piloto,
sin crear datos de práctica ni modificar el flujo operativo real.

## Alcance actual

El tour se adapta a la pantalla abierta:

- `/panel`: bienvenida, módulos activos, etapas de crecimiento y acceso a
  Articulaciones.
- `/panel/articulaciones`: propósito de una Articulación, alta inicial y
  directorio de Articulaciones registradas.
- `/panel/articulaciones/[id]`: ficha, historial de estados, responsable,
  participantes y novedades/seguimiento.

No enseña acciones de módulos posteriores, en particular Agenda,
Oportunidades, Necesidades y ofertas, Comunicaciones, Informes, Economía ni
Resultados.

## Uso

En el primer ingreso a Inicio se abre una bienvenida breve. Después, el botón
`Ver recorrido` permite abrir nuevamente la guía desde las pantallas
incluidas.

El estado de bienvenida se conserva sólo en el navegador mediante
`localStorage`; no se guarda información de onboarding en Supabase ni se
modifican datos remotos.

## Accesibilidad y movimiento

- `Escape` cierra el recorrido.
- El foco pasa al cuadro del recorrido al abrirlo.
- El desplazamiento respeta la preferencia del sistema para reducir movimiento.
- El sombreado y el borde destacan la zona explicada sin bloquear la pantalla.

## Verificación visual del piloto

1. Abrir Inicio con almacenamiento local limpio y comprobar la bienvenida.
2. Recorrer Inicio, Articulaciones y una ficha de Articulación.
3. Verificar que una persona sin permiso de gestión no reciba pasos sobre
   controles que no puede utilizar.
4. Confirmar que `Ver recorrido` reinicia la guía de la pantalla actual.
5. Probar `Escape`, teclado, escritorio y móvil.

## Materiales complementarios del piloto

El tutorial contextual se complementa con:

- `MP25M-S-PRACTICA-GUIADA.md`: recorrido breve con un caso real;
- `MP25M-S-HOJA-RAPIDA.md`: referencia operativa para consulta durante el uso.

El tutorial orienta dentro de la pantalla; estos documentos acompañan la
práctica inicial y la consulta posterior.
