# MP25M — Diseño técnico — Incremento 13A

## Informes e indicadores operativos

## 1. Objetivo técnico

13A incorporará una superficie analítica de sólo lectura sobre el modelo
operativo existente.

La implementación deberá:

- calcular agregados en servidor;
- evitar duplicación de fuentes;
- distinguir stock y flujo;
- aplicar filtros sólo cuando exista una relación válida;
- evitar descargar directorios completos para contarlos;
- mantener definiciones centralizadas y tipadas.

## 2. Arquitectura

Ruta principal:

    /panel/informes

Lógica analítica:

    lib/reports/indicators.ts

Componentes:

    app/panel/informes/

La página será dinámica, autenticada y de sólo lectura.

## 3. Estrategia de consulta

Se utilizarán consultas agregadas en servidor:

- count;
- agrupaciones;
- exists;
- CTE;
- selección del último registro;
- consultas limitadas al universo necesario.

No se descargarán tablas completas para realizar conteos en JavaScript.

## 4. Sin tabla analítica propia

13A no creará inicialmente una tabla de indicadores.

Las entidades operativas continúan siendo las fuentes de verdad.

Sólo se considerarán vistas, funciones SQL, snapshots analíticos o vistas
materializadas si las consultas reales demuestran posteriormente que son
necesarias.

## 5. Zona horaria

Zona operativa:

    America/Argentina/Buenos_Aires

Los rangos de fecha de la interfaz deberán convertirse consistentemente para
consultar columnas timestamptz.

La fecha final será inclusiva desde la perspectiva del usuario.

## 6. Fuentes principales

### Red

- mp25m.persons
- mp25m.nodes
- mp25m.organizations
- mp25m.person_skills
- mp25m.organization_capabilities

### Necesidades y ofertas

- mp25m.needs_offers

### Oportunidades y análisis

- mp25m.opportunities
- mp25m.opportunity_requirements
- mp25m_api.opportunity_coverage_summary_list
- mp25m.opportunity_coverage_snapshot_requirements
- mp25m.opportunity_requirement_matches
- mp25m.opportunity_gaps
- mp25m.opportunity_followups
- mp25m.opportunity_nodes

### Ejecución

- mp25m.opportunity_articulations
- mp25m.projects

## 7. Definiciones técnicas

### Personas activas

    persons.record_status = 'active'

### Nodos activos

    nodes.status = 'active'

### Organizaciones activas

    organizations.record_status = 'active'

### Habilidades personales confirmadas

    person_skills.verification_status = 'confirmed'

### Capacidades organizacionales confirmadas

    organization_capabilities.active = true
    organization_capabilities.verification_status = 'confirmed'

### Necesidades vigentes

    needs_offers.record_type = 'need'
    needs_offers.status = 'active'

### Ofertas vigentes

    needs_offers.record_type = 'offer'
    needs_offers.status = 'active'

### Oportunidades activas

Estados:

- open
- under_analysis
- in_progress

### Oportunidades detectadas

Filtro de período sobre:

    opportunities.created_at

### Análisis iniciado

Debe existir al menos un requerimiento activo de la Oportunidad en:

    opportunity_requirements

El porcentaje será:

    oportunidades activas con requerimientos activos
    /
    oportunidades activas

Si el denominador es cero, el resultado será no calculable.

### Completitud

Para la lectura operativa actual se utilizará:

    mp25m_api.opportunity_coverage_summary_list

Esta vista calcula la cobertura vigente a partir de requerimientos activos,
revisiones vigentes y evaluaciones actuales.

Los snapshots históricos no se utilizarán para representar el estado actual,
porque su creación es explícita y el último snapshot puede ser anterior a una
modificación posterior del análisis.

Fórmula:

    evaluated_requirement_count / active_requirement_count

Sólo cuando:

    active_requirement_count > 0

La respuesta incluirá además la cantidad de Oportunidades participantes.

### Requerimientos

Se utilizará el último snapshot de cada Oportunidad.

Fuente:

    opportunity_coverage_snapshot_requirements.network_coverage_status

