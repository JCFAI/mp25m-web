create or replace view mp25m_api.project_participant_list
with (security_invoker = true) as
select
  participant.id as participant_id,
  participant.project_id,
  case
    when participant.person_id is not null then 'person'
    else 'organization'
  end as participant_type,
  coalesce(person.display_name, organization.name) as display_name,
  participant.participation_role,
  participant.contribution_summary,
  participant.added_at,
  added_by.display_name as added_by_display_name,
  coalesce(participant.person_id, participant.organization_id) as actor_id
from mp25m.project_participants participant
left join mp25m.persons person
  on person.id = participant.person_id
left join mp25m.organizations organization
  on organization.id = participant.organization_id
join mp25m.internal_users added_by
  on added_by.id = participant.added_by_internal_user_id
where participant.removed_at is null;

revoke all on mp25m_api.project_participant_list
from public, anon, authenticated;

grant select on mp25m_api.project_participant_list
to service_role;
