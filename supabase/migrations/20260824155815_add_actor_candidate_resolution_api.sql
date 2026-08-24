-- Incremento 2 - reviewed resolution of person actor candidates.
--
-- Resolution is always explicit and audited.
-- Candidate node context remains provenance only.
-- No candidate resolution creates or confirms node participation.

create or replace function
mp25m_api.resolve_actor_candidate_existing_person(
    p_actor_internal_user_id uuid,
    p_candidate_id uuid,
    p_person_id uuid,
    p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_candidate mp25m.actor_candidates%rowtype;
    v_person_name text;
    v_opportunity_id uuid;
begin
    if nullif(btrim(p_reason), '') is null then
        raise exception
            'Resolution reason is required'
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
              or ara.valid_until > now()
          )
          and ar.code in ('administrator', 'validator')
          and ar.is_active = true
          and ar.deleted_at is null
          and scope.scope_type = 'global'
          and scope.is_active = true
          and scope.deleted_at is null
    ) then
        raise exception
            'Actor candidate review is not allowed'
            using errcode = '42501';
    end if;

    select *
    into v_candidate
    from mp25m.actor_candidates
    where id = p_candidate_id
    for update;

    if not found then
        raise exception
            'Actor candidate not found'
            using errcode = 'P0002';
    end if;

    if v_candidate.actor_kind <> 'person'
       or v_candidate.status <> 'pending'
    then
        raise exception
            'Actor candidate is not a pending person'
            using errcode = '22023';
    end if;

    select p.display_name
    into v_person_name
    from mp25m.persons p
    where p.id = p_person_id
      and p.record_status = 'active';

    if not found then
        raise exception
            'Canonical person not found or inactive'
            using errcode = 'P0002';
    end if;

    for v_opportunity_id in
        select oo.opportunity_id
        from mp25m.opportunity_origins oo
        where oo.actor_candidate_id = p_candidate_id
    loop
        delete from mp25m.opportunity_origins
        where opportunity_id = v_opportunity_id
          and actor_candidate_id = p_candidate_id;

        insert into mp25m.opportunity_origins (
            opportunity_id,
            person_id
        )
        values (
            v_opportunity_id,
            p_person_id
        )
        on conflict do nothing;

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
            'opportunity.origin_resolved',
            'mp25m',
            'opportunities',
            v_opportunity_id,
            nullif(btrim(p_reason), ''),
            jsonb_build_object(
                'actor_type', 'candidate',
                'actor_id', p_candidate_id,
                'display_name', v_candidate.display_name
            ),
            jsonb_build_object(
                'actor_type', 'person',
                'actor_id', p_person_id,
                'display_name', v_person_name
            ),
            'allowed',
            jsonb_build_object(
                'opportunity_id', v_opportunity_id,
                'actor_candidate_id', p_candidate_id
            )
        );
    end loop;

    update mp25m.actor_candidates
    set
        status = 'merged',
        resolved_person_id = p_person_id,
        resolved_organization_id = null,
        updated_at = now()
    where id = p_candidate_id;

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
        'actor_candidate.resolve_existing_person',
        'mp25m',
        'actor_candidates',
        p_candidate_id,
        nullif(btrim(p_reason), ''),
        jsonb_build_object(
            'status', 'pending',
            'display_name', v_candidate.display_name
        ),
        jsonb_build_object(
            'status', 'merged',
            'resolved_person_id', p_person_id,
            'resolved_person_display_name', v_person_name
        ),
        'allowed',
        '{}'::jsonb
    );
end;
$function$;


