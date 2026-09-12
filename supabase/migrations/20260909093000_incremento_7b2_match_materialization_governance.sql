-- Incremento 7B.2B
-- Gobernanza de la materialización humana de coincidencias.
--
-- Principios:
-- - buscar nunca persiste por sí mismo;
-- - sólo una revisión actual, activa y validada puede materializar matches;
-- - el servidor recalcula y congela los fundamentos automáticos;
-- - el cliente no declara fundamentos automáticos como verdad;
-- - descartar y reconsiderar operan sobre el mismo match;
-- - una coincidencia manual requiere fundamento humano explícito;
-- - match no significa cobertura, disponibilidad, asignación ni articulación.

begin;


-- ===========================================================================
-- 0. CLASIFICADOR GOBERNADO 7B.2
-- ===========================================================================
--
-- 7B.1 conserva su clasificación histórica.
--
-- Desde 7B.2, un actor_candidate todavía no resuelto puede aportar contexto
-- útil, pero no debe presentarse como evidencia directa ni relacionada de
-- capacidad. La identidad todavía no fue resuelta a persona u organización.
--
-- Para personas y organizaciones se conserva exactamente la clasificación
-- determinística de 7B.1.

create function
mp25m_api.opportunity_requirement_match_candidate_foundations_governed(
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

  select
    foundation.actor_kind,
    foundation.actor_id,
    foundation.actor_display_name,

    foundation.foundation_kind,

    case
      when foundation.actor_kind = 'candidate'
      then 'contextual'
      else foundation.relation_kind
    end::text
      as relation_kind,

    foundation.observed_text,

    case
      when foundation.actor_kind = 'candidate'
      then
        'El candidato todavía no está resuelto a una identidad canónica. '
        || 'La información aporta contexto para revisión humana, '
        || 'pero no prueba capacidad, cobertura ni disponibilidad.'
      else foundation.inference_text
    end::text
      as inference_text,

    foundation.verification_status,
    foundation.evidence_attributes,

    foundation.node_id,

    foundation.source_id,
    foundation.source_name,
    foundation.ingestion_record_id,

    foundation.source_locator,
    foundation.source_excerpt,

    foundation.source_record_type,
    foundation.source_record_id,
    foundation.source_updated_at,

    -- Conservamos el rule code que explica por qué apareció.
    -- Sólo cambia la fuerza semántica mientras siga sin resolverse.
    foundation.search_rule_code,
    foundation.search_rule_version,

    case
      when foundation.actor_kind = 'candidate'
      then 3
      else foundation.relation_rank
    end::integer
      as relation_rank,

    foundation.verification_rank

  from
    mp25m_api.opportunity_requirement_match_candidate_foundations(
      p_requirement_revision_id
    ) foundation;

$function$;


revoke all
on function
mp25m_api.opportunity_requirement_match_candidate_foundations_governed(
  uuid
)
from public, anon, authenticated, service_role;


grant execute
on function
mp25m_api.opportunity_requirement_match_candidate_foundations_governed(
  uuid
)
to service_role;


comment on function
mp25m_api.opportunity_requirement_match_candidate_foundations_governed(
  uuid
)
is
  '7B.2 governed classifier. Unresolved candidates are always contextual; persons and organizations retain the deterministic 7B.1 classification.';


-- ===========================================================================
-- 1. SNAPSHOT SERVER-SIDE DE FUNDAMENTOS DE BÚSQUEDA
-- ===========================================================================

create function
mp25m_api.snapshot_opportunity_requirement_match_foundations(
  p_match_id uuid,
  p_actor_internal_user_id uuid
)
returns integer
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api,
  extensions
as $function$
declare
  v_requirement_revision_id uuid;
  v_actor_kind text;
  v_actor_id uuid;
  v_inserted_count integer;
begin

  select
    match.requirement_revision_id,

    case
      when match.person_id is not null
        then 'person'
      when match.organization_id is not null
        then 'organization'
      else 'candidate'
    end::text,

    coalesce(
      match.person_id,
      match.organization_id,
      match.actor_candidate_id
    )

  into
    v_requirement_revision_id,
    v_actor_kind,
    v_actor_id

  from mp25m.opportunity_requirement_matches match

  where match.id = p_match_id;


  if not found then
    raise exception
      'Opportunity requirement match not found'
      using errcode = 'P0002';
  end if;


  with ranked_foundations as (
    select
      foundation.*,

      row_number() over (
        order by
          foundation.relation_rank,
          foundation.verification_rank,
          foundation.source_updated_at desc nulls last,
          foundation.source_record_type,
          foundation.source_record_id
      ) as foundation_order

    from
      mp25m_api.opportunity_requirement_match_candidate_foundations_governed(
        v_requirement_revision_id
      ) foundation

    where foundation.actor_kind =
        v_actor_kind
      and foundation.actor_id =
        v_actor_id
  ),

  selected_foundations as (
    select *
    from ranked_foundations
    where foundation_order <= 12
  )

  insert into
  mp25m.opportunity_requirement_match_foundations (
    match_id,

    foundation_origin,
    foundation_kind,
    relation_kind,

    observed_text,
    inference_text,

    verification_status,
    evidence_attributes,

    node_id,

    source_id,
    ingestion_record_id,

    source_locator,
    source_excerpt,

    source_record_type,
    source_record_id,
    source_updated_at,

    search_rule_code,
    search_rule_version,

    person_skill_id,
    person_skill_evidence_id,

    person_profile_person_id,
    person_profile_field,

    organization_capability_id,
    organization_capability_evidence_id,

    organization_activity_id,

    actor_evidence_fragment_id,

    node_participation_id,

    organization_node_organization_id,
    organization_node_node_id,

    source_actor_candidate_id,

    actor_candidate_node_actor_candidate_id,
    actor_candidate_node_node_id,

    created_by_internal_user_id
  )

  select
    p_match_id,

    'search_snapshot',
    foundation.foundation_kind,
    foundation.relation_kind,

    foundation.observed_text,
    foundation.inference_text,

    foundation.verification_status,
    coalesce(
      foundation.evidence_attributes,
      '{}'::jsonb
    ),

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

    case
      when foundation.source_record_type =
        'person_skill'
      then foundation.source_record_id::uuid
    end,

    case
      when foundation.source_record_type =
        'person_skill_evidence'
      then foundation.source_record_id::uuid
    end,

    case
      when foundation.source_record_type =
        'person_profile'
      then
        split_part(
          foundation.source_record_id,
          ':',
          1
        )::uuid
    end,

    case
      when foundation.source_record_type =
        'person_profile'
      then
        split_part(
          foundation.source_record_id,
          ':',
          2
        )
    end,

    case
      when foundation.source_record_type =
        'organization_capability'
      then foundation.source_record_id::uuid
    end,

    case
      when foundation.source_record_type =
        'organization_capability_evidence'
      then foundation.source_record_id::uuid
    end,

    case
      when foundation.source_record_type =
        'organization_activity'
      then foundation.source_record_id::uuid
    end,

    case
      when foundation.source_record_type =
        'actor_evidence_fragment'
      then foundation.source_record_id::uuid
    end,

    case
      when foundation.source_record_type =
        'node_participation'
      then foundation.source_record_id::uuid
    end,

    case
      when foundation.source_record_type =
        'organization_node'
      then
        split_part(
          foundation.source_record_id,
          ':',
          1
        )::uuid
    end,

    case
      when foundation.source_record_type =
        'organization_node'
      then
        split_part(
          foundation.source_record_id,
          ':',
          2
        )::uuid
    end,

    case
      when foundation.source_record_type =
        'actor_candidate'
      then foundation.source_record_id::uuid
    end,

    case
      when foundation.source_record_type =
        'actor_candidate_node'
      then
        split_part(
          foundation.source_record_id,
          ':',
          1
        )::uuid
    end,

    case
      when foundation.source_record_type =
        'actor_candidate_node'
      then
        split_part(
          foundation.source_record_id,
          ':',
          2
        )::uuid
    end,

    p_actor_internal_user_id

  from selected_foundations foundation;


  get diagnostics
    v_inserted_count = row_count;

  return v_inserted_count;
end;
$function$;


revoke all
on function
mp25m_api.snapshot_opportunity_requirement_match_foundations(
  uuid,
  uuid
)
from public, anon, authenticated, service_role;


grant execute
on function
mp25m_api.snapshot_opportunity_requirement_match_foundations(
  uuid,
  uuid
)
to service_role;


comment on function
mp25m_api.snapshot_opportunity_requirement_match_foundations(
  uuid,
  uuid
)
is
  'Internal 7B.2 server-side snapshot of up to 12 strongest deterministic foundations for one newly materialized match.';


-- ===========================================================================
-- 2. MATERIALIZAR RESULTADO DE BÚSQUEDA
-- ===========================================================================

create function
mp25m_api.materialize_opportunity_requirement_match(
  p_actor_internal_user_id uuid,
  p_requirement_revision_id uuid,
  p_actor_kind text,
  p_actor_id uuid,
  p_decision_kind text,
  p_reason text default null
)
returns table (
  match_id uuid,
  status text,
  foundation_count integer
)
language plpgsql
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

  v_existing_match_id uuid;

  v_match_id uuid;
  v_target_status text;
  v_reason text;

  v_foundation_count integer;
begin

  if p_actor_kind not in (
    'person',
    'organization',
    'candidate'
  ) then
    raise exception
      'Invalid actor kind'
      using errcode = '22023';
  end if;


  if p_actor_id is null then
    raise exception
      'Actor id is required'
      using errcode = '22023';
  end if;


  if p_decision_kind not in (
    'accept',
    'discard'
  ) then
    raise exception
      'Initial match decision must be accept or discard'
      using errcode = '22023';
  end if;


  v_reason :=
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    );


  if v_reason is not null
     and char_length(v_reason) > 4000
  then
    raise exception
      'Decision reason cannot exceed 4000 characters'
      using errcode = '22023';
  end if;


  if p_decision_kind = 'discard'
     and (
       v_reason is null
       or char_length(v_reason) < 3
     )
  then
    raise exception
      'Discard reason must contain at least 3 characters'
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
      'Only active opportunity requirements may materialize matches'
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
      'Only the current opportunity requirement revision may materialize matches'
      using errcode = '22023';
  end if;


  if v_validation_status <> 'validated' then
    raise exception
      'Only validated opportunity requirement revisions may materialize matches'
      using errcode = '22023';
  end if;


  if not
    mp25m_api.can_operate_opportunity_requirement_match(
      p_actor_internal_user_id,
      v_opportunity_id,
      'decide'
    )
  then
    raise exception
      'Internal user cannot materialize opportunity requirement matches'
      using errcode = '42501';
  end if;


  -- El actor debe seguir surgiendo de la búsqueda al momento de decidir.
  -- Así el cliente nunca puede inventar los fundamentos automáticos.

  if not exists (
    select 1
    from
      mp25m_api.opportunity_requirement_match_candidate_foundations_governed(
        p_requirement_revision_id
      ) foundation
    where foundation.actor_kind =
        p_actor_kind
      and foundation.actor_id =
        p_actor_id
  ) then
    raise exception
      'Actor is not a current search candidate; use manual materialization if appropriate'
      using errcode = '22023';
  end if;


  select
    match.id

  into
    v_existing_match_id

  from mp25m.opportunity_requirement_matches match

  where match.requirement_revision_id =
      p_requirement_revision_id

    and (
      (
        p_actor_kind = 'person'
        and match.person_id = p_actor_id
      )

      or

      (
        p_actor_kind = 'organization'
        and match.organization_id = p_actor_id
      )

      or

      (
        p_actor_kind = 'candidate'
        and match.actor_candidate_id = p_actor_id
      )
    )

  limit 1;


  if found then
    raise exception
      'A match already exists for this actor and requirement revision'
      using errcode = '23505';
  end if;


  v_target_status :=
    case
      when p_decision_kind = 'accept'
        then 'accepted_for_analysis'
      else 'discarded'
    end;


  begin

    insert into mp25m.opportunity_requirement_matches (
      requirement_revision_id,

      person_id,
      organization_id,
      actor_candidate_id,

      status,
      origin_kind,

      created_by_internal_user_id
    )
    values (
      p_requirement_revision_id,

      case
        when p_actor_kind = 'person'
          then p_actor_id
      end,

      case
        when p_actor_kind = 'organization'
          then p_actor_id
      end,

      case
        when p_actor_kind = 'candidate'
          then p_actor_id
      end,

      v_target_status,
      'search',

      p_actor_internal_user_id
    )
    returning id
    into v_match_id;

  exception
    when unique_violation then
      raise exception
        'A match already exists for this actor and requirement revision'
        using errcode = '23505';
  end;


  v_foundation_count :=
    mp25m_api.snapshot_opportunity_requirement_match_foundations(
      v_match_id,
      p_actor_internal_user_id
    );


  if v_foundation_count < 1 then
    raise exception
      'No current search foundations could be snapshotted'
      using errcode = '22023';
  end if;


  insert into mp25m.opportunity_requirement_match_decisions (
    match_id,
    decision_kind,
    from_status,
    to_status,
    reason,
    decided_by_internal_user_id
  )
  values (
    v_match_id,
    p_decision_kind,
    null,
    v_target_status,
    v_reason,
    p_actor_internal_user_id
  );


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,

    target_schema,
    target_table,
    target_id,

    old_data,
    new_data,

    result,
    metadata
  )
  values (
    p_actor_internal_user_id,

    case
      when p_decision_kind = 'accept'
      then 'opportunity.requirement.match.accept'
      else 'opportunity.requirement.match.discard'
    end,

    'mp25m',
    'opportunity_requirement_matches',
    v_match_id,

    null,

    jsonb_build_object(
      'status',
        v_target_status,
      'origin_kind',
        'search',
      'foundation_count',
        v_foundation_count
    ),

    'allowed',

    jsonb_build_object(
      'opportunity_id',
        v_opportunity_id,
      'requirement_id',
        v_requirement_id,
      'revision_id',
        p_requirement_revision_id,
      'revision_no',
        v_revision_no,
      'actor_kind',
        p_actor_kind,
      'actor_id',
        p_actor_id
    )
  );


  match_id := v_match_id;
  status := v_target_status;
  foundation_count := v_foundation_count;

  return next;
