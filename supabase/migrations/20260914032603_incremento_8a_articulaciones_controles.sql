begin;

create unique index opportunity_articulation_participants_active_person_unique_idx
  on mp25m.opportunity_articulation_participants (articulation_id, person_id)
  where removed_at is null and person_id is not null;

create unique index opportunity_articulation_participants_active_organization_unique_idx
  on mp25m.opportunity_articulation_participants (articulation_id, organization_id)
  where removed_at is null and organization_id is not null;

create or replace function mp25m_api.add_opportunity_articulation_participant(
  p_actor_internal_user_id uuid,
  p_articulation_id uuid,
  p_person_id uuid default null,
  p_organization_id uuid default null,
  p_rationale text default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_opportunity_id uuid;
  v_participant_id uuid;
begin
  if (p_person_id is not null)::integer + (p_organization_id is not null)::integer <> 1
    or char_length(btrim(coalesce(p_rationale, ''))) not between 3 and 10000 then
    raise exception 'Invalid opportunity articulation participant' using errcode = '22023';
  end if;

  select opportunity_id into v_opportunity_id
  from mp25m.opportunity_articulations
  where id = p_articulation_id;

  if v_opportunity_id is null then
    raise exception 'Opportunity articulation not found' using errcode = 'P0002';
  end if;

  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    v_opportunity_id,
    'formulate'
  ) then
    raise exception 'Internal user cannot add this opportunity articulation participant' using errcode = '42501';
  end if;

  if p_person_id is not null and not exists (
    select 1 from mp25m.persons
    where id = p_person_id and record_status = 'active'
  ) then
    raise exception 'Invalid or inactive articulation person participant' using errcode = '23503';
  end if;

  if p_organization_id is not null and not exists (
    select 1 from mp25m.organizations
    where id = p_organization_id and record_status = 'active'
  ) then
    raise exception 'Invalid or inactive articulation organization participant' using errcode = '23503';
  end if;

  insert into mp25m.opportunity_articulation_participants (
    articulation_id,
    person_id,
    organization_id,
    rationale,
    added_by_internal_user_id
  )
  values (
    p_articulation_id,
    p_person_id,
    p_organization_id,
    btrim(p_rationale),
    p_actor_internal_user_id
  )
  returning id into v_participant_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'opportunity.articulation.participant.add',
    'mp25m',
    'opportunity_articulation_participants',
    v_participant_id,
    btrim(p_rationale),
    jsonb_build_object(
      'person_id', p_person_id,
      'organization_id', p_organization_id
    ),
    'allowed',
    jsonb_build_object(
      'articulation_id', p_articulation_id,
      'opportunity_id', v_opportunity_id
    )
  );

  return v_participant_id;
end;
$function$;

create function mp25m_api.remove_opportunity_articulation_participant(
  p_actor_internal_user_id uuid,
  p_participant_id uuid,
  p_rationale text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_participant mp25m.opportunity_articulation_participants%rowtype;
  v_opportunity_id uuid;
begin
  if char_length(btrim(coalesce(p_rationale, ''))) not between 3 and 10000 then
    raise exception 'Invalid opportunity articulation participant removal' using errcode = '22023';
  end if;

  select participant.*
    into v_participant
  from mp25m.opportunity_articulation_participants participant
  where participant.id = p_participant_id
    and participant.removed_at is null
  for update of participant;

  if not found then
    raise exception 'Active opportunity articulation participant not found' using errcode = 'P0002';
  end if;

  select opportunity_id into v_opportunity_id
  from mp25m.opportunity_articulations
  where id = v_participant.articulation_id;

  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    v_opportunity_id,
    'formulate'
  ) then
    raise exception 'Internal user cannot remove this opportunity articulation participant' using errcode = '42501';
  end if;

  update mp25m.opportunity_articulation_participants
  set removed_at = now(),
      removed_by_internal_user_id = p_actor_internal_user_id,
      removal_rationale = btrim(p_rationale)
  where id = p_participant_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'opportunity.articulation.participant.remove',
    'mp25m',
    'opportunity_articulation_participants',
    p_participant_id,
    btrim(p_rationale),
    jsonb_build_object(
      'person_id', v_participant.person_id,
      'organization_id', v_participant.organization_id
    ),
    'allowed',
    jsonb_build_object(
      'articulation_id', v_participant.articulation_id,
      'opportunity_id', v_opportunity_id
    )
  );

  return p_participant_id;
end;
$function$;

create view mp25m_api.opportunity_articulation_participant_list
with (security_invoker = true) as
select
  articulation.opportunity_id,
  participant.id as participant_id,
  participant.articulation_id,
  case when participant.person_id is not null then 'person' else 'organization' end as participant_type,
  coalesce(person.display_name, organization.name) as display_name,
  participant.rationale,
  participant.added_at,
  added_by.display_name as added_by_display_name
from mp25m.opportunity_articulation_participants participant
join mp25m.opportunity_articulations articulation
  on articulation.id = participant.articulation_id
left join mp25m.persons person
  on person.id = participant.person_id
left join mp25m.organizations organization
  on organization.id = participant.organization_id
join mp25m.internal_users added_by
  on added_by.id = participant.added_by_internal_user_id
where participant.removed_at is null;

create view mp25m_api.opportunity_articulation_followup_list
with (security_invoker = true) as
select
  articulation.opportunity_id,
  followup.id as followup_id,
  followup.articulation_id,
  followup.followup_type,
  followup.detail,
  followup.created_at,
  creator.display_name as created_by_display_name
from mp25m.opportunity_articulation_followups followup
join mp25m.opportunity_articulations articulation
  on articulation.id = followup.articulation_id
join mp25m.internal_users creator
  on creator.id = followup.created_by_internal_user_id;

revoke all on mp25m_api.opportunity_articulation_participant_list,
  mp25m_api.opportunity_articulation_followup_list
from public, anon, authenticated;
grant select on mp25m_api.opportunity_articulation_participant_list,
  mp25m_api.opportunity_articulation_followup_list
to service_role;

revoke all on function mp25m_api.add_opportunity_articulation_participant(uuid, uuid, uuid, uuid, text),
  mp25m_api.remove_opportunity_articulation_participant(uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function mp25m_api.add_opportunity_articulation_participant(uuid, uuid, uuid, uuid, text),
  mp25m_api.remove_opportunity_articulation_participant(uuid, uuid, text)
to service_role;

commit;
