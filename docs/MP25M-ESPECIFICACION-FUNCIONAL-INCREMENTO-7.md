# MP25M — Especificación funcional del Incremento 7

## Estado, objetivo y alcance

Esta especificación consolida el diseño acordado del Incremento 7. El subincremento **7.0 sólo alinea documentación, nomenclatura visible y estado del panel**. Ninguna función de 7A–7G se considera implementada por este documento. La base de partida es `main`, con los Incrementos 1–6 cerrados y el catálogo de habilidades y actividades gobernado.

El Sistema MP25M es un sistema de articulación e inteligencia productiva, no solamente un padrón o un mapa de habilidades. Su pregunta rectora es:

> ¿Qué podemos producir, con quiénes, con qué ventajas, para qué mercados y qué nos falta para poder hacerlo?

El ciclo general permanece:

**detectar → analizar → relacionar → articular → acordar → ejecutar → medir → aprender**.

El Incremento 7 se concentra en el núcleo de **análisis de oportunidades**: identificar requerimientos, descubrir coincidencias, evaluar cobertura, reconocer brechas y decidir acciones. Una oportunidad puede originarse manualmente o, en el futuro, proceder de una detección externa del Radar. Después de la validación, ambas recorrerán el mismo núcleo funcional. El Radar no se implementa ahora.

Referencias: [visión general](MP25M-DOCUMENTO-FUNCIONAL-V1.md) y [diseño técnico y roadmap](MP25M-DISENO-TECNICO-INCREMENTO-7.md).

## Terminología de dominio

| Concepto | Definición y límite |
|---|---|
| Oportunidad | Posibilidad concreta de realizar una acción productiva, comercial, laboral, institucional, formativa, estratégica u otra. |
| Requerimiento de oportunidad | Condición atómica, trazable y evaluable que debe o conviene satisfacerse para responder, presentar, ejecutar o concretar una oportunidad. Éste es el término del nuevo modelo. |
| Coincidencia | Hipótesis analítica de que una persona u organización podría contribuir a satisfacer un requerimiento. |
| Evaluación de cobertura | Conclusión explicable sobre cuánto puede satisfacerse un requerimiento. |
| Brecha | Faltante o insuficiencia relevante sobre el cual se decide realizar acciones. Su apertura es explícita. |
| Articulación | Proceso operativo posterior al análisis que conecta personas, organizaciones, nodos, recursos y oportunidades para intentar concretar un resultado. |
| Proyecto | Oportunidad acordada que entra efectivamente en ejecución. |
| Actividad canónica | Descripción de lo que realiza una organización dentro del catálogo de actividades. No es una oportunidad, un proyecto ni una actividad de seguimiento. |

**Oportunidad ≠ Articulación ≠ Proyecto.** La ruta existente `/panel/oportunidades` representa oportunidades. Los nombres técnicos históricos que contengan `articulation` no se renombran en 7.0; sus etiquetas visibles deben describir lo que efectivamente muestran.

La relación futura **Oportunidad → Articulación → Proyecto** requiere decisiones explícitas: el análisis puede orientar una conexión operativa; un acuerdo que entra en ejecución puede dar lugar a un proyecto. No toda oportunidad llegará a proyecto, ni todo resultado será económico. Los aprendizajes de una articulación también pueden originar otras oportunidades.

## Principios invariantes

1. Sugerencia ≠ decisión.
2. Coincidencia ≠ asignación.
3. Capacidad registrada ≠ disponibilidad.
4. Cobertura analítica ≠ compromiso operativo.
5. Requerimiento faltante ≠ brecha abierta.
6. Brecha resuelta ≠ requerimiento automáticamente cubierto.
7. Actor externo ≠ integrante del MP25M.
8. Resultado histórico ≠ estado actual.
9. Dato ≠ inferencia ≠ hipótesis.
10. Ningún análisis crea relaciones operativas implícitas.

El sistema podrá sugerir que convendría crear una relación operativa futura, pero nunca crearla automáticamente. Tampoco debe asignar habilidades, capacidades, actividades, pertenencias territoriales o participaciones a partir de un análisis.

## 7A — Requerimientos

**Pregunta: ¿Qué necesita esta oportunidad?**

Cada requerimiento será atómico y evaluable, con identidad estable. Registrará:

- Condición expresada con claridad y criterio de satisfacción.
- Carácter obligatorio u opcional y peso relativo de 1 a 5.
- Tipo y, cuando corresponda, referencia a una habilidad o actividad canónica.
- Condiciones estructuradas pertinentes, sin forzar una estructura única para todos los tipos.
- Procedencia y evidencia/fuente.
- Revisión, responsable, fechas y validación.

