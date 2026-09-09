-- Incremento 7B.2A
-- Modelo persistente de coincidencias analíticas de oportunidad.
--
-- Principios:
-- - un resultado de búsqueda no es una coincidencia persistida;
-- - una coincidencia requiere una decisión humana o un flujo gobernado futuro;
-- - el match pertenece a una revisión exacta del requerimiento;
-- - match no implica cobertura, disponibilidad, voluntad, asignación ni articulación;
-- - los fundamentos congelan la evidencia utilizada al tomar la decisión;
-- - las decisiones son append-only;
-- - no se permite DELETE desde aplicación.

begin;


-- ===========================================================================
-- 1. COINCIDENCIA ANALÍTICA
-- ===========================================================================

create table mp25m.opportunity_requirement_matches (
  id uuid primary key default gen_random_uuid(),

  requirement_revision_id uuid not null
    references mp25m.opportunity_requirement_revisions(id)
    on delete restrict,

  person_id uuid
    references mp25m.persons(id)
    on delete restrict,

  organization_id uuid
    references mp25m.organizations(id)
    on delete restrict,

  actor_candidate_id uuid
    references mp25m.actor_candidates(id)
    on delete restrict,

  status text not null,

  origin_kind text not null,

  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint opportunity_requirement_matches_actor_check
    check (
      num_nonnulls(
        person_id,
        organization_id,
        actor_candidate_id
      ) = 1
    ),

  constraint opportunity_requirement_matches_status_check
    check (
      status in (
        'suggested',
        'accepted_for_analysis',
        'discarded'
      )
    ),

  constraint opportunity_requirement_matches_origin_check
    check (
      origin_kind in (
        'search',
        'manual',
        'system_suggestion',
        'imported_suggestion'
      )
    )
);


create unique index
opportunity_requirement_matches_revision_person_uidx
on mp25m.opportunity_requirement_matches (
  requirement_revision_id,
  person_id
)
where person_id is not null;


create unique index
opportunity_requirement_matches_revision_organization_uidx
on mp25m.opportunity_requirement_matches (
  requirement_revision_id,
  organization_id
)
where organization_id is not null;


create unique index
opportunity_requirement_matches_revision_candidate_uidx
on mp25m.opportunity_requirement_matches (
  requirement_revision_id,
  actor_candidate_id
)
where actor_candidate_id is not null;


create index
opportunity_requirement_matches_revision_status_idx
on mp25m.opportunity_requirement_matches (
  requirement_revision_id,
  status
);


create trigger trg_opportunity_requirement_matches_updated_at
before update
on mp25m.opportunity_requirement_matches
for each row
execute function mp25m.set_updated_at();


alter table mp25m.opportunity_requirement_matches
enable row level security;


revoke all
on table mp25m.opportunity_requirement_matches
from public, anon, authenticated, service_role;


grant select, insert, update
on table mp25m.opportunity_requirement_matches
to service_role;


comment on table
mp25m.opportunity_requirement_matches
is
  'Human-governed analytical consideration of one actor against one exact opportunity requirement revision. A match is not coverage, availability, assignment or articulation.';


comment on column
mp25m.opportunity_requirement_matches.status
is
  'suggested is reserved for future governed automation; accepted_for_analysis means a human chose to consider the actor; discarded means a human chose not to consider it for this revision.';


-- ===========================================================================
-- 2. FUNDAMENTOS CONGELADOS DEL MATCH
-- ===========================================================================

