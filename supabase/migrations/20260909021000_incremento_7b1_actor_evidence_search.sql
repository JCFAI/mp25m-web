-- Incremento 7B.1
-- Evidencia reutilizable de actores y búsqueda read-only de coincidencias.
--
-- Principios:
-- - la taxonomía canónica estructura, pero no agota la trayectoria del actor;
-- - CV, experiencia, actividades, tareas, proyectos y otras evidencias
--   pueden justificar una coincidencia sin crear automáticamente skills/capacidades;
-- - buscar nunca materializa una coincidencia;
-- - toda sugerencia debe poder explicar qué dato fue observado y por qué importa;
-- - las revisiones 7A permanecen inmutables.

begin;


-- ===========================================================================
-- 1. PROFUNDIZAR RELACIONES ACTIVIDAD <-> HABILIDAD
-- ===========================================================================

alter table mp25m.activity_skill_suggestions
  add column relation_strength smallint,
  add column rationale text,
  add column provenance_kind text not null default 'system_suggestion',
  add column verification_status text not null default 'candidate',
  add column source_id uuid references mp25m.data_sources(id) on delete restrict,
  add column ingestion_record_id bigint references mp25m.ingestion_records(id) on delete restrict,
  add column created_by_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  add column reviewed_by_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  add column reviewed_at timestamptz,
  add column review_reason text,
  add column updated_at timestamptz not null default now();


alter table mp25m.activity_skill_suggestions
  add constraint activity_skill_suggestions_strength_check
    check (
      relation_strength is null
      or relation_strength between 1 and 5
    ),

  add constraint activity_skill_suggestions_rationale_check
    check (
      rationale is null
      or char_length(rationale) <= 5000
    ),

  add constraint activity_skill_suggestions_provenance_check
    check (
      provenance_kind in (
        'human_entry',
        'source_explicit',
        'system_suggestion'
      )
    ),

  add constraint activity_skill_suggestions_verification_check
    check (
      verification_status in (
        'candidate',
        'confirmed',
        'rejected'
      )
    ),

  add constraint activity_skill_suggestions_review_reason_check
    check (
      review_reason is null
      or char_length(review_reason) <= 2000
    ),

  add constraint activity_skill_suggestions_review_metadata_check
    check (
      (
        verification_status = 'candidate'
        and reviewed_by_internal_user_id is null
        and reviewed_at is null
        and review_reason is null
      )
      or
      (
        verification_status in ('confirmed', 'rejected')
        and reviewed_by_internal_user_id is not null
        and reviewed_at is not null
      )
    ),

  add constraint activity_skill_suggestions_confirmed_rationale_check
    check (
      verification_status <> 'confirmed'
      or (
        rationale is not null
        and char_length(btrim(rationale)) >= 3
      )
    ),

  add constraint activity_skill_suggestions_rejected_reason_check
    check (
      verification_status <> 'rejected'
      or (
        review_reason is not null
        and char_length(btrim(review_reason)) >= 3
      )
    );


create trigger trg_activity_skill_suggestions_updated_at
before update on mp25m.activity_skill_suggestions
for each row
execute function mp25m.set_updated_at();


comment on column
mp25m.activity_skill_suggestions.relation_strength
is
  'Semantic strength from 1 to 5 between an activity and a skill. It is not an actor/opportunity compatibility score.';


comment on column
mp25m.activity_skill_suggestions.verification_status
is
  'candidate relations do not influence governed 7B related matches; confirmed relations may participate. Existing legacy suggestions are deliberately backfilled as candidate.';


revoke all
on table mp25m.activity_skill_suggestions
from public, anon, authenticated, service_role;

grant select
on table mp25m.activity_skill_suggestions
to service_role;



-- ===========================================================================
-- 2. EVIDENCIA DEL ACTOR
-- ===========================================================================

create table mp25m.actor_evidence_fragments (
  id uuid primary key default gen_random_uuid(),

  person_id uuid
    references mp25m.persons(id)
    on delete restrict,

  organization_id uuid
    references mp25m.organizations(id)
    on delete restrict,

  actor_candidate_id uuid
    references mp25m.actor_candidates(id)
    on delete restrict,

  evidence_kind text not null,

  title text,
  observed_text text not null,

  occurred_from date,
  occurred_until date,

  source_id uuid
    references mp25m.data_sources(id)
    on delete restrict,

  ingestion_record_id bigint
    references mp25m.ingestion_records(id)
    on delete restrict,

  source_locator text,

  provenance_kind text not null,
  verification_status text not null default 'candidate',

  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  reviewed_by_internal_user_id uuid
    references mp25m.internal_users(id)
    on delete restrict,

  reviewed_at timestamptz,
  review_reason text,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint actor_evidence_fragments_actor_check
    check (
      num_nonnulls(
        person_id,
        organization_id,
        actor_candidate_id
      ) = 1
    ),

  constraint actor_evidence_fragments_kind_check
    check (
      evidence_kind in (
        'profile_activity',
        'profession',
        'experience',
        'cv',
        'activity_description',
        'task',
        'project',
        'product_service',
        'certification',
        'technology',
        'sector_experience',
        'source_excerpt',
        'other'
      )
    ),

  constraint actor_evidence_fragments_title_check
    check (
      title is null
      or char_length(btrim(title)) between 2 and 300
    ),

  constraint actor_evidence_fragments_text_check
    check (
      char_length(btrim(observed_text))
      between 3 and 20000
    ),

  constraint actor_evidence_fragments_dates_check
    check (
      occurred_until is null
      or occurred_from is null
      or occurred_until >= occurred_from
    ),

  constraint actor_evidence_fragments_locator_check
    check (
      source_locator is null
      or char_length(source_locator) <= 2000
    ),

  constraint actor_evidence_fragments_provenance_check
    check (
      provenance_kind in (
        'human_entry',
        'self_reported',
        'source_explicit',
        'system_extraction'
      )
    ),

  constraint actor_evidence_fragments_verification_check
    check (
      verification_status in (
        'candidate',
        'self_reported',
        'confirmed',
        'rejected'
      )
    ),

  constraint actor_evidence_fragments_review_reason_check
    check (
      review_reason is null
      or char_length(review_reason) <= 2000
    ),

  constraint actor_evidence_fragments_review_metadata_check
    check (
      (
        verification_status in (
          'candidate',
          'self_reported'
        )
        and reviewed_by_internal_user_id is null
        and reviewed_at is null
        and review_reason is null
      )
      or
      (
        verification_status in (
          'confirmed',
          'rejected'
        )
        and reviewed_by_internal_user_id is not null
        and reviewed_at is not null
      )
    ),

  constraint actor_evidence_fragments_rejected_reason_check
    check (
      verification_status <> 'rejected'
      or (
        review_reason is not null
        and char_length(btrim(review_reason)) >= 3
      )
    )
);


