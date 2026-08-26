-- Incremento 2 - visible internal-user identity and opportunity assignee.
--
-- Internal users remain distinct from canonical territorial persons.
-- display_name is a backoffice identity only.
--
-- Browser clients never access these objects directly.

alter table mp25m.internal_users
add column if not exists display_name text;


alter table mp25m.internal_users
drop constraint if exists internal_users_display_name_length_check;

alter table mp25m.internal_users
add constraint internal_users_display_name_length_check
check (
    display_name is null
    or char_length(btrim(display_name))
        between 2 and 120
);


create index if not exists
idx_internal_users_active_display_name
on mp25m.internal_users (
    lower(display_name)
)
where status = 'active'
  and deleted_at is null
  and display_name is not null;


-- Server-only profile/options view.

create or replace view mp25m_api.internal_user_profile
with (security_invoker = true)
as
select
    iu.id,
    iu.display_name,
    iu.status,

    coalesce(
        access_data.role_names,
        '{}'::text[]
    ) as role_names,

    coalesce(
        access_data.scope_names,
        '{}'::text[]
    ) as scope_names

from mp25m.internal_users iu

left join lateral (
    select
        array_agg(
            distinct ar.name
            order by ar.name
        ) filter (
            where ar.name is not null
        ) as role_names,

        array_agg(
            distinct coalesce(
                scope.name,
                scope.scope_type
            )
            order by coalesce(
                scope.name,
                scope.scope_type
            )
        ) filter (
            where scope.id is not null
        ) as scope_names

    from mp25m.access_role_assignments ara

    join mp25m.access_roles ar
      on ar.code = ara.access_role_code
     and ar.is_active = true
     and ar.deleted_at is null

    join mp25m.access_scopes scope
      on scope.id = ara.access_scope_id
     and scope.is_active = true
     and scope.deleted_at is null

    where ara.internal_user_id = iu.id
      and ara.status = 'active'
      and ara.revoked_at is null
      and ara.valid_from <= now()
      and (
          ara.valid_until is null
          or ara.valid_until > now()
      )
) access_data on true

where iu.status = 'active'
  and iu.deleted_at is null;


revoke all
on mp25m_api.internal_user_profile
from public, anon, authenticated, service_role;

grant select
on mp25m_api.internal_user_profile
to service_role;


create or replace view mp25m_api.opportunity_assignee_options
with (security_invoker = true)
as
select
    id,
    display_name,
    role_names,
    scope_names
from mp25m_api.internal_user_profile
where display_name is not null
order by
    lower(display_name),
    id;


revoke all
on mp25m_api.opportunity_assignee_options
from public, anon, authenticated, service_role;

grant select
on mp25m_api.opportunity_assignee_options
to service_role;


-- Current internal user sets its own visible backoffice name.
-- The Next.js server resolves the current internal-user id.

