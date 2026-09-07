# MP25M - Documento Funcional V1

> Alineación 7.0: este documento conserva la visión general y decisiones funcionales de largo plazo. No todo lo descrito está implementado. La secuencia histórica de incrementos evolucionó; la sección 22 refleja el estado real hasta el Incremento 6 y la nueva etapa 7. El detalle acordado está en la [especificación funcional del Incremento 7](MP25M-ESPECIFICACION-FUNCIONAL-INCREMENTO-7.md) y su [diseño técnico previsto](MP25M-DISENO-TECNICO-INCREMENTO-7.md). 7.0 sólo alinea documentación, etiquetas visibles y estado del panel.

## 1. Vision del sistema

El Sistema MP25M se define como un sistema operativo de articulacion productiva para el Movimiento Productivo 25 de Mayo. No debe entenderse solamente como un padron de personas, un mapa de habilidades o una base de datos interna, sino como una herramienta para comprender, conectar, activar y medir capacidades productivas distribuidas en el territorio.

El sistema debe permitir que el MP25M pase de tener informacion dispersa a contar con una red organizada de personas, nodos, organizaciones, habilidades, recursos, necesidades, ofertas, oportunidades, articulaciones y proyectos. Su valor principal sera ayudar a transformar informacion declarada en acciones productivas verificables, con trazabilidad, consentimiento, privacidad y control de calidad.

El ciclo funcional del sistema sera:

```text
detectar -> analizar -> relacionar -> articular -> acordar -> ejecutar -> medir -> aprender
```

Cada ciclo debe dejar registro de que se detecto, quien lo registro, con que evidencia, que decisiones se tomaron, quienes participaron, que resultado tuvo y que aprendizaje queda disponible para proximas acciones.

La pregunta rectora es: **¿Qué podemos producir, con quiénes, con qué ventajas, para qué mercados y qué nos falta para poder hacerlo?**

## 2. Objetivos

Los objetivos funcionales del sistema son:

- Conocer que esta sucediendo dentro del movimiento.
- Visualizar como crecen, se consolidan y se relacionan los nodos.
- Detectar capacidades, recursos, ofertas y necesidades existentes.
- Generar trabajo, proyectos, negocios y articulaciones gratuitas.
- Obtener recursos transparentes para el movimiento.
- Medir impacto economico, productivo, territorial y organizativo.
- Mejorar la calidad de la informacion mediante revision, validacion e historial.
- Facilitar la coordinacion entre integrantes, referentes, organizaciones y autoridades.
- Identificar oportunidades pagas y no pagas en Argentina y en el exterior.
- Convertir aprendizajes de cada experiencia en criterios para futuras decisiones.

## 3. Estrategia de desarrollo del MVP

La primera version funcional no debe esperar a que esten completos todos los modulos del sistema. El desarrollo inicial debe construir una vertical pequena pero completa, que permita probar valor operativo real de punta a punta.

La vertical prioritaria del MVP sera:

```text
oportunidad manual -> requerimientos -> comparacion con capacidades existentes -> cobertura y brechas -> responsable -> articulacion -> seguimiento -> resultado
```

La planificación original situaba el Radar de Oportunidades Productivas desde el inicio del MVP mediante carga manual y validación humana. La evolución real implementó primero el registro manual de oportunidades y las capacidades de la red. El Incremento 7 construirá su núcleo de análisis; el Radar externo se mantiene como extensión futura, sin implementarse en 7.0. Recursos productivos, necesidades y ofertas se incorporarán incrementalmente alrededor de esta vertical.

No forman parte del MVP inicial:

- Busqueda automatica en Internet.
- Inteligencia artificial.
- Importacion automatica desde fuentes externas.
- Pagos o facturacion electronica.
- Integracion tecnica directa con ClubSmart.

Estas funciones deben quedar previstas para etapas posteriores, sin condicionar la primera version operativa.

## 4. Roles funcionales y permisos

El sistema debe separar dos conceptos que no deben mezclarse: roles territoriales dentro del MP25M y roles de acceso al sistema.

### Roles territoriales

Los roles territoriales describen la participacion de una persona en un nodo. Los roles iniciales son:

- Fundador.
- Referente.
- Participante.
- Contacto con fuerzas productivas.

Estos roles pueden requerir validacion y pueden variar por nodo. Una misma persona puede tener distintos roles territoriales en distintos nodos.

### Roles de acceso al sistema

El backoffice interno requerira autenticacion. El formulario de actualizacion mediante enlace personal continuara siendo un circuito separado, basado en token personal, sin convertirlo automaticamente en usuario autenticado del backoffice.