end;
$function$;


revoke all
on function
mp25m_api.materialize_opportunity_requirement_match(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function
mp25m_api.materialize_opportunity_requirement_match(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text
)
to service_role;


comment on function
mp25m_api.materialize_opportunity_requirement_match(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text
)
is
  'Human decision over a current governed 7B search result. Server recalculates and snapshots foundations before persisting the match.';


-- ===========================================================================
-- 3. COINCIDENCIA MANUAL
-- ===========================================================================

create function
mp25m_api.create_manual_opportunity_requirement_match(
  p_actor_internal_user_id uuid,
  p_requirement_revision_id uuid,
  p_actor_kind text,
  p_actor_id uuid,
  p_relation_kind text,
  p_observed_text text,
  p_inference_text text
)
returns table (
  match_id uuid,
  status text,
  foundation_id uuid
)
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_opportunity_id uuid;
  v_requirement_id uuid;
  v_revision_no integer;
  v_record_status text;
  v_validation_status text;

  v_observed_text text;
  v_inference_text text;

  v_existing_match_id uuid;
  v_match_id uuid;
  v_foundation_id uuid;
begin

  if p_actor_kind not in (
    'person',
    'organization',
    'candidate'
  ) then
    raise exception
      'Invalid actor kind'
      using errcode = '22023';
  end if;


  if p_actor_id is null then
    raise exception
      'Actor id is required'
      using errcode = '22023';
  end if;


  -- Un fundamento manual, por sí solo, nunca prueba igualdad canónica.
  if p_relation_kind not in (
    'related',
    'contextual'
  ) then
    raise exception
      'Manual rationale may only be related or contextual'
      using errcode = '22023';
  end if;


  if p_actor_kind = 'candidate'
     and p_relation_kind <> 'contextual'
  then
    raise exception
      'Unresolved candidate manual rationale may only be contextual'
      using errcode = '22023';
  end if;


  v_observed_text :=
    nullif(
      btrim(
        coalesce(
          p_observed_text,
          ''
        )
      ),
      ''
    );


  if v_observed_text is null
     or char_length(v_observed_text) < 3
     or char_length(v_observed_text) > 4000
  then
    raise exception
      'Manual observed text must contain between 3 and 4000 characters'
      using errcode = '22023';
  end if;


  v_inference_text :=
    nullif(
      btrim(
        coalesce(
          p_inference_text,
          ''
        )
      ),
      ''
    );


  if v_inference_text is null
     or char_length(v_inference_text) < 3
     or char_length(v_inference_text) > 4000
  then
    raise exception
      'Manual inference text must contain between 3 and 4000 characters'
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
      'Only active opportunity requirements may materialize matches'
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
      'Only the current opportunity requirement revision may materialize matches'
      using errcode = '22023';
  end if;


  if v_validation_status <> 'validated' then
    raise exception
      'Only validated opportunity requirement revisions may materialize matches'
      using errcode = '22023';
  end if;


  if not
    mp25m_api.can_operate_opportunity_requirement_match(
      p_actor_internal_user_id,
      v_opportunity_id,
      'manual'
    )
  then
    raise exception
      'Internal user cannot create manual opportunity requirement matches'
      using errcode = '42501';
  end if;


  if not (
    (
      p_actor_kind = 'person'
      and exists (
        select 1
        from mp25m.persons person
        where person.id = p_actor_id
          and person.record_status = 'active'
      )
    )

    or

    (
      p_actor_kind = 'organization'
      and exists (
        select 1
        from mp25m.organizations organization
        where organization.id = p_actor_id
          and organization.record_status = 'active'
      )
    )

    or

    (
      p_actor_kind = 'candidate'
      and exists (
        select 1
        from mp25m.actor_candidates candidate
        where candidate.id = p_actor_id
          and candidate.status in (
            'pending',
            'approved'
          )
          and candidate.resolved_person_id is null
          and candidate.resolved_organization_id is null
      )
    )
  ) then
    raise exception
      'Actor is not eligible for manual matching'
      using errcode = '22023';
  end if;


  select
    match.id

  into
    v_existing_match_id

  from mp25m.opportunity_requirement_matches match

  where match.requirement_revision_id =
      p_requirement_revision_id

    and (
      (
        p_actor_kind = 'person'
        and match.person_id = p_actor_id
      )

      or

      (
        p_actor_kind = 'organization'
        and match.organization_id = p_actor_id
      )

      or

      (
        p_actor_kind = 'candidate'
        and match.actor_candidate_id = p_actor_id
      )
    )

  limit 1;


  if found then
    raise exception
      'A match already exists for this actor and requirement revision'
      using errcode = '23505';
  end if;


  begin

    insert into mp25m.opportunity_requirement_matches (
      requirement_revision_id,

      person_id,
      organization_id,
      actor_candidate_id,

      status,
      origin_kind,

      created_by_internal_user_id
    )
    values (
      p_requirement_revision_id,

      case
        when p_actor_kind = 'person'
          then p_actor_id
      end,

      case
        when p_actor_kind = 'organization'
          then p_actor_id
      end,

      case
        when p_actor_kind = 'candidate'
          then p_actor_id
      end,

      'accepted_for_analysis',
      'manual',

      p_actor_internal_user_id
    )
    returning id
    into v_match_id;

  exception
    when unique_violation then
      raise exception
        'A match already exists for this actor and requirement revision'
        using errcode = '23505';
  end;


  insert into mp25m.opportunity_requirement_match_foundations (
    match_id,

    foundation_origin,
    foundation_kind,
    relation_kind,

    observed_text,
    inference_text,

    evidence_attributes,

    created_by_internal_user_id
  )
  values (
    v_match_id,

    'manual_rationale',
    'manual_rationale',
    p_relation_kind,

    v_observed_text,
    v_inference_text,

    '{}'::jsonb,

    p_actor_internal_user_id
  )
  returning id
  into v_foundation_id;


  insert into mp25m.opportunity_requirement_match_decisions (
    match_id,
    decision_kind,
    from_status,
    to_status,
    reason,
    decided_by_internal_user_id
  )
  values (
    v_match_id,
    'accept',
    null,
    'accepted_for_analysis',
    v_inference_text,
    p_actor_internal_user_id
  );


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,

    target_schema,
    target_table,
    target_id,

    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'opportunity.requirement.match.manual_create',

    'mp25m',
    'opportunity_requirement_matches',
    v_match_id,

    jsonb_build_object(
      'status',
        'accepted_for_analysis',
      'origin_kind',
        'manual',
      'relation_kind',
        p_relation_kind
    ),

    'allowed',

    jsonb_build_object(
      'opportunity_id',
        v_opportunity_id,
      'requirement_id',
        v_requirement_id,
      'revision_id',
        p_requirement_revision_id,
      'revision_no',
        v_revision_no,
      'actor_kind',
        p_actor_kind,
      'actor_id',
        p_actor_id,
      'foundation_id',
        v_foundation_id
    )
  );


  match_id := v_match_id;
  status := 'accepted_for_analysis';
  foundation_id := v_foundation_id;

  return next;
