# MP25M2 — Objetivos y alcance a revisar

## Estado del documento

Este documento es una base de transición entre MP25M1 y MP25M2.

**No constituye todavía una especificación funcional aprobada de MP25M2.**

Antes de iniciar cualquier implementación de MP25M2 deberán revisarse,
confirmarse, modificarse o descartarse sus objetivos, alcance, prioridades,
riesgos, dependencias y criterios de aceptación.

La implementación de MP25M2 no comenzará por inercia a partir de pendientes
históricos de MP25M1.

---

## 1. Etapas del producto

### MP25M1 (cerrado)

MP25M1 es la primera versión realmente operativa del sistema. Su cierre formal
se documenta en `MP25M1-ACTA-DE-CIERRE.md`.

La línea cerrada es utilizable de punta a punta, estable, coherente entre
módulos, trazable y apta para operación cotidiana, dentro de sus limitaciones
explícitamente documentadas.

### MP25M2

MP25M2 será una segunda etapa orientada a ampliar la capacidad del sistema para:

- detectar información externa relevante;
- asistir análisis y operación mediante IA;
- automatizar tareas seleccionadas;
- integrarse con herramientas externas de comunicación;
- integrarse con herramientas externas de calendario;
- ampliar sustancialmente Informes e Indicadores.

Estos objetivos son candidatos y deberán revisarse formalmente antes de
definir incrementos de implementación.

### MP25M3

MP25M3 queda reservado para una etapa posterior.

La posible integración limitada entre MP25M y ClubSmart se analizará recién
en MP25M3.

**La integración con ClubSmart queda expresamente fuera de MP25M2.**

---

## 2. Objetivos candidatos de MP25M2

Los siguientes objetivos representan una hipótesis inicial de alcance.

No implican todavía compromiso de implementación.

### 2.1 Radar externo automatizado

Analizar la incorporación de mecanismos para detectar señales, actores,
convocatorias, demandas, oportunidades, mercados u otra información externa
potencialmente relevante para el MP25M.

La revisión deberá definir:

- qué fuentes externas se admitirán;
- qué tipos de búsqueda se realizarán;
- qué información se almacenará;
- con qué frecuencia se consultarán las fuentes;
- cómo se explicará por qué apareció cada hallazgo;
- cómo se evitarán duplicados;
- cómo se evaluará calidad y vigencia;
- qué requiere revisión humana;
- cuándo un hallazgo puede convertirse en una entidad operativa.

Se deberá preservar el principio:

**hallazgo externo ≠ oportunidad validada ≠ compromiso operativo.**

### 2.2 IA y automatizaciones

Analizar usos de IA y automatización que aporten valor operativo sin eliminar
el control humano sobre decisiones sensibles.

Podrán evaluarse, entre otros:

- asistencia para análisis;
- clasificación;
- síntesis;
- detección de información faltante;
- preparación de comunicaciones;
- sugerencias de coincidencias;
- priorización explicable;
- generación asistida de borradores;
- seguimiento de pendientes;
- automatizaciones repetitivas.

La revisión deberá establecer expresamente:

- qué puede sugerir la IA;
- qué puede ejecutar automáticamente;
- qué requiere confirmación humana;
- qué decisiones nunca deberán automatizarse;
- qué información puede utilizar;
- cómo se auditan las acciones y sugerencias;
- cómo se controla error, sesgo y desactualización.

Se mantendrá como principio:

**sugerencia ≠ decisión.**

### 2.3 Integraciones de comunicación

Analizar integraciones reales con herramientas externas de comunicación.

La revisión deberá determinar:

- qué canales se priorizan;
- qué acciones pueden realizarse desde MP25M;
- cómo se controla el envío;
- cómo se evita contacto no autorizado;
- cómo se registra procedencia, destinatarios y resultado;
- cómo se administran consentimientos y bajas;
- qué comunicaciones requieren confirmación explícita.

El modelo actual de Comunicaciones 12B seguirá siendo la base de control humano.

### 2.4 Integraciones de calendario

Analizar integración con calendarios externos a partir de la Agenda operativa.

La revisión deberá determinar:

