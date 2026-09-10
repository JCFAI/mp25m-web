begin;

CREATE OR REPLACE FUNCTION mp25m_api.assess_opportunity_requirement_match(p_actor_internal_user_id uuid, p_match_id uuid, p_expected_assessment_no integer, p_assessment_kind text, p_rationale text, p_foundation_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(assessment_id uuid, assessment_no integer, assessment_kind text, foundation_count integer)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'mp25m', 'mp25m_api'
AS $function$
declare
  v_opportunity_id uuid;
  v_requirement_id uuid;
  v_requirement_revision_id uuid;
  v_revision_no integer;

  v_requirement_record_status text;
  v_validation_status text;

  v_match_status text;

  v_actor_kind text;
  v_actor_id uuid;

  v_candidate_status text;
  v_candidate_resolved_person_id uuid;
  v_candidate_resolved_organization_id uuid;

  v_current_assessment_id uuid;
  v_current_assessment_no integer;
  v_current_assessment_kind text;

  v_new_assessment_id uuid;
  v_new_assessment_no integer;

  v_rationale text;

  v_foundation_count integer;
  v_unique_foundation_count integer;
  v_valid_foundation_count integer;

  v_action text;
begin

  -- -------------------------------------------------------------------------
  -- Entrada
  -- -------------------------------------------------------------------------

  if p_assessment_kind not in (
    'satisfies',
    'partially_satisfies',
    'does_not_satisfy',
    'insufficient_evidence'
  ) then
    raise exception
      'Invalid opportunity requirement match assessment kind'
      using errcode = '22023';
  end if;


  v_rationale :=
    nullif(
      btrim(
        coalesce(
          p_rationale,
          ''
        )
      ),
      ''
    );


  if v_rationale is null
     or char_length(v_rationale) < 3
     or char_length(v_rationale) > 10000
  then
    raise exception
      'Assessment rationale must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- Bloquear el match.
  -- Serializa evaluaciones concurrentes sobre el mismo match.
  -- -------------------------------------------------------------------------

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
    ),

    candidate.status,
    candidate.resolved_person_id,
    candidate.resolved_organization_id

  into
    v_requirement_revision_id,
    v_match_status,

    v_opportunity_id,
    v_requirement_id,
    v_requirement_record_status,

    v_revision_no,
    v_validation_status,

    v_actor_kind,
    v_actor_id,

    v_candidate_status,
    v_candidate_resolved_person_id,
    v_candidate_resolved_organization_id

  from mp25m.opportunity_requirement_matches match

  join mp25m.opportunity_requirement_revisions revision
    on revision.id =
      match.requirement_revision_id

  join mp25m.opportunity_requirements requirement
    on requirement.id =
      revision.requirement_id

  left join mp25m.actor_candidates candidate
    on candidate.id =
      match.actor_candidate_id

  where match.id =
    p_match_id

  for update of match;


  if not found then
    raise exception
      'Opportunity requirement match not found'
      using errcode = 'P0002';
  end if;


  -- -------------------------------------------------------------------------
  -- Sólo revisión exacta actual + activa + validada.
  -- -------------------------------------------------------------------------

  if v_requirement_record_status <> 'active' then
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
      'Historical opportunity requirement matches cannot be newly assessed'
      using errcode = '22023';
  end if;


  if v_validation_status <> 'validated' then
    raise exception
      'Only validated current opportunity requirement matches may be assessed'
      using errcode = '22023';
  end if;


  if v_match_status <> 'accepted_for_analysis' then
    raise exception
      'Only accepted_for_analysis matches may be assessed'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- Permisos.
  -- -------------------------------------------------------------------------

  if not
    mp25m_api.can_operate_opportunity_requirement_evaluation(
      p_actor_internal_user_id,
      v_opportunity_id,
      'assess'
    )
  then
    raise exception
      'Internal user cannot assess this opportunity requirement match'
      using errcode = '42501';
  end if;


  -- -------------------------------------------------------------------------
  -- Regla de candidato no resuelto.
  --
  -- Mientras no exista identidad canónica:
  --
  -- contexto ≠ prueba de capacidad
  -- -------------------------------------------------------------------------

  if v_actor_kind = 'candidate' then

    if v_candidate_resolved_person_id is not null
       or v_candidate_resolved_organization_id is not null
    then
      raise exception
        'Resolved candidate matches cannot be newly assessed; rematerialize the canonical actor'
        using errcode = '22023';
    end if;


    if v_candidate_status not in (
      'pending',
      'approved'
    ) then
      raise exception
        'Inactive or rejected candidates cannot be newly assessed'
        using errcode = '22023';
    end if;


    if p_assessment_kind <> 'insufficient_evidence' then
      raise exception
        'Unresolved candidates may only be assessed as insufficient_evidence'
        using errcode = '22023';
    end if;

  end if;


  -- -------------------------------------------------------------------------
  -- Stale guard de evaluación del match.
  -- -------------------------------------------------------------------------

  select
    assessment.id,
    assessment.assessment_no,
    assessment.assessment_kind

  into
    v_current_assessment_id,
    v_current_assessment_no,
    v_current_assessment_kind

  from mp25m.opportunity_requirement_match_assessments assessment

  where assessment.match_id =
    p_match_id

  order by
    assessment.assessment_no desc

  limit 1;


  if p_expected_assessment_no
     is distinct from
     v_current_assessment_no
  then
    raise exception
      'Match assessment changed; reload before assessing'
      using errcode = 'PT409';
  end if;


  -- -------------------------------------------------------------------------
  -- Foundations seleccionadas.
  -- -------------------------------------------------------------------------

  v_foundation_count :=
    coalesce(
      cardinality(
        p_foundation_ids
      ),
      0
    );


  if exists (
    select 1

    from unnest(
      coalesce(
        p_foundation_ids,
        '{}'::uuid[]
      )
    ) selected(foundation_id)

    where selected.foundation_id is null
  ) then
    raise exception
      'Foundation ids cannot contain null values'
      using errcode = '22023';
  end if;


  select
    count(
      distinct selected.foundation_id
    )

  into
    v_unique_foundation_count

  from unnest(
    coalesce(
      p_foundation_ids,
      '{}'::uuid[]
    )
  ) selected(foundation_id);


  if v_unique_foundation_count <>
     v_foundation_count
  then
    raise exception
      'Foundation ids cannot contain duplicates'
      using errcode = '22023';
  end if;


  if p_assessment_kind <> 'insufficient_evidence'
     and v_foundation_count = 0
  then
    raise exception
      'Substantive match assessments require at least one frozen foundation'
      using errcode = '22023';
  end if;


  select
    count(*)

  into
    v_valid_foundation_count

  from mp25m.opportunity_requirement_match_foundations foundation

  where foundation.match_id =
      p_match_id

    and foundation.id = any(
      coalesce(
        p_foundation_ids,
        '{}'::uuid[]
      )
    );


  if v_valid_foundation_count <>
     v_foundation_count
  then
    raise exception
      'Every selected foundation must belong to the assessed match'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- Nueva evaluación append-only.
  -- -------------------------------------------------------------------------

  v_new_assessment_no :=
    coalesce(
      v_current_assessment_no,
      0
    ) + 1;


  insert into mp25m.opportunity_requirement_match_assessments (
    match_id,
    assessment_no,
    assessment_kind,
    rationale,
    assessed_by_internal_user_id
  )
  values (
    p_match_id,
    v_new_assessment_no,
    p_assessment_kind,
    v_rationale,
    p_actor_internal_user_id
  )
  returning id
  into v_new_assessment_id;


  insert into
  mp25m.opportunity_requirement_match_assessment_foundations (
    assessment_id,
    match_id,
    foundation_id,
    linked_by_internal_user_id
  )

  select
    v_new_assessment_id,
    p_match_id,
    selected.foundation_id,
    p_actor_internal_user_id

  from unnest(
    coalesce(
      p_foundation_ids,
      '{}'::uuid[]
    )
  ) selected(foundation_id);


  -- -------------------------------------------------------------------------
  -- Auditoría.
  -- -------------------------------------------------------------------------

  v_action :=
    case
      when v_current_assessment_no is null
      then 'opportunity.requirement.match.assess'
      else 'opportunity.requirement.match.reassess'
    end;


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,

    target_schema,
    target_table,
    target_id,

    reason,

    old_data,
    new_data,

    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    v_action,

    'mp25m',
    'opportunity_requirement_match_assessments',
    v_new_assessment_id,

    v_rationale,

    case
      when v_current_assessment_no is null
      then null
      else
        jsonb_build_object(
          'assessment_id',
            v_current_assessment_id,
          'assessment_no',
            v_current_assessment_no,
          'assessment_kind',
            v_current_assessment_kind
        )
    end,

    jsonb_build_object(
      'assessment_no',
        v_new_assessment_no,
      'assessment_kind',
        p_assessment_kind,
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


  assessment_id :=
    v_new_assessment_id;

  assessment_no :=
    v_new_assessment_no;

  assessment_kind :=
    p_assessment_kind;

  foundation_count :=
    v_foundation_count;

  return next;

end;
$function$;

CREATE OR REPLACE FUNCTION mp25m_api.evaluate_opportunity_requirement_coverage(p_actor_internal_user_id uuid, p_requirement_revision_id uuid, p_expected_evaluation_no integer, p_coverage_status text, p_rationale text, p_match_assessment_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(coverage_evaluation_id uuid, evaluation_no integer, coverage_status text, linked_match_assessment_count integer)
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'mp25m', 'mp25m_api'
AS $function$
declare
  v_opportunity_id uuid;
  v_requirement_id uuid;

  v_revision_no integer;
  v_requirement_record_status text;
  v_validation_status text;

  v_current_evaluation_id uuid;
  v_current_evaluation_no integer;
  v_current_coverage_status text;

  v_new_evaluation_id uuid;
  v_new_evaluation_no integer;

  v_rationale text;

  v_assessment_count integer;
  v_unique_assessment_count integer;
  v_valid_assessment_count integer;

  v_satisfies_count integer;
  v_partial_count integer;

  v_action text;
begin

  -- -------------------------------------------------------------------------
  -- Entrada.
  -- -------------------------------------------------------------------------

  if p_coverage_status not in (
    'covered',
    'partial',
    'missing'
  ) then
    raise exception
      'Invalid opportunity requirement coverage status'
      using errcode = '22023';
  end if;


  v_rationale :=
    nullif(
      btrim(
        coalesce(
          p_rationale,
          ''
        )
      ),
      ''
    );


  if v_rationale is null
     or char_length(v_rationale) < 3
     or char_length(v_rationale) > 10000
  then
    raise exception
      'Coverage rationale must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- Bloqueo de revisión.
  -- Serializa evaluaciones de cobertura concurrentes.
  -- -------------------------------------------------------------------------

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
    v_requirement_record_status,
    v_validation_status

  from mp25m.opportunity_requirement_revisions revision

  join mp25m.opportunity_requirements requirement
    on requirement.id =
      revision.requirement_id

  where revision.id =
    p_requirement_revision_id

  for update of revision;


  if not found then
    raise exception
      'Opportunity requirement revision not found'
      using errcode = 'P0002';
  end if;


  -- -------------------------------------------------------------------------
  -- Sólo current + active + validated.
  -- -------------------------------------------------------------------------

  if v_requirement_record_status <> 'active' then
    raise exception
      'Withdrawn opportunity requirements cannot receive new coverage evaluations'
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
      'Historical opportunity requirement revisions cannot receive new coverage evaluations'
      using errcode = '22023';
  end if;


  if v_validation_status <> 'validated' then
    raise exception
      'Only validated current opportunity requirement revisions may receive coverage evaluations'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- Permisos.
  -- -------------------------------------------------------------------------

  if not
    mp25m_api.can_operate_opportunity_requirement_evaluation(
      p_actor_internal_user_id,
      v_opportunity_id,
      'coverage'
    )
  then
    raise exception
      'Internal user cannot evaluate this opportunity requirement coverage'
      using errcode = '42501';
  end if;


  -- -------------------------------------------------------------------------
  -- Stale guard de cobertura.
  -- -------------------------------------------------------------------------

  select
    evaluation.id,
    evaluation.evaluation_no,
    evaluation.coverage_status

  into
    v_current_evaluation_id,
    v_current_evaluation_no,
    v_current_coverage_status

  from mp25m.opportunity_requirement_coverage_evaluations evaluation

  where evaluation.requirement_revision_id =
    p_requirement_revision_id

  order by
    evaluation.evaluation_no desc

  limit 1;


  if p_expected_evaluation_no
     is distinct from
     v_current_evaluation_no
  then
    raise exception
      'Requirement coverage evaluation changed; reload before evaluating'
      using errcode = 'PT409';
  end if;


  -- -------------------------------------------------------------------------
  -- Lista de evaluaciones de matches.
  -- -------------------------------------------------------------------------

  v_assessment_count :=
    coalesce(
      cardinality(
        p_match_assessment_ids
      ),
      0
    );


  if exists (
    select 1

    from unnest(
      coalesce(
        p_match_assessment_ids,
        '{}'::uuid[]
      )
    ) selected(assessment_id)

    where selected.assessment_id is null
  ) then
    raise exception
      'Match assessment ids cannot contain null values'
      using errcode = '22023';
  end if;


  select
    count(
      distinct selected.assessment_id
    )

  into
    v_unique_assessment_count

  from unnest(
    coalesce(
      p_match_assessment_ids,
      '{}'::uuid[]
    )
  ) selected(assessment_id);


  if v_unique_assessment_count <>
     v_assessment_count
  then
    raise exception
      'Match assessment ids cannot contain duplicates'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- Bloqueo determinístico de los matches seleccionados.
  --
  -- Serializa esta evaluación de cobertura con cualquier reassessment
  -- concurrente de los mismos matches. Los ids se derivan server-side desde
  -- los assessments seleccionados y se limitan a esta revisión exacta.
  -- -------------------------------------------------------------------------

  perform match.id

  from mp25m.opportunity_requirement_matches match

  join (
    select distinct
      assessment.match_id

    from unnest(
      coalesce(
        p_match_assessment_ids,
        '{}'::uuid[]
      )
    ) selected(assessment_id)

    join mp25m.opportunity_requirement_match_assessments assessment
      on assessment.id =
        selected.assessment_id
  ) selected_match
    on selected_match.match_id =
      match.id

  where match.requirement_revision_id =
    p_requirement_revision_id

  order by match.id

  for update of match;


  -- -------------------------------------------------------------------------
  -- Todos los assessments utilizados deben ser:
  --
  -- - de esta revisión exacta;
  -- - de un match accepted_for_analysis;
  -- - la evaluación vigente de ese match.
  -- -------------------------------------------------------------------------

  select
    count(*),

    count(*) filter (
      where assessment.assessment_kind =
        'satisfies'
    ),

    count(*) filter (
      where assessment.assessment_kind =
        'partially_satisfies'
    )

  into
    v_valid_assessment_count,
    v_satisfies_count,
    v_partial_count

  from mp25m.opportunity_requirement_match_assessments assessment

  join mp25m.opportunity_requirement_matches match
    on match.id =
      assessment.match_id

  where assessment.id = any(
      coalesce(
        p_match_assessment_ids,
        '{}'::uuid[]
      )
    )

    and match.requirement_revision_id =
      p_requirement_revision_id

    and match.status =
      'accepted_for_analysis'

    and not exists (
      select 1

      from mp25m.opportunity_requirement_match_assessments
        newer_assessment

      where newer_assessment.match_id =
          assessment.match_id

        and newer_assessment.assessment_no >
          assessment.assessment_no
    );


  if v_valid_assessment_count <>
     v_assessment_count
  then
    raise exception
      'Coverage may only use current assessments from accepted matches of this exact requirement revision'
      using errcode = '22023';
  end if;


  -- -------------------------------------------------------------------------
  -- Coherencia semántica mínima.
  -- -------------------------------------------------------------------------

  if p_coverage_status = 'covered' then

    if v_assessment_count = 0 then
      raise exception
        'Covered requires at least one current match assessment'
        using errcode = '22023';
    end if;


    if v_satisfies_count = 0
       and v_partial_count < 2
    then
      raise exception
        'Covered requires a satisfies assessment or at least two partially_satisfies assessments'
        using errcode = '22023';
    end if;

  elsif p_coverage_status = 'partial' then

    if v_assessment_count = 0 then
      raise exception
        'Partial coverage requires at least one current match assessment'
        using errcode = '22023';
    end if;


    if v_satisfies_count > 0 then
      raise exception
        'Partial coverage cannot use a satisfies assessment'
        using errcode = '22023';
    end if;


    if v_partial_count = 0 then
      raise exception
        'Partial coverage requires at least one partially_satisfies assessment'
        using errcode = '22023';
    end if;

  else

    -- missing puede declararse sin matches.
    --
    -- Si se utilizan evaluaciones de matches:
    -- - ninguna puede afirmar satisfacción parcial o total;
    -- - insufficient_evidence tampoco prueba una brecha.
    --
    -- Por lo tanto, los assessments explícitamente vinculados a missing
    -- sólo pueden ser does_not_satisfy.

    if v_satisfies_count > 0
       or v_partial_count > 0
    then
      raise exception
        'Missing coverage cannot use satisfies or partially_satisfies assessments'
        using errcode = '22023';
    end if;


    if exists (
      select 1

      from mp25m.opportunity_requirement_match_assessments assessment

      where assessment.id = any(
        coalesce(
          p_match_assessment_ids,
          '{}'::uuid[]
        )
      )

        and assessment.assessment_kind =
          'insufficient_evidence'
    ) then
      raise exception
        'Insufficient evidence cannot support a missing coverage conclusion'
        using errcode = '22023';
    end if;

  end if;


  -- -------------------------------------------------------------------------
  -- Nueva evaluación append-only.
  -- -------------------------------------------------------------------------

  v_new_evaluation_no :=
    coalesce(
      v_current_evaluation_no,
      0
    ) + 1;


  insert into
  mp25m.opportunity_requirement_coverage_evaluations (
    requirement_revision_id,
    evaluation_no,
    coverage_status,
    rationale,
    evaluated_by_internal_user_id
  )
  values (
    p_requirement_revision_id,
    v_new_evaluation_no,
    p_coverage_status,
    v_rationale,
    p_actor_internal_user_id
  )
  returning id
  into v_new_evaluation_id;


  insert into
  mp25m.opportunity_requirement_coverage_evaluation_matches (
    coverage_evaluation_id,
    requirement_revision_id,
    match_assessment_id,
    match_id,
    linked_by_internal_user_id
  )

  select
    v_new_evaluation_id,
    p_requirement_revision_id,
    assessment.id,
    assessment.match_id,
    p_actor_internal_user_id

  from mp25m.opportunity_requirement_match_assessments assessment

  where assessment.id = any(
    coalesce(
      p_match_assessment_ids,
      '{}'::uuid[]
    )
  );


  -- -------------------------------------------------------------------------
  -- Auditoría.
  -- -------------------------------------------------------------------------

  v_action :=
    case
      when v_current_evaluation_no is null
      then 'opportunity.requirement.coverage.evaluate'
      else 'opportunity.requirement.coverage.reevaluate'
    end;


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,

    target_schema,
    target_table,
    target_id,

    reason,

    old_data,
    new_data,

    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    v_action,

    'mp25m',
    'opportunity_requirement_coverage_evaluations',
    v_new_evaluation_id,

    v_rationale,

    case
      when v_current_evaluation_no is null
      then null
      else
        jsonb_build_object(
          'coverage_evaluation_id',
            v_current_evaluation_id,
          'evaluation_no',
            v_current_evaluation_no,
          'coverage_status',
            v_current_coverage_status
        )
    end,

    jsonb_build_object(
      'evaluation_no',
        v_new_evaluation_no,
      'coverage_status',
        p_coverage_status,
      'linked_match_assessment_count',
        v_assessment_count
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
        v_revision_no
    )
  );


  coverage_evaluation_id :=
    v_new_evaluation_id;

  evaluation_no :=
    v_new_evaluation_no;

  coverage_status :=
    p_coverage_status;

  linked_match_assessment_count :=
    v_assessment_count;

  return next;

end;
$function$;

commit;
