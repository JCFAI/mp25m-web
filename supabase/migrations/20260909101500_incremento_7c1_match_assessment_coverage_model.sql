-- Incremento 7C.1
-- Modelo persistente de evaluación humana de matches y cobertura de
-- requerimientos de oportunidad.
--
-- Principios:
-- - match aceptado no significa match satisfactorio;
-- - evaluación de match no significa cobertura del requerimiento;
-- - un requerimiento puede ser cubierto por la combinación de varios matches;
-- - ausencia de evidencia no equivale a does_not_satisfy;
-- - las evaluaciones pertenecen a una revisión exacta del requerimiento;
-- - las evaluaciones son append-only;
-- - una nueva evaluación nunca reescribe la anterior;
-- - los fundamentos seleccionados pertenecen al mismo match evaluado;
-- - una evaluación de cobertura congela qué evaluaciones de matches utilizó;
-- - nada aquí implica disponibilidad, voluntad, asignación o articulación.

begin;


-- ===========================================================================
-- 0. CLAVES COMPUESTAS AUXILIARES PARA INTEGRIDAD 7C
-- ===========================================================================
--
-- Permiten que las tablas de 7C demuestren mediante FKs que:
-- - una foundation realmente pertenece al match evaluado;
-- - un match realmente pertenece a la revisión cuya cobertura se evalúa.
--
-- No alteran la semántica ni los registros existentes de 7B.2.

alter table mp25m.opportunity_requirement_match_foundations
add constraint opp_req_match_foundations_id_match_unique
unique (
  id,
  match_id
);


alter table mp25m.opportunity_requirement_matches
add constraint opp_req_matches_id_revision_unique
unique (
  id,
  requirement_revision_id
);


-- ===========================================================================
-- 1. EVALUACIÓN HUMANA DEL MATCH
-- ===========================================================================

create table mp25m.opportunity_requirement_match_assessments (
  id uuid primary key default gen_random_uuid(),

  match_id uuid not null
    references mp25m.opportunity_requirement_matches(id)
    on delete restrict,

  assessment_no integer not null,

  assessment_kind text not null,

  rationale text not null,

  assessed_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  assessed_at timestamptz not null default now(),

  constraint opp_req_match_assessments_number_check
    check (
      assessment_no > 0
    ),

  constraint opp_req_match_assessments_kind_check
    check (
      assessment_kind in (
        'satisfies',
        'partially_satisfies',
        'does_not_satisfy',
        'insufficient_evidence'
      )
    ),

  constraint opp_req_match_assessments_rationale_check
    check (
      char_length(
        btrim(rationale)
      ) between 3 and 10000
    ),

  constraint opp_req_match_assessments_number_unique
    unique (
      match_id,
      assessment_no
    ),

  constraint opp_req_match_assessments_id_match_unique
    unique (
      id,
      match_id
    )
);


create index
opp_req_match_assessments_match_current_idx
on mp25m.opportunity_requirement_match_assessments (
  match_id,
  assessment_no desc
);


alter table
mp25m.opportunity_requirement_match_assessments
enable row level security;


revoke all
on table
mp25m.opportunity_requirement_match_assessments
from public, anon, authenticated, service_role;


grant select, insert
on table
mp25m.opportunity_requirement_match_assessments
to service_role;


comment on table
mp25m.opportunity_requirement_match_assessments
is
  'Append-only human assessment history for one analytical match. Assessment of a match is distinct from requirement coverage and does not imply availability, assignment or articulation.';


comment on column
mp25m.opportunity_requirement_match_assessments.assessment_kind
is
  'satisfies, partially_satisfies, does_not_satisfy or insufficient_evidence. Lack of evidence is deliberately distinct from a negative assessment.';


-- ===========================================================================
-- 2. FOUNDATIONS UTILIZADAS POR UNA EVALUACIÓN DE MATCH
-- ===========================================================================
--
-- Esta tabla selecciona snapshots ya congelados por 7B.2.
--
-- El match_id redundante es intencional: permite una FK compuesta que
-- garantiza físicamente que la foundation elegida pertenece al mismo match
-- que la evaluación.