| Rol de acceso | Alcance funcional |
|---|---|
| Administrador | Configuracion general, usuarios, permisos, catalogos y acceso operativo completo. Debe operar con auditoria estricta. |
| Validador | Revision y validacion dentro de su alcance territorial, tematico o funcional. Puede aprobar, rechazar o pedir correcciones. |
| Articulador | Gestion de oportunidades y articulaciones asignadas. Puede cargar requerimientos, analizar cobertura, convocar, registrar seguimiento y resultados. |
| Referente de nodo | Acceso a informacion operativa correspondiente a su nodo, sus integrantes, capacidades, oportunidades vinculadas y acciones pendientes. |
| Participante | Perfil propio y funciones internas habilitadas, como responder convocatorias o declarar capacidades, segun permisos y consentimiento. |
| Autoridad/Analista | Indicadores e informacion agregada para seguimiento institucional. No tiene acceso automatico a contactos privados. |

Los permisos deben combinar rol de acceso, territorio, nodo, responsabilidad asignada, participacion en articulaciones o proyectos y visibilidad del dato.

## 5. Visibilidad, privacidad y contactos

El sistema debe manejar cuatro niveles de visibilidad:

| Nivel | Descripcion |
|---|---|
| Publica | Informacion que el MP25M decide difundir fuera del sistema. |
| Interna MP25M | Informacion visible para usuarios autenticados habilitados dentro del movimiento. |
| Restringida por nodo, articulacion o proyecto | Informacion disponible solo para personas con responsabilidad o participacion directa en ese ambito. |
| Confidencial | Informacion sensible o privada, accesible solo por autorizacion especifica y necesidad funcional. |

Los contactos personales seran privados por defecto. Su consulta debe estar justificada por una funcion operativa, por ejemplo coordinar una oportunidad, validar una participacion o realizar seguimiento de un proyecto. Cuando corresponda, la consulta de contactos debe quedar registrada con usuario, fecha, motivo y entidad relacionada.

El consentimiento de cada persona debe definir que usos permite: tratamiento de datos, comunicaciones, visibilidad interna, perfil publico u otros usos que el MP25M apruebe. La revocacion de visibilidad debe aplicarse de manera inmediata en las vistas operativas.

## 6. Validacion de informacion

Los datos declarados no deben considerarse automaticamente validados. Toda entidad relevante debe registrar fuente, responsable, estado, fechas, visibilidad, validacion e historial.

Los estados de validacion seran:

| Estado | Significado |
|---|---|
| Declarado | Informacion cargada por una persona o usuario autorizado, aun sin revision. |
| Pendiente de validacion | Informacion en cola de revision o con revision solicitada. |
| Validado | Informacion aceptada por un responsable autorizado segun criterio definido. |
| Rechazado | Informacion no aceptada, con motivo registrado. |

Toda validacion debe registrar responsable, fecha, observacion y, cuando corresponda, evidencia.

Criterios minimos:

- La pertenencia y el rol en un nodo deben ser confirmados por un referente autorizado o administrador.
- Las habilidades pueden comenzar como declaradas y validarse posteriormente con experiencia, referencia o evidencia.
- Las organizaciones requieren fuente y responsable de validacion.
- Una oportunidad debe tener como minimo fuente, descripcion, responsable, visibilidad, fecha y estado de validacion para activarse.

## 7. Responsabilidad operativa

Cada oportunidad, articulacion y proyecto tendra:

- Un responsable principal.
- Colaboradores opcionales.
- Proxima accion.
- Fecha de seguimiento.
- Historial de asignaciones.

El historial de asignaciones debe registrar quien asigno, a quien, cuando, motivo y estado resultante. Una oportunidad sin responsable o sin proxima accion no debe considerarse operativamente activa.

## 8. Entidades principales

Toda entidad relevante debe contemplar, como minimo, fuente, responsable, estado, fechas, visibilidad, nivel de validacion e historial de cambios.

### Persona

Representa a un integrante, contacto o potencial participante. Incluye identidad basica, datos de contacto, ubicacion, nodos, roles territoriales, habilidades, vectores, consentimientos, disponibilidad, historial de participacion y estado del perfil.

### Organizacion

Representa empresas, cooperativas, clubes, instituciones, organismos, universidades, asociaciones u otras entidades relacionadas con el MP25M. Puede actuar como aliada, cliente, proveedora, fuente de oportunidad, participante de proyecto o beneficiaria.

### Nodo

Representa una unidad territorial, tematica, productiva u organizativa. Debe permitir conocer integrantes, referentes, capacidades, necesidades, ofertas, articulaciones, proyectos, crecimiento y relacion con otros nodos.

### Rol territorial

Define el tipo de participacion de una persona dentro de un nodo. El rol puede requerir validacion, vigencia temporal e historial.

### Habilidad

Describe conocimientos, oficios, profesiones, capacidades tecnicas o experiencia declarada por personas. Debe registrar nivel, experiencia, evidencia cuando exista, estado de validacion y relacion con oportunidades.