create or replace function
mp25m_api.approve_actor_candidate_new_person(
    p_actor_internal_user_id uuid,
    p_candidate_id uuid,
    p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_candidate mp25m.actor_candidates%rowtype;
    v_person_id uuid;
    v_opportunity_id uuid;
begin
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
              or ara.valid_until > now()
          )
          and ar.code in ('administrator', 'validator')
          and ar.is_active = true
          and ar.deleted_at is null
          and scope.scope_type = 'global'
          and scope.is_active = true
          and scope.deleted_at is null
    ) then
        raise exception
            'Actor candidate review is not allowed'
            using errcode = '42501';
    end if;

    select *
    into v_candidate
    from mp25m.actor_candidates
    where id = p_candidate_id
    for update;

    if not found then
        raise exception
            'Actor candidate not found'
            using errcode = 'P0002';
    end if;

    if v_candidate.actor_kind <> 'person'
       or v_candidate.status <> 'pending'
    then
        raise exception
            'Actor candidate is not a pending person'
            using errcode = '22023';
    end if;

    if exists (
        select 1
        from mp25m.persons p
        where p.record_status = 'active'
          and p.normalized_name is not null
          and (
              extensions.similarity(
                  p.normalized_name,
                  v_candidate.normalized_name
              ) >= 0.90

              or (
                  (
                      select array_agg(
                          distinct token
                          order by token
                      )
                      from regexp_split_to_table(
                          p.normalized_name,
                          '[[:space:]]+'
                      ) token
                      where token <> ''
                  )
                  =
                  (
                      select array_agg(
                          distinct token
                          order by token
                      )
                      from regexp_split_to_table(
                          v_candidate.normalized_name,
                          '[[:space:]]+'
                      ) token
                      where token <> ''
                  )
              )
          )
    )
    and nullif(btrim(p_reason), '') is null
    then
        raise exception
            'Reason is required because a strong nominal match already exists'
            using errcode = '22023';
    end if;

    insert into mp25m.persons (
        display_name,
        normalized_name
    )
    values (
        v_candidate.display_name,
        v_candidate.normalized_name
    )
    returning id
    into v_person_id;

    for v_opportunity_id in
        select oo.opportunity_id
        from mp25m.opportunity_origins oo
        where oo.actor_candidate_id = p_candidate_id
    loop
        delete from mp25m.opportunity_origins
        where opportunity_id = v_opportunity_id
          and actor_candidate_id = p_candidate_id;

        insert into mp25m.opportunity_origins (
            opportunity_id,
            person_id
        )
        values (
            v_opportunity_id,
            v_person_id
        )
        on conflict do nothing;

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
            'opportunity.origin_resolved',
            'mp25m',
            'opportunities',
            v_opportunity_id,
            nullif(btrim(p_reason), ''),
            jsonb_build_object(
                'actor_type', 'candidate',
                'actor_id', p_candidate_id,
                'display_name', v_candidate.display_name
            ),
            jsonb_build_object(
                'actor_type', 'person',
                'actor_id', v_person_id,
                'display_name', v_candidate.display_name
            ),
            'allowed',
            jsonb_build_object(
                'opportunity_id', v_opportunity_id,
                'actor_candidate_id', p_candidate_id
            )
        );
    end loop;

    update mp25m.actor_candidates
    set
        status = 'approved',
        resolved_person_id = v_person_id,
        resolved_organization_id = null,
        updated_at = now()
    where id = p_candidate_id;

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
        'actor_candidate.approve_new_person',
        'mp25m',
        'actor_candidates',
        p_candidate_id,
        nullif(btrim(p_reason), ''),
        jsonb_build_object(
            'status', 'pending',
            'display_name', v_candidate.display_name
        ),
        jsonb_build_object(
            'status', 'approved',
            'resolved_person_id', v_person_id,
            'resolved_person_display_name', v_candidate.display_name
        ),
        'allowed',
        '{}'::jsonb
    );

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
        'person.create_from_actor_candidate',
        'mp25m',
        'persons',
        v_person_id,
        nullif(btrim(p_reason), ''),
        null,
        jsonb_build_object(
            'display_name', v_candidate.display_name,
            'normalized_name', v_candidate.normalized_name
        ),
        'allowed',
        jsonb_build_object(
            'actor_candidate_id', p_candidate_id
        )
    );

    return v_person_id;
end;
$function$;


create or replace function
mp25m_api.reject_actor_candidate(
    p_actor_internal_user_id uuid,
    p_candidate_id uuid,
    p_reason text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_candidate mp25m.actor_candidates%rowtype;
    v_opportunity_id uuid;
begin
    if nullif(btrim(p_reason), '') is null then
        raise exception
            'Rejection reason is required'
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
              or ara.valid_until > now()
          )
          and ar.code in ('administrator', 'validator')
          and ar.is_active = true
          and ar.deleted_at is null
          and scope.scope_type = 'global'
          and scope.is_active = true
          and scope.deleted_at is null
    ) then
        raise exception
            'Actor candidate review is not allowed'
            using errcode = '42501';
    end if;

    select *
    into v_candidate
    from mp25m.actor_candidates
    where id = p_candidate_id
    for update;

    if not found then
        raise exception
            'Actor candidate not found'
            using errcode = 'P0002';
    end if;

    if v_candidate.status <> 'pending' then
        raise exception
            'Actor candidate is not pending'
            using errcode = '22023';
    end if;

    for v_opportunity_id in
        select oo.opportunity_id
        from mp25m.opportunity_origins oo
        where oo.actor_candidate_id = p_candidate_id
    loop
        delete from mp25m.opportunity_origins
        where opportunity_id = v_opportunity_id
          and actor_candidate_id = p_candidate_id;

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
            'opportunity.origin_candidate_rejected',
            'mp25m',
            'opportunities',
            v_opportunity_id,
            btrim(p_reason),
            jsonb_build_object(
                'actor_type', 'candidate',
                'actor_id', p_candidate_id,
                'display_name', v_candidate.display_name
            ),
            null,
            'allowed',
            jsonb_build_object(
                'opportunity_id', v_opportunity_id,
                'actor_candidate_id', p_candidate_id
            )
        );
    end loop;

    update mp25m.actor_candidates
    set
        status = 'rejected',
        resolved_person_id = null,
        resolved_organization_id = null,
        updated_at = now()
    where id = p_candidate_id;

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
        'actor_candidate.reject',
        'mp25m',
        'actor_candidates',
        p_candidate_id,
        btrim(p_reason),
        jsonb_build_object(
            'status', 'pending',
            'display_name', v_candidate.display_name
        ),
        jsonb_build_object(
            'status', 'rejected'
        ),
        'allowed',
        '{}'::jsonb
    );
end;
$function$;


revoke all
on function mp25m_api.resolve_actor_candidate_existing_person(
    uuid, uuid, uuid, text
)
from public, anon, authenticated, service_role;

revoke all
on function mp25m_api.approve_actor_candidate_new_person(
    uuid, uuid, text
)
from public, anon, authenticated, service_role;

revoke all
on function mp25m_api.reject_actor_candidate(
    uuid, uuid, text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.resolve_actor_candidate_existing_person(
    uuid, uuid, uuid, text
)
to service_role;

grant execute
on function mp25m_api.approve_actor_candidate_new_person(
    uuid, uuid, text
)
to service_role;

grant execute
on function mp25m_api.reject_actor_candidate(
    uuid, uuid, text
)
to service_role;