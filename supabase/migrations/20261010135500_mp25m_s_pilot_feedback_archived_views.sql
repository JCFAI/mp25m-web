begin;

create or replace function mp25m_api.list_my_pilot_feedback(
  p_actor_internal_user_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  feedback_type text,
  detail text,
  context_path text,
  status text,
  admin_response text,
  reviewed_by_display_name text,
  created_at timestamptz,
  reviewed_at timestamptz,
  archived_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
begin
  if not exists (
    select 1
    from mp25m.internal_users internal_user
    where internal_user.id = p_actor_internal_user_id
      and internal_user.status = 'active'
      and internal_user.deleted_at is null
  ) then
    raise exception 'Active internal user required'
      using errcode = '42501';
  end if;

  return query
  select
    feedback.id,
    feedback.feedback_type,
    feedback.detail,
    feedback.context_path,
    feedback.status,
    feedback.admin_response,
    reviewer.display_name,
    feedback.created_at,
    feedback.reviewed_at,
    feedback.archived_at
  from mp25m.pilot_feedback feedback
  left join mp25m.internal_users reviewer
    on reviewer.id = feedback.reviewed_by_internal_user_id
  where feedback.created_by_internal_user_id =
      p_actor_internal_user_id
    and feedback.archived_at is null
  order by feedback.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$function$;

create or replace function mp25m_api.list_my_archived_pilot_feedback(
  p_actor_internal_user_id uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  feedback_type text,
  detail text,
  context_path text,
  status text,
  admin_response text,
  reviewed_by_display_name text,
  created_at timestamptz,
  reviewed_at timestamptz,
  archived_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
begin
  if not exists (
    select 1
    from mp25m.internal_users internal_user
    where internal_user.id = p_actor_internal_user_id
      and internal_user.status = 'active'
      and internal_user.deleted_at is null
  ) then
    raise exception 'Active internal user required'
      using errcode = '42501';
  end if;

  return query
  select
    feedback.id,
    feedback.feedback_type,
    feedback.detail,
    feedback.context_path,
    feedback.status,
    feedback.admin_response,
    reviewer.display_name,
    feedback.created_at,
    feedback.reviewed_at,
    feedback.archived_at
  from mp25m.pilot_feedback feedback
  left join mp25m.internal_users reviewer
    on reviewer.id = feedback.reviewed_by_internal_user_id
  where feedback.created_by_internal_user_id =
      p_actor_internal_user_id
    and feedback.archived_at is not null
  order by feedback.archived_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$function$;

revoke all on function mp25m_api.list_my_archived_pilot_feedback(uuid, integer)
from public, anon, authenticated, service_role;

grant execute on function mp25m_api.list_my_archived_pilot_feedback(uuid, integer)
to service_role;

create or replace function mp25m_api.list_archived_pilot_feedback(
  p_actor_internal_user_id uuid,
  p_limit integer default 200
)
returns table (
  id uuid,
  feedback_type text,
  detail text,
  context_path text,
  status text,
  admin_response text,
  created_by_internal_user_id uuid,
  created_by_display_name text,
  reviewed_by_display_name text,
  created_at timestamptz,
  reviewed_at timestamptz,
  archived_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
begin
  if not exists (
    select 1
    from mp25m.internal_users internal_user
    join mp25m.access_role_assignments assignment
      on assignment.internal_user_id = internal_user.id
    join mp25m.access_roles access_role
      on access_role.code = assignment.access_role_code
    where internal_user.id = p_actor_internal_user_id
      and internal_user.status = 'active'
      and internal_user.deleted_at is null
      and assignment.status = 'active'
      and assignment.revoked_at is null
      and assignment.valid_from <= now()
      and (
        assignment.valid_until is null
        or assignment.valid_until > now()
      )
      and access_role.code in (
        'administrator',
        'local_administrator',
        'founder_access'
      )
      and access_role.is_active = true
      and access_role.deleted_at is null
  ) then
    raise exception 'Administrative access required'
      using errcode = '42501';
  end if;

  return query
  select
    feedback.id,
    feedback.feedback_type,
    feedback.detail,
    feedback.context_path,
    feedback.status,
    feedback.admin_response,
    feedback.created_by_internal_user_id,
    creator.display_name,
    reviewer.display_name,
    feedback.created_at,
    feedback.reviewed_at,
    feedback.archived_at
  from mp25m.pilot_feedback feedback
  join mp25m.internal_users creator
    on creator.id = feedback.created_by_internal_user_id
  left join mp25m.internal_users reviewer
    on reviewer.id = feedback.reviewed_by_internal_user_id
  where feedback.archived_at is not null
  order by feedback.archived_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$function$;

revoke all on function mp25m_api.list_archived_pilot_feedback(uuid, integer)
from public, anon, authenticated, service_role;

grant execute on function mp25m_api.list_archived_pilot_feedback(uuid, integer)
to service_role;

commit;