### Vector productivo

Agrupa areas productivas o estrategicas del MP25M. Permite clasificar personas, nodos, habilidades, oportunidades, proyectos, necesidades y ofertas.

### Capacidad productiva

Describe la posibilidad concreta de producir, prestar un servicio, ejecutar una tarea o resolver una necesidad. Puede pertenecer a una persona, organizacion, nodo o combinacion de actores. Debe incluir alcance, disponibilidad, escala, ubicacion, certificaciones, restricciones y validacion.

### Recurso o equipamiento

Registra herramientas, maquinas, espacios, infraestructura, vehiculos, software, permisos, conectividad u otros recursos utiles para ejecutar oportunidades o proyectos.

### Oferta

Representa algo que una persona, nodo u organizacion puede poner a disposicion: producto, servicio, conocimiento, equipamiento, espacio, contacto, capacitacion o colaboracion.

### Necesidad

Representa una demanda interna o externa: trabajo requerido, insumo, capacitacion, financiamiento, contacto, tecnologia, equipamiento, logistica o apoyo institucional.

### Oportunidad

Representa una posibilidad de accion productiva, comercial, laboral, institucional, formativa, solidaria o estrategica. Puede ser paga, gratuita, de intercambio o a definir. Debe tener responsable, fuente, estado, proxima accion y seguimiento.

### Requerimiento de oportunidad

Condición atómica, trazable y evaluable que debe o conviene satisfacerse para responder, presentar, ejecutar o concretar una oportunidad. Puede referirse a capacidad, recurso, ubicación, certificación, idioma, escala, disponibilidad, plazo, documentación, contacto, financiamiento o condición administrativa. El nuevo modelo usa siempre Requerimiento; conserva identidad estable y revisiones inmutables, con nueva validación ante cambios semánticos.

### Coincidencia

Es una hipótesis analítica de contribución a un requerimiento. En el Incremento 7 se consideran personas, organizaciones y candidatos provisionales pertinentes, con uno o varios fundamentos. No asigna al actor ni confirma disponibilidad o cobertura. Nodos y recursos pueden aportar contexto; futuras extensiones no se implementan en 7.0.

### Brecha

Registra un faltante o insuficiencia relevante sobre el cual se decide actuar. Se abre explícitamente: un requerimiento faltante no genera una brecha automática. Puede motivar convocatorias, búsquedas internas o externas, seguimiento y reanálisis. Resolverla no cambia automáticamente la cobertura.

### Articulacion

Representa el proceso de conectar personas, nodos, organizaciones, recursos y oportunidades para lograr un resultado. Puede ser economica, territorial, institucional, comunicacional o estrategica.

### Proyecto

Representa una oportunidad acordada y en ejecucion. Incluye objetivos, alcance, responsables, participantes, cronograma, presupuesto, entregables, riesgos, ingresos, contribuciones y resultados.

**Oportunidad ≠ Articulación ≠ Proyecto.** La ruta actual `/panel/oportunidades` corresponde a oportunidades. La articulación es el proceso operativo posterior al análisis; el proyecto corresponde al acuerdo que entra en ejecución. Ningún análisis crea esas relaciones automáticamente.

### Actividad canónica

Describe lo que realiza una organización en el catálogo de actividades. No equivale a una habilidad/capacidad ni debe confundirse con oportunidad, proyecto o actividad de seguimiento.

### Evaluación de cobertura

Conclusión explicable sobre cuánto puede satisfacerse un requerimiento, con verificaciones, evidencia, confianza, responsable, alcance y vigencia. Cubierto con confianza baja no es una conclusión admisible. Las capacidades de varios actores no son automáticamente sumables: la combinación se evalúa. Cobertura analítica no implica compromiso operativo.

### Trayectoria productiva

Historial verificable de participación de una persona u organización en oportunidades, articulaciones y proyectos, incluyendo su rol, contribución, resultados y evidencia. La experiencia comprobable aporta fundamentos para coincidencias y cobertura, pero no demuestra disponibilidad actual ni asigna participación automática. Los resultados deben retroalimentar el mapa de capacidades y el futuro Radar conservando quién hizo qué, en qué contexto, con qué evidencia y resultado.

### Actividad o evento

Representa reuniones, presentaciones, capacitaciones, visitas, demostraciones, convocatorias o encuentros. Debe poder vincularse con oportunidades, articulaciones y proyectos.

### Resultado

Registra efectos concretos: trabajo generado, ingresos, propuestas presentadas, alianzas, aprendizajes, nuevos contactos, nodos fortalecidos, capacidades incorporadas o impacto territorial.

### Contribucion economica

Registra aportes, ingresos, honorarios, costos, gastos, distribucion acordada, facturacion manual o referencia administrativa, cobro manual y recursos destinados al MP25M. No implica pagos automaticos ni facturacion electronica en el MVP.

