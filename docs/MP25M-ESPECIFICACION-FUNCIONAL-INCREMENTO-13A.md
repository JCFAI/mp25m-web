# MP25M — Especificación funcional — Incremento 13A

## Informes e indicadores operativos

## 1. Objetivo

El Incremento 13A incorpora una primera superficie de Informes e Indicadores
del MP25M para responsables, autoridades y nodos.

Su función es transformar información operativa ya registrada en lecturas
agregadas, explicables y verificables.

13A es exclusivamente de lectura: no crea hechos, no modifica entidades y no
duplica fuentes de verdad.

Debe permitir responder, entre otras, estas preguntas:

- ¿Cuál es la dimensión actual de la red?
- ¿Cuántas necesidades y ofertas están vigentes?
- ¿Cuántas oportunidades están activas?
- ¿Cuántas poseen análisis iniciado?
- ¿Qué completitud tienen los análisis?
- ¿Cuántos requerimientos están cubiertos, parciales, faltantes o no evaluados?
- ¿Cuántas coincidencias y brechas existen?
- ¿Cuántas articulaciones y proyectos se iniciaron?
- ¿Cuántos proyectos finalizaron?
- ¿Qué oportunidades activas no poseen seguimiento registrado?

## 2. Principios

### 2.1 Informe ≠ fuente de verdad

Cada indicador se deriva de entidades operativas existentes.

No se copiarán datos a una tabla paralela de informes en 13A.

### 2.2 Indicador ≠ inferencia

No se producirán métricas que el modelo actual no permita demostrar.

Por ejemplo:

- Persona nueva ≠ nuevo contacto.
- Organización nueva ≠ nuevo aliado.
- Proyecto creado ≠ propuesta presentada.
- Capacidad declarada ≠ capacidad verificada.

### 2.3 Stock ≠ flujo

Se distinguirán explícitamente:

- indicadores de estado actual;
- indicadores correspondientes a un período.

Ejemplo:

- Personas activas: stock actual.
- Oportunidades detectadas: flujo del período.

### 2.4 Sin score global

No se sintetizará el estado del MP25M en un puntaje único.

## 3. Superficie

Se incorporará:

`/panel/informes`

La pantalla tendrá inicialmente:

1. filtros;
2. resumen de la red;
3. necesidades y ofertas;
4. oportunidades y análisis;
5. requerimientos, coincidencias y brechas;
6. articulaciones y proyectos;
7. advertencias sobre disponibilidad de información.

## 4. Indicadores de red

### Personas activas

Personas canónicas con:

`record_status = active`

No incluye archivadas ni fusionadas.

### Nodos activos

Nodos con:

`status = active`

Los nodos en formación no forman parte de este indicador.

### Organizaciones activas

Organizaciones con:

`record_status = active`

No incluye archivadas ni fusionadas.

### Habilidades personales confirmadas

Registros de habilidades personales con:

`verification_status = confirmed`

### Capacidades organizacionales confirmadas

Capacidades activas de organizaciones con:

`verification_status = confirmed`

La interfaz distinguirá habilidades personales de capacidades
organizacionales.

No se sumarán como si fueran una única clase de entidad.

## 5. Necesidades y ofertas

### Necesidades vigentes

`record_type = need`
`status = active`

### Ofertas vigentes

`record_type = offer`
`status = active`

## 6. Oportunidades

### Oportunidades detectadas

Cantidad de oportunidades creadas dentro del período seleccionado.

La fecha utilizada será:

`opportunities.created_at`

### Oportunidades activas

Estados considerados operativamente activos:

- `open`
- `under_analysis`
- `in_progress`

Los estados `draft`, `resolved` y `discarded` se mostrarán por separado cuando
sea necesario.

### Oportunidades con análisis iniciado

Una oportunidad tiene análisis iniciado cuando posee al menos un requerimiento
productivo activo.

El porcentaje será:

oportunidades activas con análisis iniciado
/
total de oportunidades activas

Si no existen oportunidades activas, el porcentaje se mostrará como no
calculable y no como 0 %.

## 7. Completitud del análisis

Se utilizará el snapshot de cobertura más reciente de cada oportunidad.

Para cada oportunidad:

completitud =
evaluated_requirement_count
/
active_requirement_count

Sólo participan aquellas con:

`active_requirement_count > 0`

La interfaz deberá mostrar:

- promedio;
- cantidad de oportunidades incluidas en el cálculo.

## 8. Estado de requerimientos

Se utilizará el último snapshot de cobertura de cada oportunidad y la lectura:

`network_mp25m`

Los requerimientos se agruparán como:

- Cubiertos.
- Parcialmente cubiertos.
- Faltantes.
- No evaluados.

Un requerimiento sin evaluación no será considerado faltante.

## 9. Coincidencias

Se contabilizarán coincidencias actuales con estado:

- `suggested`
- `accepted_for_analysis`

No se incluirán:

- `discarded`

Encontrar una coincidencia no implica asignación, disponibilidad ni
participación.

## 10. Brechas

### Brechas abiertas

Estados:

- `open`
- `in_treatment`
- `blocked`