create table mp25m.opportunity_requirement_match_foundations (
  id uuid primary key default gen_random_uuid(),

  match_id uuid not null
    references mp25m.opportunity_requirement_matches(id)
    on delete restrict,

  foundation_origin text not null,

  foundation_kind text not null,

  relation_kind text not null,

  observed_text text not null,

  inference_text text,

  verification_status text,

  evidence_attributes jsonb not null default '{}'::jsonb,

  node_id uuid
    references mp25m.nodes(id)
    on delete restrict,

  source_id uuid
    references mp25m.data_sources(id)
    on delete restrict,

  ingestion_record_id bigint
    references mp25m.ingestion_records(id)
    on delete restrict,

  source_locator text,
  source_excerpt text,

  source_record_type text,
  source_record_id text,
  source_updated_at timestamptz,

  search_rule_code text,
  search_rule_version integer,

  -- -------------------------------------------------------------------------
  -- Referencias tipadas a evidencia real.
  -- Se mantiene además source_record_type/id como snapshot legible.
  -- -------------------------------------------------------------------------

  person_skill_id uuid
    references mp25m.person_skills(id)
    on delete restrict,

  person_skill_evidence_id uuid
    references mp25m.person_skill_evidence(id)
    on delete restrict,

  person_profile_person_id uuid
    references mp25m.persons(id)
    on delete restrict,

  person_profile_field text,

  organization_capability_id uuid
    references mp25m.organization_capabilities(id)
    on delete restrict,

  organization_capability_evidence_id uuid
    references mp25m.organization_capability_evidence(id)
    on delete restrict,

  organization_activity_id uuid
    references mp25m.organization_activities(id)
    on delete restrict,

  actor_evidence_fragment_id uuid
    references mp25m.actor_evidence_fragments(id)
    on delete restrict,

  node_participation_id uuid
    references mp25m.node_participations(id)
    on delete restrict,

  organization_node_organization_id uuid,
  organization_node_node_id uuid,

  source_actor_candidate_id uuid
    references mp25m.actor_candidates(id)
    on delete restrict,

  actor_candidate_node_actor_candidate_id uuid,
  actor_candidate_node_node_id uuid,

  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  created_at timestamptz not null default now(),

  constraint opportunity_requirement_match_foundations_origin_check
    check (
      foundation_origin in (
        'search_snapshot',
        'manual_rationale',
        'added_evidence'
      )
    ),

  constraint opportunity_requirement_match_foundations_relation_check
    check (
      relation_kind in (
        'direct',
        'related',
        'contextual'
      )
    ),

  constraint opportunity_requirement_match_foundations_observed_check
    check (
      char_length(btrim(observed_text))
      between 3 and 4000
    ),

  constraint opportunity_requirement_match_foundations_inference_check
    check (
      inference_text is null
      or char_length(inference_text) <= 4000
    ),

  constraint opportunity_requirement_match_foundations_attributes_check
    check (
      jsonb_typeof(evidence_attributes) = 'object'
    ),

  constraint opportunity_requirement_match_foundations_locator_check
    check (
      source_locator is null
      or char_length(source_locator) <= 2000
    ),

  constraint opportunity_requirement_match_foundations_excerpt_check
    check (
      source_excerpt is null
      or char_length(source_excerpt) <= 4000
    ),

  constraint opportunity_requirement_match_foundations_rule_check
    check (
      search_rule_version is null
      or search_rule_version > 0
    ),

  constraint opportunity_requirement_match_foundations_profile_check
    check (
      (
        person_profile_person_id is null
        and person_profile_field is null
      )
      or
      (
        person_profile_person_id is not null
        and person_profile_field in (
          'person_profile_activity',
          'person_profession',
          'person_experience'
        )
      )
    ),

  constraint opportunity_requirement_match_foundations_org_node_pair_check
    check (
      (
        organization_node_organization_id is null
        and organization_node_node_id is null
      )
      or
      (
        organization_node_organization_id is not null
        and organization_node_node_id is not null
      )
    ),

  constraint opportunity_requirement_match_foundations_candidate_node_pair_check
    check (
      (
        actor_candidate_node_actor_candidate_id is null
        and actor_candidate_node_node_id is null
      )
      or
      (
        actor_candidate_node_actor_candidate_id is not null
        and actor_candidate_node_node_id is not null
      )
    ),

  constraint opportunity_requirement_match_foundations_source_family_check
    check (
      case
        when foundation_origin = 'manual_rationale'
        then
          (
            case when person_skill_id is not null then 1 else 0 end
            + case when person_skill_evidence_id is not null then 1 else 0 end
            + case when person_profile_person_id is not null then 1 else 0 end
            + case when organization_capability_id is not null then 1 else 0 end
            + case when organization_capability_evidence_id is not null then 1 else 0 end
            + case when organization_activity_id is not null then 1 else 0 end
            + case when actor_evidence_fragment_id is not null then 1 else 0 end
            + case when node_participation_id is not null then 1 else 0 end
            + case
                when organization_node_organization_id is not null
                then 1 else 0
              end
            + case when source_actor_candidate_id is not null then 1 else 0 end
            + case
                when actor_candidate_node_actor_candidate_id is not null
                then 1 else 0
              end
          ) = 0

        else
          (
            case when person_skill_id is not null then 1 else 0 end
            + case when person_skill_evidence_id is not null then 1 else 0 end
            + case when person_profile_person_id is not null then 1 else 0 end
            + case when organization_capability_id is not null then 1 else 0 end
            + case when organization_capability_evidence_id is not null then 1 else 0 end
            + case when organization_activity_id is not null then 1 else 0 end
            + case when actor_evidence_fragment_id is not null then 1 else 0 end
            + case when node_participation_id is not null then 1 else 0 end
            + case
                when organization_node_organization_id is not null
                then 1 else 0
              end
            + case when source_actor_candidate_id is not null then 1 else 0 end
            + case
                when actor_candidate_node_actor_candidate_id is not null
                then 1 else 0
              end
          ) = 1
      end
    ),

  constraint opp_req_match_foundations_org_node_fkey
    foreign key (
      organization_node_organization_id,
      organization_node_node_id
    )
    references mp25m.organization_nodes(
      organization_id,
      node_id
    )
    on delete restrict,

  constraint opportunity_requirement_match_foundations_candidate_node_fkey
    foreign key (
      actor_candidate_node_actor_candidate_id,
      actor_candidate_node_node_id
    )
    references mp25m.actor_candidate_nodes(
      actor_candidate_id,
      node_id
    )
    on delete restrict
);