### Evidencia y validacion

Registra documentos, enlaces, referencias, comprobantes, reuniones, verificaciones, aprobaciones, rechazos y observaciones que sustentan o cuestionan un dato.

## 9. Modelo funcional minimo del MVP

Estado alineado con el cierre del Incremento 6. Las entidades marcadas como nuevas siguen siendo diseño futuro; los subincrementos 7A–7G no se implementan en 7.0.

| Entidad | Estado para el MVP | Observacion |
|---|---|---|
| Personas | Existente y ampliable | Ya existen perfiles, contactos, nodos, habilidades, vectores y consentimientos. |
| Organizaciones | Implementado y ampliable | Directorio, alta canónica, validación y relaciones territoriales; capacidades y actividades incorporadas hasta el Incremento 6. |
| Nodos | Existente y ampliable | Se usan para alcance territorial, referentes y busqueda de capacidades. |
| Capacidades | Implementado y ampliable | Habilidades personales, capacidades organizacionales, mapa por nodo y gobernanza de catálogos. Capacidad registrada no demuestra disponibilidad. |
| Recursos productivos | Nuevo | Se agregan incrementalmente cuando un requerimiento lo demande. |
| Necesidades y ofertas | Nuevo | Se amplian luego de la vertical de oportunidad manual. |
| Oportunidades | Implementado y ampliable | Registro manual, actores de origen, responsable y seguimiento; el análisis de requerimientos queda para el Incremento 7. |
| Requerimientos de oportunidades | Nuevo | Base del analisis explicable. |
| Coincidencias | Nuevo | Relacionan requerimientos con capacidades existentes. |
| Brechas | Nuevo | Identifican faltantes y acciones para resolverlos. |
| Articulaciones | Nuevo | Gestionan la conexion operativa posterior al analisis. |
| Proyectos | Nuevo | Nacen cuando una oportunidad se acuerda y requiere ejecucion. |
| Actividades de seguimiento | Nuevo | Registran reuniones, tareas, llamadas, vencimientos y proximas acciones. |
| Resultados | Nuevo | Registran cierre economico, territorial, estrategico u organizativo. |

## 10. Modulos funcionales

### Panel o pulso productivo

Debe mostrar una vision rapida del estado del movimiento: personas activas, nodos, organizaciones, capacidades, oportunidades, proyectos, alertas, necesidades sin respuesta, acciones pendientes e indicadores principales.

### Red de personas, organizaciones y nodos

Debe permitir consultar relaciones entre integrantes, organizaciones, nodos, roles, referentes y contactos. Debe facilitar busqueda por territorio, vector, habilidad, estado y nivel de validacion.

### Mapa de capacidades y recursos

Debe organizar habilidades, capacidades productivas, recursos y equipamiento disponibles. Debe distinguir informacion declarada, pendiente, validada y rechazada.

### Necesidades y ofertas

Debe registrar demandas y disponibilidades internas o externas, cruzarlas entre si y vincularlas con personas, nodos, organizaciones y oportunidades. En el MVP se incorporan alrededor de la vertical de oportunidades, no como condicion previa.

### Oportunidades

Debe centralizar oportunidades productivas, comerciales, laborales, institucionales, de financiamiento, capacitacion, cooperacion, voluntariado o difusion. Es el corazon operativo junto con el Observatorio y Radar.

### Articulaciones

Debe registrar vinculos generados, reuniones, responsables, acciones, resultados, contactos derivados y valor estrategico, aunque no exista un ingreso economico directo.

### Proyectos

Debe gestionar oportunidades acordadas, ejecucion, responsables, equipos, entregables, presupuesto, ingresos, costos, evidencias y cierre.

### Agenda

Debe organizar reuniones, vencimientos, visitas, capacitaciones, demostraciones, acciones de seguimiento y fechas limite de oportunidades.

### Comunicaciones y convocatorias

Debe permitir convocar personas o nodos segun criterios funcionales: territorio, capacidad, vector, disponibilidad, rol, interes o historial. Debe registrar a quien se convoco, por que medio y con que respuesta.

### Informes e impacto

Debe producir reportes para responsables, autoridades y nodos. Debe medir impacto economico, productivo, territorial, organizativo, social y comunicacional.

### Administracion, revision y auditoria

Debe administrar catalogos, estados, permisos, validaciones, fuentes, trazabilidad, cambios, seguridad y calidad de datos.

## 11. Observatorio y Radar de Oportunidades Productivas

El Observatorio y Radar conserva su papel central en la visión del MVP. Hoy existe el registro manual de oportunidades; el Incremento 7 se concentra en su análisis. La detección externa automatizada será futura y producirá primero señales o hallazgos externos para revisión humana y clasificación. Una señal aceptada como oportunidad podrá materializarse como oportunidad candidata y, luego de revisión/aceptación, como oportunidad MP25M, conservando su origen y recorriendo el mismo núcleo 7A–7F que una oportunidad manual. 7.0 no implementa el Radar.

