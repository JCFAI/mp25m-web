-- MP25M_S - audited internal access revocation.
-- Invoke only from a server action after binding actor to the authenticated identity.
create or replace function mp25m_api.revoke_internal_access(
  p_actor_internal_user_id uuid,
  p_assignment_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_assignment mp25m.access_role_assignments%rowtype;
  v_scope mp25m.access_scopes%rowtype;
  v_global_admin boolean;
  v_local_admin boolean;
  v_founder boolean;
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Reason is required' using errcode = '22023';
  end if;

  select * into v_assignment from mp25m.access_role_assignments
  where id = p_assignment_id and status = 'active' and revoked_at is null
  for update;
  if not found then
    raise exception 'Active assignment not found' using errcode = 'P0002';
  end if;
  if p_actor_internal_user_id = v_assignment.internal_user_id then
    raise exception 'Self-revocation is forbidden' using errcode = '42501';
  end if;
  select * into v_scope from mp25m.access_scopes
  where id = v_assignment.access_scope_id;

  select exists (
    select 1 from mp25m.internal_users u
    join mp25m.access_role_assignments a on a.internal_user_id = u.id
    join mp25m.access_roles r on r.code = a.access_role_code
    join mp25m.access_scopes s on s.id = a.access_scope_id
    where u.id = p_actor_internal_user_id and u.status = 'active' and u.deleted_at is null
      and a.status = 'active' and a.revoked_at is null and a.valid_from <= now()
      and (a.valid_until is null or a.valid_until > now())
      and r.is_active and r.deleted_at is null and s.is_active and s.deleted_at is null
      and r.code = 'administrator' and s.scope_type = 'global'
  ) into v_global_admin;

  if not v_global_admin then
    if v_scope.scope_type <> 'node'
       or v_assignment.access_role_code not in ('participant', 'node_referent') then
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
      and r.is_active and r.deleted_at is null and s.is_active and s.deleted_at is null
      and s.scope_type = 'node' and s.scope_entity_id = v_scope.scope_entity_id;

    if not (
      v_local_admin
      or (v_founder and v_assignment.access_role_code = 'node_referent')
    ) then
      raise exception 'Insufficient scope or role' using errcode = '42501';
    end if;
  end if;

  update mp25m.access_role_assignments
  set status = 'revoked',
      revoked_at = now(),
      revoked_by_internal_user_id = p_actor_internal_user_id,
      reason = btrim(p_reason),
      updated_at = now()
  where id = p_assignment_id;

  insert into mp25m.audit_events (
    actor_internal_user_id, action, target_schema, target_table,
    target_id, reason, old_data, new_data, result
  ) values (
    p_actor_internal_user_id, 'internal_access.revoke', 'mp25m',
    'access_role_assignments', p_assignment_id, btrim(p_reason),
    jsonb_build_object('role', v_assignment.access_role_code,
      'scope_id', v_assignment.access_scope_id,
      'internal_user_id', v_assignment.internal_user_id),
    jsonb_build_object('status', 'revoked'), 'allowed'
  );
end;
$function$;

revoke all on function mp25m_api.revoke_internal_access(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function mp25m_api.revoke_internal_access(uuid, uuid, text)
  to service_role;
