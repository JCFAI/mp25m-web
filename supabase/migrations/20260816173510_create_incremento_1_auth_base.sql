set search_path = '';

-- Incremento 1, fase 1: authorization model only.
-- This migration intentionally creates no RLS policies, no grants, no users,
-- no role seed data, and no changes to mp25m.roles or mp25m_private.

create table mp25m.internal_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null
    references auth.users (id)
    on update cascade
    on delete restrict,
  status text not null default 'active'
    constraint internal_users_status_check
    check (status in ('active', 'suspended', 'revoked')),
  created_by_internal_user_id uuid
    references mp25m.internal_users (id)
    on update cascade
    on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint internal_users_auth_user_unique unique (auth_user_id),
  constraint internal_users_deleted_status_check
    check (deleted_at is null or status in ('suspended', 'revoked'))
);

comment on table mp25m.internal_users is
  'Backoffice user accounts linked to Supabase Auth. Separate from mp25m territorial roles.';

alter table mp25m.internal_users enable row level security;

create table mp25m.access_roles (
  code text primary key,
  name text not null,
  description text,
  is_administrative boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint access_roles_code_format_check
    check (code ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint access_roles_name_not_blank_check
    check (length(btrim(name)) > 0),
  constraint access_roles_display_order_check
    check (display_order >= 0),
  constraint access_roles_deleted_inactive_check
    check (deleted_at is null or is_active = false)
);

comment on table mp25m.access_roles is
  'Backoffice access roles. Do not confuse with mp25m.roles, which stores territorial roles.';

alter table mp25m.access_roles enable row level security;

create table mp25m.access_scopes (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null
    constraint access_scopes_type_check
    check (scope_type in ('global', 'territorial', 'node', 'project', 'articulation')),
  scope_key text,
  scope_entity_id uuid,
  name text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint access_scopes_payload_by_type_check
    check (
      (scope_type = 'global' and scope_key is null and scope_entity_id is null)
      or
      (scope_type = 'territorial' and scope_key is not null and length(btrim(scope_key)) > 0 and scope_entity_id is null)
      or
      (scope_type in ('node', 'project', 'articulation') and scope_key is null and scope_entity_id is not null)
    ),
  constraint access_scopes_deleted_inactive_check
    check (deleted_at is null or is_active = false)
);

comment on table mp25m.access_scopes is
  'Authorization scopes for global, territorial, node, project, or articulation access.';
comment on column mp25m.access_scopes.scope_key is
  'Human-stable key for territorial scopes. Not used for global, node, project, or articulation scopes.';
comment on column mp25m.access_scopes.scope_entity_id is
  'UUID of the scoped node, project, or articulation. Foreign keys to productive or future tables are intentionally deferred.';

alter table mp25m.access_scopes enable row level security;

create table mp25m.access_role_assignments (
  id uuid primary key default gen_random_uuid(),
  internal_user_id uuid not null
    references mp25m.internal_users (id)
    on update cascade
    on delete restrict,
  access_role_code text not null
    references mp25m.access_roles (code)
    on update cascade
    on delete restrict,
  access_scope_id uuid not null
    references mp25m.access_scopes (id)
    on update cascade
    on delete restrict,
  status text not null default 'active'
    constraint access_role_assignments_status_check
    check (status in ('active', 'revoked')),
  granted_by_internal_user_id uuid
    references mp25m.internal_users (id)
    on update cascade
    on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by_internal_user_id uuid
    references mp25m.internal_users (id)
    on update cascade
    on delete set null,
  revoked_at timestamptz,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint access_role_assignments_valid_window_check
    check (valid_until is null or valid_until > valid_from),
  constraint access_role_assignments_revoked_after_granted_check
    check (revoked_at is null or revoked_at >= granted_at),
  constraint access_role_assignments_revocation_check
    check (
      (status = 'active' and revoked_by_internal_user_id is null and revoked_at is null)
      or
      (status = 'revoked' and revoked_at is not null)
    )
);

comment on table mp25m.access_role_assignments is
  'Role grants for internal users, separated from territorial participation roles.';

alter table mp25m.access_role_assignments enable row level security;

create table mp25m.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_internal_user_id uuid
    references mp25m.internal_users (id)
    on update cascade
    on delete restrict,
  action text not null,
  target_schema text,
  target_table text,
  target_id uuid,
  reason text,
  old_data jsonb,
  new_data jsonb,
  request_ip inet,
  user_agent text,
  result text not null
    constraint audit_events_result_check
    check (result in ('allowed', 'rejected', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint audit_events_action_not_blank_check
    check (length(btrim(action)) > 0),
  constraint audit_events_target_check
    check (
      (target_schema is null and target_table is null)
      or
      (target_schema is not null and target_table is not null)
    ),
  constraint audit_events_target_names_not_blank_check
    check (
      (target_schema is null or length(btrim(target_schema)) > 0)
      and
      (target_table is null or length(btrim(target_table)) > 0)
    )
);

comment on table mp25m.audit_events is
  'Append-oriented audit log for sensitive backoffice actions. No client grants or RLS policies are created in this phase.';
comment on column mp25m.audit_events.metadata is
  'Operational context only. Do not store passwords, tokens, keys, secrets, or unnecessary personal data.';
comment on column mp25m.audit_events.old_data is
  'Minimal previous state for traceability. Do not store passwords, tokens, keys, secrets, or unnecessary personal data.';
comment on column mp25m.audit_events.new_data is
  'Minimal new state for traceability. Do not store passwords, tokens, keys, secrets, or unnecessary personal data.';

alter table mp25m.audit_events enable row level security;

create index internal_users_created_by_idx
  on mp25m.internal_users (created_by_internal_user_id)
  where created_by_internal_user_id is not null;

create index internal_users_status_idx
  on mp25m.internal_users (status)
  where deleted_at is null;

create index access_roles_active_order_idx
  on mp25m.access_roles (is_active, display_order, code)
  where deleted_at is null;

create index access_scopes_type_idx
  on mp25m.access_scopes (scope_type)
  where deleted_at is null;

create unique index access_scopes_one_active_global
  on mp25m.access_scopes (scope_type)
  where scope_type = 'global' and is_active = true and deleted_at is null;

create unique index access_scopes_one_active_territorial_key
  on mp25m.access_scopes (btrim(scope_key))
  where scope_type = 'territorial' and is_active = true and deleted_at is null;

create unique index access_scopes_one_active_entity_scope
  on mp25m.access_scopes (scope_type, scope_entity_id)
  where scope_type in ('node', 'project', 'articulation') and is_active = true and deleted_at is null;

create index access_role_assignments_user_idx
  on mp25m.access_role_assignments (internal_user_id);

create index access_role_assignments_role_idx
  on mp25m.access_role_assignments (access_role_code);

create index access_role_assignments_scope_idx
  on mp25m.access_role_assignments (access_scope_id);

create index access_role_assignments_granted_by_idx
  on mp25m.access_role_assignments (granted_by_internal_user_id)
  where granted_by_internal_user_id is not null;

create index access_role_assignments_revoked_by_idx
  on mp25m.access_role_assignments (revoked_by_internal_user_id)
  where revoked_by_internal_user_id is not null;

create index access_role_assignments_active_window_idx
  on mp25m.access_role_assignments (internal_user_id, access_role_code, access_scope_id, valid_from, valid_until)
  where status = 'active';

create unique index access_role_assignments_one_active_per_scope
  on mp25m.access_role_assignments (internal_user_id, access_role_code, access_scope_id)
  where status = 'active';

create index audit_events_actor_idx
  on mp25m.audit_events (actor_internal_user_id)
  where actor_internal_user_id is not null;

create index audit_events_target_idx
  on mp25m.audit_events (target_schema, target_table, target_id)
  where target_schema is not null and target_table is not null;

create index audit_events_action_idx
  on mp25m.audit_events (action);

create index audit_events_occurred_at_idx
  on mp25m.audit_events (occurred_at desc);

create function mp25m.audit_events_append_only_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '42501',
    message = format('mp25m.audit_events is append-only; %s is not allowed', tg_op);
end;
$$;

create trigger trg_internal_users_updated_at
  before update on mp25m.internal_users
  for each row
  execute function mp25m.set_updated_at();

create trigger trg_access_roles_updated_at
  before update on mp25m.access_roles
  for each row
  execute function mp25m.set_updated_at();

create trigger trg_access_scopes_updated_at
  before update on mp25m.access_scopes
  for each row
  execute function mp25m.set_updated_at();

create trigger trg_access_role_assignments_updated_at
  before update on mp25m.access_role_assignments
  for each row
  execute function mp25m.set_updated_at();

create trigger trg_audit_events_prevent_update
  before update on mp25m.audit_events
  for each row
  execute function mp25m.audit_events_append_only_guard();

create trigger trg_audit_events_prevent_delete
  before delete on mp25m.audit_events
  for each row
  execute function mp25m.audit_events_append_only_guard();

create trigger trg_audit_events_prevent_truncate
  before truncate on mp25m.audit_events
  for each statement
  execute function mp25m.audit_events_append_only_guard();

revoke all privileges on table
  mp25m.internal_users,
  mp25m.access_roles,
  mp25m.access_scopes,
  mp25m.access_role_assignments,
  mp25m.audit_events
from public, anon, authenticated, service_role;

revoke all on function mp25m.audit_events_append_only_guard()
from public, anon, authenticated, service_role;