### Radar amplio y Radar dirigido: visión futura

El **Radar amplio** parte del mapa general de capacidades y busca señales externas potencialmente relevantes para la red. El **Radar dirigido** parte de un perfil definido manualmente con actores, capacidades, combinaciones de capacidades, temas, mercados u objetivos seleccionados. Ambos producirán señales gobernadas y explicables, nunca oportunidades operativas, articulaciones, proyectos o asignaciones directamente.

**Perfil de búsqueda productiva: intención de búsqueda definida manualmente a partir de actores, capacidades, combinaciones de capacidades, temas, mercados u objetivos de interés, utilizada para detectar señales externas potencialmente relevantes para el MP25M.**

Tres entradas combinables: **capacidades → mercado**, **actores → oportunidades** e **interés → oportunidades**. El perfil podrá expresar habilidades, actividades, sectores, tecnologías, territorios, países/regiones, modalidad presencial/remota/exportable y preferencias económicas **rentada, no rentada o indistinta**, sin fijar una taxonomía exhaustiva. La búsqueda podrá ser puntual; un perfil guardado reutilizable, su persistencia y monitoreo automático quedan fuera del Incremento 7.

**Señal / hallazgo externo:** información externa detectada por el Radar que podría resultar relevante para el MP25M y que requiere revisión humana antes de generar cualquier entidad operativa. Su clasificación podrá resultar en oportunidad candidata, actor externo de interés, fuente relevante, tema/mercado a seguir, duplicado o irrelevante. No todo hallazgo es una oportunidad.

El circuito previsto es **perfil de búsqueda / Radar amplio → Radar → señal o hallazgo externo → revisión humana → clasificación**. Sólo la rama aceptada como oportunidad continúa por **oportunidad candidata → revisión/aceptación → oportunidad MP25M → mismo núcleo 7A–7F**.

Un actor utilizado como semilla de una búsqueda del Radar no queda asignado, asociado ni comprometido con las oportunidades que esa búsqueda descubra. Actor semilla no equivale a coincidencia aceptada, actor asignado ni participante de articulación o proyecto; deberá pasar por el análisis normal 7B.

Cada hallazgo deberá explicar por qué apareció, conservando búsqueda/perfil, criterios, actores y capacidades semilla, temas/mercados, señales de relevancia, fecha y fuente externa. La trayectoria productiva comprobada, combinaciones de actores que trabajaron juntos, contribuciones y resultados podrán orientar perfiles futuros, sin inferir disponibilidad actual ni asignación automática.

7G sólo preserva compatibilidad y procedencia. No se implementan ahora búsquedas web automáticas, scraping, APIs externas, persistencia de perfiles, monitoreo periódico, alertas recurrentes, búsqueda continua, IA, ranking semántico, generación automática de requerimientos, creación automática de actores/oportunidades/articulaciones/proyectos ni contacto automático con actores externos. El detalle funcional y los puntos de extensión técnicos se documentan en los documentos del Incremento 7; el roadmap no cambia.

Debe permitir registrar oportunidades provenientes de:

- Integrantes y referentes.
- Organizaciones y empresas.
- Convocatorias publicas o privadas.
- Licitaciones.
- Compras y demandas productivas.
- Programas de financiamiento.
- Cooperacion institucional.
- Mercados externos.
- Recomendaciones y contactos.
- Fuentes digitales configurables en etapas posteriores.

Cada oportunidad debe registrar:

- Titulo y descripcion.
- Fuente y enlace cuando exista.
- Pais y territorio.
- Sector y vector productivo.
- Tipo: negocio, contratacion, empleo, proyecto, financiamiento, capacitacion, cooperacion, voluntariado o difusion.
- Modalidad: paga, gratuita, intercambio o a definir.
- Moneda y valor estimado cuando corresponda.
- Fecha de deteccion y vencimiento.
- Requerimientos tecnicos, productivos, comerciales y administrativos.
- Volumen, plazo y ubicacion.
- Trabajo presencial, remoto o exportable.
- Contactos institucionales y responsables.
- Estado de oportunidad, proxima accion y fecha de seguimiento.
- Estado de validacion y nivel de confianza de la informacion.
- Riesgos y restricciones.

Una oportunidad debe tener como minimo fuente, descripcion, responsable, visibilidad, fecha y estado de validacion para activarse.

## 12. Analisis explicable de cobertura y brechas

El sistema no debe usar un unico puntaje general para decidir si una oportunidad conviene o es posible. El analisis debe separar dimensiones distintas:

