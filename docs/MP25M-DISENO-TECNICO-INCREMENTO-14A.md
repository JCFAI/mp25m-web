# MP25M — Diseño técnico — Incremento 14A

## Economía operativa manual

## 1. Objetivo técnico

14A incorpora un modelo económico monetario transversal, manual y trazable sin
modificar la semántica de Oportunidades, Articulaciones, Proyectos o Resultados.

La implementación deberá:

- mantener una identidad económica separada de las entidades operativas;
- soportar Oportunidad, Articulación o Proyecto como origen;
- conservar revisiones inmutables;
- evitar actualizaciones perdidas;
- distinguir NULL de cero;
- evitar herencia automática;
- evitar conversión o suma entre monedas;
- mantener todas las escrituras en servidor;
- reutilizar los controles de acceso del contexto de origen.

## 2. Decisión de modelo

No se agregarán columnas económicas directamente a:

- `mp25m.opportunities`;
- `mp25m.opportunity_articulations`;
- `mp25m.projects`.

Se incorporará un núcleo separado.

Propuesta:

    mp25m.economic_profiles
    mp25m.economic_profile_revisions

La primera tabla identifica la ficha y su entidad de origen.

La segunda conserva su contenido económico versionado.

## 3. economic_profiles

Columnas principales:

    id uuid primary key

    opportunity_id uuid null
    articulation_id uuid null
    project_id uuid null

    created_by_internal_user_id uuid not null
    created_at timestamptz not null

La fila deberá referenciar exactamente uno de:

- opportunity_id;
- articulation_id;
- project_id.

Se utilizará una restricción XOR.

Deberá existir como máximo una ficha por entidad mediante índices únicos
parciales.

## 4. economic_profile_revisions

Columnas propuestas:

    id uuid primary key
    economic_profile_id uuid not null
    revision_no integer not null

    currency_code text null

    estimated_value numeric null
    estimated_costs numeric null
    probability_percent numeric null

    participant_income_potential numeric null
    mp25m_contribution_potential numeric null

    distribution_notes text null

    agreed_value numeric null
    collection_status text null
    collected_amount numeric null

    final_costs numeric null
    participant_income_final numeric null
    mp25m_contribution_final numeric null
    final_result_amount numeric null

    economic_summary text null
    evidence_reference text null

    rationale text not null
    changed_by_internal_user_id uuid not null
    changed_at timestamptz not null

Restricción única:

    economic_profile_id, revision_no

Las revisiones no se actualizarán ni eliminarán en la operación normal.

## 5. Precisión monetaria

Los importes deberán utilizar `numeric`, nunca `float` o `double precision`.

La migración definirá una precisión suficiente para los casos operativos del
MP25M.

No se almacenarán importes monetarios en unidades menores enteras mientras el
sistema soporte múltiples monedas con diferente cantidad potencial de
decimales.

## 6. Moneda

`currency_code` utilizará un código normalizado de tres caracteres.

Validación mínima:

    ^[A-Z]{3}$

14A no implementa una tabla de cotizaciones.

Si existe al menos un campo monetario informado, la moneda será obligatoria.

La base no deberá transformar importes entre monedas.

## 7. Valores monetarios

Deberán ser mayores o iguales a cero:

- estimated_value;
- estimated_costs;
- participant_income_potential;
- mp25m_contribution_potential;
- agreed_value;
- collected_amount;
- final_costs;
- participant_income_final;
- mp25m_contribution_final.

`final_result_amount` podrá ser:

- positivo;
- cero;
- negativo.

NULL significará no informado.

## 8. Margen estimado

No se almacenará una columna `estimated_margin`.

La lectura actual podrá calcular:

    estimated_value - estimated_costs

únicamente cuando ambos campos sean no NULL.

Si falta alguno:

    estimated_margin = NULL

La interfaz lo presentará como No calculable.

## 9. Probabilidad

`probability_percent` será opcional.

Restricción:

    probability_percent >= 0
    probability_percent <= 100

NULL significa no informada.

## 10. Estado de cobro

Valores propuestos:

    pending
    partial
    collected
    uncollectible
    cancelled
    not_applicable

