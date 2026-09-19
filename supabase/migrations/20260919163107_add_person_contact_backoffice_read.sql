create or replace view mp25m_api.person_contact_list
with (security_invoker = true)
as
select
  contact.id,
  contact.person_id,
  contact.contact_type::text as contact_type,
  contact.value_original,
  contact.label,
  contact.is_primary,
  contact.visibility::text as visibility,
  contact.verified_at,
  contact.created_at,
  contact.updated_at
from mp25m.person_contacts contact
where contact.active = true;

comment on view mp25m_api.person_contact_list is
  'Server-only active contact data for internal person profiles.';

revoke all
on mp25m_api.person_contact_list
from public, anon, authenticated, service_role;

grant select
on mp25m_api.person_contact_list
to service_role;
