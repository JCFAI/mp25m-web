-- Incremento 7C.2.1 - direct relation null-safety
-- Corrige SQL tri-valuado al validar evidencia canonica directa.

begin;

create or replace function
mp25m_api.add_opportunity_requirement_match_foundation(
  p_actor_internal_user_id uuid,
  p_match_id uuid,
  p_source_record_type text,
  p_source_record_id text,
  p_relation_kind text
)
returns table (
  foundation_id uuid,
  foundation_kind text,
  relation_kind text,
  source_record_type text,
  source_record_id text
)
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_requirement_revision_id uuid;
  v_requirement_id uuid;
  v_opportunity_id uuid;

  v_revision_no integer;
  v_record_status text;
  v_validation_status text;

  v_match_status text;

  v_required_skill_id uuid;
  v_required_activity_id uuid;

  v_actor_kind text;
  v_actor_id uuid;

  v_source_record_type text;
  v_source_record_id text;

  v_evidence record;

  v_foundation_id uuid;
  v_foundation_kind text;
  v_inference_text text;
begin

  -- -------------------------------------------------------------------------
  -- 1. INPUT
  -- -------------------------------------------------------------------------

  if p_actor_internal_user_id is null then
    raise exception
      'Actor internal user id is required'
      using errcode = '22023';
  end if;


  if p_match_id is null then
    raise exception
      'Match id is required'
      using errcode = '22023';
  end if;


  v_source_record_type :=
    nullif(
      btrim(
        coalesce(
          p_source_record_type,
          ''
        )
      ),
      ''
    );


  if v_source_record_type is null
     or v_source_record_type not in (
       'person_skill',
       'person_skill_evidence',
       'person_profile',
       'organization_capability',
       'organization_capability_evidence',
       'organization_activity',
       'actor_evidence_fragment',
       'node_participation',
       'organization_node',
       'actor_candidate',
       'actor_candidate_node'
     )
  then
    raise exception
      'Unsupported actor evidence source record type'
      using errcode = '22023';
  end if;


  v_source_record_id :=
    nullif(
      btrim(
        coalesce(
          p_source_record_id,
          ''
        )
      ),
      ''
    );


  if v_source_record_id is null
     or char_length(v_source_record_id) > 500
  then
    raise exception
      'Source record id is required and cannot exceed 500 characters'
      using errcode = '22023';
  end if;


  if p_relation_kind not in (
    'direct',
    'related',
    'contextual'
  ) then
    raise exception
      'Added evidence relation kind must be direct, related or contextual'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- 2. MATCH + REVISIÓN
  --
  -- El lock serializa:
  -- - agregado simultáneo de foundations;
  -- - discard/reconsider del mismo match.
  -- -------------------------------------------------------------------------

  select
    match.requirement_revision_id,
    match.status,

    requirement.id,
    requirement.opportunity_id,
    requirement.record_status,

    revision.revision_no,
    revision.validation_status,
    revision.skill_id,
    revision.activity_id,

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
    v_match_status,

    v_requirement_id,
    v_opportunity_id,
    v_record_status,

    v_revision_no,
    v_validation_status,
    v_required_skill_id,
    v_required_activity_id,

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


  if v_match_status <> 'accepted_for_analysis' then
    raise exception
      'Only accepted_for_analysis matches may receive added evidence'
      using errcode = '22023';
  end if;


  if v_record_status <> 'active' then
    raise exception
      'Historical or withdrawn opportunity requirement matches are read-only'
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
      'Only validated current requirement matches may receive added evidence'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- 3. AUTORIZACIÓN
  -- -------------------------------------------------------------------------

  if not
    mp25m_api.can_operate_opportunity_requirement_match(
      p_actor_internal_user_id,
      v_opportunity_id,
      'foundation'
    )
  then
    raise exception
      'Internal user cannot add opportunity requirement match foundations'
      using errcode = '42501';
  end if;


  -- -------------------------------------------------------------------------
  -- 4. CANDIDATO NO RESUELTO
  -- -------------------------------------------------------------------------

  if v_actor_kind = 'candidate' then

    if not exists (
      select 1

      from mp25m.actor_candidates candidate

      where candidate.id =
          v_actor_id

        and candidate.status in (
          'pending',
          'approved'
        )

        and candidate.resolved_person_id is null

        and candidate.resolved_organization_id is null
    ) then
      raise exception
        'Resolved or inactive actor candidates cannot receive new foundations'
        using errcode = '22023';
    end if;


    if p_relation_kind <> 'contextual' then
      raise exception
        'Unresolved candidate added evidence may only be contextual'
        using errcode = '22023';
    end if;

  end if;


  -- -------------------------------------------------------------------------
  -- 5. RELEER EVIDENCIA CANÓNICA DEL ACTOR
  --
  -- No recibimos:
  -- - observed_text
  -- - verification_status
  -- - evidence_attributes
  -- - source metadata
  --
  -- Todo sale del read model gobernado 7B.1.
  -- -------------------------------------------------------------------------

  select
    evidence.actor_kind,
    evidence.actor_id,

    evidence.evidence_kind,

    evidence.skill_id,
    evidence.activity_id,

    evidence.evidence_text,
    evidence.verification_status,
    evidence.evidence_attributes,

    evidence.node_id,

    evidence.source_id,
    evidence.ingestion_record_id,

    evidence.source_locator,
    evidence.source_excerpt,

    evidence.source_record_type,
    evidence.source_record_id,
    evidence.source_updated_at

  into v_evidence

  from mp25m_api.actor_search_evidence evidence

  where evidence.actor_kind =
      v_actor_kind

    and evidence.actor_id =
      v_actor_id

    and evidence.source_record_type =
      v_source_record_type

    and evidence.source_record_id =
      v_source_record_id

  limit 1;


  if not found then
    raise exception
      'Evidence is not a current searchable record of the matched actor'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- 6. DIRECT = IGUALDAD CANÓNICA REAL
  --
  -- El humano puede decidir related/contextual.
  --
  -- Para declarar direct el servidor exige:
  -- - skill_id exacta, o
  -- - activity_id exacta.
  --
  -- Texto libre nunca alcanza para direct.
  -- -------------------------------------------------------------------------

  if p_relation_kind = 'direct'
     and not (
       (
         v_required_skill_id is not null
         and v_evidence.skill_id is not null
         and v_evidence.skill_id =
           v_required_skill_id
       )

       or

       (
         v_required_activity_id is not null
         and v_evidence.activity_id is not null
         and v_evidence.activity_id =
           v_required_activity_id
       )
     )
  then
    raise exception
      'Direct added evidence requires exact canonical skill or activity equality'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- 7. NO DUPLICAR LA MISMA EVIDENCIA EN EL MISMO MATCH
  --
  -- También evita volver a agregar una evidencia que ya quedó congelada
  -- durante el search_snapshot inicial.
  --
  -- El match está bloqueado, por lo que dos RPC concurrentes sobre el mismo
  -- match quedan serializados.
  -- -------------------------------------------------------------------------

  if exists (
    select 1

    from mp25m.opportunity_requirement_match_foundations foundation

    where foundation.match_id =
        p_match_id

      and foundation.source_record_type =
        v_source_record_type

      and foundation.source_record_id =
        v_source_record_id
  ) then
    raise exception
      'This evidence is already a foundation of the match'
      using errcode = '23505';
  end if;


  -- -------------------------------------------------------------------------
  -- 8. SNAPSHOT SEMÁNTICO
  -- -------------------------------------------------------------------------

  v_foundation_kind :=
    case
      when v_evidence.evidence_kind in (
        'person_profile_activity',
        'person_profession',
        'person_experience'
      )
      then 'person_profile_text'

      else v_evidence.evidence_kind
    end;


  v_inference_text :=
    case

      when v_actor_kind = 'candidate'
      then
        'La evidencia pertenece a un candidato todavía no resuelto. '
        || 'Aporta contexto para revisión humana, pero no prueba '
        || 'capacidad, cobertura ni disponibilidad.'

      when p_relation_kind = 'direct'
      then
        'La evidencia estructurada seleccionada coincide directamente '
        || 'con la habilidad/capacidad o actividad canónica requerida.'

      when p_relation_kind = 'related'
      then
        'Evidencia existente del actor seleccionada mediante revisión '
        || 'humana como relacionada con este requerimiento.'

      else
        'Evidencia existente del actor seleccionada mediante revisión '
        || 'humana como contexto útil para evaluar este requerimiento.'

    end;


  -- -------------------------------------------------------------------------
  -- 9. FOUNDATION APPEND-ONLY
  -- -------------------------------------------------------------------------

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

  values (
    p_match_id,

    'added_evidence',
    v_foundation_kind,
    p_relation_kind,

    left(
      v_evidence.evidence_text,
      4000
    ),

    v_inference_text,

    v_evidence.verification_status,

    coalesce(
      v_evidence.evidence_attributes,
      '{}'::jsonb
    ),

    v_evidence.node_id,

    v_evidence.source_id,
    v_evidence.ingestion_record_id,

    v_evidence.source_locator,

    left(
      coalesce(
        v_evidence.source_excerpt,
        v_evidence.evidence_text
      ),
      4000
    ),

    v_source_record_type,
    v_source_record_id,
    v_evidence.source_updated_at,

    null,
    null,

    case
      when v_source_record_type =
        'person_skill'
      then v_source_record_id::uuid
    end,

    case
      when v_source_record_type =
        'person_skill_evidence'
      then v_source_record_id::uuid
    end,

    case
      when v_source_record_type =
        'person_profile'
      then
        split_part(
          v_source_record_id,
          ':',
          1
        )::uuid
    end,

    case
      when v_source_record_type =
        'person_profile'
      then
        split_part(
          v_source_record_id,
          ':',
          2
        )
    end,

    case
      when v_source_record_type =
        'organization_capability'
      then v_source_record_id::uuid
    end,

    case
      when v_source_record_type =
        'organization_capability_evidence'
      then v_source_record_id::uuid
    end,

    case
      when v_source_record_type =
        'organization_activity'
      then v_source_record_id::uuid
    end,

    case
      when v_source_record_type =
        'actor_evidence_fragment'
      then v_source_record_id::uuid
    end,

    case
      when v_source_record_type =
        'node_participation'
      then v_source_record_id::uuid
    end,

    case
      when v_source_record_type =
        'organization_node'
      then
        split_part(
          v_source_record_id,
          ':',
          1
        )::uuid
    end,

    case
      when v_source_record_type =
        'organization_node'
      then
        split_part(
          v_source_record_id,
          ':',
          2
        )::uuid
    end,

    case
      when v_source_record_type =
        'actor_candidate'
      then v_source_record_id::uuid
    end,

    case
      when v_source_record_type =
        'actor_candidate_node'
      then
        split_part(
          v_source_record_id,
          ':',
          1
        )::uuid
    end,

    case
      when v_source_record_type =
        'actor_candidate_node'
      then
        split_part(
          v_source_record_id,
          ':',
          2
        )::uuid
    end,

    p_actor_internal_user_id
  )

  returning id
  into v_foundation_id;


  -- -------------------------------------------------------------------------
  -- 10. AUDITORÍA
  -- -------------------------------------------------------------------------

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
    'opportunity.requirement.match.foundation.add',

    'mp25m',
    'opportunity_requirement_match_foundations',
    v_foundation_id,

    jsonb_build_object(
      'match_id',
        p_match_id,
      'foundation_origin',
        'added_evidence',
      'foundation_kind',
        v_foundation_kind,
      'relation_kind',
        p_relation_kind,
      'source_record_type',
        v_source_record_type,
      'source_record_id',
        v_source_record_id,
      'verification_status',
        v_evidence.verification_status
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
      'match_id',
        p_match_id,
      'actor_kind',
        v_actor_kind,
      'actor_id',
        v_actor_id
    )
  );


  foundation_id :=
    v_foundation_id;

  foundation_kind :=
    v_foundation_kind;

  relation_kind :=
    p_relation_kind;

  source_record_type :=
    v_source_record_type;

  source_record_id :=
    v_source_record_id;

  return next;

end;
$function$;

commit;
