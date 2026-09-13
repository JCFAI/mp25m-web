begin;

create table mp25m.opportunity_gap_actions (
  id uuid primary key default gen_random_uuid(),
  gap_id uuid not null references mp25m.opportunity_gaps(id) on delete restrict,
  action_type text not null check (action_type in ('search_mp25m', 'search_argentina', 'search_international', 'contact_actor', 'request_information', 'request_quote', 'verify_capacity', 'verify_availability', 'verify_certification', 'call_for_participants', 'develop_capacity', 'acquire_equipment', 'seek_financing', 'coordinate_meeting', 'reanalyze_requirement', 'other')),
  status text not null check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  rationale text not null check (char_length(btrim(rationale)) between 3 and 10000),
  responsible_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index opportunity_gap_actions_gap_id_idx on mp25m.opportunity_gap_actions(gap_id, created_at desc);
alter table mp25m.opportunity_gap_actions enable row level security;
revoke all on mp25m.opportunity_gap_actions from public, anon, authenticated, service_role;
grant select, insert, update on mp25m.opportunity_gap_actions to service_role;

create function mp25m_api.create_opportunity_gap_action(
  p_actor_internal_user_id uuid, p_gap_id uuid, p_action_type text, p_rationale text,
  p_responsible_internal_user_id uuid default null
)
returns table (action_id uuid, created_at timestamptz)
language plpgsql security invoker set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare v_opportunity_id uuid; v_action_id uuid; v_created_at timestamptz;
begin
  if p_action_type not in ('search_mp25m', 'search_argentina', 'search_international', 'contact_actor', 'request_information', 'request_quote', 'verify_capacity', 'verify_availability', 'verify_certification', 'call_for_participants', 'develop_capacity', 'acquire_equipment', 'seek_financing', 'coordinate_meeting', 'reanalyze_requirement', 'other') then raise exception 'Invalid opportunity gap action type' using errcode = '22023'; end if;
  if char_length(btrim(p_rationale)) not between 3 and 10000 then raise exception 'Invalid opportunity gap action rationale' using errcode = '22023'; end if;
  select opportunity_id into v_opportunity_id from mp25m.opportunity_gaps where id = p_gap_id;
  if v_opportunity_id is null then raise exception 'Opportunity gap not found' using errcode = 'P0002'; end if;
  if not mp25m_api.can_operate_opportunity_requirement_evaluation(p_actor_internal_user_id, v_opportunity_id, 'coverage') then raise exception 'Internal user cannot create this opportunity gap action' using errcode = '42501'; end if;
  insert into mp25m.opportunity_gap_actions (gap_id, action_type, status, rationale, responsible_internal_user_id, created_by_internal_user_id)
  values (p_gap_id, p_action_type, 'planned', btrim(p_rationale), p_responsible_internal_user_id, p_actor_internal_user_id)
  returning id, mp25m.opportunity_gap_actions.created_at into v_action_id, v_created_at;
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata)
  values (p_actor_internal_user_id, 'opportunity.gap.action.create', 'mp25m', 'opportunity_gap_actions', v_action_id, btrim(p_rationale), jsonb_build_object('action_type', p_action_type, 'status', 'planned'), 'allowed', jsonb_build_object('gap_id', p_gap_id, 'opportunity_id', v_opportunity_id));
  action_id := v_action_id; created_at := v_created_at; return next;
end;
$function$;

create view mp25m_api.opportunity_gap_action_list with (security_invoker = true) as
select action.id as action_id, action.gap_id, action.action_type, action.status, action.rationale,
  action.responsible_internal_user_id, responsible.display_name as responsible_display_name,
  action.created_by_internal_user_id, creator.display_name as created_by_display_name, action.created_at, action.updated_at
from mp25m.opportunity_gap_actions action
left join mp25m.internal_users responsible on responsible.id = action.responsible_internal_user_id
join mp25m.internal_users creator on creator.id = action.created_by_internal_user_id;

revoke all on function mp25m_api.create_opportunity_gap_action(uuid, uuid, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function mp25m_api.create_opportunity_gap_action(uuid, uuid, text, text, uuid) to service_role;
revoke all on mp25m_api.opportunity_gap_action_list from public, anon, authenticated, service_role;
grant select on mp25m_api.opportunity_gap_action_list to service_role;

commit;