create index actor_evidence_fragments_person_idx
  on mp25m.actor_evidence_fragments(
    person_id,
    active,
    verification_status
  )
  where person_id is not null;


create index actor_evidence_fragments_organization_idx
  on mp25m.actor_evidence_fragments(
    organization_id,
    active,
    verification_status
  )
  where organization_id is not null;


create index actor_evidence_fragments_candidate_idx
  on mp25m.actor_evidence_fragments(
    actor_candidate_id,
    active,
    verification_status
  )
  where actor_candidate_id is not null;


create index actor_evidence_fragments_source_idx
  on mp25m.actor_evidence_fragments(
    source_id,
    ingestion_record_id
  );


create function mp25m.guard_actor_evidence_fragment_semantics()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if new.id is distinct from old.id
    or new.person_id is distinct from old.person_id
    or new.organization_id is distinct from old.organization_id
    or new.actor_candidate_id is distinct from old.actor_candidate_id
    or new.evidence_kind is distinct from old.evidence_kind
    or new.title is distinct from old.title
    or new.observed_text is distinct from old.observed_text
    or new.occurred_from is distinct from old.occurred_from
    or new.occurred_until is distinct from old.occurred_until
    or new.source_id is distinct from old.source_id
    or new.ingestion_record_id is distinct from old.ingestion_record_id
    or new.source_locator is distinct from old.source_locator
    or new.provenance_kind is distinct from old.provenance_kind
    or new.created_by_internal_user_id
       is distinct from old.created_by_internal_user_id
    or new.created_at is distinct from old.created_at
  then
    raise exception
      'Actor evidence semantic content is immutable; create a new fragment'
      using errcode = '23514';
  end if;

  -- Solo estado de revisión, lifecycle y updated_at
  -- quedan disponibles para futuras RPC gobernadas.
  return new;
end;
$function$;


revoke all
on function mp25m.guard_actor_evidence_fragment_semantics()
from public, anon, authenticated, service_role;


create trigger trg_actor_evidence_fragments_semantic_guard
before update on mp25m.actor_evidence_fragments
for each row
execute function mp25m.guard_actor_evidence_fragment_semantics();


create trigger trg_actor_evidence_fragments_updated_at
before update on mp25m.actor_evidence_fragments
for each row
execute function mp25m.set_updated_at();


alter table mp25m.actor_evidence_fragments
enable row level security;


revoke all
on table mp25m.actor_evidence_fragments
from public, anon, authenticated, service_role;

-- 7B.1 es deliberadamente read-only para esta tabla desde aplicación.
-- La gobernanza de creación/revisión se habilitará mediante RPC posteriores.
grant select
on table mp25m.actor_evidence_fragments
to service_role;


comment on table mp25m.actor_evidence_fragments
is
  'Reusable productive evidence about a person, organization or unresolved actor candidate. A fragment records what is actually known/observed and does not automatically create a canonical skill or capability.';


comment on column mp25m.actor_evidence_fragments.observed_text
is
  'Observed/source-supported fact. Interpretations about opportunity relevance belong to future match foundations, not here.';



-- ===========================================================================
-- 3. READ MODEL UNIFICADO DE EVIDENCIA BUSCABLE
-- ===========================================================================

create view mp25m_api.actor_search_evidence
with (security_invoker = true)
as

-- ---------------------------------------------------------------------------
-- Persona: habilidad/capacidad estructurada
-- ---------------------------------------------------------------------------

select
  'person'::text as actor_kind,
  person.id as actor_id,
  person.display_name::text as actor_display_name,

  ('person_skill:' || person_skill.id::text) as evidence_key,
  'person_skill'::text as evidence_kind,

  skill.id as skill_id,
  skill.name::text as skill_name,

  null::uuid as activity_id,
  null::text as activity_name,

  concat_ws(
    E'\n',
    ('Habilidad/capacidad: ' || skill.name::text),
    nullif(btrim(person_skill.notes), ''),
    nullif(btrim(person_skill.experience_notes), '')
  )::text as evidence_text,

  person_skill.verification_status::text
    as verification_status,

  jsonb_strip_nulls(
    jsonb_build_object(
      'proficiency_level',
        person_skill.proficiency_level,
      'experience_range',
        person_skill.experience_range,
      'last_self_reported_at',
        person_skill.last_self_reported_at
    )
  ) as evidence_attributes,

  null::uuid as node_id,
  null::text as node_name,

  null::uuid as source_id,
  null::text as source_name,
  null::bigint as ingestion_record_id,

  null::text as source_locator,

  concat_ws(
    E'\n',
    nullif(btrim(person_skill.notes), ''),
    nullif(btrim(person_skill.experience_notes), '')
  )::text as source_excerpt,

  'person_skill'::text as source_record_type,
  person_skill.id::text as source_record_id,
  person_skill.updated_at as source_updated_at

from mp25m.person_skills person_skill

join mp25m.persons person
  on person.id = person_skill.person_id

join mp25m.skills skill
  on skill.id = person_skill.skill_id