create table
mp25m.opportunity_requirement_match_assessment_foundations (
  assessment_id uuid not null,

  match_id uuid not null,

  foundation_id uuid not null,

  linked_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  linked_at timestamptz not null default now(),

  primary key (
    assessment_id,
    foundation_id
  ),

  constraint opp_req_match_assess_found_assessment_fkey
    foreign key (
      assessment_id,
      match_id
    )
    references
      mp25m.opportunity_requirement_match_assessments (
        id,
        match_id
      )
    on delete restrict,

  constraint opp_req_match_assess_found_foundation_fkey
    foreign key (
      foundation_id,
      match_id
    )
    references
      mp25m.opportunity_requirement_match_foundations (
        id,
        match_id
      )
    on delete restrict
);


create index
opp_req_match_assess_found_match_idx
on mp25m.opportunity_requirement_match_assessment_foundations (
  match_id,
  assessment_id
);


alter table
mp25m.opportunity_requirement_match_assessment_foundations
enable row level security;


revoke all
on table
mp25m.opportunity_requirement_match_assessment_foundations
from public, anon, authenticated, service_role;


grant select, insert
on table
mp25m.opportunity_requirement_match_assessment_foundations
to service_role;


comment on table
mp25m.opportunity_requirement_match_assessment_foundations
is
  'Append-only selection of frozen 7B foundations used to justify one human match assessment. Composite FKs guarantee that each selected foundation belongs to the evaluated match.';


-- ===========================================================================
-- 3. EVALUACIÓN HUMANA DE COBERTURA DEL REQUERIMIENTO
-- ===========================================================================
--
-- No existe estado "unknown".
--
-- La ausencia de una fila de cobertura significa:
--   "este requerimiento todavía no fue evaluado".
--
-- Esto permitirá que 7D distinga:
--   cobertura
-- de
--   completitud del análisis.

create table mp25m.opportunity_requirement_coverage_evaluations (
  id uuid primary key default gen_random_uuid(),

  requirement_revision_id uuid not null
    references mp25m.opportunity_requirement_revisions(id)
    on delete restrict,

  evaluation_no integer not null,

  coverage_status text not null,

  rationale text not null,

  evaluated_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  evaluated_at timestamptz not null default now(),

  constraint opp_req_coverage_eval_number_check
    check (
      evaluation_no > 0
    ),

  constraint opp_req_coverage_eval_status_check
    check (
      coverage_status in (
        'covered',
        'partial',
        'missing'
      )
    ),

  constraint opp_req_coverage_eval_rationale_check
    check (
      char_length(
        btrim(rationale)
      ) between 3 and 10000
    ),

  constraint opp_req_coverage_eval_number_unique
    unique (
      requirement_revision_id,
      evaluation_no
    ),

  constraint opp_req_coverage_eval_id_revision_unique
    unique (
      id,
      requirement_revision_id
    )
);


create index
opp_req_coverage_eval_revision_current_idx
on mp25m.opportunity_requirement_coverage_evaluations (
  requirement_revision_id,
  evaluation_no desc
);


alter table
mp25m.opportunity_requirement_coverage_evaluations
enable row level security;


revoke all
on table
mp25m.opportunity_requirement_coverage_evaluations
from public, anon, authenticated, service_role;


grant select, insert
on table
mp25m.opportunity_requirement_coverage_evaluations
to service_role;


comment on table
mp25m.opportunity_requirement_coverage_evaluations
is
  'Append-only human conclusions about coverage of one exact opportunity requirement revision. covered, partial and missing are human analytical conclusions; absence of an evaluation means not yet evaluated.';


comment on column
mp25m.opportunity_requirement_coverage_evaluations.coverage_status
is
  'covered will map to 1, partial to 0.5 and missing to 0 in the later 7D aggregate model. No aggregate percentage is calculated in 7C.';


