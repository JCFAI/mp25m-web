-- MP25M_S - grants of internal access. Migration is not applied automatically.
-- Only a server-side authenticated action may supply p_actor_internal_user_id.
-- NEVER expose this service_role-only RPC directly to browser calls.
create or replace function mp25m_api.grant_internal_access(
  p_actor_internal_user_id uuid,
  p_target_internal_user_id uuid,
  p_role_code text,
  p_scope_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_scope mp25m.access_scopes%rowtype;
  v_assignment_id uuid;
  v_global_admin boolean;
  v_local_admin boolean;
  v_founder boolean;
begin
  if p_actor_internal_user_id is null or p_target_internal_user_id is null
     or p_actor_internal_user_id = p_target_internal_user_id then
    raise exception 'Self-assignment or missing user is forbidden' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Reason is required' using errcode = '22023';
  end if;

  select * into v_scope from mp25m.access_scopes
    where id = p_scope_id and is_active = true and deleted_at is null;
  if not found then
    raise exception 'Active scope not found' using errcode = '22023';
  end if;
  if not exists (
    select 1 from mp25m.internal_users
    where id = p_target_internal_user_id and status = 'active' and deleted_at is null
  ) then
    raise exception 'Target user is not active' using errcode = '22023';
  end if;

  -- Only explicitly approved combinations of technical role and scope.
  if not (
    (p_role_code = 'administrator' and v_scope.scope_type = 'global')
    or (p_role_code in ('local_administrator', 'founder_access', 'node_referent') and v_scope.scope_type = 'node')
    or (p_role_code in ('participant', 'validator', 'articulator', 'authority_analyst') and v_scope.scope_type in ('node', 'global'))
  ) then
    raise exception 'Role and scope combination is invalid' using errcode = '42501';
  end if;

  if not exists (
    select 1 from mp25m.access_roles
    where code = p_role_code and is_active and deleted_at is null
  ) then
    raise exception 'Role is not active' using errcode = '42501';
  end if;

  select exists (
    select 1 from mp25m.internal_users u
    join mp25m.access_role_assignments a on a.internal_user_id = u.id
    join mp25m.access_roles r on r.code = a.access_role_code
    join mp25m.access_scopes s on s.id = a.access_scope_id
    where u.id = p_actor_internal_user_id and u.status = 'active' and u.deleted_at is null
      and a.status = 'active' and a.revoked_at is null and a.valid_from <= now()
      and (a.valid_until is null or a.valid_until > now())
      and r.is_active and r.deleted_at is null
      and s.is_active and s.deleted_at is null
      and r.code = 'administrator' and s.scope_type = 'global'
  ) into v_global_admin;

  if not v_global_admin then
    if v_scope.scope_type <> 'node' then
      raise exception 'Global administrator required' using errcode = '42501';
    end if;
    select
      coalesce(bool_or(r.code = 'local_administrator'), false),
      coalesce(bool_or(r.code = 'founder_access'), false)
    into v_local_admin, v_founder
    from mp25m.internal_users u
    join mp25m.access_role_assignments a on a.internal_user_id = u.id
    join mp25m.access_roles r on r.code = a.access_role_code
    join mp25m.access_scopes s on s.id = a.access_scope_id
    where u.id = p_actor_internal_user_id and u.status = 'active' and u.deleted_at is null
      and a.status = 'active' and a.revoked_at is null and a.valid_from <= now()
      and (a.valid_until is null or a.valid_until > now())
      and r.is_active and r.deleted_at is null
      and s.is_active and s.deleted_at is null
      and s.scope_type = 'node' and s.scope_entity_id = v_scope.scope_entity_id;
    if not (
      (v_local_admin and p_role_code in ('participant', 'node_referent'))
      or (v_founder and p_role_code = 'node_referent')
    ) then
      raise exception 'Insufficient scope or role' using errcode = '42501';
    end if;
  end if;

  -- A unique active grant index prevents concurrent duplicate insertions.
  insert into mp25m.access_role_assignments (
    internal_user_id, access_role_code, access_scope_id,
    status, granted_by_internal_user_id, reason
  ) values (
    p_target_internal_user_id, p_role_code, p_scope_id,
    'active', p_actor_internal_user_id, btrim(p_reason)
  ) returning id into v_assignment_id;

  insert into mp25m.audit_events (
    actor_internal_user_id, action, target_schema, target_table,
    target_id, reason, new_data, result
  ) values (
    p_actor_internal_user_id, 'internal_access.grant', 'mp25m',
    'access_role_assignments', v_assignment_id, btrim(p_reason),
    jsonb_build_object('internal_user_id', p_target_internal_user_id,
      'role', p_role_code, 'scope_id', p_scope_id), 'allowed'
  );

  return v_assignment_id;
end;
$function$;

revoke all on function mp25m_api.grant_internal_access(uuid, uuid, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function mp25m_api.grant_internal_access(uuid, uuid, text, uuid, text)
  to service_role;
