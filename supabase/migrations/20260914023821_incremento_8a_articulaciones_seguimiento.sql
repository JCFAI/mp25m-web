begin;

create function mp25m_api.transition_opportunity_articulation(p_actor_internal_user_id uuid, p_articulation_id uuid, p_status text, p_rationale text, p_responsible_internal_user_id uuid default null, p_closing_summary text default null)
returns table (articulation_id uuid, transition_no integer, changed_at timestamptz)
language plpgsql security invoker set search_path = pg_catalog, mp25m, mp25m_api as $function$
declare v_articulation mp25m.opportunity_articulations%rowtype; v_transition_no integer; v_changed_at timestamptz;
begin
  if p_status not in ('draft', 'active', 'follow_up', 'paused', 'closed_with_result', 'closed_without_result', 'cancelled') or char_length(btrim(p_rationale)) not between 3 and 10000 then raise exception 'Invalid opportunity articulation transition' using errcode = '22023'; end if;
  select * into v_articulation from mp25m.opportunity_articulations where id = p_articulation_id for update;
  if not found then raise exception 'Opportunity articulation not found' using errcode = 'P0002'; end if;
  if not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, v_articulation.opportunity_id, 'formulate') then raise exception 'Internal user cannot update this opportunity articulation' using errcode = '42501'; end if;
  if p_status = 'active' and p_responsible_internal_user_id is null then raise exception 'Activating an opportunity articulation requires a responsible user' using errcode = '22023'; end if;
  if p_status in ('closed_with_result', 'closed_without_result') and (p_responsible_internal_user_id is null or char_length(btrim(coalesce(p_closing_summary, ''))) not between 3 and 10000) then raise exception 'Closing an opportunity articulation requires a responsible user and summary' using errcode = '22023'; end if;
  select coalesce(max(transition_no), 0) + 1 into v_transition_no from mp25m.opportunity_articulation_status_history where articulation_id = p_articulation_id;
  update mp25m.opportunity_articulations set status = p_status, responsible_internal_user_id = p_responsible_internal_user_id, closing_summary = case when p_status in ('closed_with_result', 'closed_without_result') then btrim(p_closing_summary) else null end, closed_at = case when p_status in ('closed_with_result', 'closed_without_result') then now() else null end, updated_at = now() where id = p_articulation_id returning updated_at into v_changed_at;
  insert into mp25m.opportunity_articulation_status_history (articulation_id, transition_no, status, rationale, responsible_internal_user_id, changed_by_internal_user_id, changed_at) values (p_articulation_id, v_transition_no, p_status, btrim(p_rationale), p_responsible_internal_user_id, p_actor_internal_user_id, v_changed_at);
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, old_data, new_data, result, metadata) values (p_actor_internal_user_id, 'opportunity.articulation.transition', 'mp25m', 'opportunity_articulations', p_articulation_id, btrim(p_rationale), jsonb_build_object('status', v_articulation.status, 'responsible_internal_user_id', v_articulation.responsible_internal_user_id), jsonb_build_object('status', p_status, 'responsible_internal_user_id', p_responsible_internal_user_id), 'allowed', jsonb_build_object('opportunity_id', v_articulation.opportunity_id, 'transition_no', v_transition_no));
  articulation_id := p_articulation_id; transition_no := v_transition_no; changed_at := v_changed_at; return next;
end;
$function$;

create function mp25m_api.add_opportunity_articulation_participant(p_actor_internal_user_id uuid, p_articulation_id uuid, p_person_id uuid default null, p_organization_id uuid default null, p_rationale text default null)
returns uuid language plpgsql security invoker set search_path = pg_catalog, mp25m, mp25m_api as $function$
declare v_opportunity_id uuid; v_participant_id uuid;
begin
  if (p_person_id is not null)::integer + (p_organization_id is not null)::integer <> 1 or char_length(btrim(coalesce(p_rationale, ''))) not between 3 and 10000 then raise exception 'Invalid opportunity articulation participant' using errcode = '22023'; end if;
  select opportunity_id into v_opportunity_id from mp25m.opportunity_articulations where id = p_articulation_id;
  if v_opportunity_id is null then raise exception 'Opportunity articulation not found' using errcode = 'P0002'; end if;
  if not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, v_opportunity_id, 'formulate') then raise exception 'Internal user cannot add this opportunity articulation participant' using errcode = '42501'; end if;
  insert into mp25m.opportunity_articulation_participants (articulation_id, person_id, organization_id, rationale, added_by_internal_user_id) values (p_articulation_id, p_person_id, p_organization_id, btrim(p_rationale), p_actor_internal_user_id) returning id into v_participant_id;
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata) values (p_actor_internal_user_id, 'opportunity.articulation.participant.add', 'mp25m', 'opportunity_articulation_participants', v_participant_id, btrim(p_rationale), jsonb_build_object('person_id', p_person_id, 'organization_id', p_organization_id), 'allowed', jsonb_build_object('articulation_id', p_articulation_id, 'opportunity_id', v_opportunity_id));
  return v_participant_id;
end;
$function$;

create function mp25m_api.create_opportunity_articulation_followup(p_actor_internal_user_id uuid, p_articulation_id uuid, p_followup_type text, p_detail text)
returns uuid language plpgsql security invoker set search_path = pg_catalog, mp25m, mp25m_api as $function$
declare v_opportunity_id uuid; v_followup_id uuid;
begin
  if p_followup_type not in ('general', 'meeting', 'commitment', 'contact', 'result') or char_length(btrim(p_detail)) not between 3 and 10000 then raise exception 'Invalid opportunity articulation followup' using errcode = '22023'; end if;
  select opportunity_id into v_opportunity_id from mp25m.opportunity_articulations where id = p_articulation_id;
  if v_opportunity_id is null or not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, v_opportunity_id, 'formulate') then raise exception 'Internal user cannot create this opportunity articulation followup' using errcode = '42501'; end if;
  insert into mp25m.opportunity_articulation_followups (articulation_id, followup_type, detail, created_by_internal_user_id) values (p_articulation_id, p_followup_type, btrim(p_detail), p_actor_internal_user_id) returning id into v_followup_id;
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata) values (p_actor_internal_user_id, 'opportunity.articulation.followup.create', 'mp25m', 'opportunity_articulation_followups', v_followup_id, btrim(p_detail), jsonb_build_object('followup_type', p_followup_type), 'allowed', jsonb_build_object('articulation_id', p_articulation_id, 'opportunity_id', v_opportunity_id));
  return v_followup_id;
end;
$function$;

revoke all on function mp25m_api.transition_opportunity_articulation(uuid, uuid, text, text, uuid, text), mp25m_api.add_opportunity_articulation_participant(uuid, uuid, uuid, uuid, text), mp25m_api.create_opportunity_articulation_followup(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function mp25m_api.transition_opportunity_articulation(uuid, uuid, text, text, uuid, text), mp25m_api.add_opportunity_articulation_participant(uuid, uuid, uuid, uuid, text), mp25m_api.create_opportunity_articulation_followup(uuid, uuid, text, text) to service_role;

commit;