-- ===========================================================================
-- 4. EVALUACIONES DE MATCH QUE FUNDAMENTAN UNA COBERTURA
-- ===========================================================================
--
-- Una evaluación de cobertura puede:
-- - no utilizar matches (por ejemplo missing sin candidatos útiles);
-- - utilizar un match;
-- - combinar varios matches.
--
-- La misma evaluación de cobertura no puede seleccionar dos versiones
-- distintas de evaluación del mismo match.

create table
mp25m.opportunity_requirement_coverage_evaluation_matches (
  coverage_evaluation_id uuid not null,

  requirement_revision_id uuid not null,

  match_assessment_id uuid not null,

  match_id uuid not null,

  linked_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  linked_at timestamptz not null default now(),

  primary key (
    coverage_evaluation_id,
    match_assessment_id
  ),

  constraint opp_req_cov_eval_matches_one_assessment_per_match
    unique (
      coverage_evaluation_id,
      match_id
    ),

  constraint opp_req_cov_eval_matches_evaluation_fkey
    foreign key (
      coverage_evaluation_id,
      requirement_revision_id
    )
    references
      mp25m.opportunity_requirement_coverage_evaluations (
        id,
        requirement_revision_id
      )
    on delete restrict,

  constraint opp_req_cov_eval_matches_assessment_fkey
    foreign key (
      match_assessment_id,
      match_id
    )
    references
      mp25m.opportunity_requirement_match_assessments (
        id,
        match_id
      )
    on delete restrict,

  constraint opp_req_cov_eval_matches_match_revision_fkey
    foreign key (
      match_id,
      requirement_revision_id
    )
    references
      mp25m.opportunity_requirement_matches (
        id,
        requirement_revision_id
      )
    on delete restrict
);


create index
opp_req_cov_eval_matches_revision_idx
on mp25m.opportunity_requirement_coverage_evaluation_matches (
  requirement_revision_id,
  coverage_evaluation_id
);


alter table
mp25m.opportunity_requirement_coverage_evaluation_matches
enable row level security;


revoke all
on table
mp25m.opportunity_requirement_coverage_evaluation_matches
from public, anon, authenticated, service_role;


grant select, insert
on table
mp25m.opportunity_requirement_coverage_evaluation_matches
to service_role;


comment on table
mp25m.opportunity_requirement_coverage_evaluation_matches
is
  'Append-only snapshot of which exact match assessments were used for one requirement coverage conclusion. Composite FKs guarantee that every selected match belongs to the evaluated requirement revision.';


-- ===========================================================================
-- 5. READ MODEL — EVALUACIONES DE MATCH
-- ===========================================================================

create view
mp25m_api.opportunity_requirement_match_assessment_list
with (security_invoker = true)
as

select
  assessment.id
    as assessment_id,

  assessment.match_id,
  assessment.assessment_no,
  assessment.assessment_kind,
  assessment.rationale,

  assessment.assessed_by_internal_user_id,
  assessor.display_name
    as assessed_by_display_name,

  assessment.assessed_at,

  match.requirement_revision_id,

  revision.requirement_id,
  requirement.opportunity_id,

  revision.revision_no,
  revision.validation_status,

  requirement.record_status
    as requirement_record_status,

  not exists (
    select 1
    from mp25m.opportunity_requirement_revisions newer_revision
    where newer_revision.requirement_id =
        revision.requirement_id
      and newer_revision.revision_no >
        revision.revision_no
  ) as is_current_requirement_revision,

  match.status
    as match_status,

  match.origin_kind
    as match_origin_kind,

  case
    when match.person_id is not null
      then 'person'
    when match.organization_id is not null
      then 'organization'
    else 'candidate'
  end::text
    as actor_kind,

  coalesce(
    match.person_id,
    match.organization_id,
    match.actor_candidate_id
  ) as actor_id,

  coalesce(
    person.display_name::text,
    organization.name::text,
    candidate.display_name::text
  ) as actor_display_name,

  not exists (
    select 1
    from mp25m.opportunity_requirement_match_assessments
      newer_assessment
    where newer_assessment.match_id =
        assessment.match_id
      and newer_assessment.assessment_no >
        assessment.assessment_no
  ) as is_current_assessment,

  (
    select count(*)::integer
    from
      mp25m.opportunity_requirement_match_assessment_foundations
        selected_foundation
    where selected_foundation.assessment_id =
      assessment.id
  ) as selected_foundation_count

