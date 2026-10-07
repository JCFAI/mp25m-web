# MP25M — Especificación funcional — Incremento 14A

## Economía operativa manual

> **Estado:** Implementado y validado en producción el 7 de octubre de 2026.
> La implementación conserva fichas económicas independientes para
> Oportunidades, Articulaciones y Proyectos, revisiones inmutables,
> concurrencia optimista, distinción entre dato ausente y cero y escritura
> gobernada desde servidor. Los indicadores económicos agregados continúan
> fuera de 14A.

## 1. Objetivo

El Incremento 14A incorpora un núcleo de información económica monetaria
manual, estructurada y trazable para la operación del MP25M.

Su objetivo es permitir registrar información económica cuando exista evidencia
suficiente, sin inferir importes, sin automatizar distribuciones y sin ejecutar
pagos o facturación.

La información económica podrá asociarse independientemente a:

- una Oportunidad;
- una Articulación;
- un Proyecto.

14A incorpora una fuente estructurada que podrá alimentar indicadores
económicos posteriores, pero no incorpora todavía esos indicadores al módulo
Informes.

## 2. Principios

### 2.1 Dato explícito ≠ inferencia

Todo importe deberá provenir de una carga explícita de un usuario autorizado.

El sistema no deberá inferir valores económicos a partir de:

- participantes;
- entregables;
- resultados;
- oportunidades relacionadas;
- articulaciones relacionadas;
- proyectos relacionados;
- textos libres;
- estados operativos.

### 2.2 Una entidad no hereda automáticamente la economía de otra

Una Oportunidad, una Articulación y un Proyecto pueden representar momentos
económicos diferentes.

Por lo tanto:

- crear una Articulación no copiará automáticamente la ficha económica de una
  Oportunidad;
- crear un Proyecto no copiará automáticamente la ficha económica de una
  Articulación;
- modificar una entidad aguas arriba no modificará fichas económicas aguas
  abajo.

Una eventual copia asistida y explícita podrá analizarse en otro incremento.

### 2.3 Desconocido ≠ cero

Un campo monetario sin información se representará como no informado.

El valor cero significará que el usuario registró explícitamente cero.

La interfaz no sustituirá datos ausentes por cero.

### 2.4 Sin conversión automática de moneda

Cada ficha económica utilizará una única moneda.

14A no:

- convierte monedas;
- consulta cotizaciones;
- suma importes de monedas distintas;
- mantiene tipos de cambio.

### 2.5 Sin reglas automáticas de distribución

14A no fija:

- porcentajes para participantes;
- porcentaje para MP25M;
- porcentaje para quien originó una oportunidad;
- reglas automáticas de reparto.

Cuando exista un acuerdo podrá registrarse como descripción explícita.

La distribución estructurada por participante queda reservada para una etapa
posterior.

## 3. Ficha económica

Cada Oportunidad, Articulación o Proyecto podrá poseer como máximo una ficha
económica vigente.

La ficha tendrá identidad propia y conservará historial de revisiones.

## 4. Información registrable

### 4.1 Moneda

Código de moneda de la ficha.

Se utilizarán códigos normalizados de tres caracteres.

Ejemplos:

- ARS;
- USD;
- EUR.

La presencia de cualquier importe monetario requerirá una moneda.

### 4.2 Valor estimado

Valor económico total estimado de la operación.

Es opcional.

### 4.3 Costos estimados

Costo total estimado conocido.

Es opcional.

### 4.4 Margen estimado

Cuando existan Valor estimado y Costos estimados, la interfaz podrá mostrar:

    valor estimado - costos estimados

El margen no se almacenará como un dato independiente en 14A.

Si alguno de los dos componentes no existe, el margen será No calculable.

### 4.5 Probabilidad de concreción

Porcentaje explícitamente estimado por un usuario autorizado.

Rango:

    0 a 100

La ausencia del dato no equivale a 0 %.

### 4.6 Ingreso potencial para participantes

Monto agregado potencial destinado a participantes.

14A no distribuye este valor entre Personas u Organizaciones.

### 4.7 Aporte potencial al MP25M

Monto potencial que podría corresponder al MP25M.

No será calculado automáticamente como porcentaje del valor total.

### 4.8 Distribución acordada

Descripción textual opcional del acuerdo económico cuando exista.

Puede documentar criterios, condiciones o referencias.

No constituye una asignación estructurada por participante.

### 4.9 Valor finalmente acordado

Valor total finalmente acordado.

Es independiente del valor estimado.

El sistema no lo completa automáticamente.

### 4.10 Estado manual de cobro

Podrá registrarse uno de los siguientes estados:

- Pendiente;
- Cobro parcial;
- Cobrado;
- Incobrable;
- Cancelado;
- No corresponde.

La ausencia del estado significa que todavía no fue informado.

### 4.11 Importe cobrado

Monto efectivamente registrado como cobrado.

No implica integración con bancos, billeteras ni proveedores de pago.

### 4.12 Costos finales

Costo total final registrado.

### 4.13 Ingreso final para participantes

Monto agregado final destinado a participantes.

14A no lo reparte entre actores individuales.

### 4.14 Aporte final al MP25M

Monto final explícitamente registrado como correspondiente al MP25M.

### 4.15 Resultado económico final

Monto final explícito del resultado económico cuando corresponda.

Puede ser:

- positivo;
- cero;
- negativo.

No se inferirá automáticamente desde otros campos.

### 4.16 Resumen económico

Texto opcional que permita explicar:

- condiciones;
- ajustes;
- diferencias entre estimación y resultado;
- particularidades del acuerdo;
- motivos de pérdidas o variaciones.

### 4.17 Evidencia o referencia

Referencia opcional a documentación que respalde la información económica.

Puede ser:

- documento;
- expediente;
- presupuesto;
- factura;
- comprobante;
- carpeta;
- otra referencia verificable.

14A no implementa gestión documental nueva.

## 5. Revisiones

Cada modificación de la ficha económica deberá crear una nueva revisión.

Una revisión deberá conservar:

- número de revisión;
- valores económicos de ese momento;
- motivo del cambio;
- usuario que realizó el cambio;
- fecha y hora.

Las revisiones anteriores no se sobrescribirán.

## 6. Concurrencia

La edición deberá protegerse contra modificaciones concurrentes.

Cuando un usuario intente guardar sobre una revisión que ya dejó de ser la
vigente, el sistema deberá rechazar la operación y solicitar una recarga antes
de guardar nuevamente.

## 7. Oportunidades

La ficha económica de una Oportunidad representa una evaluación económica de
esa oportunidad.

Puede contener principalmente:

- estimaciones;
- probabilidad;
- ingresos potenciales;
- aporte potencial;
- información disponible durante la evaluación.

No compromete automáticamente a participantes ni al MP25M.

## 8. Articulaciones

La ficha económica de una Articulación representa las condiciones económicas
registradas durante el proceso de articulación.

Puede reflejar:

- estimaciones revisadas;
- negociación;
- valor acordado;
- descripción de una distribución acordada.

No reemplaza los participantes ni los resultados de la Articulación.

## 9. Proyectos

La ficha económica de un Proyecto representa la información económica de su
ejecución.

Puede registrar:

- valor acordado;
- cobro;
- costos finales;
- ingresos finales;
- aporte final al MP25M;
- resultado económico final.

No constituye un sistema contable.

## 10. Relación con Resultados 11A

Un Resultado de tipo:

    economic

continúa siendo un resultado cualitativo y trazable de una Articulación o
Proyecto.

No equivale a una ficha económica monetaria.

14A no convierte automáticamente Resultados 11A en importes ni crea Resultados
a partir de una ficha económica.

Ambos modelos pueden coexistir.

## 11. Interfaz

La ficha económica se incorporará inicialmente dentro de las fichas de:

- Oportunidad;
- Articulación;
- Proyecto.

La sección deberá mostrar:

1. estado de disponibilidad de información;
2. moneda;
3. estimaciones;
4. datos acordados;
5. cobro;
6. datos finales;
7. resumen y evidencia;
8. última revisión;
9. historial de revisiones.

No se incorpora un módulo independiente “Economía” al menú principal en 14A.

## 12. Permisos

La información económica será interna.

La lectura y escritura deberá respetar la visibilidad y los permisos de la
entidad de origen.

14A no deberá ampliar el acceso a una Oportunidad, Articulación o Proyecto por
el solo hecho de incorporar una ficha económica.

Las operaciones de escritura se ejecutarán únicamente desde servidor y deberán
quedar auditadas.

## 13. Auditoría

Crear o modificar una ficha económica deberá registrar:

- usuario;
- entidad relacionada;
- revisión;
- motivo;
- fecha;
- resultado de la operación.

No habrá edición silenciosa de importes.

## 14. Informes

14A crea la fuente estructurada para futuros indicadores económicos.

No incorpora todavía en `/panel/informes`:

- suma de ingresos potenciales;
- suma de ingresos finales;
- recursos potenciales para MP25M;
- recursos finales para MP25M;
- márgenes;
- cobranzas.

Esos indicadores deberán diseñarse respetando monedas y universos antes de ser
habilitados.

## 15. Fuera de alcance

Quedan fuera de 14A:

- pagos automáticos;
- Mercado Pago u otros proveedores;
- transferencias bancarias;
- conciliación bancaria;
- facturación electrónica;
- emisión de facturas;
- contabilidad;
- impuestos;
- retenciones;
- conversión de monedas;
- cotizaciones;
- distribución automática;
- porcentajes institucionales predeterminados;
- distribución estructurada por participante;
- liquidaciones;
- cuentas corrientes;
- vencimientos de cobro automáticos;
- alertas de mora;
- indicadores económicos agregados;
- exportaciones contables.

## 16. Posible continuación 14B

Una etapa posterior podrá incorporar, una vez definidas las reglas
institucionales:

- distribución estructurada por Persona u Organización;
- participación del MP25M;
- participación de quien origina una oportunidad;
- reglas y validaciones de reparto;
- indicadores económicos agregados;
- vistas por moneda;
- reportes económicos.

14B no queda definido por esta especificación.

## 17. Criterios de aceptación

14A se considerará funcionalmente válido cuando:

1. una Oportunidad pueda poseer una ficha económica;
2. una Articulación pueda poseer una ficha económica independiente;
3. un Proyecto pueda poseer una ficha económica independiente;
4. sólo exista una ficha vigente por entidad;
5. cada modificación genere una revisión inmutable;
6. no exista herencia automática de importes entre entidades;
7. no exista distribución automática;
8. no se confunda dato ausente con cero;
9. no se sumen monedas diferentes;
10. los montos negativos se rechacen salvo Resultado económico final;
11. la probabilidad acepte únicamente valores entre 0 y 100;
12. la interfaz funcione en desktop y móvil;
13. las operaciones respeten los permisos de la entidad relacionada;
14. toda escritura quede auditada;
15. 14A no ejecute pagos ni facturación.