end;
$function$;


revoke all
on function
mp25m_api.create_manual_opportunity_requirement_match(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function
mp25m_api.create_manual_opportunity_requirement_match(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text
)
to service_role;


comment on function
mp25m_api.create_manual_opportunity_requirement_match(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text
)
is
  'Creates a human-governed manual analytical match. Manual rationale may be related or contextual but never direct without canonical structured evidence.';


-- ===========================================================================
-- 4. DESCARTAR / RECONSIDERAR MATCH EXISTENTE
-- ===========================================================================

create function
mp25m_api.decide_opportunity_requirement_match(
  p_actor_internal_user_id uuid,
  p_match_id uuid,
  p_expected_status text,
  p_decision_kind text,
  p_reason text
)
returns table (
  match_id uuid,
  status text
)
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_opportunity_id uuid;
  v_requirement_id uuid;
  v_requirement_revision_id uuid;
  v_revision_no integer;
  v_record_status text;
  v_validation_status text;

  v_current_status text;
  v_target_status text;
  v_operation text;

  v_actor_kind text;
  v_actor_id uuid;

  v_reason text;
begin

  if p_expected_status not in (
    'suggested',
    'accepted_for_analysis',
    'discarded'
  ) then
    raise exception
      'Invalid expected match status'
      using errcode = '22023';
  end if;


  if p_decision_kind not in (
    'discard',
    'reconsider'
  ) then
    raise exception
      'Existing match decision must be discard or reconsider'
      using errcode = '22023';
  end if;


  v_reason :=
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    );


  if v_reason is null
     or char_length(v_reason) < 3
     or char_length(v_reason) > 4000
  then
    raise exception
      'Decision reason must contain between 3 and 4000 characters'
      using errcode = '22023';
  end if;


  select
    match.requirement_revision_id,
    match.status,

    requirement.opportunity_id,
    requirement.id,
    requirement.record_status,

    revision.revision_no,
    revision.validation_status,

    case
      when match.person_id is not null
        then 'person'
      when match.organization_id is not null
        then 'organization'
      else 'candidate'
    end::text,

    coalesce(
      match.person_id,
      match.organization_id,
      match.actor_candidate_id
    )

  into
    v_requirement_revision_id,
    v_current_status,

    v_opportunity_id,
    v_requirement_id,
    v_record_status,

    v_revision_no,
    v_validation_status,

    v_actor_kind,
    v_actor_id

  from mp25m.opportunity_requirement_matches match

  join mp25m.opportunity_requirement_revisions revision
    on revision.id =
      match.requirement_revision_id

  join mp25m.opportunity_requirements requirement
    on requirement.id =
      revision.requirement_id

  where match.id =
    p_match_id

  for update of match;


  if not found then
    raise exception
      'Opportunity requirement match not found'
      using errcode = 'P0002';
  end if;


  if v_record_status <> 'active' then
    raise exception
      'Historical or withdrawn matches are read-only'
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
      'Historical opportunity requirement matches are read-only'
      using errcode = '22023';
  end if;


  if v_validation_status <> 'validated' then
    raise exception
      'Only validated current requirement matches may be decided'
      using errcode = '22023';
  end if;


  if v_current_status <> p_expected_status then
    raise exception
      'Match status changed; reload before deciding'
      using errcode = '40001';
  end if;


  if p_decision_kind = 'discard' then
    v_operation := 'decide';

    if v_current_status not in (
      'suggested',
      'accepted_for_analysis'
    ) then
      raise exception
        'Only suggested or accepted matches may be discarded'
        using errcode = '22023';
    end if;

    v_target_status := 'discarded';

  else
    v_operation := 'reconsider';

    if v_current_status <> 'discarded' then
      raise exception
        'Only discarded matches may be reconsidered'
        using errcode = '22023';
    end if;

    v_target_status := 'accepted_for_analysis';
  end if;


  if not
    mp25m_api.can_operate_opportunity_requirement_match(
      p_actor_internal_user_id,
      v_opportunity_id,
      v_operation
    )
  then
    raise exception
      'Internal user cannot decide this opportunity requirement match'
      using errcode = '42501';
  end if;


  update mp25m.opportunity_requirement_matches match
  set status =
    v_target_status
  where match.id =
    p_match_id;


  insert into mp25m.opportunity_requirement_match_decisions (
    match_id,
    decision_kind,
    from_status,
    to_status,
    reason,
    decided_by_internal_user_id
  )
  values (
    p_match_id,
    p_decision_kind,
    v_current_status,
    v_target_status,
    v_reason,
    p_actor_internal_user_id
  );


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,

    target_schema,
    target_table,
    target_id,

    old_data,
    new_data,

    result,
    metadata
  )
  values (
    p_actor_internal_user_id,

    case
      when p_decision_kind = 'discard'
      then 'opportunity.requirement.match.discard'
      else 'opportunity.requirement.match.reconsider'
    end,

    'mp25m',
    'opportunity_requirement_matches',
    p_match_id,

    jsonb_build_object(
      'status',
        v_current_status
    ),

    jsonb_build_object(
      'status',
        v_target_status
    ),

    'allowed',

    jsonb_build_object(
      'opportunity_id',
        v_opportunity_id,
      'requirement_id',
        v_requirement_id,
      'revision_id',
        v_requirement_revision_id,
      'revision_no',
        v_revision_no,
      'actor_kind',
        v_actor_kind,
      'actor_id',
        v_actor_id
    )
  );


  match_id := p_match_id;
  status := v_target_status;

  return next;