from mp25m.opportunity_requirement_match_assessments assessment

join mp25m.opportunity_requirement_matches match
  on match.id =
    assessment.match_id

join mp25m.opportunity_requirement_revisions revision
  on revision.id =
    match.requirement_revision_id

join mp25m.opportunity_requirements requirement
  on requirement.id =
    revision.requirement_id

left join mp25m.internal_users assessor
  on assessor.id =
    assessment.assessed_by_internal_user_id

left join mp25m.persons person
  on person.id =
    match.person_id

left join mp25m.organizations organization
  on organization.id =
    match.organization_id

left join mp25m.actor_candidates candidate
  on candidate.id =
    match.actor_candidate_id
;


revoke all
on mp25m_api.opportunity_requirement_match_assessment_list
from public, anon, authenticated, service_role;


grant select
on mp25m_api.opportunity_requirement_match_assessment_list
to service_role;


comment on view
mp25m_api.opportunity_requirement_match_assessment_list
is
  '7C read model for immutable match assessments, including actor identity, exact requirement revision, currentness and number of selected frozen foundations.';


-- ===========================================================================
-- 6. READ MODEL — FOUNDATIONS SELECCIONADAS
-- ===========================================================================

create view
mp25m_api.opportunity_requirement_match_assessment_foundation_list
with (security_invoker = true)
as

select
  link.assessment_id,
  link.match_id,
  link.foundation_id,

  assessment.assessment_no,
  assessment.assessment_kind,

  foundation.foundation_origin,
  foundation.foundation_kind,
  foundation.relation_kind,

  foundation.observed_text,
  foundation.inference_text,

  foundation.verification_status,
  foundation.evidence_attributes,

  foundation.node_id,

  foundation.source_id,
  foundation.ingestion_record_id,

  foundation.source_locator,
  foundation.source_excerpt,

  foundation.source_record_type,
  foundation.source_record_id,
  foundation.source_updated_at,

  foundation.search_rule_code,
  foundation.search_rule_version,

  link.linked_by_internal_user_id,
  linker.display_name
    as linked_by_display_name,

  link.linked_at

from
  mp25m.opportunity_requirement_match_assessment_foundations link

join mp25m.opportunity_requirement_match_assessments assessment
  on assessment.id =
    link.assessment_id

join mp25m.opportunity_requirement_match_foundations foundation
  on foundation.id =
    link.foundation_id

left join mp25m.internal_users linker
  on linker.id =
    link.linked_by_internal_user_id
;


revoke all
on
mp25m_api.opportunity_requirement_match_assessment_foundation_list
from public, anon, authenticated, service_role;


grant select
on
mp25m_api.opportunity_requirement_match_assessment_foundation_list
to service_role;


comment on view
mp25m_api.opportunity_requirement_match_assessment_foundation_list
is
  '7C read model showing the exact frozen 7B foundations selected for each immutable match assessment.';


-- ===========================================================================
-- 7. READ MODEL — COBERTURA DEL REQUERIMIENTO
-- ===========================================================================

create view
mp25m_api.opportunity_requirement_coverage_evaluation_list
with (security_invoker = true)
as