NULL significa que el estado aún no fue informado.

No se derivará automáticamente desde `collected_amount`.

## 11. Distribución

`distribution_notes` será texto estructuralmente libre.

14A no crea:

- filas por participante;
- porcentajes;
- fórmulas;
- reparto automático;
- obligaciones de suma al 100 %.

No deberá interpretarse este texto automáticamente.

## 12. Historial

La lectura vigente será la revisión con mayor:

    revision_no

para cada ficha.

Se expondrá mediante una vista de sólo lectura, por ejemplo:

    mp25m_api.economic_profile_current

También se expondrá el historial mediante:

    mp25m_api.economic_profile_revision_list

La vista actual deberá incluir datos mínimos de la entidad de origen necesarios
para la UI, sin duplicar sus fuentes de verdad.

## 13. Escritura

Las tablas no se expondrán directamente al navegador.

Se implementarán funciones servidor/RPC gobernadas.

Operaciones mínimas:

    create_economic_profile_revision(...)
    update_economic_profile_revision(...)

La implementación podrá unificar ambas en una única operación si mantiene las
mismas garantías.

## 14. Concurrencia optimista

Toda actualización deberá recibir:

    expected_revision_no

Antes de insertar una nueva revisión se verificará que la revisión actual siga
siendo la esperada.

Si cambió, la función deberá fallar con conflicto y no crear una nueva
revisión.

## 15. Permisos

Antes de crear o modificar una ficha deberá resolverse el contexto de origen.

14A expondrá un helper server-only:

    mp25m_api.can_manage_economic_source(
      actor_internal_user_id,
      source_type,
      source_id
    )

La autorización será derivada del tipo de origen.

### Oportunidad

Para Oportunidades se conservará la semántica vigente de gestión utilizada por
la aplicación.

Podrá administrar la ficha económica un usuario interno activo que posea una
asignación de acceso vigente y cuyo rol:

- sea administrativo; o
- sea `administrator`; o
- sea `articulator`; o
- sea `authority_analyst`.

La regla no reutilizará
`can_operate_opportunity_requirement(..., 'formulate')`, porque ese helper
pertenece al gobierno del análisis de requerimientos y posee una composición
de roles diferente de la gestión general de Oportunidades.

### Articulación

Se reutilizará:

    mp25m_api.can_manage_articulation(
      actor_internal_user_id,
      articulation_id
    )

Por lo tanto se conservarán sus reglas vigentes de responsable explícito,
administración y ámbitos territoriales.

### Proyecto

Se reutilizará:

    mp25m_api.can_manage_project(
      actor_internal_user_id,
      project_id
    )

Por lo tanto se conservarán sus reglas vigentes de responsable explícito,
administración y ámbitos territoriales.

14A no creará una autorización económica que amplíe por sí misma los permisos
sobre la entidad de origen.

Las vistas permanecerán disponibles únicamente para el servidor mediante
`service_role`; el navegador no recibirá acceso directo a las tablas ni a las
vistas económicas.

## 16. Auditoría

Cada inserción de revisión deberá crear un evento en:

    mp25m.audit_events

Acciones sugeridas:

    economic.profile.create
    economic.profile.revise

El evento deberá identificar:

- economic_profile_id;
- source type;
- source id;
- revision_no;
- rationale;
- actor;
- resultado.

Los datos monetarios anteriores y nuevos deberán quedar trazables sin depender
únicamente del evento, porque las revisiones son la fuente histórica.

## 17. Lectura desde la aplicación

La capa servidor deberá resolver una estructura tipada común.

Ejemplo conceptual:

    EconomicProfileCurrent

con:

- sourceType;
- sourceId;
- revisionNo;
- currencyCode;
- campos monetarios;
- probabilityPercent;
- collectionStatus;
- summary;
- evidenceReference;
- changedBy;
- changedAt.

No se usarán tipos `number` para realizar cálculos monetarios de precisión que
puedan introducir errores de punto flotante sin una conversión controlada.

## 18. Interfaz

Se incorporará un componente económico reutilizable en:

    /panel/oportunidades/[id]
    /panel/articulaciones/[id]
    /panel/proyectos/[id]

