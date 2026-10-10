begin;

alter table mp25m.pilot_feedback
  add column status text not null default 'new'
    check (status in ('new', 'in_review', 'resolved', 'dismissed')),
  add column admin_response text
    check (
      admin_response is null
      or char_length(btrim(admin_response)) between 2 and 5000
    ),
  add column reviewed_by_internal_user_id uuid
    references mp25m.internal_users(id)
    on delete restrict,
  add column reviewed_at timestamptz,
  add column archived_by_internal_user_id uuid
    references mp25m.internal_users(id)
    on delete restrict,
  add column archived_at timestamptz,
  add column updated_at timestamptz not null default now();

alter table mp25m.pilot_feedback
  add constraint pilot_feedback_review_state_check
  check (
    (
      status = 'new'
      and reviewed_by_internal_user_id is null
      and reviewed_at is null
      and admin_response is null
    )
    or
    (
      status = 'in_review'
      and reviewed_by_internal_user_id is not null
      and reviewed_at is not null
    )
    or
    (
      status in ('resolved', 'dismissed')
      and reviewed_by_internal_user_id is not null
      and reviewed_at is not null
      and admin_response is not null
    )
  );

alter table mp25m.pilot_feedback
  add constraint pilot_feedback_archive_check
  check (
    (
      archived_at is null
      and archived_by_internal_user_id is null
    )
    or
    (
      archived_at is not null
      and archived_by_internal_user_id is not null
    )
  );

create trigger trg_pilot_feedback_updated_at
before update on mp25m.pilot_feedback
for each row
execute function mp25m.set_updated_at();

create index pilot_feedback_active_status_idx
  on mp25m.pilot_feedback(status, created_at desc)
  where archived_at is null;

drop function if exists mp25m_api.list_pilot_feedback(uuid, integer);

create function mp25m_api.list_pilot_feedback(
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
  created_by_internal_user_id uuid,
  created_by_display_name text,
  reviewed_by_display_name text,
  created_at timestamptz,
  reviewed_at timestamptz,
  updated_at timestamptz
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
    join mp25m.access_scopes scope
      on scope.id = assignment.access_scope_id
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
      and scope.is_active = true
      and scope.deleted_at is null
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
    feedback.updated_at
  from mp25m.pilot_feedback feedback
  join mp25m.internal_users creator
    on creator.id = feedback.created_by_internal_user_id
  left join mp25m.internal_users reviewer
    on reviewer.id = feedback.reviewed_by_internal_user_id
  where feedback.archived_at is null
  order by feedback.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$function$;

revoke all on function mp25m_api.list_pilot_feedback(uuid, integer)
from public, anon, authenticated, service_role;

grant execute on function mp25m_api.list_pilot_feedback(uuid, integer)
to service_role;

create function mp25m_api.list_my_pilot_feedback(
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
  order by feedback.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$function$;

revoke all on function mp25m_api.list_my_pilot_feedback(uuid, integer)
from public, anon, authenticated, service_role;

grant execute on function mp25m_api.list_my_pilot_feedback(uuid, integer)
to service_role;

create function mp25m_api.update_pilot_feedback_admin(
  p_actor_internal_user_id uuid,
  p_feedback_id uuid,
  p_status text,
  p_admin_response text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_response text :=
    nullif(btrim(coalesce(p_admin_response, '')), '');
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

  if p_status not in ('new', 'in_review', 'resolved', 'dismissed') then
    raise exception 'Invalid feedback status'
      using errcode = '22023';
  end if;

  if p_status in ('resolved', 'dismissed')
     and (
       v_response is null
       or char_length(v_response) < 2
       or char_length(v_response) > 5000
     )
  then
    raise exception 'Response required for final status'
      using errcode = '22023';
  end if;

  if v_response is not null
     and char_length(v_response) > 5000
  then
    raise exception 'Response too long'
      using errcode = '22023';
  end if;

  update mp25m.pilot_feedback
  set
    status = p_status,
    admin_response =
      case
        when p_status = 'new' then null
        else v_response
      end,
    reviewed_by_internal_user_id =
      case
        when p_status = 'new' then null
        else p_actor_internal_user_id
      end,
    reviewed_at =
      case
        when p_status = 'new' then null
        else now()
      end
  where id = p_feedback_id
    and archived_at is null;

  if not found then
    raise exception 'Feedback not found'
      using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function mp25m_api.update_pilot_feedback_admin(uuid, uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function mp25m_api.update_pilot_feedback_admin(uuid, uuid, text, text)
to service_role;

create function mp25m_api.archive_pilot_feedback_admin(
  p_actor_internal_user_id uuid,
  p_feedback_id uuid
)
returns void
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

  update mp25m.pilot_feedback
  set
    archived_at = now(),
    archived_by_internal_user_id =
      p_actor_internal_user_id
  where id = p_feedback_id
    and archived_at is null;

  if not found then
    raise exception 'Feedback not found'
      using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function mp25m_api.archive_pilot_feedback_admin(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function mp25m_api.archive_pilot_feedback_admin(uuid, uuid)
to service_role;

commit;
