begin;

create table mp25m.project_participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references mp25m.projects(id) on delete restrict,
  person_id uuid references mp25m.persons(id) on delete restrict,
  organization_id uuid references mp25m.organizations(id) on delete restrict,
  participation_role text not null check (char_length(btrim(participation_role)) between 3 and 200),
  contribution_summary text not null check (char_length(btrim(contribution_summary)) between 3 and 10000),
  added_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  removal_rationale text,
  constraint project_participants_one_actor check ((person_id is not null)::integer + (organization_id is not null)::integer = 1),
  constraint project_participants_removal check ((removed_at is null and removed_by_internal_user_id is null and removal_rationale is null) or (removed_at is not null and removed_by_internal_user_id is not null and char_length(btrim(coalesce(removal_rationale, ''))) between 3 and 10000))
);

create table mp25m.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references mp25m.projects(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  description text not null check (char_length(btrim(description)) between 3 and 10000),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'delivered', 'accepted', 'cancelled')),
  responsible_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  target_date date,
  result_summary text,
  evidence_reference text,
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint project_deliverables_completion check ((status in ('delivered', 'accepted') and char_length(btrim(coalesce(result_summary, ''))) between 3 and 10000 and char_length(btrim(coalesce(evidence_reference, ''))) between 3 and 2000 and completed_at is not null) or (status not in ('delivered', 'accepted') and completed_at is null))
);

create index project_participants_project_idx on mp25m.project_participants(project_id) where removed_at is null;
create index project_deliverables_project_idx on mp25m.project_deliverables(project_id, target_date nulls last, created_at desc);

alter table mp25m.project_participants enable row level security;
alter table mp25m.project_deliverables enable row level security;

revoke all on mp25m.project_participants, mp25m.project_deliverables from public, anon, authenticated;
grant select, insert, update on mp25m.project_participants, mp25m.project_deliverables to service_role;

create view mp25m_api.project_participant_list with (security_invoker = true) as
select
  participant.id as participant_id,
  participant.project_id,
  case when participant.person_id is not null then 'person' else 'organization' end as participant_type,
  coalesce(person.display_name, organization.name) as display_name,
  participant.participation_role,
  participant.contribution_summary,
  participant.added_at,
  added_by.display_name as added_by_display_name
from mp25m.project_participants participant
left join mp25m.persons person on person.id = participant.person_id
left join mp25m.organizations organization on organization.id = participant.organization_id
join mp25m.internal_users added_by on added_by.id = participant.added_by_internal_user_id
where participant.removed_at is null;

create view mp25m_api.project_source_participant_list with (security_invoker = true) as
select
  project.id as project_id,
  case when participant.person_id is not null then 'person' else 'organization' end as participant_type,
  coalesce(person.id, organization.id) as actor_id,
  coalesce(person.display_name, organization.name) as display_name
from mp25m.projects project
join mp25m.opportunity_articulation_participants participant on participant.articulation_id = project.source_articulation_id and participant.removed_at is null
left join mp25m.persons person on person.id = participant.person_id
left join mp25m.organizations organization on organization.id = participant.organization_id;

create view mp25m_api.project_deliverable_list with (security_invoker = true) as
select
  deliverable.id as deliverable_id,
  deliverable.project_id,
  deliverable.title,
  deliverable.description,
  deliverable.status,
  deliverable.responsible_internal_user_id,
  responsible.display_name as responsible_display_name,
  deliverable.target_date,
  deliverable.result_summary,
  deliverable.evidence_reference,
  deliverable.created_at,
  deliverable.updated_at,
  deliverable.completed_at
from mp25m.project_deliverables deliverable
left join mp25m.internal_users responsible on responsible.id = deliverable.responsible_internal_user_id;

revoke all on mp25m_api.project_participant_list, mp25m_api.project_source_participant_list, mp25m_api.project_deliverable_list from public, anon, authenticated;
grant select on mp25m_api.project_participant_list, mp25m_api.project_source_participant_list, mp25m_api.project_deliverable_list to service_role;

create function mp25m_api.add_project_participant(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_person_id uuid default null,
  p_organization_id uuid default null,
  p_participation_role text default null,
  p_contribution_summary text default null
)
returns void language plpgsql security invoker set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare v_opportunity_id uuid;
begin
  if (p_person_id is not null)::integer + (p_organization_id is not null)::integer <> 1 or char_length(btrim(coalesce(p_participation_role, ''))) not between 3 and 200 or char_length(btrim(coalesce(p_contribution_summary, ''))) not between 3 and 10000 then
    raise exception 'Invalid project participant' using errcode = '22023';
  end if;
  select opportunity_id into v_opportunity_id from mp25m.projects where id = p_project_id;
  if v_opportunity_id is null or not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, v_opportunity_id, 'formulate') then raise exception 'Internal user cannot update this project' using errcode = '42501'; end if;
  if exists (select 1 from mp25m.project_participants where project_id = p_project_id and coalesce(person_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_person_id, '00000000-0000-0000-0000-000000000000'::uuid) and coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_organization_id, '00000000-0000-0000-0000-000000000000'::uuid) and removed_at is null) then raise exception 'Participant is already active in this project' using errcode = '23505'; end if;
  insert into mp25m.project_participants (project_id, person_id, organization_id, participation_role, contribution_summary, added_by_internal_user_id) values (p_project_id, p_person_id, p_organization_id, btrim(p_participation_role), btrim(p_contribution_summary), p_actor_internal_user_id);
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, result) values (p_actor_internal_user_id, 'project.participant.add', 'mp25m', 'projects', p_project_id, btrim(p_contribution_summary), 'allowed');
end;
$function$;