Mapeo:

- covered → Cubierto
- partial → Parcialmente cubierto
- missing → Faltante
- NULL → No evaluado

NULL no deberá convertirse en missing.

### Coincidencias

Fuente:

    opportunity_requirement_matches

Incluir:

- suggested
- accepted_for_analysis

Excluir:

- discarded

### Brechas abiertas

Estados:

- open
- in_treatment
- blocked

### Brechas resueltas

Estado:

- resolved

Mantener separadas:

- closed_unresolved
- cancelled

### Articulaciones iniciadas

Filtro de período sobre:

    opportunity_articulations.created_at

### Proyectos iniciados

Filtro de período sobre:

    projects.created_at

### Proyectos finalizados

Condiciones:

    projects.status = 'completed'

y:

    projects.completed_at dentro del período

### Oportunidades sin seguimiento registrado

Universo:

- open
- under_analysis
- in_progress

Condición:

no debe existir un registro en opportunity_followups para la Oportunidad.

Este indicador no se denominará "sin actividad".

## 8. Tipos de respuesta

La lógica deberá devolver estructuras tipadas equivalentes a:

    type NetworkSummary = {
      activePeople: number
      activeNodes: number
      activeOrganizations: number
      confirmedPersonSkills: number
      confirmedOrganizationCapabilities: number
    }

    type NeedsOffersSummary = {
      activeNeeds: number
      activeOffers: number
    }

    type OpportunitySummary = {
      detectedInPeriod: number
      active: number
      analysisStarted: number
      analysisStartedPercent: number | null
      analysisStartedDenominator: number
      averageCompleteness: number | null
      completenessSampleCount: number
      withoutRegisteredFollowup: number
    }

    type RequirementSummary = {
      covered: number
      partial: number
      missing: number
      notEvaluated: number
      currentMatches: number
      suggestedMatches: number
      acceptedMatches: number
    }

    type GapSummary = {
      open: number
      resolved: number
      closedUnresolved: number
      cancelled: number
    }

    type ExecutionSummary = {
      articulationsStarted: number
      projectsStarted: number
      projectsCompleted: number
    }

## 9. Filtros

Tipo conceptual inicial:

    type ReportFilters = {
      dateFrom?: string
      dateTo?: string
      nodeId?: string
      responsibleInternalUserId?: string
    }

Los estados se tratarán dentro de cada familia de datos.

El período sólo afectará métricas de flujo.

## 10. Nodo

Para Oportunidades se utilizará exclusivamente la relación explícita:

    mp25m.opportunity_nodes

No se inferirá Nodo a través de Personas, Organizaciones, Articulaciones o
Proyectos.

Los indicadores generales de red no se filtrarán automáticamente por Nodo
mientras no exista una definición territorial específica para ellos.

En la implementación 13A:

- `need_offer_list.node_id` filtra Necesidades/Ofertas;
- `opportunity_list.node_ids`, derivado de `opportunity_nodes`, filtra
  Oportunidades y su análisis;
- las brechas se limitan al universo explícito de Oportunidades del Nodo;
- Articulaciones y Proyectos permanecen sin filtro de Nodo mientras no exista
  una relación territorial propia que justifique aplicarlo.

## 11. Responsable

Campos relevantes:

- opportunities.assigned_to_internal_user_id
- opportunity_articulations.responsible_internal_user_id
- projects.responsible_internal_user_id
- needs_offers.responsible_internal_user_id
- opportunity_gaps.responsible_internal_user_id

Autoría no equivale a responsabilidad.

El filtro usa el campo explícito correspondiente a cada entidad. En
requerimientos, completitud y coincidencias, se utiliza como universo la
Oportunidad cuyo `assigned_to_internal_user_id` coincide con el filtro.

## 12. Validación

No habrá un filtro universal de validación.

Se aplicará únicamente donde exista una dimensión estructurada, por ejemplo:

- person_skills.verification_status
- organization_capabilities.verification_status
- opportunity_requirement_revisions.validation_status

