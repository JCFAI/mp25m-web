begin;

create or replace view mp25m_api.opportunity_articulation_participant_list
with (security_invoker = true) as
select
  articulation.opportunity_id,
  participant.id as participant_id,
  participant.articulation_id,
  case
    when participant.person_id is not null then 'person'
    else 'organization'
  end as participant_type,
  coalesce(person.display_name, organization.name) as display_name,
  participant.rationale,
  participant.added_at,
  added_by.display_name as added_by_display_name,
  participant.person_id,
  participant.organization_id
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

commit;