Estados conceptuales: **Declarado → Pendiente de validación → Validado**, o **Pendiente de validación → Rechazado**, con motivo. Un cambio semántico de un requerimiento validado genera una nueva revisión y exige nueva validación. No se borra historia ni se transfiere silenciosamente una aprobación anterior a una condición distinta.

## 7B — Coincidencias

**Pregunta: ¿Quién podría contribuir a satisfacer cada requerimiento?**

Inicialmente se buscarán personas, organizaciones y candidatos provisionales existentes cuando corresponda. Los nodos aportan contexto territorial; no se los convierte implícitamente en un actor asignado. Una coincidencia no asigna al actor, no confirma disponibilidad ni cobertura y no crea una articulación.

Tipos conceptuales de correspondencia: **directa, relacionada, contextual y manual**. Estados: **sugerida, aceptada para análisis y descartada**. Aceptar para análisis no significa aceptar un compromiso operativo.

Un actor puede tener múltiples fundamentos en una única coincidencia para una revisión del requerimiento. Los fundamentos iniciales serán habilidad de persona, capacidad de organización, actividad de organización y fundamento manual. Cada uno debe distinguir el dato observado de la inferencia o hipótesis derivada.

La búsqueda inicial será de sólo lectura. Persistir una coincidencia requerirá una decisión explícita o la materialización pertinente de una sugerencia gobernada; no se guardarán cientos de sugerencias por el solo hecho de consultar.

Se prevén fundamentos futuros basados en participación en articulaciones, participación o contribuciones en proyectos y resultados anteriores. No se crean esas entidades en esta etapa.

## 7C — Evaluación de cobertura

**Pregunta: ¿Podemos realmente satisfacer este requerimiento?**

Lecturas funcionales: **No evaluado, Cubierto, Parcialmente cubierto y Faltante**. La conclusión debe explicar adecuación técnica, escala, ubicación, plazo, disponibilidad, evidencia y otras verificaciones pertinentes; una habilidad relacionada por sí sola no demuestra cobertura.

La confianza será **baja, media o alta**. No se permitirá conceptualmente afirmar **Cubierto con confianza baja**. Debe poder reconstruirse quién evaluó, qué revisó, con qué fuentes y para qué alcance y vigencia.

La cobertura puede apoyarse en una o varias coincidencias. Varias capacidades no se consideran automáticamente sumables o combinables: se debe evaluar la combinación, sus dependencias y restricciones. La evaluación histórica se conserva; una nueva conclusión no sobrescribe la anterior.

**Cobertura analítica ≠ compromiso operativo**, aun cuando la evaluación tenga confianza alta.

## 7D — Cobertura global y completitud

**Pregunta: ¿Qué tan preparados estamos para aprovechar la oportunidad?**

Se distinguirán dos lecturas: cobertura de la **red MP25M** y cobertura **ampliada con actores argentinos externos**. Estos actores pueden complementar capacidades, cubrir requerimientos y mejorar las expectativas de aprovechamiento; encontrarlos no demuestra compromiso ni los convierte en integrantes del movimiento. La cobertura ampliada debe identificar sus aportes y no sumarse a la de red como si fueran conjuntos independientes.

Fórmula funcional acordada:

> Cobertura productiva = Σ(peso × valor de cobertura) / Σ(pesos de los requerimientos activos con evaluación confirmada vigente).

Valores: **Cubierto = 1; Parcialmente cubierto = 0,5; Faltante = 0**. La fórmula, el universo y las contribuciones deben ser visibles. Los requerimientos no evaluados no forman parte del denominador de cobertura; su ausencia se refleja mediante completitud.

Las capas `network_mp25m` y `expanded_argentina` deben usar el **mismo universo de requerimientos evaluados y el mismo denominador**, nunca universos diferentes. La cobertura ampliada Argentina representa la cobertura posible utilizando la red MP25M más contribuciones argentinas externas evaluadas. 7D implementará y verificará esta regla; su definición funcional ya no es una decisión diferida.

Si no existe ningún requerimiento con evaluación confirmada vigente, **todavía no existe cobertura calculable**; no se interpreta como 0 %. La completitud debe mostrar la ausencia de análisis.

La **completitud** se calcula separadamente:

> requerimientos activos con evaluación confirmada vigente / requerimientos activos identificados.