end;
$function$;


revoke all
on function
mp25m_api.decide_opportunity_requirement_match(
  uuid,
  uuid,
  text,
  text,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function
mp25m_api.decide_opportunity_requirement_match(
  uuid,
  uuid,
  text,
  text,
  text
)
to service_role;


comment on function
mp25m_api.decide_opportunity_requirement_match(
  uuid,
  uuid,
  text,
  text,
  text
)
is
  'Governed discard/reconsider transition with row locking and expected-status stale-write protection.';


-- ===========================================================================
-- 5. BÚSQUEDA 7B.2: EXPONER MATCH EXISTENTE
-- ===========================================================================

create or replace function
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
      mp25m_api.opportunity_requirement_match_candidate_foundations_governed(
        p_requirement_revision_id
      ) as foundation

    where p_actor_kind is null
       or foundation.actor_kind =
          p_actor_kind
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
  ),

  actor_with_match as (
    select
      actor_summary.*,

      existing_match.id
        as existing_match_id,

      existing_match.status
        as existing_match_status

    from actor_summary

    left join mp25m.opportunity_requirement_matches
      existing_match

      on existing_match.requirement_revision_id =
          p_requirement_revision_id

      and (
        (
          actor_summary.actor_kind = 'person'
          and existing_match.person_id =
            actor_summary.actor_id
        )

        or

        (
          actor_summary.actor_kind = 'organization'
          and existing_match.organization_id =
            actor_summary.actor_id
        )

        or

        (
          actor_summary.actor_kind = 'candidate'
          and existing_match.actor_candidate_id =
            actor_summary.actor_id
        )
      )
  )

  select
    actor_with_match.actor_kind,
    actor_with_match.actor_id,
    actor_with_match.actor_display_name,

    case actor_with_match.best_relation_rank
      when 1 then 'direct'
      when 2 then 'related'
      else 'contextual'
    end::text
      as strongest_relation_kind,

    actor_with_match.foundation_count,

    actor_with_match.verification_summary,
    actor_with_match.territorially_related,

    case
      when v_validation_status = 'validated'
      then 'governed'
      else 'exploratory'
    end::text
      as search_mode,

    (
      v_validation_status = 'validated'

      and actor_with_match.existing_match_id
        is null

      and mp25m_api.can_operate_opportunity_requirement_match(
        p_actor_internal_user_id,
        v_opportunity_id,
        'decide'
      )
    ) as persistence_allowed,

    actor_with_match.existing_match_id,
    actor_with_match.existing_match_status,

    actor_with_match.foundations

  from actor_with_match

  where
    coalesce(
      p_include_contextual,
      true
    )
    or actor_with_match.best_relation_rank < 3

  order by
    actor_with_match.best_relation_rank,
    actor_with_match.best_verification_rank,
    actor_with_match.territorially_related desc,
    actor_with_match.foundation_count desc,
    actor_with_match.actor_display_name

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
  '7B.2 search: deterministic read-only candidate discovery plus existing analytical match identity/status. Only validated rows without an existing match allow initial persistence.';


commit;