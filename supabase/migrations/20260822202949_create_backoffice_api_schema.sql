-- Incremento 1: minimal server-only Data API surface for backoffice authorization.
--
-- mp25m remains the canonical/internal schema.
-- This schema is intended to be exposed through PostgREST only so that
-- trusted server-side code using the Supabase secret key can resolve
-- backoffice access.
--
-- No anon or authenticated grants are introduced here.

create schema if not exists mp25m_api;

comment on schema mp25m_api is
  'Minimal server-only Data API surface for MP25M backoffice. Do not grant browser roles direct access.';

revoke all on schema mp25m_api from public;
revoke all on schema mp25m_api from anon;
revoke all on schema mp25m_api from authenticated;

grant usage on schema mp25m_api to service_role;

create or replace view mp25m_api.active_internal_access
with (security_invoker = true)
as
select
  iu.id as internal_user_id,
  iu.auth_user_id,
  ara.id as assignment_id,
  ara.access_role_code,
  ar.name as access_role_name,
  ar.is_administrative,
  ara.access_scope_id,
  s.scope_type,
  s.scope_key,
  s.scope_entity_id,
  s.name as scope_name,
  ara.valid_from,
  ara.valid_until
from mp25m.internal_users iu
join mp25m.access_role_assignments ara
  on ara.internal_user_id = iu.id
join mp25m.access_roles ar
  on ar.code = ara.access_role_code
join mp25m.access_scopes s
  on s.id = ara.access_scope_id
where iu.status = 'active'
  and iu.deleted_at is null
  and ara.status = 'active'
  and ara.valid_from <= now()
  and (ara.valid_until is null or ara.valid_until > now())
  and ar.is_active = true
  and ar.deleted_at is null
  and s.is_active = true
  and s.deleted_at is null;

comment on view mp25m_api.active_internal_access is
  'Currently valid MP25M backoffice access assignments. Server-side use only.';

revoke all on mp25m_api.active_internal_access from public;
revoke all on mp25m_api.active_internal_access from anon;
revoke all on mp25m_api.active_internal_access from authenticated;

grant select on mp25m_api.active_internal_access to service_role;

-- Keep future objects closed by default. Access must be granted explicitly.
alter default privileges for role postgres in schema mp25m_api
  revoke all on tables from public, anon, authenticated;

alter default privileges for role postgres in schema mp25m_api
  revoke execute on functions from public, anon, authenticated;