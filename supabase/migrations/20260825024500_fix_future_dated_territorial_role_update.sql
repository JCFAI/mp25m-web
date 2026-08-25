-- Fix confirmation of a currently active territorial role
-- when the role has a future ended_on date.
--
-- The original API already considered such a role active when
-- detecting it. The UPDATE must use the same definition of active.

create or replace function
mp25m_api.add_person_node_participation_roles(
    p_actor_internal_user_id uuid,
    p_participation_id uuid,
    p_role_codes text[],
    p_reason text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_participation mp25m.node_participations%rowtype;
    v_role_code text;
    v_previous_roles text[];
    v_result_roles text[];
begin
    if nullif(btrim(p_reason), '') is null then
        raise exception
            'Role assignment reason is required'
            using errcode = '22023';
    end if;

    if
        p_role_codes is null
        or cardinality(p_role_codes) = 0
    then
        raise exception
            'At least one role is required'
            using errcode = '22023';
    end if;

    if cardinality(p_role_codes) > 20 then
        raise exception
            'Too many roles requested'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.internal_users iu

        join mp25m.access_role_assignments ara
          on ara.internal_user_id = iu.id

        join mp25m.access_roles ar
          on ar.code = ara.access_role_code

        join mp25m.access_scopes scope
          on scope.id = ara.access_scope_id

        where iu.id = p_actor_internal_user_id
          and iu.status = 'active'
          and iu.deleted_at is null
          and ara.status = 'active'
          and ara.revoked_at is null
          and ara.valid_from <= now()
          and (
              ara.valid_until is null
              or ara.valid_until >= now()
          )
          and ar.code in (
              'administrator',
              'validator'
          )
          and scope.scope_type = 'global'
    ) then
        raise exception
            'Internal user cannot manage territorial roles'
            using errcode = '42501';
    end if;

    select np.*
    into v_participation
    from mp25m.node_participations np
    where np.id = p_participation_id
    for update;

    if not found then
        raise exception
            'Territorial participation not found'
            using errcode = 'P0002';
    end if;

    if
        v_participation.status <> 'active'
        or (
            v_participation.ended_on is not null
            and v_participation.ended_on < current_date
        )
        or
        v_participation.verification_status <>
            'confirmed'
    then
        raise exception
            'Territorial participation must be active and confirmed'
            using errcode = '22023';
    end if;

    if exists (
        select requested.role_code
        from (
            select distinct
                btrim(value) as role_code
            from unnest(p_role_codes) value
        ) requested

        left join mp25m.roles r
          on r.code = requested.role_code
         and r.active = true

        where
            requested.role_code = ''
            or r.code is null
    ) then
        raise exception
            'One or more territorial roles are invalid'
            using errcode = '22023';
    end if;

    select
        coalesce(
            array_agg(
                npr.role_code::text
                order by npr.role_code
            ),
            '{}'::text[]
        )
    into v_previous_roles
    from mp25m.node_participation_roles npr
    where npr.participation_id =
        p_participation_id
      and (
          npr.ended_on is null
          or npr.ended_on >= current_date
      )
      and npr.verification_status <>
          'rejected';

    for v_role_code in
        select distinct btrim(value)
        from unnest(p_role_codes) value
        order by 1
    loop
        if exists (
            select 1
            from mp25m.node_participation_roles npr
            where npr.participation_id =
                p_participation_id
              and npr.role_code =
                v_role_code
              and (
                  npr.ended_on is null
                  or npr.ended_on >= current_date
              )
        ) then
            update mp25m.node_participation_roles
            set verification_status =
                'confirmed'
            where participation_id =
                p_participation_id
              and role_code =
                v_role_code
              and (
                  ended_on is null
                  or ended_on >= current_date
              )
              and verification_status <>
                  'confirmed';

        else
            insert into mp25m.node_participation_roles (
                participation_id,
                role_code,
                verification_status
            )
            values (
                p_participation_id,
                v_role_code,
                'confirmed'
            );
        end if;
    end loop;

    select
        coalesce(
            array_agg(
                npr.role_code::text
                order by npr.role_code
            ),
            '{}'::text[]
        )
    into v_result_roles
    from mp25m.node_participation_roles npr
    where npr.participation_id =
        p_participation_id
      and (
          npr.ended_on is null
          or npr.ended_on >= current_date
      )
      and npr.verification_status <>
          'rejected';

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
        'person.node_roles.add',
        'mp25m',
        'node_participations',
        p_participation_id,
        btrim(p_reason),
        jsonb_build_object(
            'role_codes',
            v_previous_roles
        ),
        jsonb_build_object(
            'role_codes',
            v_result_roles
        ),
        'allowed',
        jsonb_build_object(
            'person_id',
            v_participation.person_id,
            'node_id',
            v_participation.node_id
        )
    );
end;
$function$;