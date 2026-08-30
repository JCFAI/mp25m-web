-- Incremento 5C - Alta y vinculacion territorial de organizaciones.
--
-- La identidad canonica, la presencia territorial y la validacion
-- del vinculo se administran por acciones explicitas y auditadas.
-- Crear una organizacion no confirma presencia territorial ni capacidades.

begin;


create or replace function
mp25m_api.create_organization(
    p_actor_internal_user_id uuid,
    p_name text,
    p_organization_type_code text,
    p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path =
    pg_catalog,
    mp25m,
    mp25m_api,
    mp25m_private,
    extensions
as $function$
declare
    v_name text;
    v_normalized_name text;
    v_notes text;
    v_organization_id uuid;
    v_existing_organization_id uuid;
    v_existing_organization_name text;
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
          and ar.code in (
              'administrator',
              'validator'
          )
          and ar.is_active = true
          and ar.deleted_at is null
          and scope.scope_type = 'global'
          and scope.is_active = true
          and scope.deleted_at is null
    ) then
        raise exception
            'Internal user cannot create organizations'
            using errcode = '42501';
    end if;

    v_name := nullif(btrim(p_name), '');

    if v_name is null
       or char_length(v_name) < 2
       or char_length(v_name) > 300
    then
        raise exception
            'Organization name must contain between 2 and 300 characters'
            using errcode = '22023';
    end if;

    v_normalized_name :=
        mp25m_private.normalize_text(v_name);

    if v_normalized_name is null then
        raise exception
            'Organization name cannot be normalized'
            using errcode = '22023';
    end if;

    v_notes :=
        nullif(btrim(coalesce(p_notes, '')), '');

    if v_notes is not null
       and char_length(v_notes) > 2000
    then
        raise exception
            'Organization notes cannot exceed 2000 characters'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.organization_types ot
        where ot.code = p_organization_type_code
          and ot.is_active = true
    ) then
        raise exception
            'Invalid organization type'
            using errcode = '23503';
    end if;

    select
        o.id,
        o.name
    into
        v_existing_organization_id,
        v_existing_organization_name
    from mp25m.organizations o
    where o.record_status = 'active'
      and o.normalized_name is not null
      and (
          o.normalized_name = v_normalized_name

          or extensions.similarity(
              o.normalized_name,
              v_normalized_name
          ) >= 0.90

          or (
              (
                  select array_agg(
                      distinct token
                      order by token
                  )
                  from regexp_split_to_table(
                      o.normalized_name,
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
                      v_normalized_name,
                      '[[:space:]]+'
                  ) token
                  where token <> ''
              )
          )
      )
    order by
        case
            when o.normalized_name =
                v_normalized_name
            then 0
            else 1
        end,
        extensions.similarity(
            o.normalized_name,
            v_normalized_name
        ) desc,
        o.name
    limit 1;

    if found then
        raise exception
            'A strong organization nominal match already exists: % (%)',
            v_existing_organization_name,
            v_existing_organization_id
            using errcode = '23505';
    end if;

    insert into mp25m.organizations (
        name,
        normalized_name,
        organization_type_code,
        notes,
        record_status
    )
    values (
        v_name,
        v_normalized_name,
        p_organization_type_code,
        v_notes,
        'active'
    )
    returning id
    into v_organization_id;

    insert into mp25m.audit_events (
        actor_internal_user_id,
        action,
        target_schema,
        target_table,
        target_id,
        new_data,
        result,
        metadata
    )
    values (
        p_actor_internal_user_id,
        'organization.create',
        'mp25m',
        'organizations',
        v_organization_id,
        jsonb_build_object(
            'name',
                v_name,
            'organization_type_code',
                p_organization_type_code,
            'notes',
                v_notes,
            'record_status',
                'active'
        ),
        'allowed',
        jsonb_build_object(
            'normalized_name',
                v_normalized_name
        )
    );

    return v_organization_id;
end;
$function$;


