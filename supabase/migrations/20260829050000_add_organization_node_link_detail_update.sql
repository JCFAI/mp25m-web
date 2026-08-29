-- Incremento 5C - Correccion auditada de detalles de vinculos pendientes.
--
-- Permite completar evidencia y fecha de inicio de un vinculo
-- organizacion-nodo ya creado, sin confirmar presencia territorial.

begin;


create or replace function
mp25m_api.update_organization_node_link_details(
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
    v_link mp25m.organization_nodes%rowtype;
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
            'Internal user cannot update organization node link details'
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

    select onode.*
    into v_link
    from mp25m.organization_nodes onode
    where onode.organization_id = p_organization_id
      and onode.node_id = p_node_id
    for update;

    if not found then
        raise exception
            'Organization node link not found'
            using errcode = 'P0002';
    end if;

    if v_link.active is distinct from true then
        raise exception
            'Organization node link is not active'
            using errcode = '22023';
    end if;

    if v_link.verification_status <> 'pending' then
        raise exception
            'Organization node link details can only be updated while pending'
            using errcode = '22023';
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

    update mp25m.organization_nodes
    set evidence_text = v_evidence_text,
        started_on = p_started_on
    where organization_id = p_organization_id
      and node_id = p_node_id;

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
        p_actor_internal_user_id,
        'organization.node_link.update_details',
        'mp25m',
        'organization_nodes',
        p_organization_id,
        jsonb_build_object(
            'organization_id',
                v_link.organization_id,
            'node_id',
                v_link.node_id,
            'verification_status',
                v_link.verification_status,
            'evidence_text',
                v_link.evidence_text,
            'started_on',
                v_link.started_on,
            'active',
                v_link.active
        ),
        jsonb_build_object(
            'organization_id',
                p_organization_id,
            'node_id',
                p_node_id,
            'verification_status',
                v_link.verification_status,
            'evidence_text',
                v_evidence_text,
            'started_on',
                p_started_on,
            'active',
                v_link.active
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
on function mp25m_api.update_organization_node_link_details(
    uuid, uuid, uuid, text, date
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.update_organization_node_link_details(
    uuid, uuid, uuid, text, date
)
to service_role;


comment on function
mp25m_api.update_organization_node_link_details(
    uuid, uuid, uuid, text, date
) is
    'Updates evidence and start date of an active pending organization-node link without confirming territorial presence, auditing old and new values.';


commit;