- Cobertura productiva.
- Completitud del analisis.
- Atractivo economico.
- Valor estrategico y de difusion.
- Riesgo.
- Confianza de la informacion.

Para cobertura, cada requerimiento debe indicar:

| Campo del requerimiento | Descripcion |
|---|---|
| Obligatorio u opcional | Define si el requerimiento bloquea la oportunidad o solo mejora la propuesta. |
| Peso explicito | Importancia relativa dentro de la cobertura productiva. |
| Estado | Cubierto, Parcialmente cubierto, Faltante o No evaluado. |
| Capacidad o recurso relacionado | Habilidad, capacidad, recurso, certificacion, contacto o condicion vinculada. |
| Actor compatible | Persona, organizacion o nodo que podria cubrirlo. |
| Evidencia | Dato, referencia, documento, experiencia o validacion que justifica la coincidencia. |
| Observaciones | Aclaraciones, restricciones o dudas del analisis. |

Los requerimientos no evaluados deben afectar la completitud del analisis y no ocultarse. Todo requerimiento obligatorio faltante debe destacarse independientemente del porcentaje de cobertura.

Obligatorio + faltante representa un bloqueante confirmado; obligatorio + parcial, cobertura crítica incompleta; obligatorio + no evaluado, incertidumbre crítica. Se conservan evaluaciones históricas y se señalan conclusiones que requieren revisión sin reescribir el pasado.

La fórmula de cobertura productiva es una decisión funcional acordada y debe ser visible:

```text
cobertura productiva = Σ(peso × valor de cobertura) / Σ(pesos de los requerimientos activos con evaluación confirmada vigente)
Cubierto = 1; Parcialmente cubierto = 0,5; Faltante = 0
```

Los requerimientos no evaluados no forman parte del denominador de cobertura; su ausencia se refleja mediante completitud. Las capas `network_mp25m` y `expanded_argentina` usan el mismo universo de requerimientos evaluados y el mismo denominador para que sus porcentajes sean comparables. La cobertura ampliada Argentina representa la cobertura posible utilizando la red MP25M más contribuciones argentinas externas evaluadas; encontrar un actor no implica compromiso. 7D implementará y verificará esta regla, cuya definición funcional ya está acordada. La completitud se calcula separadamente como:

```text
completitud = requerimientos activos con evaluación confirmada vigente / requerimientos activos identificados
```

Si no existe ningún requerimiento con evaluación confirmada vigente, todavía no existe cobertura calculable: no se interpreta como 0 %. La completitud debe mostrar la ausencia de análisis; si tampoco hay requerimientos identificados, se explicita la ausencia de universo sin afirmar completitud plena.

El resultado debe mostrar:

- Requerimientos cubiertos.
- Requerimientos parcialmente cubiertos.
- Requerimientos faltantes.
- Requerimientos no evaluados.
- Personas, organizaciones o nodos compatibles.
- Posibilidad de buscar capacidades faltantes.
- Justificacion del resultado.
- Responsable del analisis y fecha de revision.

## 13. Busqueda de capacidades faltantes

Una brecha debe poder generar acciones concretas:

- Convocatoria dentro del MP25M.
- Busqueda en otros nodos.
- Busqueda de organizacion aliada.
- Incorporacion de proveedor o especialista externo.
- Actividad de seguimiento.
- Reanalisis de cobertura.

Cada accion generada desde una brecha debe mantener vinculo con el requerimiento original para que el analisis pueda recalcularse cuando se incorpore nueva informacion.

## 14. Estados funcionales

Compatible y Requiere completar capacidades son resultados del analisis, no estados de la oportunidad.

### Estados de oportunidad

| Estado | Uso funcional |
|---|---|
| Borrador | Registro inicial incompleto o no listo para revision. |
| Pendiente de validacion | Requiere revision de fuente, datos minimos y visibilidad. |
| Rechazada | No supera validacion o no corresponde al MP25M. |
| Activa | Validada y disponible para analisis o gestion. |
| En analisis | Se estan cargando requerimientos, cobertura, brechas y evaluacion. |
| En articulacion | Hay gestion activa con personas, nodos u organizaciones. |
| Propuesta presentada | Se presento una propuesta o respuesta formal. |
| Acordada | La oportunidad fue aceptada y puede derivar en proyecto. |
| No acordada | Se presento o negocio, pero no se concreto. |
| Pausada | Queda detenida temporalmente por decision o bloqueo. |
| Vencida | Paso la fecha limite sin avance posible. |
| Cancelada | Se cancela por decision interna o externa. |

### Estados de articulacion

