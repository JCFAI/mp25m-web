begin;

create or replace function mp25m_api.transition_opportunity_gap(
  p_actor_internal_user_id uuid,
  p_gap_id uuid,
  p_status text,
  p_rationale text,
  p_responsible_internal_user_id uuid default null
)
returns table (gap_id uuid, transition_no integer, changed_at timestamptz)
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_gap mp25m.opportunity_gaps%rowtype;
  v_transition_no integer;
  v_changed_at timestamptz;
begin
  if p_status not in ('open', 'in_treatment', 'blocked', 'resolved', 'closed_unresolved', 'cancelled') then
    raise exception 'Invalid opportunity gap status' using errcode = '22023';
  end if;
  if char_length(btrim(p_rationale)) not between 3 and 10000 then
    raise exception 'Invalid opportunity gap rationale' using errcode = '22023';
  end if;

  select * into v_gap from mp25m.opportunity_gaps where id = p_gap_id for update;
  if not found then raise exception 'Opportunity gap not found' using errcode = 'P0002'; end if;
  if not mp25m_api.can_operate_opportunity_requirement_evaluation(p_actor_internal_user_id, v_gap.opportunity_id, 'coverage') then
    raise exception 'Internal user cannot update this opportunity gap' using errcode = '42501';
  end if;
  if p_status in ('resolved', 'closed_unresolved') and p_responsible_internal_user_id is null then
    raise exception 'Resolving or closing an opportunity gap requires a responsible user' using errcode = '22023';
  end if;

  select coalesce(max(history.transition_no), 0) + 1 into v_transition_no
  from mp25m.opportunity_gap_status_history history where history.gap_id = p_gap_id;

  update mp25m.opportunity_gaps set status = p_status, rationale = btrim(p_rationale),
    responsible_internal_user_id = p_responsible_internal_user_id, updated_at = now()
  where id = p_gap_id returning updated_at into v_changed_at;

  insert into mp25m.opportunity_gap_status_history (
    gap_id, transition_no, status, rationale, responsible_internal_user_id, changed_by_internal_user_id, changed_at
  ) values (
    p_gap_id, v_transition_no, p_status, btrim(p_rationale), p_responsible_internal_user_id, p_actor_internal_user_id, v_changed_at
  );

  insert into mp25m.audit_events (
    actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata
  ) values (
    p_actor_internal_user_id, 'opportunity.gap.transition', 'mp25m', 'opportunity_gaps', p_gap_id,
    btrim(p_rationale), jsonb_build_object('status', p_status), 'allowed',
    jsonb_build_object('opportunity_id', v_gap.opportunity_id, 'transition_no', v_transition_no)
  );

  gap_id := p_gap_id;
  transition_no := v_transition_no;
  changed_at := v_changed_at;
  return next;
end;
$function$;

commit;
