begin;

create function mp25m_api.transition_opportunity_gap_action(
  p_actor_internal_user_id uuid, p_action_id uuid, p_status text, p_rationale text,
  p_responsible_internal_user_id uuid default null
)
returns table (action_id uuid, updated_at timestamptz)
language plpgsql security invoker set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare v_opportunity_id uuid; v_updated_at timestamptz;
begin
  if p_status not in ('planned', 'in_progress', 'completed', 'cancelled') then raise exception 'Invalid opportunity gap action status' using errcode = '22023'; end if;
  if char_length(btrim(p_rationale)) not between 3 and 10000 then raise exception 'Invalid opportunity gap action rationale' using errcode = '22023'; end if;
  select gap.opportunity_id into v_opportunity_id from mp25m.opportunity_gap_actions action join mp25m.opportunity_gaps gap on gap.id = action.gap_id where action.id = p_action_id for update of action;
  if v_opportunity_id is null then raise exception 'Opportunity gap action not found' using errcode = 'P0002'; end if;
  if not mp25m_api.can_operate_opportunity_requirement_evaluation(p_actor_internal_user_id, v_opportunity_id, 'coverage') then raise exception 'Internal user cannot update this opportunity gap action' using errcode = '42501'; end if;
  update mp25m.opportunity_gap_actions action set status = p_status, rationale = btrim(p_rationale), responsible_internal_user_id = p_responsible_internal_user_id, updated_at = now() where action.id = p_action_id returning action.updated_at into v_updated_at;
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata) values (p_actor_internal_user_id, 'opportunity.gap.action.transition', 'mp25m', 'opportunity_gap_actions', p_action_id, btrim(p_rationale), jsonb_build_object('status', p_status), 'allowed', jsonb_build_object('opportunity_id', v_opportunity_id));
  action_id := p_action_id; updated_at := v_updated_at; return next;
end;
$function$;

revoke all on function mp25m_api.transition_opportunity_gap_action(uuid, uuid, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function mp25m_api.transition_opportunity_gap_action(uuid, uuid, text, text, uuid) to service_role;

commit;
