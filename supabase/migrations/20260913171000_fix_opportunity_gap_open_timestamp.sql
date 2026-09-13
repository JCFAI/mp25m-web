begin;

create or replace function mp25m_api.open_opportunity_gap(
  p_actor_internal_user_id uuid,
  p_requirement_revision_id uuid,
  p_coverage_layer text,
  p_gap_type text,
  p_rationale text,
  p_responsible_internal_user_id uuid default null
)
returns table (gap_id uuid, opened_at timestamptz)
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_opportunity_id uuid;
  v_coverage_status text;
  v_gap_id uuid;
  v_opened_at timestamptz;
begin
  if p_coverage_layer not in ('network_mp25m', 'expanded_argentina') then
    raise exception 'Invalid opportunity gap coverage layer' using errcode = '22023';
  end if;
  if p_gap_type not in ('capacity', 'scale', 'availability', 'resource_equipment', 'certification_authorization', 'knowledge', 'articulation', 'financing', 'logistics', 'deadline', 'other') then
    raise exception 'Invalid opportunity gap type' using errcode = '22023';
  end if;
  if char_length(btrim(p_rationale)) not between 3 and 10000 then
    raise exception 'Invalid opportunity gap rationale' using errcode = '22023';
  end if;

  select requirement.opportunity_id into v_opportunity_id
  from mp25m.opportunity_requirement_revisions revision
  join mp25m.opportunity_requirements requirement on requirement.id = revision.requirement_id
  where revision.id = p_requirement_revision_id
    and requirement.record_status = 'active'
    and revision.validation_status = 'validated'
    and not exists (
      select 1 from mp25m.opportunity_requirement_revisions newer
      where newer.requirement_id = revision.requirement_id and newer.revision_no > revision.revision_no
    );

  if v_opportunity_id is null then
    raise exception 'Only validated current opportunity requirement revisions may open gaps' using errcode = '23514';
  end if;
  if not mp25m_api.can_operate_opportunity_requirement_evaluation(p_actor_internal_user_id, v_opportunity_id, 'coverage') then
    raise exception 'Internal user cannot open this opportunity gap' using errcode = '42501';
  end if;

  select layer.coverage_status into v_coverage_status
  from mp25m.opportunity_requirement_coverage_evaluations evaluation
  join mp25m.opportunity_requirement_coverage_evaluation_layers layer on layer.coverage_evaluation_id = evaluation.id
  where evaluation.requirement_revision_id = p_requirement_revision_id
    and layer.coverage_layer = p_coverage_layer
  order by evaluation.evaluation_no desc
  limit 1;

  if v_coverage_status not in ('partial', 'missing') then
    raise exception 'Opportunity gaps require a current partial or missing coverage conclusion' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_requirement_revision_id::text || ':' || p_coverage_layer, 0));

  insert into mp25m.opportunity_gaps (
    opportunity_id, requirement_revision_id, coverage_layer, gap_type, status,
    rationale, responsible_internal_user_id, opened_by_internal_user_id
  ) values (
    v_opportunity_id, p_requirement_revision_id, p_coverage_layer, p_gap_type, 'open',
    btrim(p_rationale), p_responsible_internal_user_id, p_actor_internal_user_id
  ) returning id, mp25m.opportunity_gaps.opened_at into v_gap_id, v_opened_at;

  insert into mp25m.opportunity_gap_status_history (
    gap_id, transition_no, status, rationale, responsible_internal_user_id, changed_by_internal_user_id, changed_at
  ) values (
    v_gap_id, 1, 'open', btrim(p_rationale), p_responsible_internal_user_id, p_actor_internal_user_id, v_opened_at
  );

  insert into mp25m.audit_events (
    actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata
  ) values (
    p_actor_internal_user_id, 'opportunity.gap.open', 'mp25m', 'opportunity_gaps', v_gap_id,
    btrim(p_rationale), jsonb_build_object('gap_type', p_gap_type, 'coverage_layer', p_coverage_layer, 'status', 'open'),
    'allowed', jsonb_build_object('opportunity_id', v_opportunity_id, 'requirement_revision_id', p_requirement_revision_id)
  );

  gap_id := v_gap_id;
  opened_at := v_opened_at;
  return next;
end;
$function$;

commit;