create index
opportunity_requirement_match_foundations_match_idx
on mp25m.opportunity_requirement_match_foundations (
  match_id,
  created_at
);


create index
opportunity_requirement_match_foundations_source_record_idx
on mp25m.opportunity_requirement_match_foundations (
  source_record_type,
  source_record_id
)
where source_record_type is not null;


alter table mp25m.opportunity_requirement_match_foundations
enable row level security;


revoke all
on table mp25m.opportunity_requirement_match_foundations
from public, anon, authenticated, service_role;


grant select, insert
on table mp25m.opportunity_requirement_match_foundations
to service_role;


comment on table
mp25m.opportunity_requirement_match_foundations
is
  'Append-only evidence snapshots explaining why an actor was considered or discarded for an exact opportunity requirement revision.';


comment on column
mp25m.opportunity_requirement_match_foundations.observed_text
is
  'Snapshot of the observed/source-supported information used by the decision.';


comment on column
mp25m.opportunity_requirement_match_foundations.inference_text
is
  'Explainable interpretation of why the observed information is relevant. It does not assert coverage.';


-- ===========================================================================
-- 3. HISTORIAL APPEND-ONLY DE DECISIONES
-- ===========================================================================

create table mp25m.opportunity_requirement_match_decisions (
  id uuid primary key default gen_random_uuid(),

  match_id uuid not null
    references mp25m.opportunity_requirement_matches(id)
    on delete restrict,

  decision_kind text not null,

  from_status text,
  to_status text not null,

  reason text,

  decided_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  decided_at timestamptz not null default now(),

  constraint opportunity_requirement_match_decisions_kind_check
    check (
      decision_kind in (
        'accept',
        'discard',
        'reconsider'
      )
    ),

  constraint opportunity_requirement_match_decisions_from_status_check
    check (
      from_status is null
      or from_status in (
        'suggested',
        'accepted_for_analysis',
        'discarded'
      )
    ),

  constraint opportunity_requirement_match_decisions_to_status_check
    check (
      to_status in (
        'accepted_for_analysis',
        'discarded'
      )
    ),

  constraint opportunity_requirement_match_decisions_reason_check
    check (
      reason is null
      or char_length(btrim(reason))
        between 3 and 4000
    ),

  constraint opportunity_requirement_match_decisions_reason_required_check
    check (
      decision_kind not in (
        'discard',
        'reconsider'
      )
      or (
        reason is not null
        and char_length(btrim(reason)) >= 3
      )
    ),

  constraint opportunity_requirement_match_decisions_transition_check
    check (
      (
        decision_kind = 'accept'
        and (
          (
            from_status is null
            and to_status = 'accepted_for_analysis'
          )
          or
          (
            from_status = 'suggested'
            and to_status = 'accepted_for_analysis'
          )
        )
      )

      or

      (
        decision_kind = 'discard'
        and (
          (
            from_status is null
            and to_status = 'discarded'
          )
          or
          (
            from_status in (
              'suggested',
              'accepted_for_analysis'
            )
            and to_status = 'discarded'
          )
        )
      )

      or

      (
        decision_kind = 'reconsider'
        and from_status = 'discarded'
        and to_status = 'accepted_for_analysis'
      )
    )
);


