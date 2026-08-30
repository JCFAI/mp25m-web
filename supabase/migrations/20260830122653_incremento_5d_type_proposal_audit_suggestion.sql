-- Incremento 5D - Correccion de auditoria para resolucion de propuestas.
--
-- Recalcula la sugerencia canonica antes de resolver cualquier accion para
-- que los futuros audit_events conserven el contexto que vio el validador.

begin;


create or replace function
mp25m_api.resolve_organization_type_proposal(
    p_actor_internal_user_id uuid,
    p_proposal_id uuid,
    p_resolution_action text,
    p_existing_organization_type_code text default null,
    p_reason text default null
)
returns void
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
    v_proposal mp25m.organization_type_proposals%rowtype;
    v_resolution_action text;
    v_reason text;
    v_old_organization_type_code text;
    v_new_organization_type_code text;
    v_new_proposal_status text;
    v_existing_type_name text;
    v_matching_type_code text;
    v_matching_type_name text;
    v_matching_match_kind text;
    v_matching_similarity real;
    v_has_matching_type boolean := false;
    v_base_type_code text;
    v_new_type_code text;
    v_display_order integer;
    v_suffix integer := 2;
    v_audit_action text;
    v_override boolean := false;
begin
    v_resolution_action :=
        lower(
            btrim(
                coalesce(
                    p_resolution_action,
                    ''
                )
            )
        );

    if v_resolution_action not in (
        'mapped',
        'approved',
        'approved_override',
        'rejected'
    ) then
        raise exception
            'Invalid organization type proposal resolution action'
            using errcode = '22023';
    end if;

    v_override :=
        v_resolution_action = 'approved_override';

    v_reason :=
        nullif(
            btrim(
                coalesce(
                    p_reason,
                    ''
                )
            ),
            ''
        );

    if v_reason is null
       or char_length(v_reason) < 3
       or char_length(v_reason) > 2000
    then
        raise exception
            'Organization type proposal resolution reason is required'
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
            'Internal user cannot resolve organization type proposals'
            using errcode = '42501';
    end if;

    select proposal.*
    into v_proposal
    from mp25m.organization_type_proposals proposal
    where proposal.id = p_proposal_id
    for update;

    if not found then
        raise exception
            'Organization type proposal not found'
            using errcode = 'P0002';
    end if;

    if v_proposal.status <> 'pending' then
        raise exception
            'Organization type proposal is not pending'
            using errcode = '22023';
    end if;

    select organization_record.organization_type_code
    into v_old_organization_type_code
    from mp25m.organizations organization_record
    where organization_record.id =
        v_proposal.organization_id
      and organization_record.record_status =
        'active'
    for update;

    if not found then
        raise exception
            'Organization not found or inactive'
            using errcode = 'P0002';
    end if;

    if v_resolution_action in (
        'approved',
        'approved_override'
    ) then
        perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
                'mp25m.organization_type_proposals.approve',
                0
            )
        );
    end if;

    select
        type_match.organization_type_code,
        type_match.organization_type_name,
        type_match.match_kind,
        type_match.match_similarity
    into
        v_matching_type_code,
        v_matching_type_name,
        v_matching_match_kind,
        v_matching_similarity
    from mp25m_private.find_organization_type_match(
        v_proposal.normalized_name
    ) as type_match;

    v_has_matching_type := found;

    if v_resolution_action = 'mapped' then
        v_new_organization_type_code :=
            nullif(
                btrim(
                    coalesce(
                        p_existing_organization_type_code,
                        ''
                    )
                ),
                ''
            );

        if v_new_organization_type_code is null
           or v_new_organization_type_code = 'other'
        then
            raise exception
                'A canonical organization type must be selected'
                using errcode = '22023';
        end if;

        select ot.name::text
        into v_existing_type_name
        from mp25m.organization_types ot
        where ot.code = v_new_organization_type_code
          and ot.is_active = true;

        if not found then
            raise exception
                'Invalid organization type'
                using errcode = '23503';
        end if;

        update mp25m.organizations
        set organization_type_code =
            v_new_organization_type_code
        where id = v_proposal.organization_id;

        update mp25m.organization_type_proposals
        set status = 'mapped',
            resolved_organization_type_code =
                v_new_organization_type_code,
            resolved_by_internal_user_id =
                p_actor_internal_user_id,
            resolution_reason = v_reason,
            resolved_at = now()
        where id = v_proposal.id;

        v_new_proposal_status := 'mapped';
        v_audit_action :=
            'organization.type_proposal.map';

    elsif v_resolution_action in (
        'approved',
        'approved_override'
    ) then
        if v_has_matching_type and not v_override then
            raise exception
                'A strong organization type match already exists: % (%)',
                v_matching_type_name,
                v_matching_type_code
                using errcode = '23505';
        end if;

        v_base_type_code :=
            trim(
                both '_' from regexp_replace(
                    v_proposal.normalized_name,
                    '[[:space:]]+',
                    '_',
                    'g'
                )
            );

        v_base_type_code :=
            left(
                regexp_replace(
                    v_base_type_code,
                    '[^a-z0-9_]+',
                    '',
                    'g'
                ),
                80
            );

        if v_base_type_code is null
           or v_base_type_code = ''
        then
            raise exception
                'Organization type code cannot be generated'
                using errcode = '22023';
        end if;

        v_new_type_code := v_base_type_code;

        while exists (
            select 1
            from mp25m.organization_types ot
            where ot.code = v_new_type_code
        ) loop
            v_new_type_code :=
                left(v_base_type_code, 72)
                || '_'
                || v_suffix::text;

            v_suffix := v_suffix + 1;

            if v_suffix > 99 then
                raise exception
                    'Organization type code cannot be generated'
                    using errcode = '22023';
            end if;
        end loop;

        select
            coalesce(max(display_order), 100) + 10
        into v_display_order
        from mp25m.organization_types;

        insert into mp25m.organization_types (
            code,
            name,
            display_order,
            is_active
        )
        values (
            v_new_type_code,
            v_proposal.proposed_name,
            v_display_order,
            true
        );

        update mp25m.organizations
        set organization_type_code =
            v_new_type_code
        where id = v_proposal.organization_id;

        update mp25m.organization_type_proposals
        set status = 'approved',
            resolved_organization_type_code =
                v_new_type_code,
            resolved_by_internal_user_id =
                p_actor_internal_user_id,
            resolution_reason = v_reason,
            resolved_at = now()
        where id = v_proposal.id;

        v_new_organization_type_code :=
            v_new_type_code;
        v_new_proposal_status := 'approved';
        v_audit_action :=
            case
                when v_override
                then 'organization.type_proposal.approve_override'
                else 'organization.type_proposal.approve'
            end;

    else
        if not exists (
            select 1
            from mp25m.organization_types ot
            where ot.code = 'other'
              and ot.is_active = true
        ) then
            raise exception
                'Fallback organization type is not available'
                using errcode = '23503';
        end if;

        update mp25m.organizations
        set organization_type_code = 'other'
        where id = v_proposal.organization_id;

        update mp25m.organization_type_proposals
        set status = 'rejected',
            resolved_organization_type_code = null,
            resolved_by_internal_user_id =
                p_actor_internal_user_id,
            resolution_reason = v_reason,
            resolved_at = now()
        where id = v_proposal.id;

        v_new_organization_type_code := 'other';
        v_new_proposal_status := 'rejected';
        v_audit_action :=
            'organization.type_proposal.reject';
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
        v_audit_action,
        'mp25m',
        'organization_type_proposals',
        v_proposal.id,
        v_reason,
        jsonb_build_object(
            'proposal_id',
                v_proposal.id,
            'organization_id',
                v_proposal.organization_id,
            'organization_type_code',
                v_old_organization_type_code,
            'proposal_status',
                v_proposal.status,
            'proposed_name',
                v_proposal.proposed_name,
            'normalized_name',
                v_proposal.normalized_name,
            'resolved_organization_type_code',
                v_proposal.resolved_organization_type_code
        ),
        jsonb_build_object(
            'proposal_id',
                v_proposal.id,
            'organization_id',
                v_proposal.organization_id,
            'organization_type_code',
                v_new_organization_type_code,
            'proposal_status',
                v_new_proposal_status,
            'proposed_name',
                v_proposal.proposed_name,
            'normalized_name',
                v_proposal.normalized_name,
            'resolved_organization_type_code',
                case
                    when v_new_proposal_status = 'rejected'
                    then null
                    else v_new_organization_type_code
                end,
            'override',
                v_override
        ),
        'allowed',
        jsonb_build_object(
            'proposal_id',
                v_proposal.id,
            'organization_id',
                v_proposal.organization_id,
            'resolution_action',
                v_resolution_action,
            'existing_organization_type_code',
                p_existing_organization_type_code,
            'previous_organization_type_code',
                v_old_organization_type_code,
            'new_organization_type_code',
                v_new_organization_type_code,
            'proposed_name',
                v_proposal.proposed_name,
            'suggested_organization_type_code',
                v_matching_type_code,
            'suggested_organization_type_name',
                v_matching_type_name,
            'suggested_match_kind',
                v_matching_match_kind,
            'suggested_similarity',
                v_matching_similarity,
            'override',
                v_override
        )
    );
end;
$function$;


revoke all
on function mp25m_api.resolve_organization_type_proposal(
    uuid, uuid, text, text, text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.resolve_organization_type_proposal(
    uuid, uuid, text, text, text
)
to service_role;


comment on function mp25m_api.resolve_organization_type_proposal(
    uuid, uuid, text, text, text
) is
    'Server-only audited resolution of organization type proposals. Recalculates suggested canonical matches for future audit metadata.';


commit;