where person.record_status = 'active'
  and person_skill.active = true
  and person_skill.verification_status <> 'rejected'
  and skill.active = true


union all


-- ---------------------------------------------------------------------------
-- Persona: evidencia detallada de una habilidad
-- ---------------------------------------------------------------------------

select
  'person'::text,
  person.id,
  person.display_name::text,

  ('person_skill_evidence:' || evidence.id::text),
  'person_skill_evidence'::text,

  skill.id,
  skill.name::text,

  null::uuid,
  null::text,

  evidence.evidence_text::text,

  person_skill.verification_status::text,

  jsonb_strip_nulls(
    jsonb_build_object(
      'confidence',
        evidence.confidence,
      'evidence_type',
        evidence.evidence_type,
      'proficiency_level',
        person_skill.proficiency_level,
      'experience_range',
        person_skill.experience_range
    )
  ),

  null::uuid,
  null::text,

  ingestion.source_id,
  source.name::text,
  evidence.ingestion_record_id,

  case
    when evidence.ingestion_record_id is not null
      then 'Registro de ingesta '
        || evidence.ingestion_record_id::text
    else null
  end,

  evidence.evidence_text::text,

  'person_skill_evidence'::text,
  evidence.id::text,

  greatest(
    evidence.created_at,
    person_skill.updated_at
  )

from mp25m.person_skill_evidence evidence

join mp25m.person_skills person_skill
  on person_skill.id = evidence.person_skill_id

join mp25m.persons person
  on person.id = person_skill.person_id

join mp25m.skills skill
  on skill.id = person_skill.skill_id

left join mp25m.ingestion_records ingestion
  on ingestion.id = evidence.ingestion_record_id

left join mp25m.data_sources source
  on source.id = ingestion.source_id

where person.record_status = 'active'
  and person_skill.active = true
  and person_skill.verification_status <> 'rejected'
  and skill.active = true


union all


-- ---------------------------------------------------------------------------
-- Persona: trayectoria descriptiva actual del perfil
-- ---------------------------------------------------------------------------

select
  'person'::text,
  person.id,
  person.display_name::text,

  (
    'person_profile:'
    || person.id::text
    || ':'
    || profile_evidence.evidence_kind
  ),

  profile_evidence.evidence_kind,

  null::uuid,
  null::text,

  null::uuid,
  null::text,

  profile_evidence.evidence_text,

  null::text,

  '{}'::jsonb,

  null::uuid,
  null::text,

  null::uuid,
  null::text,
  null::bigint,

  profile_evidence.source_locator,

  profile_evidence.evidence_text,

  'person_profile'::text,

  (
    person.id::text
    || ':'
    || profile_evidence.evidence_kind
  ),

  person.updated_at

from mp25m.persons person

cross join lateral (
  values
    (
      'person_profile_activity'::text,
      nullif(btrim(person.primary_activity_text), ''),
      'Perfil / Actividad principal'::text
    ),
    (
      'person_profession'::text,
      nullif(btrim(person.profession_text), ''),
      'Perfil / Profesión'::text
    ),
    (
      'person_experience'::text,
      nullif(btrim(person.experience_text), ''),
      'Perfil / Experiencia'::text
    )
) as profile_evidence(
  evidence_kind,
  evidence_text,
  source_locator
)

where person.record_status = 'active'
  and profile_evidence.evidence_text is not null


union all


-- ---------------------------------------------------------------------------
-- Organización: capacidad estructurada
-- ---------------------------------------------------------------------------

select
  'organization'::text,
  organization.id,
  organization.name::text,

  (
    'organization_capability:'
    || capability.id::text
  ),

  'organization_capability'::text,

  skill.id,
  skill.name::text,

  null::uuid,
  null::text,

  concat_ws(
    E'\n',
    ('Capacidad: ' || skill.name::text),
    nullif(btrim(capability.notes), '')
  )::text,

  capability.verification_status::text,

  jsonb_strip_nulls(
    jsonb_build_object(
      'last_self_reported_at',
        capability.last_self_reported_at
    )
  ),

  capability.node_id,
  node.name::text,

  coalesce(
    capability.source_id,
    ingestion.source_id
  ),

  source.name::text,

  capability.ingestion_record_id,

  case
    when capability.ingestion_record_id is not null
      then 'Registro de ingesta '
        || capability.ingestion_record_id::text
    else null
  end,

  capability.notes::text,

  'organization_capability'::text,
  capability.id::text,
  capability.updated_at

from mp25m.organization_capabilities capability

join mp25m.organizations organization
  on organization.id = capability.organization_id

join mp25m.skills skill
  on skill.id = capability.skill_id

left join mp25m.nodes node
  on node.id = capability.node_id

left join mp25m.ingestion_records ingestion
  on ingestion.id = capability.ingestion_record_id

left join mp25m.data_sources source
  on source.id = coalesce(
    capability.source_id,
    ingestion.source_id
  )

where organization.record_status = 'active'
  and capability.active = true
  and capability.verification_status <> 'rejected'
  and skill.active = true


union all


-- ---------------------------------------------------------------------------
-- Organización: evidencia de una capacidad
-- ---------------------------------------------------------------------------

select
  'organization'::text,
  organization.id,
  organization.name::text,

  (
    'organization_capability_evidence:'
    || evidence.id::text
  ),

  'organization_capability_evidence'::text,

  skill.id,
  skill.name::text,

  null::uuid,
  null::text,

  evidence.evidence_text::text,

  capability.verification_status::text,

  jsonb_strip_nulls(
    jsonb_build_object(
      'confidence',
        evidence.confidence,
      'evidence_type',
        evidence.evidence_type
    )
  ),

  capability.node_id,
  node.name::text,

  coalesce(
    evidence.source_id,
    capability.source_id,
    ingestion.source_id
  ),

  source.name::text,

  coalesce(
    evidence.ingestion_record_id,
    capability.ingestion_record_id
  ),

  case
    when coalesce(
      evidence.ingestion_record_id,
      capability.ingestion_record_id
    ) is not null
      then 'Registro de ingesta '
        || coalesce(
          evidence.ingestion_record_id,
          capability.ingestion_record_id
        )::text
    else null
  end,

  evidence.evidence_text::text,

  'organization_capability_evidence'::text,
  evidence.id::text,

  greatest(
    evidence.created_at,
    capability.updated_at
  )

