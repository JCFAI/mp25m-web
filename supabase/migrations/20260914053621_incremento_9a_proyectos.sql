begin;

create table mp25m.projects (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references mp25m.opportunities(id) on delete restrict,
  source_articulation_id uuid not null unique references mp25m.opportunity_articulations(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  objective text not null check (char_length(btrim(objective)) between 3 and 10000),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  responsible_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  completion_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint projects_completion_check check (
    (status = 'completed' and char_length(btrim(coalesce(completion_summary, ''))) between 3 and 10000 and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create table mp25m.project_status_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references mp25m.projects(id) on delete restrict,
  transition_no integer not null check (transition_no > 0),
  status text not null check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  rationale text not null check (char_length(btrim(rationale)) between 3 and 10000),
  responsible_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  changed_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  unique (project_id, transition_no)
);

create table mp25m.project_followups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references mp25m.projects(id) on delete restrict,
  followup_type text not null default 'general' check (followup_type in ('general', 'meeting', 'commitment', 'progress', 'result')),
  detail text not null check (char_length(btrim(detail)) between 3 and 10000),
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index projects_opportunity_idx on mp25m.projects(opportunity_id, created_at desc);
create index project_followups_project_idx on mp25m.project_followups(project_id, created_at desc);

alter table mp25m.projects enable row level security;
alter table mp25m.project_status_history enable row level security;
alter table mp25m.project_followups enable row level security;

revoke all on mp25m.projects, mp25m.project_status_history, mp25m.project_followups from public, anon, authenticated;
grant select, insert, update on mp25m.projects to service_role;
grant select, insert on mp25m.project_status_history, mp25m.project_followups to service_role;

create view mp25m_api.project_list with (security_invoker = true) as
select
  project.id as project_id,
  project.opportunity_id,
  opportunity.title as opportunity_title,
  project.source_articulation_id,
  articulation.title as source_articulation_title,
  project.title,
  project.objective,
  project.status,
  project.responsible_internal_user_id,
  responsible.display_name as responsible_display_name,
  creator.display_name as created_by_display_name,
  project.completion_summary,
  project.created_at,
  project.updated_at,
  project.completed_at,
  latest_followup.detail as latest_followup_detail,
  latest_followup.created_at as latest_followup_at
from mp25m.projects project
join mp25m.opportunities opportunity on opportunity.id = project.opportunity_id
join mp25m.opportunity_articulations articulation on articulation.id = project.source_articulation_id
join mp25m.internal_users creator on creator.id = project.created_by_internal_user_id
left join mp25m.internal_users responsible on responsible.id = project.responsible_internal_user_id
left join lateral (
  select followup.detail, followup.created_at
  from mp25m.project_followups followup
  where followup.project_id = project.id
  order by followup.created_at desc
  limit 1
) latest_followup on true;

create view mp25m_api.project_source_articulation_list with (security_invoker = true) as
select
  articulation.id as articulation_id,
  articulation.opportunity_id,
  opportunity.title as opportunity_title,
  articulation.title as articulation_title,
  articulation.objective as articulation_objective,
  articulation.closing_summary,
  articulation.closed_at,
  project.id as project_id
from mp25m.opportunity_articulations articulation
join mp25m.opportunities opportunity on opportunity.id = articulation.opportunity_id
left join mp25m.projects project on project.source_articulation_id = articulation.id
where articulation.status = 'closed_with_result';

create view mp25m_api.project_followup_list with (security_invoker = true) as
select
  followup.id as followup_id,
  followup.project_id,
  followup.followup_type,
  followup.detail,
  followup.created_at,
  user_account.display_name as created_by_display_name
from mp25m.project_followups followup
join mp25m.internal_users user_account on user_account.id = followup.created_by_internal_user_id;

revoke all on mp25m_api.project_list, mp25m_api.project_source_articulation_list, mp25m_api.project_followup_list from public, anon, authenticated;
grant select on mp25m_api.project_list, mp25m_api.project_source_articulation_list, mp25m_api.project_followup_list to service_role;

create function mp25m_api.create_project_from_articulation(
  p_actor_internal_user_id uuid,
  p_source_articulation_id uuid,
  p_title text,
  p_objective text,
  p_responsible_internal_user_id uuid default null
)
returns table (project_id uuid, created_at timestamptz)
language plpgsql security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_opportunity_id uuid;
  v_project_id uuid;
  v_created_at timestamptz;
begin
  if char_length(btrim(p_title)) not between 3 and 200 or char_length(btrim(p_objective)) not between 3 and 10000 then
    raise exception 'Invalid project title or objective' using errcode = '22023';
  end if;

  select opportunity_id into v_opportunity_id
  from mp25m.opportunity_articulations
  where id = p_source_articulation_id
    and status = 'closed_with_result';

  if v_opportunity_id is null then
    raise exception 'A project requires an articulation closed with result' using errcode = '22023';
  end if;

  if not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, v_opportunity_id, 'formulate') then
    raise exception 'Internal user cannot create this project' using errcode = '42501';
  end if;

  insert into mp25m.projects (opportunity_id, source_articulation_id, title, objective, responsible_internal_user_id, created_by_internal_user_id)
  values (v_opportunity_id, p_source_articulation_id, btrim(p_title), btrim(p_objective), p_responsible_internal_user_id, p_actor_internal_user_id)
  returning id, mp25m.projects.created_at into v_project_id, v_created_at;

  insert into mp25m.project_status_history (project_id, transition_no, status, rationale, responsible_internal_user_id, changed_by_internal_user_id, changed_at)
  values (v_project_id, 1, 'draft', btrim(p_objective), p_responsible_internal_user_id, p_actor_internal_user_id, v_created_at);

  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata)
  values (p_actor_internal_user_id, 'project.create', 'mp25m', 'projects', v_project_id, btrim(p_objective), jsonb_build_object('title', btrim(p_title), 'status', 'draft'), 'allowed', jsonb_build_object('opportunity_id', v_opportunity_id, 'source_articulation_id', p_source_articulation_id));

  project_id := v_project_id;
  created_at := v_created_at;
  return next;
exception when unique_violation then
  raise exception 'This articulation already has an execution project' using errcode = '23505';
end;
$function$;

create function mp25m_api.transition_project(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_status text,
  p_rationale text,
  p_responsible_internal_user_id uuid default null,
  p_completion_summary text default null
)
returns void
language plpgsql security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_opportunity_id uuid;
  v_transition_no integer;
begin
  if p_status not in ('draft', 'active', 'paused', 'completed', 'cancelled') or char_length(btrim(p_rationale)) not between 3 and 10000 then
    raise exception 'Invalid project transition' using errcode = '22023';
  end if;
  if p_status = 'completed' and char_length(btrim(coalesce(p_completion_summary, ''))) not between 3 and 10000 then
    raise exception 'A completion summary is required' using errcode = '22023';
  end if;
  if p_status = 'active' and p_responsible_internal_user_id is null then
    raise exception 'An active project requires a responsible internal user' using errcode = '22023';
  end if;

  select opportunity_id into v_opportunity_id from mp25m.projects where id = p_project_id for update;
  if v_opportunity_id is null or not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, v_opportunity_id, 'formulate') then
    raise exception 'Internal user cannot update this project' using errcode = '42501';
  end if;

  update mp25m.projects
  set status = p_status, responsible_internal_user_id = p_responsible_internal_user_id,
      completion_summary = case when p_status = 'completed' then btrim(p_completion_summary) else null end,
      completed_at = case when p_status = 'completed' then now() else null end,
      updated_at = now()
  where id = p_project_id;

  select coalesce(max(transition_no), 0) + 1 into v_transition_no from mp25m.project_status_history where project_id = p_project_id;
  insert into mp25m.project_status_history (project_id, transition_no, status, rationale, responsible_internal_user_id, changed_by_internal_user_id)
  values (p_project_id, v_transition_no, p_status, btrim(p_rationale), p_responsible_internal_user_id, p_actor_internal_user_id);
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result)
  values (p_actor_internal_user_id, 'project.transition', 'mp25m', 'projects', p_project_id, btrim(p_rationale), jsonb_build_object('status', p_status, 'responsible_internal_user_id', p_responsible_internal_user_id), 'allowed');
