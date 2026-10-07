create or replace function mp25m_api.create_person(
  p_actor_internal_user_id uuid,
  p_display_name text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api, mp25m_private
as $function$
declare
  v_display_name text;
  v_normalized_name text;
  v_person_id uuid;
begin
  v_display_name := nullif(
    regexp_replace(btrim(coalesce(p_display_name, '')), '[[:space:]]+', ' ', 'g'),
    ''
  );

  if char_length(coalesce(v_display_name, '')) not between 2 and 200 then
    raise exception 'Invalid person display name' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from mp25m.internal_users internal_user
    join mp25m.access_role_assignments assignment
      on assignment.internal_user_id = internal_user.id
    join mp25m.access_roles role
      on role.code = assignment.access_role_code
    join mp25m.access_scopes scope
      on scope.id = assignment.access_scope_id
    where internal_user.id = p_actor_internal_user_id
      and internal_user.status = 'active'
      and internal_user.deleted_at is null
      and assignment.status = 'active'
      and assignment.revoked_at is null
      and assignment.valid_from <= now()
      and (assignment.valid_until is null or assignment.valid_until > now())
      and role.code in ('administrator', 'validator')
      and role.is_active = true
      and role.deleted_at is null
      and scope.scope_type = 'global'
      and scope.is_active = true
      and scope.deleted_at is null
  ) then
    raise exception 'Canonical person creation is not allowed' using errcode = '42501';
  end if;

  v_normalized_name := mp25m_private.normalize_text(v_display_name);

  if char_length(coalesce(v_normalized_name, '')) not between 2 and 220 then
    raise exception 'Invalid normalized person name' using errcode = '22023';
  end if;

  insert into mp25m.persons (
    display_name,
    normalized_name
  ) values (
    v_display_name,
    v_normalized_name
  )
  returning id into v_person_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    new_data,
    result,
    metadata
  ) values (
    p_actor_internal_user_id,
    'person.create',
    'mp25m',
    'persons',
    v_person_id,
    jsonb_build_object(
      'display_name', v_display_name,
      'normalized_name', v_normalized_name
    ),
    'allowed',
    jsonb_build_object('source', 'panel.personas')
  );

  return v_person_id;
end;
$function$;

revoke all on function mp25m_api.create_person(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function mp25m_api.create_person(uuid, text)
to service_role;