- sistemas de calendario objetivo;
- sincronización unidireccional o bidireccional;
- propiedad de los eventos;
- resolución de conflictos;
- modificaciones y cancelaciones;
- permisos;
- privacidad;
- trazabilidad.

La Agenda MP25M continuará siendo una fuente operativa propia y no deberá
perder su semántica por la integración.

### 2.5 Ampliación fuerte de Informes e Indicadores

Analizar una segunda generación de Informes e Indicadores.

Podrán evaluarse:

- indicadores económicos por moneda;
- evolución temporal;
- comparación entre períodos;
- indicadores territoriales;
- indicadores por vector o temática;
- tiempos operativos;
- resultados;
- trayectorias;
- crecimiento de la red;
- eficacia de articulaciones;
- desempeño de proyectos;
- cobertura y brechas;
- seguimiento;
- actividad de comunicaciones;
- actividad del Radar;
- indicadores de automatización;
- exportaciones;
- informes institucionales.

Cada indicador deberá conservar:

- definición explícita;
- universo;
- fuente;
- período;
- filtros;
- semántica de cero;
- semántica de dato ausente;
- reproducibilidad;
- trazabilidad.

No se crearán indicadores mediante aproximaciones ocultas.

---

## 3. Revisión obligatoria antes de comenzar MP25M2

Antes de diseñar el primer incremento de MP25M2 se realizará una revisión
formal de sus objetivos.

Como mínimo deberán revisarse:

1. problema que se quiere resolver;
2. usuarios y roles involucrados;
3. principales casos de uso;
4. beneficios esperados;
5. alcance funcional;
6. exclusiones explícitas;
7. prioridades;
8. dependencias con MP25M1;
9. calidad de los datos existentes;
10. nuevas fuentes de datos;
11. privacidad;
12. seguridad;
13. permisos;
14. consentimiento;
15. auditoría;
16. control humano;
17. riesgos de automatización;
18. criterios de uso de IA;
19. integraciones externas;
20. costos operativos;
21. observabilidad;
22. métricas de éxito;
23. estrategia de pruebas;
24. criterios de aceptación;
25. secuencia de incrementos.

No se deberá asumir que todos los objetivos candidatos de este documento
sobrevivirán a esa revisión.

---

## 4. Criterio para comenzar MP25M2

MP25M2 comenzará únicamente después de:

- cerrar formalmente MP25M1;
- realizar la revisión de objetivos de MP25M2;
- acordar qué problemas se resolverán;
- definir qué queda dentro y fuera;
- priorizar los objetivos;
- definir una secuencia incremental;
- establecer criterios de aceptación verificables.

La revisión deberá producir una especificación inicial aprobada antes de crear
el primer incremento técnico de MP25M2.

---

## 5. Límite con MP25M1

La existencia de este documento no amplía el alcance de MP25M1.

MP25M1 deberá cerrarse por sus propios criterios operativos.

Los objetivos candidatos de MP25M2 no deberán utilizarse como motivo para
postergar indefinidamente el cierre de MP25M1.

---

## 6. Límite con MP25M3

La integración entre MP25M y ClubSmart no forma parte de MP25M2.

Cuando corresponda iniciar MP25M3 deberá realizarse una revisión específica
sobre:

- objetivo de la integración;
- datos que pueden compartirse;
- datos que deben permanecer separados;
- autenticación;
- permisos;
- privacidad;
- responsabilidades de cada sistema;
- flujos comerciales;
- límites técnicos y organizativos.

Hasta esa revisión, MP25M y ClubSmart continuarán siendo sistemas
independientes.

---

## 7. Resultado de la revisión inicial y próximo paso

MP25M1 quedó formalmente cerrado el 8 de octubre de 2026.

La revisión inicial resolvió no aprobar todavía ningún incremento técnico de
MP25M2. Radar, IA, integraciones externas e Informes ampliados permanecen como
candidatos y no como compromiso de implementación.

El próximo paso es preparar y validar MP25M_S, un piloto global y didáctico
basado en un recorte de MP25M1. Su alcance se documenta en
MP25M-S-ALCANCE-Y-PILOTO.md.

La evidencia del piloto permitirá volver a revisar problemas, prioridades,
riesgos, dependencias y criterios de aceptación antes de aprobar MP25M_M o
cualquier incremento técnico de MP25M2.