create index
opportunity_requirement_match_decisions_match_idx
on mp25m.opportunity_requirement_match_decisions (
  match_id,
  decided_at desc
);


alter table mp25m.opportunity_requirement_match_decisions
enable row level security;


revoke all
on table mp25m.opportunity_requirement_match_decisions
from public, anon, authenticated, service_role;


grant select, insert
on table mp25m.opportunity_requirement_match_decisions
to service_role;


comment on table
mp25m.opportunity_requirement_match_decisions
is
  'Append-only human decision history for analytical opportunity requirement matches.';


-- ===========================================================================
-- 4. READ MODEL DE MATCHES
-- ===========================================================================

create view mp25m_api.opportunity_requirement_match_list
with (security_invoker = true)
as

select
  match.id as match_id,

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
  ) as is_current_revision,

  case
    when match.person_id is not null
      then 'person'

    when match.organization_id is not null
      then 'organization'

    else 'candidate'
  end::text as actor_kind,

  coalesce(
    match.person_id,
    match.organization_id,
    match.actor_candidate_id
  ) as actor_id,

  coalesce(
    person.display_name::text,
    organization.name,
    candidate.display_name
  ) as actor_display_name,

  match.status,
  match.origin_kind,

  (
    select count(*)::integer
    from mp25m.opportunity_requirement_match_foundations foundation
    where foundation.match_id = match.id
  ) as foundation_count,

  last_decision.decision_kind
    as last_decision_kind,

  last_decision.reason
    as last_decision_reason,

  last_decision.decided_by_internal_user_id
    as last_decided_by_internal_user_id,

  last_decision.decided_at
    as last_decided_at,

  match.created_by_internal_user_id,
  match.created_at,
  match.updated_at

from mp25m.opportunity_requirement_matches match

join mp25m.opportunity_requirement_revisions revision
  on revision.id =
    match.requirement_revision_id

join mp25m.opportunity_requirements requirement
  on requirement.id =
    revision.requirement_id

left join mp25m.persons person
  on person.id =
    match.person_id

left join mp25m.organizations organization
  on organization.id =
    match.organization_id

left join mp25m.actor_candidates candidate
  on candidate.id =
    match.actor_candidate_id

left join lateral (
  select
    decision.decision_kind,
    decision.reason,
    decision.decided_by_internal_user_id,
    decision.decided_at

  from mp25m.opportunity_requirement_match_decisions decision

  where decision.match_id =
    match.id

  order by
    decision.decided_at desc,
    decision.id desc

  limit 1
) last_decision
  on true
;


revoke all
on mp25m_api.opportunity_requirement_match_list
from public, anon, authenticated, service_role;


grant select
on mp25m_api.opportunity_requirement_match_list
to service_role;


comment on view
mp25m_api.opportunity_requirement_match_list
is
  'Server-only analytical match read model with exact requirement revision, actor identity, current status, foundation count and latest human decision.';


-- ===========================================================================
-- 5. READ MODELS DE FUNDAMENTOS Y DECISIONES
-- ===========================================================================

create view mp25m_api.opportunity_requirement_match_foundation_list
with (security_invoker = true)
as

select
  foundation.*

from mp25m.opportunity_requirement_match_foundations foundation;


revoke all
on mp25m_api.opportunity_requirement_match_foundation_list
from public, anon, authenticated, service_role;


grant select
on mp25m_api.opportunity_requirement_match_foundation_list
to service_role;


create view mp25m_api.opportunity_requirement_match_decision_list
with (security_invoker = true)
as

select
  decision.*

from mp25m.opportunity_requirement_match_decisions decision;


revoke all
on mp25m_api.opportunity_requirement_match_decision_list
from public, anon, authenticated, service_role;


grant select
on mp25m_api.opportunity_requirement_match_decision_list
to service_role;


commit;