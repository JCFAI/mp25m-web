# MP25M — Especificación funcional Incremento 11A
## Resultados y aprendizaje

## 1. Objetivo

Incorporar un registro estructurado, explícito y trazable de los resultados
obtenidos en Articulaciones y Proyectos.

El objetivo es distinguir un resultado verificable de:

- una síntesis de cierre;
- una novedad de seguimiento;
- el resultado particular de un entregable;
- una inferencia automática sobre lo ocurrido.

Los resultados registrados deberán servir posteriormente como base para
trayectoria productiva, aprendizaje institucional, indicadores y futuras
funciones del Radar, sin convertir automáticamente la experiencia histórica
en capacidad actual, disponibilidad ni asignación.

## 2. Principio funcional

Un resultado representa un efecto concreto observado o documentado durante
o después de una Articulación o Proyecto.

Ejemplos:

- trabajo generado;
- propuesta presentada;
- alianza conseguida;
- contacto relevante incorporado;
- capacidad desarrollada;
- nodo fortalecido;
- impacto territorial;
- aprendizaje documentado;
- resultado económico cualitativo;
- otro efecto verificable.

Resultado no equivale a cierre.

Una Articulación o Proyecto puede:

- permanecer abierto y ya tener resultados;
- cerrarse con varios resultados;
- cerrarse sin un resultado concreto pero conservar aprendizajes;
- registrar nuevos resultados posteriormente si se documenta evidencia
  adicional.

## 3. Entidades de origen

En 11A un Resultado debe pertenecer a exactamente uno de estos contextos:

- una Articulación;
- un Proyecto.

No se exige una Opportunity asociada.

Una relación entre Articulación y Opportunity, o entre Proyecto y Opportunity,
no se utilizará para inferir automáticamente el origen de un Resultado.

## 4. Datos mínimos de un Resultado

Cada Resultado registrará como mínimo:

- identificador;
- Articulación o Proyecto de origen;
- tipo de resultado;
- título;
- descripción;
- fecha del resultado;
- referencia de evidencia opcional;
- usuario que lo registró;
- fecha de registro.

Tipos iniciales:

- `productive`;
- `economic`;
- `territorial`;
- `organizational`;
- `strategic`;
- `institutional`;
- `communication`;
- `learning`;
- `other`.

El tipo `economic` en 11A sólo clasifica cualitativamente el resultado.
No incorpora importes ni contabilidad.

## 5. Contribuciones al resultado

Un Resultado podrá registrar de manera explícita contribuciones de:

- personas;
- organizaciones.

Cada contribución deberá indicar:

- actor;
- descripción de la contribución;
- referencia de evidencia opcional;
- usuario que la registró;
- fecha de registro.

La interfaz deberá priorizar como candidatos a las personas u organizaciones
que participaron históricamente en la Articulación o Proyecto correspondiente.

La existencia de una participación no crea automáticamente una contribución.

La existencia de una contribución no implica disponibilidad actual del actor.

## 6. Relación con datos existentes

11A no reemplaza ni migra automáticamente:

- `opportunity_articulations.closing_summary`;
- `projects.completion_summary`;
- `project_deliverables.result_summary`;
- novedades o seguimientos de tipo resultado.

Esos registros conservan su significado actual.

Un usuario podrá registrar un Resultado estructurado cuando corresponda,
pero no se generará automáticamente a partir de textos históricos.

## 7. Trazabilidad

Toda alta o modificación relevante deberá quedar registrada en auditoría con:

- actor;
- fecha;
- entidad de origen;
- resultado afectado;
- motivo cuando corresponda;
- datos anteriores y posteriores en las operaciones de modificación.

No se realizará borrado físico desde la interfaz operativa.

Las correcciones deberán preservar trazabilidad.

## 8. Permisos

Puede registrar o administrar Resultados quien pueda administrar la
Articulación o Proyecto de origen.

El acceso de lectura debe respetar la visibilidad y alcance de la entidad
de origen.

Registrar un Resultado no otorga permisos adicionales sobre Personas,
Organizaciones, Articulaciones, Proyectos u Opportunities relacionadas.

## 9. Interfaz mínima

### Articulación

La ficha de una Articulación incorporará una sección `Resultados`.

Debe permitir:

- listar resultados;
- registrar un resultado;
- consultar evidencia;
- consultar contribuciones;
- agregar contribuciones cuando corresponda.

### Proyecto

La ficha de un Proyecto incorporará la misma sección `Resultados`.

Los Resultados serán independientes de `Entregables y evidencia`.

## 10. Trayectoria productiva

Las contribuciones explícitas a Resultados preparan la base para construir
trayectoria productiva verificable.

En 11A no se utilizarán automáticamente para:

- modificar habilidades;
- validar capacidades;
- modificar cobertura de Opportunities;
- producir coincidencias;
- asignar actores;
- alimentar automáticamente el Radar.

Esas funciones requerirán decisiones y reglas posteriores.

## 11. Fuera de alcance

11A no incorpora:

- presupuestos;
- montos;
- monedas;
- costos;
- márgenes;
- ingresos;
- honorarios;
- aportes al MP25M;
- distribución económica;
- facturación;
- pagos;
- cobros;
- conciliaciones;
- indicadores agregados;
- agenda;
- convocatorias;
- Radar externo;
- IA o generación automática de resultados.

La capa económica estructurada quedará para un incremento posterior.

## 12. Invariantes

1. Cierre ≠ resultado estructurado.
2. Entregable completado ≠ resultado global automático.
3. Seguimiento ≠ resultado estructurado.
4. Participación ≠ contribución comprobada.
5. Resultado histórico ≠ capacidad actual.
6. Resultado histórico ≠ disponibilidad actual.
7. Resultado económico cualitativo ≠ registro contable.
8. Articulación ≠ Proyecto.
9. Ningún vínculo con Opportunity se infiere por transitividad.
10. Ningún Resultado se crea automáticamente.

## 13. Criterios de aceptación

11A se considerará completo cuando:

1. se puedan registrar múltiples Resultados en una Articulación;
2. se puedan registrar múltiples Resultados en un Proyecto;
3. cada Resultado pertenezca exactamente a una Articulación o Proyecto;
4. puedan registrarse personas u organizaciones contribuyentes;
5. ninguna participación produzca contribuciones automáticas;
6. ninguna síntesis de cierre o entregable produzca Resultados automáticos;
7. exista auditoría de las operaciones de escritura;
8. se respeten los permisos de la entidad de origen;
9. la interfaz diferencie claramente Resultados de seguimiento, cierre y
   entregables;
10. no exista ninguna funcionalidad monetaria o de cobro en este incremento.