from mp25m.organization_capability_evidence evidence

join mp25m.organization_capabilities capability
  on capability.id =
    evidence.organization_capability_id

join mp25m.organizations organization
  on organization.id = capability.organization_id

join mp25m.skills skill
  on skill.id = capability.skill_id

left join mp25m.nodes node
  on node.id = capability.node_id

left join mp25m.ingestion_records ingestion
  on ingestion.id = coalesce(
    evidence.ingestion_record_id,
    capability.ingestion_record_id
  )

left join mp25m.data_sources source
  on source.id = coalesce(
    evidence.source_id,
    capability.source_id,
    ingestion.source_id
  )

where organization.record_status = 'active'
  and capability.active = true
  and capability.verification_status <> 'rejected'
  and skill.active = true


union all


-- ---------------------------------------------------------------------------
-- Organización: actividad registrada
-- ---------------------------------------------------------------------------

select
  'organization'::text,
  organization.id,
  organization.name::text,

  (
    'organization_activity:'
    || organization_activity.id::text
  ),

  'organization_activity'::text,

  null::uuid,
  null::text,

  activity.id,
  activity.name::text,

  concat_ws(
    E'\n',
    ('Actividad: ' || activity.name::text),
    nullif(btrim(organization_activity.notes), '')
  )::text,

  organization_activity.verification_status::text,

  '{}'::jsonb,

  null::uuid,
  null::text,

  null::uuid,
  null::text,
  null::bigint,

  null::text,
  organization_activity.notes::text,

  'organization_activity'::text,
  organization_activity.id::text,
  organization_activity.updated_at

from mp25m.organization_activities organization_activity

join mp25m.organizations organization
  on organization.id =
    organization_activity.organization_id

join mp25m.activities activity
  on activity.id = organization_activity.activity_id

where organization.record_status = 'active'
  and organization_activity.active = true
  and organization_activity.verification_status <> 'rejected'
  and activity.active = true


union all


-- ---------------------------------------------------------------------------
-- Evidencia reusable explícita: CV, experiencia, tareas, proyectos, etc.
-- ---------------------------------------------------------------------------

select
  case
    when fragment.person_id is not null
      then 'person'
    when fragment.organization_id is not null
      then 'organization'
    else 'candidate'
  end::text,

  coalesce(
    fragment.person_id,
    fragment.organization_id,
    fragment.actor_candidate_id
  ),

  coalesce(
    person.display_name::text,
    organization.name::text,
    candidate.display_name::text
  ),

  (
    'actor_evidence_fragment:'
    || fragment.id::text
  ),

  'actor_evidence_fragment'::text,

  null::uuid,
  null::text,

  null::uuid,
  null::text,

  concat_ws(
    E'\n',
    nullif(btrim(fragment.title), ''),
    fragment.observed_text
  )::text,

  fragment.verification_status::text,

  jsonb_strip_nulls(
    jsonb_build_object(
      'fragment_kind',
        fragment.evidence_kind,
      'title',
        fragment.title,
      'provenance_kind',
        fragment.provenance_kind,
      'occurred_from',
        fragment.occurred_from,
      'occurred_until',
        fragment.occurred_until
    )
  ),

  null::uuid,
  null::text,

  coalesce(
    fragment.source_id,
    ingestion.source_id
  ),

  source.name::text,

  fragment.ingestion_record_id,

  fragment.source_locator,

  fragment.observed_text,

  'actor_evidence_fragment'::text,
  fragment.id::text,
  fragment.updated_at

from mp25m.actor_evidence_fragments fragment

left join mp25m.persons person
  on person.id = fragment.person_id

left join mp25m.organizations organization
  on organization.id = fragment.organization_id

left join mp25m.actor_candidates candidate
  on candidate.id = fragment.actor_candidate_id

left join mp25m.ingestion_records ingestion
  on ingestion.id = fragment.ingestion_record_id

left join mp25m.data_sources source
  on source.id = coalesce(
    fragment.source_id,
    ingestion.source_id
  )

where fragment.active = true
  and fragment.verification_status <> 'rejected'

  and (
    (
      fragment.person_id is not null
      and person.record_status = 'active'
    )
    or
    (
      fragment.organization_id is not null
      and organization.record_status = 'active'
    )
    or
    (
      fragment.actor_candidate_id is not null
      and candidate.status in (
        'pending',
        'approved'
      )
      and candidate.resolved_person_id is null
      and candidate.resolved_organization_id is null
    )
  )


union all


-- ---------------------------------------------------------------------------
-- Candidato todavía no resuelto: contexto textual existente
-- ---------------------------------------------------------------------------

select
  'candidate'::text,
  candidate.id,
  candidate.display_name::text,

  (
    'candidate_context:'
    || candidate.id::text
  ),

  'candidate_context'::text,

  null::uuid,
  null::text,

  null::uuid,
  null::text,

  candidate.context_text::text,

  'candidate'::text,

  jsonb_build_object(
    'candidate_kind',
    candidate.actor_kind
  ),

  null::uuid,
  null::text,

  null::uuid,
  null::text,
  null::bigint,

  'Contexto del candidato'::text,
  candidate.context_text::text,

  'actor_candidate'::text,
  candidate.id::text,
  candidate.updated_at

from mp25m.actor_candidates candidate

where candidate.status in (
    'pending',
    'approved'
  )
  and candidate.resolved_person_id is null
  and candidate.resolved_organization_id is null
  and nullif(
    btrim(candidate.context_text),
    ''
  ) is not null