end;
$function$;

create function mp25m_api.create_project_followup(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_followup_type text,
  p_detail text
)
returns void
language plpgsql security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare v_opportunity_id uuid;
begin
  if p_followup_type not in ('general', 'meeting', 'commitment', 'progress', 'result') or char_length(btrim(p_detail)) not between 3 and 10000 then
    raise exception 'Invalid project followup' using errcode = '22023';
  end if;
  select opportunity_id into v_opportunity_id from mp25m.projects where id = p_project_id;
  if v_opportunity_id is null or not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, v_opportunity_id, 'formulate') then
    raise exception 'Internal user cannot add this project followup' using errcode = '42501';
  end if;
  insert into mp25m.project_followups (project_id, followup_type, detail, created_by_internal_user_id)
  values (p_project_id, p_followup_type, btrim(p_detail), p_actor_internal_user_id);
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, result)
  values (p_actor_internal_user_id, 'project.followup.create', 'mp25m', 'projects', p_project_id, btrim(p_detail), 'allowed');
end;
$function$;

revoke all on function mp25m_api.create_project_from_articulation(uuid, uuid, text, text, uuid), mp25m_api.transition_project(uuid, uuid, text, text, uuid, text), mp25m_api.create_project_followup(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function mp25m_api.create_project_from_articulation(uuid, uuid, text, text, uuid), mp25m_api.transition_project(uuid, uuid, text, text, uuid, text), mp25m_api.create_project_followup(uuid, uuid, text, text) to service_role;

commit;