El componente deberá recibir explícitamente:

- sourceType;
- sourceId;
- permiso de lectura;
- permiso de edición.

Deberá mostrar:

- Sin ficha económica, cuando no exista;
- datos actuales;
- margen estimado calculable;
- edición;
- historial de revisiones.

## 19. Formularios

Los formularios deberán:

- aceptar coma o punto según la experiencia de usuario definida por la
  aplicación;
- normalizar antes de persistir;
- no convertir campo vacío a cero;
- validar moneda;
- validar importes;
- validar probabilidad;
- requerir motivo de cambio.

La representación visual podrá usar formato local, pero la escritura deberá
usar una representación numérica inequívoca.

## 20. Relación con 11A

`mp25m.results.result_type = 'economic'` seguirá representando un resultado
cualitativo.

No habrá:

- foreign key automática entre Result y Economic Profile;
- migración automática;
- generación automática de Result;
- conversión de descripción a importe.

## 21. Relación con Informes 13A

14A no modificará inicialmente `/panel/informes`.

Cuando exista información económica suficiente, un incremento posterior podrá
agregar:

- ingresos potenciales por moneda;
- ingresos finales por moneda;
- aportes potenciales al MP25M por moneda;
- aportes finales por moneda;
- valor acordado;
- cobrado;
- margen.

Nunca se generará un total multimoneda sin una política explícita de conversión.

## 22. Base de datos

La migración de 14A deberá:

1. crear `mp25m.economic_profiles`;
2. crear `mp25m.economic_profile_revisions`;
3. crear claves foráneas;
4. crear restricciones XOR;
5. crear índices únicos parciales;
6. crear restricciones monetarias;
7. crear índices de lectura;
8. habilitar RLS;
9. revocar acceso directo a roles de navegador;
10. conceder acceso únicamente al mecanismo servidor correspondiente;
11. crear vistas de lectura;
12. crear funciones de escritura;
13. registrar auditoría;
14. incorporar comentarios de esquema.

## 23. Datos existentes

14A no migrará automáticamente texto histórico a importes.

No se inferirán datos económicos desde:

- resultados;
- seguimientos;
- cierres;
- entregables;
- descripciones;
- evidencia.

Las fichas iniciales se crearán manualmente.

## 24. Pruebas mínimas

Deberán verificarse:

- ficha de Oportunidad;
- ficha de Articulación;
- ficha de Proyecto;
- XOR de origen;
- una sola ficha por origen;
- múltiples revisiones;
- conflicto de revisión;
- NULL distinto de cero;
- importes cero válidos;
- importes negativos rechazados;
- resultado final negativo permitido;
- moneda obligatoria con importes;
- probabilidad 0;
- probabilidad 100;
- probabilidad fuera de rango rechazada;
- estados de cobro;
- permisos;
- auditoría;
- lectura actual;
- historial;
- desktop;
- móvil.

## 25. Regresión

Antes del cierre se ejecutará:

    git diff --check
    npx tsc --noEmit --incremental false
    npm run build
    npm run lint

Los warnings preexistentes deberán distinguirse de cualquier regresión de 14A.

## 26. Exclusiones técnicas

14A no incorporará:

- proveedor de pagos;
- API bancaria;
- facturación;
- AFIP/ARCA;
- conciliación;
- ledger contable;
- tipo de cambio;
- conversión de moneda;
- liquidaciones;
- asignaciones monetarias por participante;
- reglas automáticas de reparto;
- indicadores económicos agregados.

## 27. Criterio técnico de cierre

14A podrá cerrarse cuando:

1. el modelo económico sea independiente de las entidades operativas;
2. exista una sola ficha por origen;
3. las revisiones sean inmutables;
4. la edición use concurrencia optimista;
5. NULL y cero conserven semánticas distintas;
6. no exista herencia automática;
7. no exista conversión de moneda;
8. las escrituras estén gobernadas y auditadas;
9. las tres fichas operativas integren la sección económica;
10. build y TypeScript finalicen sin errores;
11. no aparezcan regresiones nuevas de lint;
12. las limitaciones permanezcan documentadas.