| Estado | Uso funcional |
|---|---|
| Borrador | Articulacion registrada, aun sin activacion. |
| Activa | Articulacion iniciada y con responsable. |
| En seguimiento | Requiere acciones posteriores, reuniones o respuestas. |
| Pausada | Detenida temporalmente. |
| Convertida en proyecto | Derivo en proyecto ejecutable. |
| Cerrada con resultado | Finalizo con resultado economico, territorial, estrategico u organizativo. |
| Cerrada sin resultado | Finalizo sin resultado concreto, pero con aprendizaje o trazabilidad. |
| Cancelada | Se cancela sin continuar seguimiento. |

### Estados de proyecto

| Estado | Uso funcional |
|---|---|
| Planificado | Proyecto acordado, con alcance y responsables definidos. |
| En ejecucion | Trabajo en curso. |
| Pausado | Detenido temporalmente. |
| Finalizado | Cerrado con entregables y resultado registrado. |
| Cancelado | Interrumpido antes del cierre previsto. |

## 15. Analisis economico en el MVP

Aunque pagos y facturacion electronica quedan fuera del MVP, el sistema debe registrar manualmente informacion economica para evaluar y aprender.

Cada oportunidad, articulacion o proyecto que corresponda debe registrar:

- Moneda.
- Valor estimado.
- Costos estimados.
- Margen estimado.
- Probabilidad de concrecion.
- Ingreso potencial para participantes.
- Aporte potencial al MP25M.
- Distribucion acordada, cuando exista.
- Valor finalmente acordado.
- Estado manual de cobro.
- Resultado economico final.

No se fijan porcentajes unicos de distribucion. Las condiciones economicas deben poder acordarse por oportunidad o proyecto, quedar documentadas y ser visibles para las partes autorizadas.

## 16. Articulaciones como instrumento de difusion

Una articulacion puede tener resultados economicos, estrategicos, territoriales, institucionales o comunicacionales. No debe medirse solamente por facturacion.

Cada articulacion debe registrar:

- Objetivo de la articulacion.
- Personas y organizaciones involucradas.
- Publico alcanzado.
- Presentaciones y reuniones.
- Material compartido.
- Nuevos contactos.
- Organizaciones alcanzadas.
- Posibles miembros o aliados.
- Nuevos territorios o mercados.
- Oportunidades derivadas.
- Valor estrategico y justificacion.
- Seguimiento posterior.
- Resultado economico.
- Resultado territorial y organizativo.

El sistema debe permitir que una articulacion derive en oportunidad, proyecto, nuevo nodo, nueva organizacion aliada, actividad, convocatoria o aprendizaje documentado.

## 17. Unidad de Tecnologia Productiva

Se propone contemplar una posible Unidad de Tecnologia Productiva, coordinada inicialmente por Jorge, orientada a:

- Desarrollo de sistemas.
- Ingenieria en computacion.
- Electronica e IoT.
- Automatizacion.
- Integracion de datos.
- Tableros de gestion.
- Consultoria.
- Direccion tecnica.
- Capacitacion.
- Implementacion y soporte de ClubSmart.

Esta unidad puede funcionar como caso inicial de articulacion profesional, generacion de trabajo, oferta tecnologica y soporte a proyectos productivos.

## 18. ClubSmart como caso futuro articulado

ClubSmart se considera un posible producto o caso comercial articulado por la red MP25M, pero no tendra integracion tecnica directa en el MVP.

El circuito funcional futuro propuesto es:

```text
detectar club -> relevar necesidad -> generar oportunidad -> demostrar ClubSmart -> presentar propuesta -> implementar -> capacitar -> brindar soporte -> medir resultado
```

Limite funcional entre MP25M y ClubSmart:

- MP25M puede registrar club detectado, necesidad, contacto institucional autorizado, demostracion, propuesta, implementacion, capacitacion, soporte y resultado comercial.
- MP25M no debe copiar socios, credenciales, cuentas bancarias, pagos de socios ni informacion financiera interna de los clubes.
- Los pagos de socios se acreditan directamente en la cuenta de cada club.
- Los servicios de suscripcion, implementacion o soporte de ClubSmart son operaciones separadas y deben registrarse como tales cuando correspondan.

## 19. Proteccion, correccion y eliminacion

El MVP debe contemplar:

- Revocacion inmediata de visibilidad.
- Baja logica.
- Correccion documentada.
- Preservacion minima del historial de auditoria.
- Invalidacion de enlaces personales cuando corresponda.

La baja logica debe impedir el uso operativo de un registro sin borrar automaticamente la trazabilidad necesaria. La correccion documentada debe permitir conocer que cambio, quien lo cambio, cuando y por que.

Los plazos legales definitivos de conservacion y eliminacion requieren una politica institucional y revision juridica posterior.

## 20. Indicadores

Los indicadores minimos son:

- Personas, nodos y organizaciones activas.
- Capacidades verificadas.
- Necesidades y ofertas vigentes.
- Oportunidades detectadas.
- Oportunidades activas.
- Porcentaje de oportunidades con analisis iniciado.
- Completitud promedio del analisis.
- Requerimientos cubiertos, parcialmente cubiertos, faltantes y no evaluados.
- Coincidencias encontradas.
- Brechas abiertas y brechas resueltas.
- Articulaciones iniciadas.
- Propuestas presentadas.
- Proyectos acordados y finalizados.
- Ingresos estimados y finales para participantes.
- Recursos potenciales y finales para el MP25M.
- Horas de colaboracion gratuita.
- Nuevos contactos, aliados, territorios y nodos.
- Tiempo desde deteccion hasta primera accion.
- Oportunidades sin seguimiento.

Los indicadores deben poder filtrarse por periodo, territorio, nodo, vector productivo, estado, responsable y nivel de validacion.

## 21. Menu propuesto

El menu principal propuesto es:

- Inicio.
- Red.
- Capacidades.
- Necesidades y ofertas.
- Oportunidades.
- Articulaciones.
- Proyectos.
- Agenda.
- Informes.
- Administracion.

El acceso a cada seccion debe depender del rol, permisos, territorio y visibilidad de los datos.

## 22. Hoja de ruta corregida

La numeración original era planificación histórica, no evidencia de entregas. La secuencia real evolucionó: no se implementaron requerimientos/cobertura en los antiguos incrementos 2–3 ni módulos propios de articulaciones/proyectos en los siguientes. Se conservan esas decisiones funcionales válidas como alcance futuro, pero la tabla siguiente refleja la secuencia efectivamente implementada.

| Incremento real | Alcance y estado |
|---|---|
| Incremento 1 | Implementado: autenticación, roles/ámbitos y estructura del backoffice. |
| Incremento 2 | Implementado: oportunidades manuales, actores de origen/candidatos, responsable, edición y seguimiento, con evolución del directorio de personas. |
| Incremento 3 | Implementado: directorio y fichas de nodos, composición y relaciones territoriales. |
| Incremento 4 | Implementado: mapa de capacidades de nodos. |
| Incremento 5 | Implementado: directorio, fichas, alta y validación de organizaciones y relaciones territoriales. |
| Incremento 6 | Implementado: directorio de habilidades, gestión de habilidades personales, capacidades y actividades de organizaciones, gobernanza de catálogos y propuestas. |
| Incremento 7 | Previsto: análisis productivo de oportunidades — requerimientos, coincidencias, cobertura, brechas y preparación para Radar. 7.0 sólo alinea documentación/nomenclatura; 7A–7G se desarrollarán después. |

Posteriores, sin fijar números rígidos: necesidades/ofertas/recursos/equipamiento; articulaciones; proyectos; resultados/economía; agenda/convocatorias; informes/indicadores; Radar externo automatizado; automatización/IA; integración futura limitada con ClubSmart. La prioridad sigue siendo una vertical útil, verificable y ampliable. El orden exacto 7.0 → 7G se registra en el diseño técnico del Incremento 7.

## 23. Decisiones pendientes

Las siguientes decisiones siguen requiriendo definicion institucional:

- Politica legal definitiva de conservacion, eliminacion y tratamiento de datos.
- Criterios juridicos y administrativos para auditorias periodicas.
- Indicadores obligatorios para informes formales de autoridades.
- Reglas economicas marco para distribucion, aportes y participacion de quien origina una oportunidad.
- Alcance formal de la Unidad de Tecnologia Productiva.
- Condiciones comerciales definitivas para ClubSmart.
- Fuentes externas que se incorporaran primero al Radar en etapas posteriores.
- Herramientas externas de comunicacion, agenda y documentacion que se integraran en el futuro.
- Nivel aceptable de automatizacion futura sin perder control humano.

## 24. Criterios transversales

El sistema debe mantener estos criterios en todos sus modulos:

Para el análisis del Incremento 7 rigen además diez invariantes: sugerencia ≠ decisión; coincidencia ≠ asignación; capacidad registrada ≠ disponibilidad; cobertura analítica ≠ compromiso operativo; requerimiento faltante ≠ brecha abierta; brecha resuelta ≠ requerimiento automáticamente cubierto; actor externo ≠ integrante del MP25M; resultado histórico ≠ estado actual; dato ≠ inferencia ≠ hipótesis; ningún análisis crea relaciones operativas implícitas.

- Trazabilidad de datos, acciones y decisiones.
- Consentimiento explicito para usos sensibles de informacion.
- Privacidad por defecto y visibilidad segun rol.
- Separacion entre dato declarado, pendiente de validacion, validado y rechazado.
- Historial de cambios relevante.
- Responsables claros para oportunidades, articulaciones y proyectos.
- Control de calidad antes de publicar, convocar o comprometer capacidades.
- Transparencia economica en acuerdos, ingresos, costos y aportes.
- Capacidad de aprender de resultados y mejorar criterios operativos.