select
  evaluation.id
    as coverage_evaluation_id,

  evaluation.requirement_revision_id,

  revision.requirement_id,
  requirement.opportunity_id,

  revision.revision_no,
  revision.name
    as requirement_name,

  revision.validation_status,

  requirement.record_status
    as requirement_record_status,

  not exists (
    select 1
    from mp25m.opportunity_requirement_revisions newer_revision
    where newer_revision.requirement_id =
        revision.requirement_id
      and newer_revision.revision_no >
        revision.revision_no
  ) as is_current_requirement_revision,

  evaluation.evaluation_no,
  evaluation.coverage_status,
  evaluation.rationale,

  evaluation.evaluated_by_internal_user_id,
  evaluator.display_name
    as evaluated_by_display_name,

  evaluation.evaluated_at,

  not exists (
    select 1
    from mp25m.opportunity_requirement_coverage_evaluations
      newer_evaluation
    where newer_evaluation.requirement_revision_id =
        evaluation.requirement_revision_id
      and newer_evaluation.evaluation_no >
        evaluation.evaluation_no
  ) as is_current_coverage_evaluation,

  (
    select count(*)::integer
    from
      mp25m.opportunity_requirement_coverage_evaluation_matches
        selected_match
    where selected_match.coverage_evaluation_id =
      evaluation.id
  ) as linked_match_assessment_count

from mp25m.opportunity_requirement_coverage_evaluations evaluation

join mp25m.opportunity_requirement_revisions revision
  on revision.id =
    evaluation.requirement_revision_id

join mp25m.opportunity_requirements requirement
  on requirement.id =
    revision.requirement_id

left join mp25m.internal_users evaluator
  on evaluator.id =
    evaluation.evaluated_by_internal_user_id
;


revoke all
on mp25m_api.opportunity_requirement_coverage_evaluation_list
from public, anon, authenticated, service_role;


grant select
on mp25m_api.opportunity_requirement_coverage_evaluation_list
to service_role;


comment on view
mp25m_api.opportunity_requirement_coverage_evaluation_list
is
  '7C read model for immutable human coverage conclusions over exact opportunity requirement revisions. Absence of a row means not yet evaluated.';


-- ===========================================================================
-- 8. READ MODEL — MATCHES UTILIZADOS PARA COBERTURA
-- ===========================================================================

create view
mp25m_api.opportunity_requirement_coverage_evaluation_match_list
with (security_invoker = true)
as

select
  link.coverage_evaluation_id,
  link.requirement_revision_id,

  coverage.evaluation_no
    as coverage_evaluation_no,

  coverage.coverage_status,

  link.match_assessment_id,
  assessment.assessment_no
    as match_assessment_no,

  assessment.assessment_kind,
  assessment.rationale
    as match_assessment_rationale,

  link.match_id,

  match.status
    as match_status,

  match.origin_kind
    as match_origin_kind,

  case
    when match.person_id is not null
      then 'person'
    when match.organization_id is not null
      then 'organization'
    else 'candidate'
  end::text
    as actor_kind,

  coalesce(
    match.person_id,
    match.organization_id,
    match.actor_candidate_id
  ) as actor_id,

  coalesce(
    person.display_name::text,
    organization.name::text,
    candidate.display_name::text
  ) as actor_display_name,

  link.linked_by_internal_user_id,
  linker.display_name
    as linked_by_display_name,

  link.linked_at

from
  mp25m.opportunity_requirement_coverage_evaluation_matches link

join mp25m.opportunity_requirement_coverage_evaluations coverage
  on coverage.id =
    link.coverage_evaluation_id

join mp25m.opportunity_requirement_match_assessments assessment
  on assessment.id =
    link.match_assessment_id

join mp25m.opportunity_requirement_matches match
  on match.id =
    link.match_id

left join mp25m.persons person
  on person.id =
    match.person_id

left join mp25m.organizations organization
  on organization.id =
    match.organization_id

left join mp25m.actor_candidates candidate
  on candidate.id =
    match.actor_candidate_id

left join mp25m.internal_users linker
  on linker.id =
    link.linked_by_internal_user_id
;


revoke all
on mp25m_api.opportunity_requirement_coverage_evaluation_match_list
from public, anon, authenticated, service_role;


grant select
on mp25m_api.opportunity_requirement_coverage_evaluation_match_list
to service_role;


comment on view
mp25m_api.opportunity_requirement_coverage_evaluation_match_list
is
  '7C read model showing which exact match assessment versions were used to justify one immutable requirement coverage evaluation.';


commit;