union all


-- ---------------------------------------------------------------------------
-- Contexto territorial de personas
-- ---------------------------------------------------------------------------

select
  'person'::text,
  person.id,
  person.display_name::text,

  (
    'person_node:'
    || participation.id::text
  ),

  'territorial_context'::text,

  null::uuid,
  null::text,

  null::uuid,
  null::text,

  (
    'Vínculo territorial con nodo: '
    || node.name::text
  ),

  participation.verification_status::text,

  '{}'::jsonb,

  node.id,
  node.name::text,

  null::uuid,
  null::text,
  null::bigint,

  null::text,
  null::text,

  'node_participation'::text,
  participation.id::text,
  participation.updated_at

from mp25m.node_participations participation

join mp25m.persons person
  on person.id = participation.person_id

join mp25m.nodes node
  on node.id = participation.node_id

where person.record_status = 'active'
  and participation.status = 'active'
  and participation.verification_status <> 'rejected'


union all


-- ---------------------------------------------------------------------------
-- Contexto territorial de organizaciones
-- ---------------------------------------------------------------------------

select
  'organization'::text,
  organization.id,
  organization.name::text,

  (
    'organization_node:'
    || organization.id::text
    || ':'
    || node.id::text
  ),

  'territorial_context'::text,

  null::uuid,
  null::text,

  null::uuid,
  null::text,

  (
    'Vínculo territorial con nodo: '
    || node.name::text
  ),

  organization_node.verification_status::text,

  '{}'::jsonb,

  node.id,
  node.name::text,

  organization_node.source_id,
  source.name::text,
  organization_node.ingestion_record_id,

  null::text,
  organization_node.evidence_text::text,

  'organization_node'::text,

  (
    organization.id::text
    || ':'
    || node.id::text
  ),

  organization_node.updated_at

from mp25m.organization_nodes organization_node

join mp25m.organizations organization
  on organization.id =
    organization_node.organization_id

join mp25m.nodes node
  on node.id = organization_node.node_id

left join mp25m.data_sources source
  on source.id = organization_node.source_id

where organization.record_status = 'active'
  and organization_node.active = true
  and organization_node.verification_status <> 'rejected'


union all


-- ---------------------------------------------------------------------------
-- Contexto territorial de candidatos
-- ---------------------------------------------------------------------------

select
  'candidate'::text,
  candidate.id,
  candidate.display_name::text,

  (
    'candidate_node:'
    || candidate.id::text
    || ':'
    || node.id::text
  ),

  'territorial_context'::text,

  null::uuid,
  null::text,

  null::uuid,
  null::text,

  (
    'Vínculo territorial con nodo: '
    || node.name::text
  ),

  'candidate'::text,

  jsonb_build_object(
    'candidate_kind',
    candidate.actor_kind
  ),

  node.id,
  node.name::text,

  null::uuid,
  null::text,
  null::bigint,

  null::text,
  null::text,

  'actor_candidate_node'::text,

  (
    candidate.id::text
    || ':'
    || node.id::text
  ),

  candidate.updated_at

from mp25m.actor_candidate_nodes candidate_node

join mp25m.actor_candidates candidate
  on candidate.id =
    candidate_node.actor_candidate_id

join mp25m.nodes node
  on node.id = candidate_node.node_id

where candidate.status in (
    'pending',
    'approved'
  )
  and candidate.resolved_person_id is null
  and candidate.resolved_organization_id is null
;


revoke all
on mp25m_api.actor_search_evidence
from public, anon, authenticated, service_role;

grant select
on mp25m_api.actor_search_evidence
to service_role;


comment on view mp25m_api.actor_search_evidence
is
  'Unified server-only search evidence for persons, organizations and unresolved candidates. Canonical skills/activities and descriptive trajectory coexist as parallel evidence sources. Private contact fields are deliberately excluded.';



-- ===========================================================================
-- 4. AUTORIZACIÓN DE 7B
-- ===========================================================================

create function
mp25m_api.can_operate_opportunity_requirement_match(
  p_actor_internal_user_id uuid,
  p_opportunity_id uuid,
  p_operation text
)
returns boolean
language sql
stable
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
  select
    p_operation in (
      'search',
      'decide',
      'manual',
      'reconsider',
      'foundation'
    )

    and exists (
      select 1
      from mp25m.internal_users internal_user
      where internal_user.id =
          p_actor_internal_user_id
        and internal_user.status = 'active'
        and internal_user.deleted_at is null
    )

    and exists (
      select 1
      from mp25m.opportunities opportunity
      where opportunity.id = p_opportunity_id
    )

    and (
      -- El responsable explícito puede analizar su oportunidad.
      exists (
        select 1
        from mp25m.opportunities opportunity
        where opportunity.id = p_opportunity_id
          and opportunity.assigned_to_internal_user_id =
            p_actor_internal_user_id
      )

      or

      exists (
        select 1

        from mp25m.access_role_assignments assignment

        join mp25m.access_roles role
          on role.code =
            assignment.access_role_code

        join mp25m.access_scopes scope
          on scope.id =
            assignment.access_scope_id

        where assignment.internal_user_id =
            p_actor_internal_user_id

          and assignment.status = 'active'
          and assignment.revoked_at is null
          and assignment.valid_from <= now()

          and (
            assignment.valid_until is null
            or assignment.valid_until > now()
          )

          and role.is_active = true
          and role.deleted_at is null

          and scope.is_active = true
          and scope.deleted_at is null

          and (
            -- Administración conserva autoridad administrativa.
            role.is_administrative = true

            or

            (
              (
                role.code in (
                  'validator',
                  'articulator'
                )

                or (
                  p_operation = 'search'
                  and role.code in (
                    'authority_analyst',
                    'node_referent'
                  )
                )
              )

              and (
                scope.scope_type = 'global'

                or (
                  scope.scope_type = 'node'

                  and exists (
                    select 1
                    from mp25m.opportunity_nodes opportunity_node
                    where opportunity_node.opportunity_id =
                        p_opportunity_id
                      and opportunity_node.node_id =
                        scope.scope_entity_id
                  )
                )
              )
            )
          )
      )
    );
