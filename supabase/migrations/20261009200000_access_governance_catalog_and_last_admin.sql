-- MP25M_S: catalog for explicitly scoped governance.
-- No account is promoted and no existing assignment is changed by this migration.
insert into mp25m.access_roles
  (code, name, description, is_administrative, is_active, display_order)
values
  ('local_administrator', 'Administrador Local',
   'Administración de personas y accesos dentro de los nodos asignados.', true, true, 15),
  ('founder_access', 'Fundador',
   'Facultad de designar referentes dentro del ámbito autorizado.', false, true, 35)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_administrative = excluded.is_administrative,
  is_active = true,
  updated_at = now();

-- Invariant: do not remove the last active global administrator.
-- This trigger protects UPDATE/DELETE on grants; also lock global scope
-- so concurrent revocations cannot each see the other administrator.
create or replace function mp25m_private.protect_last_global_administrator()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_private
as $function$
declare
  v_scope_type text;
  v_remaining integer;
begin
  if old.access_role_code <> 'administrator'
     or old.status <> 'active'
     or old.revoked_at is not null
     or old.valid_from > now()
     or (old.valid_until is not null and old.valid_until <= now()) then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE'
     and new.status = 'active'
     and new.revoked_at is null
     and new.access_role_code = old.access_role_code
     and new.access_scope_id = old.access_scope_id
     and new.internal_user_id = old.internal_user_id
     and new.valid_from <= now()
     and (new.valid_until is null or new.valid_until > now()) then
    return new;
  end if;

  select scope_type into v_scope_type
  from mp25m.access_scopes where id = old.access_scope_id;
  if v_scope_type <> 'global' then return coalesce(new, old); end if;

  -- Serialize administrative privilege removals within this transaction.
  perform pg_advisory_xact_lock(20261009, 1);

  select count(*) into v_remaining
  from mp25m.access_role_assignments a
  join mp25m.internal_users u on u.id = a.internal_user_id
  where a.id <> old.id
    and a.access_role_code = 'administrator'
    and a.access_scope_id = old.access_scope_id
    and a.status = 'active'
    and a.revoked_at is null
    and a.valid_from <= now()
    and (a.valid_until is null or a.valid_until > now())
    and u.status = 'active'
    and u.deleted_at is null;

  if v_remaining = 0 then
    raise exception 'Cannot remove last active global administrator'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists protect_last_global_administrator
  on mp25m.access_role_assignments;
create trigger protect_last_global_administrator
before update or delete on mp25m.access_role_assignments
for each row execute function mp25m_private.protect_last_global_administrator();

-- Prevent suspending, revoking or deleting the last active global administrator.
create or replace function mp25m_private.protect_last_admin_user()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_private
as $function$
declare
  v_remaining integer;
begin
  if tg_op = 'UPDATE'
     and new.status = 'active'
     and new.deleted_at is null then
    return new;
  end if;

  if old.status <> 'active' or old.deleted_at is not null then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1 from mp25m.access_role_assignments a
    join mp25m.access_scopes s on s.id = a.access_scope_id
    where a.internal_user_id = old.id and a.access_role_code = 'administrator'
      and s.scope_type = 'global' and s.is_active and s.deleted_at is null
      and a.status = 'active' and a.revoked_at is null
      and a.valid_from <= now()
      and (a.valid_until is null or a.valid_until > now())
  ) then return coalesce(new, old); end if;

  perform pg_advisory_xact_lock(20261009, 1);
  select count(distinct u.id) into v_remaining
  from mp25m.internal_users u
  join mp25m.access_role_assignments a on a.internal_user_id = u.id
  join mp25m.access_scopes s on s.id = a.access_scope_id
  where u.id <> old.id and u.status = 'active' and u.deleted_at is null
    and a.access_role_code = 'administrator' and a.status = 'active'
    and a.revoked_at is null and a.valid_from <= now()
    and (a.valid_until is null or a.valid_until > now())
    and s.scope_type = 'global' and s.is_active and s.deleted_at is null;

  if v_remaining = 0 then
    raise exception 'Cannot disable last active global administrator' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists protect_last_admin_user on mp25m.internal_users;
create trigger protect_last_admin_user
before update or delete on mp25m.internal_users
for each row execute function mp25m_private.protect_last_admin_user();

-- Remaining: safeguard role/catalog/scope deactivation and naturally expiring
-- grants. No privilege management API is enabled until these are covered.