create function mp25m_api.remove_project_participant(p_actor_internal_user_id uuid, p_participant_id uuid, p_rationale text)
returns void language plpgsql security invoker set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare v_opportunity_id uuid; v_project_id uuid;
begin
  if char_length(btrim(coalesce(p_rationale, ''))) not between 3 and 10000 then raise exception 'Invalid participant removal rationale' using errcode = '22023'; end if;
  select project.id, project.opportunity_id into v_project_id, v_opportunity_id from mp25m.project_participants participant join mp25m.projects project on project.id = participant.project_id where participant.id = p_participant_id and participant.removed_at is null for update;
  if v_project_id is null or not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, v_opportunity_id, 'formulate') then raise exception 'Internal user cannot update this project' using errcode = '42501'; end if;
  update mp25m.project_participants set removed_at = now(), removed_by_internal_user_id = p_actor_internal_user_id, removal_rationale = btrim(p_rationale) where id = p_participant_id;
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, result) values (p_actor_internal_user_id, 'project.participant.remove', 'mp25m', 'projects', v_project_id, btrim(p_rationale), 'allowed');
end;
$function$;

create function mp25m_api.create_project_deliverable(p_actor_internal_user_id uuid, p_project_id uuid, p_title text, p_description text, p_responsible_internal_user_id uuid default null, p_target_date date default null)
returns void language plpgsql security invoker set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare v_opportunity_id uuid;
begin
  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 200 or char_length(btrim(coalesce(p_description, ''))) not between 3 and 10000 then raise exception 'Invalid project deliverable' using errcode = '22023'; end if;
  select opportunity_id into v_opportunity_id from mp25m.projects where id = p_project_id;
  if v_opportunity_id is null or not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, v_opportunity_id, 'formulate') then raise exception 'Internal user cannot update this project' using errcode = '42501'; end if;
  insert into mp25m.project_deliverables (project_id, title, description, responsible_internal_user_id, target_date, created_by_internal_user_id) values (p_project_id, btrim(p_title), btrim(p_description), p_responsible_internal_user_id, p_target_date, p_actor_internal_user_id);
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, result) values (p_actor_internal_user_id, 'project.deliverable.create', 'mp25m', 'projects', p_project_id, btrim(p_description), 'allowed');
end;
$function$;

create function mp25m_api.transition_project_deliverable(p_actor_internal_user_id uuid, p_deliverable_id uuid, p_status text, p_result_summary text default null, p_evidence_reference text default null)
returns void language plpgsql security invoker set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare v_opportunity_id uuid; v_project_id uuid;
begin
  if p_status not in ('planned', 'in_progress', 'delivered', 'accepted', 'cancelled') then raise exception 'Invalid deliverable status' using errcode = '22023'; end if;
  if p_status in ('delivered', 'accepted') and (char_length(btrim(coalesce(p_result_summary, ''))) not between 3 and 10000 or char_length(btrim(coalesce(p_evidence_reference, ''))) not between 3 and 2000) then raise exception 'Delivered or accepted work requires a result and evidence reference' using errcode = '22023'; end if;
  select project.id, project.opportunity_id into v_project_id, v_opportunity_id from mp25m.project_deliverables deliverable join mp25m.projects project on project.id = deliverable.project_id where deliverable.id = p_deliverable_id for update;
  if v_project_id is null or not mp25m_api.can_operate_opportunity_requirement(p_actor_internal_user_id, v_opportunity_id, 'formulate') then raise exception 'Internal user cannot update this project' using errcode = '42501'; end if;
  update mp25m.project_deliverables set status = p_status, result_summary = case when p_status in ('delivered', 'accepted') then btrim(p_result_summary) else null end, evidence_reference = case when p_status in ('delivered', 'accepted') then btrim(p_evidence_reference) else null end, completed_at = case when p_status in ('delivered', 'accepted') then now() else null end, updated_at = now() where id = p_deliverable_id;
  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, result) values (p_actor_internal_user_id, 'project.deliverable.transition', 'mp25m', 'projects', v_project_id, coalesce(btrim(p_result_summary), p_status), 'allowed');
end;
$function$;

revoke all on function mp25m_api.add_project_participant(uuid, uuid, uuid, uuid, text, text), mp25m_api.remove_project_participant(uuid, uuid, text), mp25m_api.create_project_deliverable(uuid, uuid, text, text, uuid, date), mp25m_api.transition_project_deliverable(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function mp25m_api.add_project_participant(uuid, uuid, uuid, uuid, text, text), mp25m_api.remove_project_participant(uuid, uuid, text), mp25m_api.create_project_deliverable(uuid, uuid, text, text, uuid, date), mp25m_api.transition_project_deliverable(uuid, uuid, text, text, text) to service_role;

commit;