Sin requerimientos identificados no se afirmará preparación completa. Deben distinguirse evaluaciones vigentes, históricas y que requieren revisión. Las lecturas por capa deben hacer explícito su universo y qué parte de la evaluación permanece pendiente.

Los obligatorios se presentan además del agregado:

| Situación | Lectura |
|---|---|
| Obligatorio + faltante | Bloqueante confirmado. |
| Obligatorio + parcial | Cobertura crítica incompleta. |
| Obligatorio + no evaluado | Incertidumbre crítica. |

Nunca se reduce toda la oportunidad a un único score opaco. Cobertura, completitud, confianza, riesgos y eventuales valoraciones económicas o estratégicas son dimensiones diferentes. La lectura actual será dinámica y los snapshots históricos se generarán explícitamente.

## 7E — Brechas y acciones

**Pregunta: ¿Qué nos falta y qué hacemos para intentar resolverlo?**

Una brecha se abre explícitamente ante un faltante o insuficiencia relevante. Un requerimiento faltante no genera una brecha automática. La brecha y sus acciones son entidades distintas.

Tipos iniciales conceptuales: **capacidad, escala, disponibilidad, recurso/equipamiento, certificación/habilitación, conocimiento, articulación, financiamiento, logística, plazo y otro**.

Estados: **abierta, en tratamiento, bloqueada, resuelta, cerrada sin resolver y cancelada**. La resolución o cierre requiere responsable y fundamento, conservando la historia.

Ejemplos de acciones:

- Buscar dentro del MP25M, buscar actor argentino externo o buscar actor internacional.
- Contactar actor, solicitar información o solicitar presupuesto.
- Verificar capacidad, disponibilidad o certificación.
- Generar convocatoria, desarrollar capacidad o conseguir equipamiento.
- Buscar financiamiento, coordinar reunión, reanalizar requerimiento u otra acción fundamentada.

La búsqueda internacional es una posible acción; no activa por sí misma una nueva capa de cobertura. El flujo correcto es:

**acción → nueva información → coincidencia/evidencia → nueva evaluación → mejora de cobertura → resolución explícita de brecha**.

Resolver una brecha no modifica automáticamente la cobertura. Tampoco abrir una acción equivale a contactar realmente a un actor o comprometer recursos.

## 7F — Gobernanza transversal

Toda conclusión relevante conserva **responsable, fecha, fundamento, alcance, vigencia, revisión y trazabilidad**.

Se contemplan los roles existentes `administrator`, `validator`, `articulator`, `node_referent`, `participant` y `authority_analyst`, junto con sus ámbitos actuales. Este listado no concede nuevos permisos. El **responsable de oportunidad** es una relación con una oportunidad concreta, no necesariamente un rol global nuevo.

Principios de gobernanza:

- Quien ve no necesariamente confirma.
- Quien formula no necesariamente valida.
- Una sugerencia automática nunca equivale a decisión.
- Las evaluaciones históricas no se sobrescriben.
- Cambios posteriores pueden marcar una conclusión como **requiere revisión**, sin reescribir el pasado.

Los permisos precisos de cada operación y ámbito deberán definirse antes de implementarla. La atribución de decisiones se obtiene del usuario autenticado y se verifica en el servidor, con auditoría. La consulta o aparición de un actor externo no habilita acceso a contactos privados.

## 7G — Preparación para Radar futuro

No se implementa el Radar. Se prevé conservar para una oportunidad: **origen, método de detección, fuente, captura/evidencia histórica, país, mercado objetivo, fecha de publicación, fecha de detección, vencimiento, organización emisora, identificador externo y procedencia de cada requerimiento**.

El Radar futuro producirá primero una **señal o hallazgo externo**, para revisión humana y clasificación. Una señal aceptada como oportunidad podrá materializarse como **oportunidad candidata**, nunca directamente como oportunidad operativa. Los estados conceptuales futuros de la candidata siguen siendo **detectada, pendiente de revisión, aceptada, descartada, duplicada y expirada**. Una candidata aceptada podrá generar una oportunidad MP25M, conservando el vínculo de origen. Luego de la validación, usará el mismo núcleo 7A–7F que la oportunidad manual, sin rutas analíticas alternativas.

La procedencia deberá aprovechar el modelo actual de fuentes e ingesta. 7.0 no crea tablas de candidatas ni procesos de captura, detección, importación o automatización.

### Radar amplio y Radar dirigido

Son dos modalidades futuras, no funciones implementadas:

- **Radar amplio:** parte del mapa general de capacidades y busca señales externas potencialmente relevantes para la red.
- **Radar dirigido:** parte de un perfil definido manualmente con actores, capacidades, combinaciones de capacidades, temas, mercados u objetivos seleccionados.

