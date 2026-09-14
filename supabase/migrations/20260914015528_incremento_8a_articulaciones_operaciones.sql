begin;

create function mp25m_api.create_opportunity_articulation(
  p_actor_internal_user_id uuid,
  p_opportunity_id uuid,
  p_title text,
  p_objective text,
  p_responsible_internal_user_id uuid default null
)
returns table (articulation_id uuid, created_at timestamptz)
language plpgsql security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare v_articulation_id uuid; v_created_at timestamptz;
begin
  if char_length(btrim(p_title)) not between 3 and 200 or char_length(btrim(p_objective)) not between 3 and 10000 then
    raise exception 'Invalid opportunity articulation title or objective' using errcode = '22023';
  end if;
  if not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, p_opportunity_id, 'formulate') then
    raise exception 'Internal user cannot create this opportunity articulation' using errcode = '42501';
  end if;
  insert into mp25m.opportunity_articulations (opportunity_id, title, objective, status, responsible_internal_user_id, created_by_internal_user_id)
  values (p_opportunity_id, btrim(p_title), btrim(p_objective), 'draft', p_responsible_internal_user_id, p_actor_internal_user_id)
  returning id, mp25m.opportunity_articulations.created_at into v_articulation_id, v_created_at;
  insert into mp25m.opportunity_articulation_status_history (articulation_id, transition_no, status, rationale, responsible_internal_user_id, changed_by_internal_user_id, changed_at)
  values (v_articulation_id, 1, 'draft', btrim(p_objective), p_responsible_internal_user_id, p_actor_internal_user_id, v_created_at);
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata)
  values (p_actor_internal_user_id, 'opportunity.articulation.create', 'mp25m', 'opportunity_articulations', v_articulation_id, btrim(p_objective), jsonb_build_object('title', btrim(p_title), 'status', 'draft', 'responsible_internal_user_id', p_responsible_internal_user_id), 'allowed', jsonb_build_object('opportunity_id', p_opportunity_id));
  articulation_id := v_articulation_id; created_at := v_created_at; return next;
end;
$function$;

revoke all on function mp25m_api.create_opportunity_articulation(uuid, uuid, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function mp25m_api.create_opportunity_articulation(uuid, uuid, text, text, uuid) to service_role;

commit;