create or replace function
mp25m_api.create_organization_node_link(
    p_actor_internal_user_id uuid,
    p_organization_id uuid,
    p_node_id uuid,
    p_evidence_text text default null,
    p_started_on date default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_evidence_text text;
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
          and ar.code in (
              'administrator',
              'validator'
          )
          and ar.is_active = true
          and ar.deleted_at is null
          and scope.scope_type = 'global'
          and scope.is_active = true
          and scope.deleted_at is null
    ) then
        raise exception
            'Internal user cannot link organizations to nodes'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from mp25m.organizations o
        where o.id = p_organization_id
          and o.record_status = 'active'
    ) then
        raise exception
            'Organization not found or inactive'
            using errcode = 'P0002';
    end if;

    if not exists (
        select 1
        from mp25m.nodes n
        where n.id = p_node_id
          and n.status = 'active'
    ) then
        raise exception
            'Node not found or inactive'
            using errcode = 'P0002';
    end if;

    if p_started_on is not null
       and p_started_on > current_date
    then
        raise exception
            'Organization node link start date cannot be in the future'
            using errcode = '22023';
    end if;

    v_evidence_text :=
        nullif(
            btrim(
                coalesce(
                    p_evidence_text,
                    ''
                )
            ),
            ''
        );

    if v_evidence_text is not null
       and char_length(v_evidence_text) > 2000
    then
        raise exception
            'Organization node link evidence cannot exceed 2000 characters'
            using errcode = '22023';
    end if;

    if exists (
        select 1
        from mp25m.organization_nodes onode
        where onode.organization_id =
            p_organization_id
          and onode.node_id =
            p_node_id
        for update
    ) then
        raise exception
            'Organization node link already exists'
            using errcode = '23505';
    end if;

    insert into mp25m.organization_nodes (
        organization_id,
        node_id,
        verification_status,
        evidence_text,
        started_on,
        active
    )
    values (
        p_organization_id,
        p_node_id,
        'pending',
        v_evidence_text,
        p_started_on,
        true
    );

    insert into mp25m.audit_events (
        actor_internal_user_id,
        action,
        target_schema,
        target_table,
        target_id,
        new_data,
        result,
        metadata
    )
    values (
        p_actor_internal_user_id,
        'organization.node_link.create',
        'mp25m',
        'organization_nodes',
        p_organization_id,
        jsonb_build_object(
            'organization_id',
                p_organization_id,
            'node_id',
                p_node_id,
            'verification_status',
                'pending',
            'evidence_text',
                v_evidence_text,
            'started_on',
                p_started_on,
            'active',
                true
        ),
        'allowed',
        jsonb_build_object(
            'node_id',
                p_node_id
        )
    );
end;
$function$;


create or replace function
mp25m_api.confirm_organization_node_link(
    p_actor_internal_user_id uuid,
    p_organization_id uuid,
    p_node_id uuid,
    p_reason text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_link mp25m.organization_nodes%rowtype;
begin
    if nullif(btrim(p_reason), '') is null then
        raise exception
            'Organization node link confirmation reason is required'
            using errcode = '22023';
    end if;

    if char_length(btrim(p_reason)) > 2000 then
        raise exception
            'Organization node link confirmation reason cannot exceed 2000 characters'
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
          and ar.code in (
              'administrator',
              'validator'
          )
          and ar.is_active = true
          and ar.deleted_at is null
          and scope.scope_type = 'global'
          and scope.is_active = true
          and scope.deleted_at is null
    ) then
        raise exception
            'Internal user cannot confirm organization node links'
            using errcode = '42501';
    end if;

    select onode.*
    into v_link
    from mp25m.organization_nodes onode
    where onode.organization_id =
        p_organization_id
      and onode.node_id =
        p_node_id
    for update;

    if not found then
        raise exception
            'Organization node link not found'
            using errcode = 'P0002';
    end if;

    if v_link.active <> true then
        raise exception
            'Organization node link is not active'
            using errcode = '22023';
    end if;

    if v_link.verification_status = 'confirmed' then
        raise exception
            'Organization node link is already confirmed'
            using errcode = '22023';
    end if;

    if v_link.verification_status <> 'pending' then
        raise exception
            'Organization node link is not pending'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.organizations o
        where o.id = p_organization_id
          and o.record_status = 'active'
    ) then
        raise exception
            'Organization not found or inactive'
            using errcode = 'P0002';
    end if;

    if not exists (
        select 1
        from mp25m.nodes n
        where n.id = p_node_id
          and n.status = 'active'
    ) then
        raise exception
            'Node not found or inactive'
            using errcode = 'P0002';
    end if;

    update mp25m.organization_nodes
    set verification_status = 'confirmed'
    where organization_id = p_organization_id
      and node_id = p_node_id;

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
        'organization.node_link.confirm',
        'mp25m',
        'organization_nodes',
        p_organization_id,
        btrim(p_reason),
        jsonb_build_object(
            'organization_id',
                v_link.organization_id,
            'node_id',
                v_link.node_id,
            'verification_status',
                v_link.verification_status,
            'active',
                v_link.active
        ),
        jsonb_build_object(
            'organization_id',
                p_organization_id,
            'node_id',
                p_node_id,
            'verification_status',
                'confirmed',
            'active',
                true
        ),
        'allowed',
        jsonb_build_object(
            'node_id',
                p_node_id
        )
    );
end;
$function$;


revoke all
on function mp25m_api.create_organization(
    uuid, text, text, text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.create_organization(
    uuid, text, text, text
)
to service_role;


revoke all
on function mp25m_api.create_organization_node_link(
    uuid, uuid, uuid, text, date
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.create_organization_node_link(
    uuid, uuid, uuid, text, date
)
to service_role;


revoke all
on function mp25m_api.confirm_organization_node_link(
    uuid, uuid, uuid, text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.confirm_organization_node_link(
    uuid, uuid, uuid, text
)
to service_role;


comment on function mp25m_api.create_organization(
    uuid, text, text, text
) is
    'Creates one canonical organization after explicit authorized review, preventing strong nominal duplicates and auditing the action.';

comment on function mp25m_api.create_organization_node_link(
    uuid, uuid, uuid, text, date
) is
    'Creates an active pending organization-node link. It never confirms territorial presence automatically.';

comment on function mp25m_api.confirm_organization_node_link(
    uuid, uuid, uuid, text
) is
    'Explicitly confirms one pending organization-node link with a required reason and audit event.';


commit;
