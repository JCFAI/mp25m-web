begin;

create table mp25m.themes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 200),
  normalized_name text not null check (char_length(btrim(normalized_name)) between 3 and 200),
  description text not null check (char_length(btrim(description)) between 10 and 10000),
  purpose text not null check (char_length(btrim(purpose)) between 3 and 10000),
  status text not null default 'active' check (status in ('active', 'monitoring', 'paused', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  start_date date not null default current_date,
  current_summary text check (current_summary is null or char_length(btrim(current_summary)) between 3 and 10000),
  territorial_scope_summary text check (territorial_scope_summary is null or char_length(btrim(territorial_scope_summary)) between 3 and 2000),
  closing_summary text check (closing_summary is null or char_length(btrim(closing_summary)) between 3 and 10000),
  closing_date date,
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint themes_closure_check check (
    (status = 'closed' and closing_date is not null and closed_at is not null and closing_summary is not null)
    or (status <> 'closed' and closing_date is null and closed_at is null and closing_summary is null)
  )
);

create table mp25m.theme_responsibilities (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references mp25m.themes(id) on delete restrict,
  internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  responsibility_role text not null check (responsibility_role in ('principal', 'responsible', 'promoter')),
  rationale text not null check (char_length(btrim(rationale)) between 3 and 10000),
  started_at timestamptz not null default now(),
  added_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  ended_at timestamptz,
  ended_by_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  ending_rationale text,
  constraint theme_responsibilities_ending_check check (
    (ended_at is null and ended_by_internal_user_id is null and ending_rationale is null)
    or (ended_at is not null and ended_by_internal_user_id is not null and char_length(btrim(coalesce(ending_rationale, ''))) between 3 and 10000)
  )
);

create table mp25m.theme_status_history (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references mp25m.themes(id) on delete restrict,
  transition_no integer not null check (transition_no > 0),
  status text not null check (status in ('active', 'monitoring', 'paused', 'closed')),
  priority text not null check (priority in ('low', 'normal', 'high', 'urgent')),
  closing_summary text,
  rationale text not null check (char_length(btrim(rationale)) between 3 and 10000),
  changed_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  unique (theme_id, transition_no),
  constraint theme_status_history_closing_summary_check check (
    (status = 'closed' and char_length(btrim(coalesce(closing_summary, ''))) between 3 and 10000)
    or (status <> 'closed' and closing_summary is null)
  )
);

create table mp25m.theme_followups (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references mp25m.themes(id) on delete restrict,
  followup_type text not null default 'general' check (followup_type in ('general', 'meeting', 'decision', 'commitment', 'next_step', 'result', 'observation')),
  detail text not null check (char_length(btrim(detail)) between 3 and 10000),
  occurred_at timestamptz not null default now(),
  responsible_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  next_due_at timestamptz,
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index themes_directory_idx on mp25m.themes(normalized_name, id);
create index themes_status_priority_directory_idx on mp25m.themes(status, priority, normalized_name, id);
create index themes_updated_idx on mp25m.themes(updated_at desc);
create index theme_responsibilities_theme_active_idx on mp25m.theme_responsibilities(theme_id, responsibility_role, internal_user_id) where ended_at is null;
create index theme_responsibilities_user_active_idx on mp25m.theme_responsibilities(internal_user_id, theme_id) where ended_at is null;
create unique index theme_responsibilities_active_role_unique on mp25m.theme_responsibilities(theme_id, internal_user_id, responsibility_role) where ended_at is null;
create unique index theme_responsibilities_active_principal_unique on mp25m.theme_responsibilities(theme_id) where responsibility_role = 'principal' and ended_at is null;
create index theme_status_history_theme_idx on mp25m.theme_status_history(theme_id, transition_no desc);
create index theme_followups_theme_idx on mp25m.theme_followups(theme_id, occurred_at desc, id desc);
create index theme_followups_responsible_idx on mp25m.theme_followups(responsible_internal_user_id) where responsible_internal_user_id is not null;

create trigger trg_themes_updated_at
before update on mp25m.themes
for each row execute function mp25m.set_updated_at();

alter table mp25m.themes enable row level security;
alter table mp25m.theme_responsibilities enable row level security;
alter table mp25m.theme_status_history enable row level security;
alter table mp25m.theme_followups enable row level security;

revoke all on mp25m.themes, mp25m.theme_responsibilities, mp25m.theme_status_history, mp25m.theme_followups from public, anon, authenticated, service_role;
grant select, insert, update on mp25m.themes, mp25m.theme_responsibilities to service_role;
grant select, insert on mp25m.theme_status_history, mp25m.theme_followups to service_role;

create or replace function mp25m_api.can_operate_theme(
  p_actor_internal_user_id uuid,
  p_theme_id uuid,
  p_operation text
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
  select case
    when p_operation = 'read' then exists (
      select 1
      from mp25m.internal_users internal_user
      where internal_user.id = p_actor_internal_user_id
        and internal_user.status = 'active'
        and internal_user.deleted_at is null
    )
    when p_operation in ('create', 'govern') then exists (
      select 1
      from mp25m.internal_users internal_user
      join mp25m.access_role_assignments assignment on assignment.internal_user_id = internal_user.id
      join mp25m.access_roles access_role on access_role.code = assignment.access_role_code
      join mp25m.access_scopes scope on scope.id = assignment.access_scope_id
      where internal_user.id = p_actor_internal_user_id
        and internal_user.status = 'active'
        and internal_user.deleted_at is null
        and assignment.status = 'active'
        and assignment.revoked_at is null
        and assignment.valid_from <= now()
        and (assignment.valid_until is null or assignment.valid_until > now())
        and access_role.is_administrative = true
        and access_role.is_active = true
        and access_role.deleted_at is null
        and scope.scope_type = 'global'
        and scope.is_active = true
        and scope.deleted_at is null
    )
    when p_operation = 'followup' then
      mp25m_api.can_operate_theme(p_actor_internal_user_id, p_theme_id, 'govern')
      or exists (
        select 1
        from mp25m.theme_responsibilities responsibility
        join mp25m.internal_users internal_user on internal_user.id = responsibility.internal_user_id
        where responsibility.theme_id = p_theme_id
          and responsibility.internal_user_id = p_actor_internal_user_id
          and responsibility.ended_at is null
          and responsibility.responsibility_role in ('principal', 'responsible', 'promoter')
          and internal_user.status = 'active'
          and internal_user.deleted_at is null
      )
    when p_operation = 'manage' then
      mp25m_api.can_operate_theme(p_actor_internal_user_id, p_theme_id, 'govern')
      or exists (
        select 1
        from mp25m.theme_responsibilities responsibility
        join mp25m.internal_users internal_user on internal_user.id = responsibility.internal_user_id
        where responsibility.theme_id = p_theme_id
          and responsibility.internal_user_id = p_actor_internal_user_id
          and responsibility.ended_at is null
          and responsibility.responsibility_role in ('principal', 'responsible')
          and internal_user.status = 'active'
          and internal_user.deleted_at is null
      )
    else false
  end;
$function$;

revoke all on function mp25m_api.can_operate_theme(uuid, uuid, text) from public, anon, authenticated, service_role;
grant execute on function mp25m_api.can_operate_theme(uuid, uuid, text) to service_role;

create view mp25m_api.theme_list with (security_invoker = true) as
select
  theme.id as theme_id,
  theme.name,
  theme.normalized_name,
  theme.description,
  theme.purpose,
  theme.status,
  theme.priority,
  theme.start_date,
  theme.current_summary,
  theme.territorial_scope_summary,
  theme.closing_summary,
  theme.closing_date,
  theme.created_by_internal_user_id,
  creator.display_name as created_by_display_name,
  theme.created_at,
  theme.updated_at,
  theme.closed_at,
  coalesce(responsibility_summary.active_responsibility_count, 0)::integer as active_responsibility_count,
  responsibility_summary.principal_internal_user_id,
  responsibility_summary.principal_display_name,
  coalesce(responsibility_summary.responsible_names, array[]::text[]) as responsible_names,
  latest_followup.detail as latest_followup_detail,
  latest_followup.occurred_at as latest_followup_at
from mp25m.themes theme
join mp25m.internal_users creator on creator.id = theme.created_by_internal_user_id
left join lateral (
  select
    count(*)::integer as active_responsibility_count,
    (array_agg(responsibility.internal_user_id) filter (where responsibility.responsibility_role = 'principal'))[1] as principal_internal_user_id,
    max(internal_user.display_name) filter (where responsibility.responsibility_role = 'principal') as principal_display_name,
    array_agg(internal_user.display_name order by lower(internal_user.display_name), internal_user.id)
      filter (where responsibility.responsibility_role = 'responsible') as responsible_names
  from mp25m.theme_responsibilities responsibility
  join mp25m.internal_users internal_user on internal_user.id = responsibility.internal_user_id
  where responsibility.theme_id = theme.id and responsibility.ended_at is null
) responsibility_summary on true
left join lateral (
  select followup.detail, followup.occurred_at
  from mp25m.theme_followups followup
  where followup.theme_id = theme.id
  order by followup.occurred_at desc, followup.id desc
  limit 1
) latest_followup on true;

create view mp25m_api.theme_responsibility_list with (security_invoker = true) as
select
  responsibility.id as responsibility_id,
  responsibility.theme_id,
  responsibility.internal_user_id,
  internal_user.display_name,
  responsibility.responsibility_role,
  responsibility.rationale,
  responsibility.started_at,
  added_by.display_name as added_by_display_name,
  responsibility.ended_at,
  ended_by.display_name as ended_by_display_name,
  responsibility.ending_rationale
from mp25m.theme_responsibilities responsibility
join mp25m.internal_users internal_user on internal_user.id = responsibility.internal_user_id
join mp25m.internal_users added_by on added_by.id = responsibility.added_by_internal_user_id
left join mp25m.internal_users ended_by on ended_by.id = responsibility.ended_by_internal_user_id;

create view mp25m_api.theme_followup_list with (security_invoker = true) as
select
  followup.id as followup_id,
  followup.theme_id,
  followup.followup_type,
  followup.detail,
  followup.occurred_at,
  followup.responsible_internal_user_id,
  responsible.display_name as responsible_display_name,
  followup.next_due_at,
  followup.created_by_internal_user_id,
  creator.display_name as created_by_display_name,
  followup.created_at
from mp25m.theme_followups followup
join mp25m.internal_users creator on creator.id = followup.created_by_internal_user_id
left join mp25m.internal_users responsible on responsible.id = followup.responsible_internal_user_id;

create view mp25m_api.theme_status_history_list with (security_invoker = true) as
select
  history.id as history_id,
  history.theme_id,
  history.transition_no,
  history.status,
  history.priority,
  history.closing_summary,
  history.rationale,
  history.changed_by_internal_user_id,
  internal_user.display_name as changed_by_display_name,
  history.changed_at
from mp25m.theme_status_history history
join mp25m.internal_users internal_user on internal_user.id = history.changed_by_internal_user_id;

revoke all on mp25m_api.theme_list, mp25m_api.theme_responsibility_list, mp25m_api.theme_followup_list, mp25m_api.theme_status_history_list from public, anon, authenticated, service_role;
grant select on mp25m_api.theme_list, mp25m_api.theme_responsibility_list, mp25m_api.theme_followup_list, mp25m_api.theme_status_history_list to service_role;

create or replace function mp25m_api.theme_page(
  p_query text default '',
  p_statuses text[] default null,
  p_priorities text[] default null,
  p_responsible_internal_user_id uuid default null,
  p_after_name text default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  theme_id uuid,
  name text,
  description text,
  status text,
  priority text,
  start_date date,
  current_summary text,
  principal_display_name text,
  responsible_names text[],
  latest_followup_at timestamptz,
  cursor_name text
)
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api, extensions
as $function$
  with parameters as (
    select nullif(mp25m_private.normalize_text(coalesce(p_query, '')), '') as normalized_query
  )
  select
    theme.theme_id,
    theme.name,
    theme.description,
    theme.status,
    theme.priority,
    theme.start_date,
    theme.current_summary,
    theme.principal_display_name,
    theme.responsible_names,
    theme.latest_followup_at,
    theme.normalized_name as cursor_name
  from mp25m_api.theme_list theme
  cross join parameters
  where (p_statuses is null or theme.status = any(p_statuses))
    and (p_priorities is null or theme.priority = any(p_priorities))
    and (
      p_responsible_internal_user_id is null
      or theme.principal_internal_user_id = p_responsible_internal_user_id
      or exists (
        select 1 from mp25m.theme_responsibilities responsibility
        where responsibility.theme_id = theme.theme_id
          and responsibility.internal_user_id = p_responsible_internal_user_id
          and responsibility.ended_at is null
      )
    )
    and (
      parameters.normalized_query is null
      or theme.normalized_name like '%' || parameters.normalized_query || '%'
      or mp25m_private.normalize_text(theme.description) like '%' || parameters.normalized_query || '%'
      or mp25m_private.normalize_text(theme.purpose) like '%' || parameters.normalized_query || '%'
    )
    and (
      p_after_name is null
      or p_after_id is null
      or (theme.normalized_name, theme.theme_id) > (p_after_name, p_after_id)
    )
  order by theme.normalized_name, theme.theme_id
  limit least(greatest(coalesce(p_limit, 25), 1), 50) + 1;
$function$;

revoke all on function mp25m_api.theme_page(text, text[], text[], uuid, text, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function mp25m_api.theme_page(text, text[], text[], uuid, text, uuid, integer) to service_role;

create or replace function mp25m_api.create_theme(
  p_actor_internal_user_id uuid,
  p_name text,
  p_description text,
  p_purpose text,
  p_priority text,
  p_start_date date,
  p_current_summary text default null,
  p_territorial_scope_summary text default null,
  p_principal_internal_user_id uuid default null,
  p_rationale text default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_theme_id uuid;
  v_rationale text := nullif(btrim(p_rationale), '');
begin
  if not mp25m_api.can_operate_theme(p_actor_internal_user_id, null, 'create') then
    raise exception 'Internal user cannot create themes' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 200
     or char_length(btrim(coalesce(p_description, ''))) not between 10 and 10000
     or char_length(btrim(coalesce(p_purpose, ''))) not between 3 and 10000
     or p_priority not in ('low', 'normal', 'high', 'urgent')
     or p_start_date is null
     or v_rationale is null
     or char_length(v_rationale) not between 3 and 10000 then
    raise exception 'Invalid theme data' using errcode = '22023';
  end if;
  if p_principal_internal_user_id is not null and not exists (
    select 1 from mp25m.internal_users internal_user
    where internal_user.id = p_principal_internal_user_id and internal_user.status = 'active' and internal_user.deleted_at is null
  ) then
    raise exception 'Theme principal must be an active internal user' using errcode = '22023';
  end if;

  insert into mp25m.themes (
    name, normalized_name, description, purpose, priority, start_date,
    current_summary, territorial_scope_summary, created_by_internal_user_id
  ) values (
    btrim(p_name), mp25m_private.normalize_text(p_name), btrim(p_description), btrim(p_purpose), p_priority, p_start_date,
    nullif(btrim(p_current_summary), ''), nullif(btrim(p_territorial_scope_summary), ''), p_actor_internal_user_id
  ) returning id into v_theme_id;

  insert into mp25m.theme_status_history (theme_id, transition_no, status, priority, rationale, changed_by_internal_user_id)
  values (v_theme_id, 1, 'active', p_priority, v_rationale, p_actor_internal_user_id);

  if p_principal_internal_user_id is not null then
    insert into mp25m.theme_responsibilities (theme_id, internal_user_id, responsibility_role, rationale, added_by_internal_user_id)
    values (v_theme_id, p_principal_internal_user_id, 'principal', v_rationale, p_actor_internal_user_id);
  end if;

  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result)
  values (
    p_actor_internal_user_id, 'theme.create', 'mp25m', 'themes', v_theme_id, v_rationale,
    jsonb_build_object('name', btrim(p_name), 'status', 'active', 'priority', p_priority, 'principal_internal_user_id', p_principal_internal_user_id), 'allowed'
  );

  return v_theme_id;
end;
$function$;

create or replace function mp25m_api.update_theme(
  p_actor_internal_user_id uuid,
  p_theme_id uuid,
  p_name text,
  p_description text,
  p_purpose text,
  p_priority text,
  p_start_date date,
  p_current_summary text default null,
  p_territorial_scope_summary text default null,
  p_rationale text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.themes%rowtype;
  v_rationale text := nullif(btrim(p_rationale), '');
begin
  if not mp25m_api.can_operate_theme(p_actor_internal_user_id, p_theme_id, 'manage') then
    raise exception 'Internal user cannot manage this theme' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 200
     or char_length(btrim(coalesce(p_description, ''))) not between 10 and 10000
     or char_length(btrim(coalesce(p_purpose, ''))) not between 3 and 10000
     or p_priority not in ('low', 'normal', 'high', 'urgent')
     or p_start_date is null
     or v_rationale is null
     or char_length(v_rationale) not between 3 and 10000 then
    raise exception 'Invalid theme data' using errcode = '22023';
  end if;

  select * into v_before from mp25m.themes where id = p_theme_id for update;
  if not found then raise exception 'Theme not found' using errcode = 'P0002'; end if;

  update mp25m.themes set
    name = btrim(p_name),
    normalized_name = mp25m_private.normalize_text(p_name),
    description = btrim(p_description),
    purpose = btrim(p_purpose),
    priority = p_priority,
    start_date = p_start_date,
    current_summary = nullif(btrim(p_current_summary), ''),
    territorial_scope_summary = nullif(btrim(p_territorial_scope_summary), '')
  where id = p_theme_id;

  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, old_data, new_data, result)
  values (
    p_actor_internal_user_id, 'theme.update', 'mp25m', 'themes', p_theme_id, v_rationale,
    jsonb_build_object('name', v_before.name, 'priority', v_before.priority, 'start_date', v_before.start_date),
    jsonb_build_object('name', btrim(p_name), 'priority', p_priority, 'start_date', p_start_date), 'allowed'
  );
end;
$function$;

create or replace function mp25m_api.transition_theme(
  p_actor_internal_user_id uuid,
  p_theme_id uuid,
  p_status text,
  p_rationale text,
  p_closing_summary text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.themes%rowtype;
  v_transition_no integer;
begin
  if not mp25m_api.can_operate_theme(p_actor_internal_user_id, p_theme_id, 'govern') then
    raise exception 'Internal user cannot govern this theme' using errcode = '42501';
  end if;
  if p_status not in ('active', 'monitoring', 'paused', 'closed')
     or char_length(btrim(coalesce(p_rationale, ''))) not between 3 and 10000
     or (p_status = 'closed' and char_length(btrim(coalesce(p_closing_summary, ''))) not between 3 and 10000) then
    raise exception 'Invalid theme transition' using errcode = '22023';
  end if;

  select * into v_before from mp25m.themes where id = p_theme_id for update;
  if not found then raise exception 'Theme not found' using errcode = 'P0002'; end if;
  if v_before.status = p_status then raise exception 'Theme already has this status' using errcode = '22023'; end if;

  update mp25m.themes set
    status = p_status,
    closing_summary = case when p_status = 'closed' then btrim(p_closing_summary) else null end,
    closing_date = case when p_status = 'closed' then current_date else null end,
    closed_at = case when p_status = 'closed' then now() else null end
  where id = p_theme_id;

  select coalesce(max(history.transition_no), 0) + 1 into v_transition_no
  from mp25m.theme_status_history history where history.theme_id = p_theme_id;

  insert into mp25m.theme_status_history (theme_id, transition_no, status, priority, closing_summary, rationale, changed_by_internal_user_id)
  values (
    p_theme_id,
    v_transition_no,
    p_status,
    v_before.priority,
    case when p_status = 'closed' then btrim(p_closing_summary) else null end,
    btrim(p_rationale),
    p_actor_internal_user_id
  );

  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, old_data, new_data, result)
  values (
    p_actor_internal_user_id, 'theme.transition', 'mp25m', 'themes', p_theme_id, btrim(p_rationale),
    jsonb_build_object('status', v_before.status, 'closing_summary', v_before.closing_summary),
    jsonb_build_object('status', p_status, 'closing_summary', case when p_status = 'closed' then btrim(p_closing_summary) else null end),
    'allowed'
  );
end;
$function$;

create or replace function mp25m_api.add_theme_responsibility(
  p_actor_internal_user_id uuid,
  p_theme_id uuid,
  p_internal_user_id uuid,
  p_responsibility_role text,
  p_rationale text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_responsibility_id uuid;
begin
  if not mp25m_api.can_operate_theme(p_actor_internal_user_id, p_theme_id, 'govern') then
    raise exception 'Internal user cannot govern this theme' using errcode = '42501';
  end if;
  if p_responsibility_role not in ('principal', 'responsible', 'promoter')
     or char_length(btrim(coalesce(p_rationale, ''))) not between 3 and 10000
     or not exists (
       select 1 from mp25m.internal_users internal_user
       where internal_user.id = p_internal_user_id and internal_user.status = 'active' and internal_user.deleted_at is null
     ) then
    raise exception 'Invalid theme responsibility' using errcode = '22023';
  end if;

  insert into mp25m.theme_responsibilities (theme_id, internal_user_id, responsibility_role, rationale, added_by_internal_user_id)
  values (p_theme_id, p_internal_user_id, p_responsibility_role, btrim(p_rationale), p_actor_internal_user_id)
  returning id into v_responsibility_id;

  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata)
  values (
    p_actor_internal_user_id, 'theme.responsibility.add', 'mp25m', 'theme_responsibilities', v_responsibility_id, btrim(p_rationale),
    jsonb_build_object('internal_user_id', p_internal_user_id, 'responsibility_role', p_responsibility_role), 'allowed', jsonb_build_object('theme_id', p_theme_id)
  );
  return v_responsibility_id;
exception when unique_violation then
  raise exception 'This active responsibility conflicts with an existing assignment' using errcode = '23505';
end;
$function$;

create or replace function mp25m_api.remove_theme_responsibility(
  p_actor_internal_user_id uuid,
  p_responsibility_id uuid,
  p_rationale text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_responsibility mp25m.theme_responsibilities%rowtype;
begin
  select * into v_responsibility from mp25m.theme_responsibilities where id = p_responsibility_id for update;
  if not found then raise exception 'Theme responsibility not found' using errcode = 'P0002'; end if;
  if not mp25m_api.can_operate_theme(p_actor_internal_user_id, v_responsibility.theme_id, 'govern') then
    raise exception 'Internal user cannot govern this theme' using errcode = '42501';
  end if;
  if v_responsibility.ended_at is not null or char_length(btrim(coalesce(p_rationale, ''))) not between 3 and 10000 then
    raise exception 'Invalid theme responsibility removal' using errcode = '22023';
  end if;

  update mp25m.theme_responsibilities set
    ended_at = now(), ended_by_internal_user_id = p_actor_internal_user_id, ending_rationale = btrim(p_rationale)
  where id = p_responsibility_id;

  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, old_data, new_data, result, metadata)
  values (
    p_actor_internal_user_id, 'theme.responsibility.remove', 'mp25m', 'theme_responsibilities', p_responsibility_id, btrim(p_rationale),
    jsonb_build_object('internal_user_id', v_responsibility.internal_user_id, 'responsibility_role', v_responsibility.responsibility_role),
    jsonb_build_object('ended', true), 'allowed', jsonb_build_object('theme_id', v_responsibility.theme_id)
  );
end;
$function$;

create or replace function mp25m_api.create_theme_followup(
  p_actor_internal_user_id uuid,
  p_theme_id uuid,
  p_followup_type text,
  p_detail text,
  p_occurred_at timestamptz default null,
  p_responsible_internal_user_id uuid default null,
  p_next_due_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_followup_id uuid;
begin
  if not mp25m_api.can_operate_theme(p_actor_internal_user_id, p_theme_id, 'followup') then
    raise exception 'Internal user cannot follow up this theme' using errcode = '42501';
  end if;
  if p_followup_type not in ('general', 'meeting', 'decision', 'commitment', 'next_step', 'result', 'observation')
     or char_length(btrim(coalesce(p_detail, ''))) not between 3 and 10000 then
    raise exception 'Invalid theme follow-up' using errcode = '22023';
  end if;
  if exists (select 1 from mp25m.themes theme where theme.id = p_theme_id and theme.status = 'closed') then
    raise exception 'A closed theme cannot receive follow-ups' using errcode = '22023';
  end if;
  if p_responsible_internal_user_id is not null and not exists (
    select 1 from mp25m.internal_users internal_user
    where internal_user.id = p_responsible_internal_user_id and internal_user.status = 'active' and internal_user.deleted_at is null
  ) then
    raise exception 'Follow-up responsible must be an active internal user' using errcode = '22023';
  end if;

  insert into mp25m.theme_followups (
    theme_id, followup_type, detail, occurred_at, responsible_internal_user_id, next_due_at, created_by_internal_user_id
  ) values (
    p_theme_id, p_followup_type, btrim(p_detail), coalesce(p_occurred_at, now()), p_responsible_internal_user_id, p_next_due_at, p_actor_internal_user_id
  ) returning id into v_followup_id;

  update mp25m.themes set updated_at = now() where id = p_theme_id;

  insert into mp25m.audit_events (actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata)
  values (
    p_actor_internal_user_id, 'theme.followup.create', 'mp25m', 'theme_followups', v_followup_id, btrim(p_detail),
    jsonb_build_object('followup_type', p_followup_type, 'responsible_internal_user_id', p_responsible_internal_user_id, 'next_due_at', p_next_due_at),
    'allowed', jsonb_build_object('theme_id', p_theme_id)
  );
  return v_followup_id;
end;
$function$;

revoke all on function mp25m_api.create_theme(uuid, text, text, text, text, date, text, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function mp25m_api.update_theme(uuid, uuid, text, text, text, text, date, text, text, text) from public, anon, authenticated, service_role;
revoke all on function mp25m_api.transition_theme(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
revoke all on function mp25m_api.add_theme_responsibility(uuid, uuid, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function mp25m_api.remove_theme_responsibility(uuid, uuid, text) from public, anon, authenticated, service_role;
revoke all on function mp25m_api.create_theme_followup(uuid, uuid, text, text, timestamptz, uuid, timestamptz) from public, anon, authenticated, service_role;

grant execute on function mp25m_api.create_theme(uuid, text, text, text, text, date, text, text, uuid, text) to service_role;
grant execute on function mp25m_api.update_theme(uuid, uuid, text, text, text, text, date, text, text, text) to service_role;
grant execute on function mp25m_api.transition_theme(uuid, uuid, text, text, text) to service_role;
grant execute on function mp25m_api.add_theme_responsibility(uuid, uuid, uuid, text, text) to service_role;
grant execute on function mp25m_api.remove_theme_responsibility(uuid, uuid, text) to service_role;
grant execute on function mp25m_api.create_theme_followup(uuid, uuid, text, text, timestamptz, uuid, timestamptz) to service_role;

comment on table mp25m.themes is '10B cross-cutting themes that remain independent from opportunities, articulations and projects.';
comment on table mp25m.theme_responsibilities is 'Explicit, time-bounded internal responsibilities for one theme.';
comment on table mp25m.theme_status_history is 'Append-oriented history of theme status transitions.';
comment on table mp25m.theme_followups is 'Append-oriented operational follow-ups for themes.';

commit;