$function$;


revoke all
on function
mp25m_api.can_operate_opportunity_requirement_match(
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;

grant execute
on function
mp25m_api.can_operate_opportunity_requirement_match(
  uuid,
  uuid,
  text
)
to service_role;



-- ===========================================================================
-- 5. MOTOR INTERNO DE FUNDAMENTOS EXPLICABLES
-- ===========================================================================

create function
mp25m_api.opportunity_requirement_match_candidate_foundations(
  p_requirement_revision_id uuid
)
returns table (
  actor_kind text,
  actor_id uuid,
  actor_display_name text,

  foundation_kind text,
  relation_kind text,

  observed_text text,
  inference_text text,

  verification_status text,
  evidence_attributes jsonb,

  node_id uuid,

  source_id uuid,
  source_name text,
  ingestion_record_id bigint,

  source_locator text,
  source_excerpt text,

  source_record_type text,
  source_record_id text,
  source_updated_at timestamptz,

  search_rule_code text,
  search_rule_version integer,

  relation_rank integer,
  verification_rank integer
)
language sql
stable
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api,
  extensions
as $function$

with requirement_context as (
  select
    revision.id as revision_id,
    requirement.opportunity_id,

    revision.skill_id,
    skill.name::text as skill_name,

    revision.activity_id,
    activity.name::text as activity_name,

    lower(
      extensions.unaccent(
        coalesce(
          revision.name,
          ''
        )
      )
    ) as requirement_name_norm,

    lower(
      extensions.unaccent(
        coalesce(
          revision.description,
          ''
        )
      )
    ) as requirement_description_norm,

    lower(
      extensions.unaccent(
        coalesce(
          revision.satisfaction_criteria,
          ''
        )
      )
    ) as requirement_criteria_norm

  from mp25m.opportunity_requirement_revisions revision

  join mp25m.opportunity_requirements requirement
    on requirement.id =
      revision.requirement_id

  left join mp25m.skills skill
    on skill.id =
      revision.skill_id

  left join mp25m.activities activity
    on activity.id =
      revision.activity_id

  where revision.id =
    p_requirement_revision_id
),

signals as (
  select
    evidence.*,
    requirement_context.opportunity_id,
    requirement_context.skill_id
      as required_skill_id,
    requirement_context.skill_name
      as required_skill_name,

    requirement_context.activity_id
      as required_activity_id,
    requirement_context.activity_name
      as required_activity_name,

    (
      requirement_context.skill_id is not null
      and evidence.skill_id =
        requirement_context.skill_id
    ) as exact_skill,

    (
      requirement_context.activity_id is not null
      and evidence.activity_id =
        requirement_context.activity_id
    ) as exact_activity,

    (
      (
        requirement_context.activity_id is not null
        and evidence.skill_id is not null

        and exists (
          select 1
          from mp25m.activity_skill_suggestions relation
          where relation.activity_id =
              requirement_context.activity_id
            and relation.skill_id =
              evidence.skill_id
            and relation.active = true
            and relation.verification_status =
              'confirmed'
        )
      )

      or

      (
        requirement_context.skill_id is not null
        and evidence.activity_id is not null

        and exists (
          select 1
          from mp25m.activity_skill_suggestions relation
          where relation.activity_id =
              evidence.activity_id
            and relation.skill_id =
              requirement_context.skill_id
            and relation.active = true
            and relation.verification_status =
              'confirmed'
        )
      )
    ) as activity_skill_related,

    (
      requirement_context.skill_id is not null

      and (
        (
          requirement_context.skill_name is not null
          and char_length(
            btrim(
              requirement_context.skill_name
            )
          ) >= 3

          and lower(
            extensions.unaccent(
              evidence.evidence_text
            )
          ) like
            (
              '%'
              || lower(
                extensions.unaccent(
                  requirement_context.skill_name
                )
              )
              || '%'
            )
        )

        or

        exists (
          select 1
          from mp25m.skill_aliases alias
          where alias.skill_id =
              requirement_context.skill_id

            and char_length(
              btrim(alias.alias)
            ) >= 3

            and lower(
              extensions.unaccent(
                evidence.evidence_text
              )
            ) like
              (
                '%'
                || lower(
                  extensions.unaccent(
                    alias.alias
                  )
                )
                || '%'
              )
        )
      )
    ) as skill_term_related,

    (
      requirement_context.activity_id is not null
      and requirement_context.activity_name
        is not null

      and char_length(
        btrim(
          requirement_context.activity_name
        )
      ) >= 3

      and lower(
        extensions.unaccent(
          evidence.evidence_text
        )
      ) like
        (
          '%'
          || lower(
            extensions.unaccent(
              requirement_context.activity_name
            )
          )
          || '%'
        )
    ) as activity_term_related,

    greatest(
      case
        when char_length(
          requirement_context.requirement_name_norm
        ) >= 3
        then extensions.word_similarity(
          requirement_context.requirement_name_norm,
          lower(
            extensions.unaccent(
              evidence.evidence_text
            )
          )
        )
        else 0
      end,

      case
        when char_length(
          requirement_context.requirement_description_norm
        ) >= 3
        then extensions.word_similarity(
          requirement_context.requirement_description_norm,
          lower(
            extensions.unaccent(
              evidence.evidence_text
            )
          )
        )
        else 0
      end,

      case
        when char_length(
          requirement_context.requirement_criteria_norm
        ) >= 3
        then extensions.word_similarity(
          requirement_context.requirement_criteria_norm,
          lower(
            extensions.unaccent(
              evidence.evidence_text
            )
          )
        )
        else 0
      end
    ) as lexical_similarity,

    (
      evidence.node_id is not null

      and exists (
        select 1
        from mp25m.opportunity_nodes opportunity_node
        where opportunity_node.opportunity_id =
            requirement_context.opportunity_id
          and opportunity_node.node_id =
            evidence.node_id
      )
    ) as territorial_context

  from mp25m_api.actor_search_evidence evidence

  cross join requirement_context
),

classified as (
  select
    signals.*,

    case
      when exact_skill
        or exact_activity
      then 'direct'

      when activity_skill_related
        or skill_term_related
        or activity_term_related
      then 'related'

      when territorial_context
        or lexical_similarity >= 0.45
      then 'contextual'

      else null
    end::text as classified_relation_kind,

    case
      when exact_skill
      then 'skill_exact_v1'

      when exact_activity
      then 'activity_exact_v1'

      when activity_skill_related
      then 'activity_skill_confirmed_v1'

      when skill_term_related
      then 'evidence_skill_term_v1'

      when activity_term_related
      then 'evidence_activity_term_v1'

      when territorial_context
      then 'territory_context_v1'

      when lexical_similarity >= 0.45
      then 'evidence_lexical_v1'

      else null
    end::text as classified_search_rule

  from signals
)

select
  classified.actor_kind,
  classified.actor_id,
  classified.actor_display_name,

  case
    when classified.evidence_kind in (
      'person_profile_activity',
      'person_profession',
      'person_experience'
    )
    then 'person_profile_text'

    else classified.evidence_kind
  end as foundation_kind,

  classified.classified_relation_kind
    as relation_kind,

  left(
    classified.evidence_text,
    4000
  ) as observed_text,

  case
    when classified.exact_skill
    then
      'La evidencia referencia exactamente la habilidad o capacidad canónica requerida.'

    when classified.exact_activity
    then
      'La evidencia referencia exactamente la actividad canónica requerida.'

    when classified.activity_skill_related
    then
      'La habilidad o actividad del actor está vinculada con el requerimiento mediante una relación actividad-habilidad confirmada.'

    when classified.skill_term_related
    then
      'La evidencia descriptiva contiene una denominación o alias de la habilidad canónica requerida.'

    when classified.activity_term_related
    then
      'La evidencia descriptiva menciona la actividad canónica requerida.'

    when classified.territorial_context
    then
      'El actor posee un vínculo territorial con un nodo asociado a la oportunidad. Esto aporta contexto y no prueba capacidad.'

    else
      'La evidencia presenta similitud textual relevante con el requerimiento y merece revisión humana; no prueba por sí sola capacidad ni cobertura.'
  end::text as inference_text,

  classified.verification_status,
  classified.evidence_attributes,

  classified.node_id,

  classified.source_id,
  classified.source_name,
  classified.ingestion_record_id,

  classified.source_locator,

  left(
    coalesce(
      classified.source_excerpt,
      classified.evidence_text
    ),
    4000
  ) as source_excerpt,

  classified.source_record_type,
  classified.source_record_id,
  classified.source_updated_at,

  classified.classified_search_rule,
  1::integer as search_rule_version,

  case classified.classified_relation_kind
    when 'direct' then 1
    when 'related' then 2
    when 'contextual' then 3
    else 99
  end::integer as relation_rank,

  case classified.verification_status
    when 'confirmed' then 1
    when 'self_reported' then 2
    when 'candidate' then 3
    when 'pending' then 4
    else 5
  end::integer as verification_rank

from classified

where classified.classified_relation_kind
  is not null;

$function$;


revoke all
on function
mp25m_api.opportunity_requirement_match_candidate_foundations(
  uuid
)
from public, anon, authenticated, service_role;

grant execute
on function
mp25m_api.opportunity_requirement_match_candidate_foundations(
  uuid
)
to service_role;


comment on function
mp25m_api.opportunity_requirement_match_candidate_foundations(
  uuid
)
is
  'Internal 7B.1 deterministic evidence classifier. Direct means canonical equality; related means a governed semantic/textual relation; contextual means weaker textual or territorial relevance. It never asserts coverage.';



-- ===========================================================================
-- 6. RPC READ-ONLY DE BÚSQUEDA
-- ===========================================================================

create function
mp25m_api.search_opportunity_requirement_match_candidates(
  p_actor_internal_user_id uuid,
  p_requirement_revision_id uuid,
  p_actor_kind text default null,
  p_include_contextual boolean default true,
  p_limit integer default 50
)
returns table (
  actor_kind text,
  actor_id uuid,
  actor_display_name text,

  strongest_relation_kind text,
  foundation_count integer,

  verification_summary jsonb,
  territorially_related boolean,

  search_mode text,
  persistence_allowed boolean,

  existing_match_id uuid,
  existing_match_status text,

  foundations jsonb
)
language plpgsql
stable
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api,
  extensions
as $function$
declare
  v_opportunity_id uuid;
  v_requirement_id uuid;
  v_revision_no integer;
  v_record_status text;
  v_validation_status text;
begin

  if p_actor_kind is not null
     and p_actor_kind not in (
       'person',
       'organization',
       'candidate'
     )
  then
    raise exception
      'Invalid actor kind'
      using errcode = '22023';
  end if;


  if p_limit is null
     or p_limit < 1
     or p_limit > 100
  then
    raise exception
      'Search limit must be between 1 and 100'
      using errcode = '22023';
  end if;


  select
    requirement.opportunity_id,
    requirement.id,
    revision.revision_no,
    requirement.record_status,
    revision.validation_status

  into
    v_opportunity_id,
    v_requirement_id,
    v_revision_no,
    v_record_status,
    v_validation_status

  from mp25m.opportunity_requirement_revisions revision

  join mp25m.opportunity_requirements requirement
    on requirement.id =
      revision.requirement_id

  where revision.id =
    p_requirement_revision_id;


  if not found then
    raise exception
      'Opportunity requirement revision not found'
      using errcode = 'P0002';
  end if;


  if v_record_status <> 'active' then
    raise exception
      'Only active opportunity requirements may be searched'
      using errcode = '22023';
  end if;


  if exists (
    select 1
    from mp25m.opportunity_requirement_revisions newer_revision
    where newer_revision.requirement_id =
        v_requirement_id
      and newer_revision.revision_no >
        v_revision_no
  ) then
    raise exception
      'Only the current opportunity requirement revision may be searched'
      using errcode = '22023';
  end if;


  if v_validation_status not in (
    'declared',
    'pending',
    'validated'
  ) then
    raise exception
      'Rejected opportunity requirement revisions cannot be searched'
      using errcode = '22023';
  end if;


  if not
    mp25m_api.can_operate_opportunity_requirement_match(
      p_actor_internal_user_id,
      v_opportunity_id,
      'search'
    )
  then
    raise exception
      'Internal user cannot search opportunity requirement matches'
      using errcode = '42501';
  end if;


  return query

  with raw_foundations as (
    select
      foundation.*
    from
      mp25m_api.opportunity_requirement_match_candidate_foundations(
        p_requirement_revision_id
      ) as foundation
    where p_actor_kind is null
       or foundation.actor_kind = p_actor_kind
  ),

  ranked_foundations as (
    select
      raw_foundations.*,

      row_number() over (
        partition by
          raw_foundations.actor_kind,
          raw_foundations.actor_id

        order by
          raw_foundations.relation_rank,
          raw_foundations.verification_rank,
          raw_foundations.source_updated_at desc nulls last,
          raw_foundations.source_record_type,
          raw_foundations.source_record_id
      ) as foundation_order

    from raw_foundations
  ),

  actor_summary as (
    select
      ranked_foundations.actor_kind,
      ranked_foundations.actor_id,

      max(
        ranked_foundations.actor_display_name
      ) as actor_display_name,

      min(
        ranked_foundations.relation_rank
      ) as best_relation_rank,

      min(
        ranked_foundations.verification_rank
      ) as best_verification_rank,

      count(*)::integer
        as foundation_count,

      jsonb_build_object(
        'confirmed',
          count(*) filter (
            where ranked_foundations.verification_status =
              'confirmed'
          ),

        'self_reported',
          count(*) filter (
            where ranked_foundations.verification_status =
              'self_reported'
          ),

        'candidate',
          count(*) filter (
            where ranked_foundations.verification_status =
              'candidate'
          ),

        'other_or_unverified',
          count(*) filter (
            where ranked_foundations.verification_status
              is null

              or ranked_foundations.verification_status
                not in (
                  'confirmed',
                  'self_reported',
                  'candidate'
                )
          )
      ) as verification_summary,

      bool_or(
        ranked_foundations.search_rule_code =
          'territory_context_v1'
      ) as territorially_related,

      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'foundation_kind',
              ranked_foundations.foundation_kind,

            'relation_kind',
              ranked_foundations.relation_kind,

            'observed_text',
              ranked_foundations.observed_text,

            'inference_text',
              ranked_foundations.inference_text,

            'verification_status',
              ranked_foundations.verification_status,

            'evidence_attributes',
              ranked_foundations.evidence_attributes,

            'node_id',
              ranked_foundations.node_id,

            'source_id',
              ranked_foundations.source_id,

            'source_name',
              ranked_foundations.source_name,

            'ingestion_record_id',
              ranked_foundations.ingestion_record_id,

            'source_locator',
              ranked_foundations.source_locator,

            'source_excerpt',
              ranked_foundations.source_excerpt,

            'source_record_type',
              ranked_foundations.source_record_type,

            'source_record_id',
              ranked_foundations.source_record_id,

            'source_updated_at',
              ranked_foundations.source_updated_at,

            'search_rule_code',
              ranked_foundations.search_rule_code,

            'search_rule_version',
              ranked_foundations.search_rule_version
          )
        )

        order by
          ranked_foundations.foundation_order
      )

      filter (
        where ranked_foundations.foundation_order <= 12
      ) as foundations

    from ranked_foundations

    group by
      ranked_foundations.actor_kind,
      ranked_foundations.actor_id
  )

  select
    actor_summary.actor_kind,
    actor_summary.actor_id,
    actor_summary.actor_display_name,

    case actor_summary.best_relation_rank
      when 1 then 'direct'
      when 2 then 'related'
      else 'contextual'
    end::text as strongest_relation_kind,

    actor_summary.foundation_count,

    actor_summary.verification_summary,
    actor_summary.territorially_related,

    case
      when v_validation_status = 'validated'
      then 'governed'
      else 'exploratory'
    end::text as search_mode,

    (
      v_validation_status = 'validated'
    ) as persistence_allowed,

    -- 7B.1 todavía no materializa coincidencias.
    null::uuid as existing_match_id,
    null::text as existing_match_status,

    actor_summary.foundations

  from actor_summary

  where
    coalesce(
      p_include_contextual,
      true
    )
    or actor_summary.best_relation_rank < 3

  order by
    actor_summary.best_relation_rank,
    actor_summary.best_verification_rank,
    actor_summary.territorially_related desc,
    actor_summary.foundation_count desc,
    actor_summary.actor_display_name

  limit p_limit;

end;
$function$;


revoke all
on function
mp25m_api.search_opportunity_requirement_match_candidates(
  uuid,
  uuid,
  text,
  boolean,
  integer
)
from public, anon, authenticated, service_role;


grant execute
on function
mp25m_api.search_opportunity_requirement_match_candidates(
  uuid,
  uuid,
  text,
  boolean,
  integer
)
to service_role;


comment on function
mp25m_api.search_opportunity_requirement_match_candidates(
  uuid,
  uuid,
  text,
  boolean,
  integer
)
is
  'Read-only 7B.1 match search. Searches only the current active requirement revision. Declared/pending revisions are exploratory; validated revisions are eligible for later governed persistence. No match, assignment, coverage or articulation is created.';


commit;