create or replace function mp25m_api.set_internal_user_display_name(
    p_internal_user_id uuid,
    p_display_name text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_old_display_name text;
    v_new_display_name text;
begin
    v_new_display_name :=
        nullif(
            btrim(p_display_name),
            ''
        );

    if v_new_display_name is null
       or char_length(v_new_display_name) < 2
       or char_length(v_new_display_name) > 120
    then
        raise exception
            'Invalid internal user display name'
            using errcode = '22023';
    end if;

    select iu.display_name
    into v_old_display_name
    from mp25m.internal_users iu
    where iu.id = p_internal_user_id
      and iu.status = 'active'
      and iu.deleted_at is null
    for update;

    if not found then
        raise exception
            'Internal user not found or inactive'
            using errcode = 'P0002';
    end if;

    if v_old_display_name is not distinct from
       v_new_display_name
    then
        return;
    end if;

    update mp25m.internal_users
    set display_name =
        v_new_display_name
    where id =
        p_internal_user_id;

    insert into mp25m.audit_events (
        actor_internal_user_id,
        action,
        target_schema,
        target_table,
        target_id,
        old_data,
        new_data,
        result,
        metadata
    )
    values (
        p_internal_user_id,
        'internal_user.display_name_change',
        'mp25m',
        'internal_users',
        p_internal_user_id,
        jsonb_build_object(
            'display_name',
                v_old_display_name
        ),
        jsonb_build_object(
            'display_name',
                v_new_display_name
        ),
        'allowed',
        '{}'::jsonb
    );
end;
$function$;


revoke all
on function mp25m_api.set_internal_user_display_name(
    uuid,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.set_internal_user_display_name(
    uuid,
    text
)
to service_role;


-- Assign or unassign an opportunity.
-- The lifecycle status remains independent.

create or replace function mp25m_api.update_opportunity_assignee(
    p_actor_internal_user_id uuid,
    p_opportunity_id uuid,
    p_assigned_to_internal_user_id uuid,
    p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_old_assignee_id uuid;
    v_old_assignee_name text;
    v_new_assignee_name text;
begin
    if not exists (
        select 1
        from mp25m.internal_users iu
        where iu.id = p_actor_internal_user_id
          and iu.status = 'active'
          and iu.deleted_at is null
    ) then
        raise exception
            'Invalid or inactive internal user'
            using errcode = '42501';
    end if;

    select
        o.assigned_to_internal_user_id
    into
        v_old_assignee_id
    from mp25m.opportunities o
    where o.id = p_opportunity_id
    for update;

    if not found then
        raise exception
            'Opportunity not found'
            using errcode = 'P0002';
    end if;

    if p_assigned_to_internal_user_id is not null then
        select iu.display_name
        into v_new_assignee_name
        from mp25m.internal_users iu
        where iu.id =
                p_assigned_to_internal_user_id
          and iu.status = 'active'
          and iu.deleted_at is null
          and iu.display_name is not null;

        if not found then
            raise exception
                'Assigned internal user is invalid, inactive or has no display name'
                using errcode = '23503';
        end if;
    end if;

    if v_old_assignee_id is not null then
        select iu.display_name
        into v_old_assignee_name
        from mp25m.internal_users iu
        where iu.id =
                v_old_assignee_id;
    end if;

    if v_old_assignee_id is not distinct from
       p_assigned_to_internal_user_id
    then
        raise exception
            'Opportunity already has the requested assignee'
            using errcode = '22023';
    end if;

    update mp25m.opportunities
    set assigned_to_internal_user_id =
        p_assigned_to_internal_user_id
    where id =
        p_opportunity_id;

    insert into mp25m.audit_events (
        actor_internal_user_id,
        action,
        target_schema,
        target_table,
        target_id,
        reason,
        old_data,
        new_data,
        result,
        metadata
    )
    values (
        p_actor_internal_user_id,
        'opportunity.assignee_change',
        'mp25m',
        'opportunities',
        p_opportunity_id,
        nullif(
            btrim(p_reason),
            ''
        ),
        jsonb_build_object(
            'assigned_to_internal_user_id',
                v_old_assignee_id,
            'assigned_to_display_name',
                v_old_assignee_name
        ),
        jsonb_build_object(
            'assigned_to_internal_user_id',
                p_assigned_to_internal_user_id,
            'assigned_to_display_name',
                v_new_assignee_name
        ),
        'allowed',
        '{}'::jsonb
    );
end;
$function$;


revoke all
on function mp25m_api.update_opportunity_assignee(
    uuid,
    uuid,
    uuid,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.update_opportunity_assignee(
    uuid,
    uuid,
    uuid,
    text
)
to service_role;


comment on column mp25m.internal_users.display_name is
    'Human-readable backoffice identity. Independent from canonical territorial persons.';

comment on view mp25m_api.opportunity_assignee_options is
    'Server-only list of active internal users eligible to appear in opportunity assignee selectors.';

comment on function mp25m_api.update_opportunity_assignee(
    uuid,
    uuid,
    uuid,
    text
) is
    'Assigns or clears an opportunity responsible internal user and records an immutable audit event.';