### Brechas resueltas

Estado:

- `resolved`

Se mantendrán separadas:

- `closed_unresolved`
- `cancelled`

## 11. Articulaciones

“Articulaciones iniciadas” contará articulaciones cuyo `created_at` se
encuentre dentro del período seleccionado.

No implica que hayan finalizado con resultado.

## 12. Proyectos

### Proyectos iniciados

Proyectos cuyo `created_at` esté dentro del período.

Se utilizará “Proyectos iniciados” y no “Proyectos acordados”, porque el modelo
actual no registra un evento independiente e inequívoco de acuerdo.

### Proyectos finalizados

Proyectos con:

`status = completed`

y `completed_at` dentro del período.

## 13. Oportunidades sin seguimiento registrado

Se contabilizarán oportunidades activas sin registros en:

`opportunity_followups`

La denominación será:

“Sin seguimiento registrado”

No se las denominará “sin actividad”, porque pueden poseer requerimientos,
coincidencias, brechas, articulaciones u otras operaciones.

## 14. Indicadores pendientes

El documento funcional general incluye indicadores que 13A todavía no puede
producir con rigor.

Quedan pendientes:

- propuestas presentadas;
- proyectos acordados como evento independiente;
- ingresos estimados y finales para participantes;
- recursos potenciales y finales para MP25M;
- horas de colaboración gratuita;
- nuevos contactos;
- nuevos aliados;
- nuevos territorios;
- tiempo desde detección hasta primera acción.

### Motivos

Los indicadores económicos requieren el futuro modelo económico.

“Nuevo contacto”, “nuevo aliado” y “nuevo territorio” todavía no poseen una
definición estructurada inequívoca.

“Primera acción” requiere acordar qué eventos califican como tales entre
seguimientos, requerimientos, coincidencias, brechas, articulaciones y Agenda.

13A no elegirá estas reglas arbitrariamente.

## 15. Período

Valores iniciales:

- últimos 30 días;
- últimos 90 días;
- año actual;
- rango personalizado.

El período sólo afectará indicadores de flujo.

No se reconstruirán stocks históricos cuando el modelo no conserve información
suficiente para hacerlo correctamente.

## 16. Nodo

El filtro por Nodo sólo se aplicará cuando exista una relación explícita.

En Oportunidades se utilizará:

`opportunity_nodes`

No se inferirá el Nodo de una oportunidad a partir de personas,
organizaciones, articulaciones o proyectos relacionados.

## 17. Responsable

El filtro por responsable se aplicará sólo a entidades con responsable
explícito.

No se inferirá responsabilidad a partir del usuario creador.

## 18. Estado

Cada familia conservará sus propios estados.

No se implementará un filtro genérico que mezcle estados de:

- Oportunidades;
- Articulaciones;
- Proyectos;
- Necesidades/Ofertas;
- Brechas.

## 19. Validación

El nivel de validación sólo se aplicará donde exista un campo estructurado que
lo soporte.

Ejemplos:

- habilidades personales;
- capacidades organizacionales;
- revisiones de requerimientos.

No será un filtro global artificial.

## 20. Territorio y vector productivo

Se postergan como filtros transversales hasta acordar una definición que no
mezcle:

- Nodo;
- residencia;
- ámbito organizacional;
- territorio de oportunidad;
- actividad;
- habilidad;
- sector;
- vector productivo.

## 21. Estados sin datos

La interfaz distinguirá:

- `0`: el universo existe y el resultado es cero;
- `Sin datos`: no existen registros suficientes;
- `No calculable`: falta denominador o evidencia;
- `Pendiente`: indicador todavía no soportado.

## 22. Navegación

Informes dejará de ser un módulo futuro.

Se activará en:

- Inicio;
- navegación desktop;
- navegación móvil.

## 23. Permisos

13A será sólo lectura.

Requerirá autenticación interna y respetará los permisos y ámbitos existentes.

No expondrá información personal adicional innecesaria.

## 24. Explicabilidad

Cada indicador deberá poder explicar:

- qué cuenta;
- qué no cuenta;
- cuál es su fuente;
- si es stock o flujo;
- qué período utiliza;
- qué filtros se aplicaron.

Los porcentajes mostrarán numerador y denominador.

## 25. Fuera de alcance

Quedan fuera de 13A:

- PDF;
- Excel;
- informes formales para organismos;
- economía;
- metas;
- predicciones;
- IA generativa;
- alertas automáticas;
- envío programado de informes;
- dashboards públicos;
- BI externo;
- reconstrucción histórica sin evidencia suficiente.

## 26. Criterios de aceptación

13A se considerará funcionalmente válido cuando:

1. `/panel/informes` sea accesible para usuarios autorizados;
2. cada indicador posea una definición reproducible;
3. los valores coincidan con consultas directas a las fuentes;
4. stock y flujo estén diferenciados;
5. los filtros se apliquen únicamente cuando correspondan;
6. no se presenten como medidos indicadores sin soporte real;
7. funcione correctamente en desktop y móvil;
8. Informes no permita operaciones de escritura.