Ambos producirán señales gobernadas y explicables. No crearán directamente oportunidades operativas, articulaciones, proyectos ni asignaciones operativas.

**Perfil de búsqueda productiva: intención de búsqueda definida manualmente a partir de actores, capacidades, combinaciones de capacidades, temas, mercados u objetivos de interés, utilizada para detectar señales externas potencialmente relevantes para el MP25M.**

### Entradas y criterios de búsqueda

El Radar futuro podrá iniciar búsquedas desde tres entradas combinables:

1. **Capacidades → mercado:** “Tenemos estas capacidades. ¿Qué productos, servicios, proyectos o demandas externas podrían corresponderse con ellas?”.
2. **Actores → oportunidades:** “Queremos buscar oportunidades para estas personas u organizaciones concretas”.
3. **Interés → oportunidades:** “Nos interesa este tema, sector, mercado o problema aunque todavía no sepamos exactamente qué capacidades utilizar”.

Por ejemplo: **actores + capacidades + tema + mercado + objetivo**.

Un perfil podrá expresar actores y capacidades seleccionados, habilidades, actividades, combinaciones de capacidades, temas, sectores, tecnologías, mercados, territorios, países o regiones, modalidad presencial/remota/exportable, objetivo de búsqueda y preferencias económicas **rentada, no rentada o indistinta**. No se congela una taxonomía exhaustiva ni una estructura técnica definitiva.

Ejemplos de objetivos/intereses: trabajo, venta de producto, prestación de servicio, subcontratación, proyecto conjunto, investigación y desarrollo, cooperación, capacitación, financiamiento, fortalecimiento institucional y alianzas.

Una **búsqueda puntual** usa criterios definidos para una consulta concreta. Un **perfil guardado** será un conjunto persistente de criterios reutilizable y, en etapas futuras, monitoreable periódicamente. La persistencia de perfiles, monitoreo automático, alertas recurrentes y búsqueda continua **no forman parte del Incremento 7**.

### Hallazgos, clasificación y oportunidad candidata

**Señal / hallazgo externo: información externa detectada por el Radar que podría resultar relevante para el MP25M y que requiere revisión humana antes de generar cualquier entidad operativa.**

Ejemplos: oportunidad potencial, convocatoria, licitación, demanda de producto, demanda de servicio, proyecto que busca socios, programa de financiamiento, cooperación tecnológica, organización externa relevante, fuente de información, tema o mercado a seguir e iniciativa rentada o no rentada.

El flujo futuro es:

**Perfil de búsqueda / Radar amplio → Radar → señal o hallazgo externo → revisión humana → clasificación**.

La clasificación puede resultar en **oportunidad candidata, actor externo de interés, fuente relevante, tema/mercado a seguir, duplicado o irrelevante**. No crea automáticamente actores ni relaciones. Para el Incremento 7 sólo importa preservar la compatibilidad de la rama de oportunidad: **señal aceptada como oportunidad → oportunidad candidata → revisión/aceptación → oportunidad MP25M → mismo núcleo 7A–7F**. No se crea ahora la entidad técnica de hallazgo.

### Semilla de búsqueda y explicabilidad

**Un actor utilizado como semilla de una búsqueda del Radar no queda asignado, asociado ni comprometido con las oportunidades que esa búsqueda descubra.**

- Actor usado como semilla ≠ coincidencia aceptada.
- Actor usado como semilla ≠ actor asignado.
- Actor usado como semilla ≠ participante de articulación.
- Actor usado como semilla ≠ participante de proyecto.

Si se detecta una oportunidad, esos actores deberán pasar por el análisis normal de coincidencias 7B.

Cada hallazgo deberá responder **“¿Por qué apareció esta señal?”**, conservando perfil o búsqueda de origen, criterios utilizados, actores y capacidades semilla, temas/mercados seleccionados, señales que justificaron la relevancia, fecha de búsqueda/detección y fuente externa.

Ejemplo: una convocatoria para soluciones IoT agrícolas aparece porque el perfil buscaba IoT, electrónica, software, Mercosur y proyectos rentados o de cooperación. Organización A y Persona B fueron semillas de esa búsqueda; esto no significa que estén asignadas a la oportunidad.

### Trayectoria como origen de perfiles futuros

