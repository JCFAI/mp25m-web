-- Explicit territorial participation management for resolved person candidates.
--
-- Identity resolution, node participation and territorial roles are independent.
-- Confirming a node never copies roles from another node.
-- Adding roles never removes existing roles.

create or replace view
mp25m_api.territorial_role_options
with (security_invoker = true)
as
select
    r.code::text as code,
    r.name::text as name,
    r.description,
    r.is_internal
from mp25m.roles r
where r.active = true;


create or replace function
mp25m_api.confirm_actor_candidate_person_node_participation(
    p_actor_internal_user_id uuid,
    p_candidate_id uuid,
    p_node_id uuid,
    p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_candidate mp25m.actor_candidates%rowtype;
    v_participation mp25m.node_participations%rowtype;
    v_old_data jsonb;
begin
    if nullif(btrim(p_reason), '') is null then
        raise exception
            'Participation confirmation reason is required'
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
            'Internal user cannot confirm territorial participation'
            using errcode = '42501';
    end if;

    select ac.*
    into v_candidate
    from mp25m.actor_candidates ac
    where ac.id = p_candidate_id
    for update;

    if not found then
        raise exception
            'Actor candidate not found'
            using errcode = 'P0002';
    end if;

    if v_candidate.actor_kind <> 'person' then
        raise exception
            'Actor candidate is not a person'
            using errcode = '22023';
    end if;

    if v_candidate.status not in (
        'merged',
        'approved'
    )
    or v_candidate.resolved_person_id is null
    then
        raise exception
            'Actor candidate does not have a resolved person'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.actor_candidate_nodes acn
        where acn.actor_candidate_id =
            p_candidate_id
          and acn.node_id =
            p_node_id
    ) then
        raise exception
            'Node was not reported for this actor candidate'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.nodes n
        where n.id = p_node_id
          and n.status = 'active'
    ) then
        raise exception
            'Node is not active'
            using errcode = '22023';
    end if;

    select np.*
    into v_participation
    from mp25m.node_participations np
    where np.person_id =
        v_candidate.resolved_person_id
      and np.node_id = p_node_id
      and np.status = 'active'
      and (
          np.ended_on is null
          or np.ended_on >= current_date
      )
    for update;

    if found then
        if
            v_participation.verification_status =
            'confirmed'
        then
            raise exception
                'Territorial participation is already confirmed'
                using errcode = '22023';
        end if;

        v_old_data :=
            jsonb_build_object(
                'person_id',
                v_participation.person_id,
                'node_id',
                v_participation.node_id,
                'status',
                v_participation.status,
                'verification_status',
                v_participation.verification_status
            );

        update mp25m.node_participations
        set
            verification_status = 'confirmed',
            updated_at = now()
        where id = v_participation.id
        returning *
        into v_participation;

    else
        insert into mp25m.node_participations (
            person_id,
            node_id,
            status,
            verification_status
        )
        values (
            v_candidate.resolved_person_id,
            p_node_id,
            'active',
            'confirmed'
        )
        returning *
        into v_participation;

        v_old_data := null;
    end if;

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
        'person.node_participation.confirm',
        'mp25m',
        'node_participations',
        v_participation.id,
        btrim(p_reason),
        v_old_data,
        jsonb_build_object(
            'person_id',
            v_participation.person_id,
            'node_id',
            v_participation.node_id,
            'status',
            v_participation.status,
            'verification_status',
            v_participation.verification_status
        ),
        'allowed',
        jsonb_build_object(
            'actor_candidate_id',
            p_candidate_id
        )
    );

    return v_participation.id;
end;
$function$;


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
              and ended_on is null
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


revoke all
on mp25m_api.territorial_role_options
from public, anon, authenticated, service_role;

grant select
on mp25m_api.territorial_role_options
to service_role;


revoke all
on function
mp25m_api.confirm_actor_candidate_person_node_participation(
    uuid, uuid, uuid, text
)
from public, anon, authenticated, service_role;

grant execute
on function
mp25m_api.confirm_actor_candidate_person_node_participation(
    uuid, uuid, uuid, text
)
to service_role;


revoke all
on function
mp25m_api.add_person_node_participation_roles(
    uuid, uuid, text[], text
)
from public, anon, authenticated, service_role;

grant execute
on function
mp25m_api.add_person_node_participation_roles(
    uuid, uuid, text[], text
)
to service_role;