## 13. Servicio de indicadores

Se implementará inicialmente:

    lib/reports/indicators.ts

Responsabilidades:

- validar filtros;
- normalizar fechas;
- ejecutar consultas agregadas;
- seleccionar snapshots vigentes;
- calcular porcentajes;
- devolver estructuras tipadas;
- mantener las reglas funcionales fuera de los componentes visuales.

Los componentes de UI no deberán reinterpretar la semántica de los
indicadores.

## 14. Acceso a datos

Se preferirán consultas ejecutadas desde servidor.

Cuando Supabase/PostgREST permita expresar el cálculo de forma clara y
eficiente, podrá utilizarse directamente.

Si un cálculo transversal requiere SQL complejo, antes de crear una función
RPC deberá evaluarse:

- legibilidad;
- rendimiento;
- permisos;
- necesidad real de reutilización.

13A no presupone una RPC nueva.

## 15. UI

La pantalla deberá mostrar bloques separados:

- Red;
- Necesidades y ofertas;
- Oportunidades;
- Análisis productivo;
- Coincidencias y brechas;
- Articulaciones y proyectos.

Cada indicador deberá mostrar:

- etiqueta;
- valor;
- período o corte;
- explicación breve.

Ejemplo:

    Análisis iniciado
    62 %
    8 de 13 oportunidades activas

Para completitud:

    Completitud promedio
    74 %
    6 oportunidades con snapshot válido

## 16. Estados sin datos

La representación deberá distinguir:

- cero válido;
- sin datos;
- no calculable;
- pendiente de soporte.

Un null analítico no deberá convertirse automáticamente en cero.

## 17. Responsive

Desktop:

- grillas de tarjetas;
- filtros visibles;
- bloques por dimensión.

Móvil:

- una columna;
- controles táctiles;
- sin tablas horizontales obligatorias;
- explicaciones accesibles sin hover.

## 18. Navegación

Se activará Informes en:

- app/panel/page.tsx
- app/panel/panel-navigation.tsx
- app/panel/panel-mobile-navigation.tsx

Informes dejará de pertenecer a futureModules.

## 19. Seguridad

La página deberá:

1. exigir autenticación;
2. exigir acceso interno;
3. respetar el modelo de ámbitos existente;
4. no exponer información personal innecesaria;
5. devolver agregados cuando no se necesiten listados nominales.

No habrá operaciones de escritura.

## 20. Migraciones

La primera implementación no presupone ninguna migración.

Antes de crear vistas, funciones o índices se revisarán:

- consultas reales;
- tiempos de respuesta;
- planes de ejecución;
- índices existentes.

Cualquier cambio de base deberá aprobarse e incorporarse explícitamente al
Incremento 13A.

## 21. Contraste con SQL

Cada indicador deberá poder contrastarse con una consulta SQL directa sobre la
misma fuente.

La prueba deberá verificar tanto el valor total como, cuando corresponda:

- numerador;
- denominador;
- composición por estado;
- cantidad de entidades participantes.

## 22. Pruebas de filtros

Se deberá verificar que:

- período afecte sólo métricas temporales;
- Nodo no altere métricas sin relación territorial definida;
- responsable no se infiera desde autoría;
- validación sólo afecte indicadores compatibles;
- los estados terminales se traten según la definición de cada indicador.

## 23. Regresión

Ejecutar:

    npm run build
    npx tsc --noEmit --incremental false
    npm run lint

Los warnings de lint preexistentes deberán mantenerse separados de cualquier
warning nuevo introducido por 13A.

## 24. Criterio técnico de cierre

13A podrá cerrarse cuando:

1. los cálculos estén centralizados y tipados;
2. cada indicador tenga una única definición;
3. los valores sean reproducibles con SQL;
4. no exista escritura desde Informes;
5. desktop y móvil funcionen;
6. los filtros respeten sus universos;
7. build y TypeScript finalicen sin errores;
8. los warnings preexistentes de lint no aumenten por 13A;
9. las limitaciones permanezcan documentadas.