Los perfiles podrán partir de habilidades/capacidades declaradas y también de trayectoria productiva comprobada, combinaciones de actores que ya trabajaron juntos, contribuciones realizadas y resultados anteriores. Por ejemplo, ante una combinación que ejecutó exitosamente proyectos de electrónica + software + IoT, el Radar podría buscar: “¿Dónde existe demanda para una combinación productiva similar?”.

Se mantiene **experiencia pasada ≠ disponibilidad actual** y **trayectoria ≠ asignación automática**. Una combinación histórica no demuestra que los actores puedan o quieran trabajar juntos nuevamente. 7G sólo preserva compatibilidad y procedencia; no implementa estas búsquedas ni modifica el orden de 7A–7F, y no se agrega un 7H.

## Trayectoria productiva y aprendizaje

**Trayectoria productiva: historial verificable de participación de una persona u organización en oportunidades, articulaciones y proyectos, incluyendo su rol, contribución, resultados y evidencia.**

Figurar como actor de origen, contacto o actor relacionado con una oportunidad no constituye por sí mismo trayectoria productiva comprobada. La trayectoria utilizable como fundamento futuro de coincidencia o evidencia de cobertura debe basarse en participación/contribución verificable, registrando según corresponda rol, contribución, contexto, resultado, evidencia y validación.

**Experiencia pasada ≠ disponibilidad actual ≠ asignación automática.** Esta precisión no crea tablas de articulaciones, proyectos, participaciones o contribuciones.

La experiencia histórica comprobable de una persona u organización en oportunidades, articulaciones y proyectos constituye evidencia relevante para descubrir coincidencias y evaluar cobertura, pero no implica disponibilidad actual ni participación automática en una nueva oportunidad.

El resultado de cada articulación o proyecto debe retroalimentar el mapa de capacidades y el futuro Radar, preservando quién hizo qué, en qué contexto, con qué evidencia y con qué resultado.

**Habilidades/capacidades declaradas + trayectoria comprobada + resultados → conocimiento real de capacidad → nuevas oportunidades → nuevos proyectos → nueva experiencia → aprendizaje.**

Esta retroalimentación conserva la distinción entre evidencia y decisión: no confirma automáticamente una capacidad ni actualiza una evaluación vigente sin revisión. Las futuras participaciones y contribuciones serán puntos de extensión, no entidades implementadas por 7.0.

## Criterios generales de aceptación

Para los subincrementos futuros:

- Cada requerimiento es atómico, trazable y versionado; un cambio semántico exige nueva validación.
- Cada coincidencia se explica por fundamentos y refiere a una revisión concreta, sin duplicar al actor por cada fundamento.
- La consulta de candidatos no genera asignaciones ni persistencia masiva automática.
- Cada evaluación conserva verificaciones, evidencia, confianza, alcance y vigencia; Cubierto con confianza baja no es válido.
- La combinación de actores se justifica; se distinguen cobertura de red y ampliada, completitud y alertas de obligatorios.
- Brechas y acciones se deciden explícitamente; sus cambios no reemplazan una nueva evaluación.
- La historia puede reconstruirse y una conclusión desactualizada se señala sin alterarla.
- Oportunidades manuales y futuras candidatas aceptadas convergen en el mismo análisis, conservando procedencia.
- Los diez invariantes se verifican junto con permisos, auditoría y pruebas de punta a punta.

Para **7.0**, la aceptación se limita a documentación autocontenida, etiquetas Oportunidades coherentes, módulos activos correctamente enlazados y Articulaciones/Proyectos planificados sin nuevas rutas. El panel anuncia las funciones analíticas en futuro, no como disponibles.

## Exclusiones explícitas

Quedan fuera del Incremento 7 la búsqueda web automática, scraping, APIs externas, persistencia de perfiles de búsqueda, monitoreo periódico, alertas automáticas, búsqueda continua, inteligencia artificial, ranking semántico, generación automática de requerimientos, creación automática de actores, oportunidades, articulaciones o proyectos, y contacto automático con actores externos. Radar amplio y Radar dirigido son visión futura.

7.0 no implementa 7A ni otro subincremento funcional: no crea migraciones, tablas, RPCs, APIs, rutas, permisos ni datos. No renombra identificadores técnicos existentes ni altera lógica de negocio. No crea entidades de articulación/proyecto ni `project_participations` o `articulation_participations`.

Quedan para etapas posteriores los módulos ampliados de necesidades/ofertas/recursos/equipamiento, articulaciones, proyectos, resultados/economía, agenda/convocatorias, informes/indicadores, Radar externo automatizado, automatización/IA e integración limitada con ClubSmart. Se conserva su valor funcional sin exigirlos para iniciar el análisis de oportunidades.
