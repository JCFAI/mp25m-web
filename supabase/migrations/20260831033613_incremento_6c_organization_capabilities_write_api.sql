-- Incremento 6C - Gestion de capacidades de organizaciones.
--
-- Agrega una write API server-only para administrar la relacion
-- organizacion <-> capacidad usando mp25m.organization_capabilities y
-- mp25m.organization_capability_evidence.
--
-- No crea skills, aliases, categorias ni modelos paralelos.
-- No borra fisicamente organization_capabilities.

begin;


-- ---------------------------------------------------------------------------
-- 1. ALTA O REACTIVACION DE CAPACIDAD DE ORGANIZACION
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.add_organization_capability(
    p_actor_internal_user_id uuid,
    p_organization_id uuid,
    p_skill_id uuid,
    p_node_id uuid default null,
    p_notes text default null,
    p_evidence_text text default null
)
returns table (
    organization_capability_id uuid,
    skill_id uuid,
    skill_name text,
    organization_name text,
    node_id uuid,
    node_name text,
    verification_status text,
    operation text
)
language plpgsql
security invoker
set search_path =
    pg_catalog,
    mp25m,
    mp25m_api
as $function$
declare
    v_existing mp25m.organization_capabilities%rowtype;
    v_capability mp25m.organization_capabilities%rowtype;
    v_skill_name text;
    v_organization_name text;
    v_node_name text;
    v_notes text;
    v_evidence_text text;
    v_action text;
    v_operation text;
    v_evidence_added boolean;
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
            'Internal user cannot manage organization capabilities'
            using errcode = '42501';
    end if;

    select o.name::text
    into v_organization_name
    from mp25m.organizations o
    where o.id = p_organization_id
      and o.record_status = 'active';

    if not found then
        raise exception
            'Organization not found or inactive'
            using errcode = 'P0002';
    end if;

    select s.name::text
    into v_skill_name
    from mp25m.skills s
    where s.id = p_skill_id
      and s.active = true
      and s.applies_to_organization = true;

    if not found then
        raise exception
            'Skill not found or unavailable for organizations'
            using errcode = 'P0002';
    end if;

    if p_node_id is not null then
        select
            regexp_replace(
                n.name::text,
                '^[Nn]odo[[:space:]]+',
                ''
            )
        into v_node_name
        from mp25m.organization_nodes onode

        join mp25m.nodes n
          on n.id = onode.node_id

        where onode.organization_id = p_organization_id
          and onode.node_id = p_node_id
          and onode.active = true
          and onode.verification_status = 'confirmed'
          and (
              onode.started_on is null
              or onode.started_on <= current_date
          )
          and (
              onode.ended_on is null
              or onode.ended_on >= current_date
          )
          and n.status = 'active';

        if not found then
            raise exception
                'Organization does not have a confirmed current territorial link with that node'
                using errcode = '22023';
        end if;
    end if;

    v_notes :=
        nullif(
            btrim(
                coalesce(
                    p_notes,
                    ''
                )
            ),
            ''
        );

    if v_notes is not null
       and char_length(v_notes) > 2000
    then
        raise exception
            'Organization capability notes cannot exceed 2000 characters'
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
            'Organization capability evidence cannot exceed 2000 characters'
            using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'mp25m.organization_capability.add:' ||
            p_organization_id::text ||
            ':' ||
            p_skill_id::text ||
            ':' ||
            coalesce(
                p_node_id::text,
                'institutional'
            ),
            0
        )
    );

    select oc.*
    into v_existing
    from mp25m.organization_capabilities oc
    where oc.organization_id = p_organization_id
      and oc.skill_id = p_skill_id
      and oc.node_id is not distinct from p_node_id
    for update;

    if found then
        if v_existing.active = true then
            raise exception
                'Organization already has this capability registered for this scope'
                using errcode = '23505';
        end if;

        update mp25m.organization_capabilities
        set active = true,
            verification_status =
                case
                    when v_existing.verification_status =
                        'rejected'
                    then 'candidate'
                    else v_existing.verification_status
                end,
            notes = v_notes
        where id = v_existing.id
        returning *
        into v_capability;

        v_action := 'organization.capability.reactivate';
        v_operation := 'reactivate';
    else
        insert into mp25m.organization_capabilities (
            organization_id,
            skill_id,
            node_id,
            verification_status,
            notes,
            active
        )
        values (
            p_organization_id,
            p_skill_id,
            p_node_id,
            'candidate',
            v_notes,
            true
        )
        returning *
        into v_capability;

        v_action := 'organization.capability.add';
        v_operation := 'add';
    end if;

    v_evidence_added :=
        v_evidence_text is not null;

    if v_evidence_added then
        insert into mp25m.organization_capability_evidence (
            organization_capability_id,
            evidence_type,
            evidence_text,
            confidence
        )
        values (
            v_capability.id,
            'other',
            v_evidence_text,
            null
        );
    end if;

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
        v_action,
        'mp25m',
        'organization_capabilities',
        v_capability.id,
        case
            when v_existing.id is null
              then null
            else jsonb_build_object(
                'organization_capability_id',
                    v_existing.id,
                'organization_id',
                    v_existing.organization_id,
                'skill_id',
                    v_existing.skill_id,
                'node_id',
                    v_existing.node_id,
                'verification_status',
                    v_existing.verification_status,
                'notes',
                    v_existing.notes,
                'source_id',
                    v_existing.source_id,
                'ingestion_record_id',
                    v_existing.ingestion_record_id,
                'last_self_reported_at',
                    v_existing.last_self_reported_at,
                'active',
                    v_existing.active
            )
        end,
        jsonb_build_object(
            'organization_capability_id',
                v_capability.id,
            'organization_id',
                v_capability.organization_id,
            'skill_id',
                v_capability.skill_id,
            'node_id',
                v_capability.node_id,
            'verification_status',
                v_capability.verification_status,
            'notes',
                v_capability.notes,
            'source_id',
                v_capability.source_id,
            'ingestion_record_id',
                v_capability.ingestion_record_id,
            'last_self_reported_at',
                v_capability.last_self_reported_at,
            'active',
                v_capability.active
        ),
        'allowed',
        jsonb_build_object(
            'organization_id',
                v_capability.organization_id,
            'skill_id',
                v_capability.skill_id,
            'skill_name',
                v_skill_name,
            'scope_kind',
                case
                    when v_capability.node_id is null
                    then 'institutional'
                    else 'node'
                end,
            'scope_node_id',
                v_capability.node_id,
            'node_name',
                v_node_name,
            'operation',
                v_operation,
            'evidence_added',
                v_evidence_added
        )
    );

    return query
    select
        v_capability.id,
        v_capability.skill_id,
        v_skill_name,
        v_organization_name,
        v_capability.node_id,
        v_node_name,
        v_capability.verification_status::text,
        v_operation;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 2. EDICION DE DATOS DE UNA CAPACIDAD DE ORGANIZACION
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.update_organization_capability(
    p_actor_internal_user_id uuid,
    p_organization_id uuid,
    p_organization_capability_id uuid,
    p_notes text default null,
    p_evidence_text text default null
)
returns void
language plpgsql
security invoker
set search_path =
    pg_catalog,
    mp25m,
    mp25m_api
as $function$
declare
    v_existing mp25m.organization_capabilities%rowtype;
    v_capability mp25m.organization_capabilities%rowtype;
    v_skill_name text;
    v_node_name text;
    v_notes text;
    v_evidence_text text;
    v_evidence_added boolean;
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
            'Internal user cannot manage organization capabilities'
            using errcode = '42501';
    end if;

    select oc.*
    into v_existing
    from mp25m.organization_capabilities oc
    where oc.id = p_organization_capability_id
      and oc.organization_id = p_organization_id
    for update;

    if not found then
        raise exception
            'Organization capability not found'
            using errcode = 'P0002';
    end if;

    if v_existing.active is distinct from true then
        raise exception
            'Organization capability is not active'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.organizations o
        where o.id = v_existing.organization_id
          and o.record_status = 'active'
    ) then
        raise exception
            'Organization not found or inactive'
            using errcode = 'P0002';
    end if;

    select s.name::text
    into v_skill_name
    from mp25m.skills s
    where s.id = v_existing.skill_id
      and s.active = true
      and s.applies_to_organization = true;

    if not found then
        raise exception
            'Skill not found or unavailable for organizations'
            using errcode = 'P0002';
    end if;

    if v_existing.node_id is not null then
        select
            regexp_replace(
                n.name::text,
                '^[Nn]odo[[:space:]]+',
                ''
            )
        into v_node_name
        from mp25m.nodes n
        where n.id = v_existing.node_id;
    end if;

    v_notes :=
        nullif(
            btrim(
                coalesce(
                    p_notes,
                    ''
                )
            ),
            ''
        );

    if v_notes is not null
       and char_length(v_notes) > 2000
    then
        raise exception
            'Organization capability notes cannot exceed 2000 characters'
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
            'Organization capability evidence cannot exceed 2000 characters'
            using errcode = '22023';
    end if;

    update mp25m.organization_capabilities
    set notes = v_notes
    where id = v_existing.id
    returning *
    into v_capability;

    v_evidence_added :=
        v_evidence_text is not null;

    if v_evidence_added then
        insert into mp25m.organization_capability_evidence (
            organization_capability_id,
            evidence_type,
            evidence_text,
            confidence
        )
        values (
            v_capability.id,
            'other',
            v_evidence_text,
            null
        );
    end if;

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
        'organization.capability.update',
        'mp25m',
        'organization_capabilities',
        v_capability.id,
        jsonb_build_object(
            'organization_capability_id',
                v_existing.id,
            'organization_id',
                v_existing.organization_id,
            'skill_id',
                v_existing.skill_id,
            'node_id',
                v_existing.node_id,
            'verification_status',
                v_existing.verification_status,
            'notes',
                v_existing.notes,
            'source_id',
                v_existing.source_id,
            'ingestion_record_id',
                v_existing.ingestion_record_id,
            'last_self_reported_at',
                v_existing.last_self_reported_at,
            'active',
                v_existing.active
        ),
        jsonb_build_object(
            'organization_capability_id',
                v_capability.id,
            'organization_id',
                v_capability.organization_id,
            'skill_id',
                v_capability.skill_id,
            'node_id',
                v_capability.node_id,
            'verification_status',
                v_capability.verification_status,
            'notes',
                v_capability.notes,
            'source_id',
                v_capability.source_id,
            'ingestion_record_id',
                v_capability.ingestion_record_id,
            'last_self_reported_at',
                v_capability.last_self_reported_at,
            'active',
                v_capability.active
        ),
        'allowed',
        jsonb_build_object(
            'organization_id',
                v_capability.organization_id,
            'skill_id',
                v_capability.skill_id,
            'skill_name',
                v_skill_name,
            'scope_kind',
                case
                    when v_capability.node_id is null
                    then 'institutional'
                    else 'node'
                end,
            'scope_node_id',
                v_capability.node_id,
            'node_name',
                v_node_name,
            'operation',
                'update',
            'evidence_added',
                v_evidence_added
        )
    );
end;
$function$;


-- ---------------------------------------------------------------------------
-- 3. CONFIRMACION O RECHAZO DE CAPACIDAD DE ORGANIZACION
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.resolve_organization_capability(
    p_actor_internal_user_id uuid,
    p_organization_id uuid,
    p_organization_capability_id uuid,
    p_resolution_action text,
    p_reason text
)
returns void
language plpgsql
security invoker
set search_path =
    pg_catalog,
    mp25m,
    mp25m_api
as $function$
declare
    v_existing mp25m.organization_capabilities%rowtype;
    v_capability mp25m.organization_capabilities%rowtype;
    v_skill_name text;
    v_node_name text;
    v_resolution_action text;
    v_reason text;
begin
    v_resolution_action :=
        nullif(
            btrim(
                coalesce(
                    p_resolution_action,
                    ''
                )
            ),
            ''
        );

    if v_resolution_action not in (
        'confirmed',
        'rejected'
    ) then
        raise exception
            'Invalid organization capability resolution action'
            using errcode = '22023';
    end if;

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
            'Organization capability resolution reason must contain between 3 and 2000 characters'
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
            'Internal user cannot manage organization capabilities'
            using errcode = '42501';
    end if;

    select oc.*
    into v_existing
    from mp25m.organization_capabilities oc
    where oc.id = p_organization_capability_id
      and oc.organization_id = p_organization_id
    for update;

    if not found then
        raise exception
            'Organization capability not found'
            using errcode = 'P0002';
    end if;

    if v_existing.active is distinct from true then
        raise exception
            'Organization capability is not active'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.organizations o
        where o.id = v_existing.organization_id
          and o.record_status = 'active'
    ) then
        raise exception
            'Organization not found or inactive'
            using errcode = 'P0002';
    end if;

    select s.name::text
    into v_skill_name
    from mp25m.skills s
    where s.id = v_existing.skill_id
      and s.active = true
      and s.applies_to_organization = true;

    if not found then
        raise exception
            'Skill not found or unavailable for organizations'
            using errcode = 'P0002';
    end if;

    if v_existing.node_id is not null then
        select
            regexp_replace(
                n.name::text,
                '^[Nn]odo[[:space:]]+',
                ''
            )
        into v_node_name
        from mp25m.nodes n
        where n.id = v_existing.node_id;
    end if;

    if v_resolution_action = 'confirmed'
       and v_existing.verification_status =
           'confirmed'
    then
        raise exception
            'Organization capability is already confirmed'
            using errcode = '22023';
    end if;

    if v_resolution_action = 'confirmed'
       and v_existing.node_id is not null
       and not exists (
           select 1
           from mp25m.organization_nodes onode

           join mp25m.nodes n
             on n.id = onode.node_id

           where onode.organization_id =
               v_existing.organization_id
             and onode.node_id =
               v_existing.node_id
             and onode.active = true
             and onode.verification_status =
                 'confirmed'
             and (
                 onode.started_on is null
                 or onode.started_on <= current_date
             )
             and (
                 onode.ended_on is null
                 or onode.ended_on >= current_date
             )
             and n.status = 'active'
       )
    then
        raise exception
            'Organization does not have a confirmed current territorial link with that node'
            using errcode = '22023';
    end if;

    if v_resolution_action = 'rejected'
       and v_existing.verification_status not in (
           'self_reported',
           'candidate'
       )
    then
        raise exception
            'Only self-reported or candidate organization capabilities can be rejected'
            using errcode = '22023';
    end if;

    update mp25m.organization_capabilities
    set verification_status =
            v_resolution_action,
        active =
            case
                when v_resolution_action =
                    'rejected'
                then false
                else true
            end
    where id = v_existing.id
    returning *
    into v_capability;

    insert into mp25m.organization_capability_evidence (
        organization_capability_id,
        evidence_type,
        evidence_text,
        confidence
    )
    values (
        v_capability.id,
        'admin_validation',
        v_reason,
        null
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
        case
            when v_resolution_action =
                'confirmed'
            then 'organization.capability.confirm'
            else 'organization.capability.reject'
        end,
        'mp25m',
        'organization_capabilities',
        v_capability.id,
        v_reason,
        jsonb_build_object(
            'organization_capability_id',
                v_existing.id,
            'organization_id',
                v_existing.organization_id,
            'skill_id',
                v_existing.skill_id,
            'node_id',
                v_existing.node_id,
            'verification_status',
                v_existing.verification_status,
            'notes',
                v_existing.notes,
            'source_id',
                v_existing.source_id,
            'ingestion_record_id',
                v_existing.ingestion_record_id,
            'last_self_reported_at',
                v_existing.last_self_reported_at,
            'active',
                v_existing.active
        ),
        jsonb_build_object(
            'organization_capability_id',
                v_capability.id,
            'organization_id',
                v_capability.organization_id,
            'skill_id',
                v_capability.skill_id,
            'node_id',
                v_capability.node_id,
            'verification_status',
                v_capability.verification_status,
            'notes',
                v_capability.notes,
            'source_id',
                v_capability.source_id,
            'ingestion_record_id',
                v_capability.ingestion_record_id,
            'last_self_reported_at',
                v_capability.last_self_reported_at,
            'active',
                v_capability.active
        ),
        'allowed',
        jsonb_build_object(
            'organization_id',
                v_capability.organization_id,
            'skill_id',
                v_capability.skill_id,
            'skill_name',
                v_skill_name,
            'scope_kind',
                case
                    when v_capability.node_id is null
                    then 'institutional'
                    else 'node'
                end,
            'scope_node_id',
                v_capability.node_id,
            'node_name',
                v_node_name,
            'operation',
                case
                    when v_resolution_action =
                        'confirmed'
                    then 'confirm'
                    else 'reject'
                end,
            'evidence_added',
                true
        )
    );
end;
$function$;


-- ---------------------------------------------------------------------------
-- 4. DESACTIVACION SIN BORRADO DE CAPACIDAD DE ORGANIZACION
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.deactivate_organization_capability(
    p_actor_internal_user_id uuid,
    p_organization_id uuid,
    p_organization_capability_id uuid,
    p_reason text
)
returns void
language plpgsql
security invoker
set search_path =
    pg_catalog,
    mp25m,
    mp25m_api
as $function$
declare
    v_existing mp25m.organization_capabilities%rowtype;
    v_capability mp25m.organization_capabilities%rowtype;
    v_skill_name text;
    v_node_name text;
    v_reason text;
begin
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
            'Organization capability deactivation reason must contain between 3 and 2000 characters'
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
            'Internal user cannot manage organization capabilities'
            using errcode = '42501';
    end if;

    select oc.*
    into v_existing
    from mp25m.organization_capabilities oc
    where oc.id = p_organization_capability_id
      and oc.organization_id = p_organization_id
    for update;

    if not found then
        raise exception
            'Organization capability not found'
            using errcode = 'P0002';
    end if;

    if v_existing.active is distinct from true then
        raise exception
            'Organization capability is not active'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.organizations o
        where o.id = v_existing.organization_id
          and o.record_status = 'active'
    ) then
        raise exception
            'Organization not found or inactive'
            using errcode = 'P0002';
    end if;

    select s.name::text
    into v_skill_name
    from mp25m.skills s
    where s.id = v_existing.skill_id
      and s.active = true
      and s.applies_to_organization = true;

    if not found then
        raise exception
            'Skill not found or unavailable for organizations'
            using errcode = 'P0002';
    end if;

    if v_existing.node_id is not null then
        select
            regexp_replace(
                n.name::text,
                '^[Nn]odo[[:space:]]+',
                ''
            )
        into v_node_name
        from mp25m.nodes n
        where n.id = v_existing.node_id;
    end if;

    update mp25m.organization_capabilities
    set active = false
    where id = v_existing.id
    returning *
    into v_capability;

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
        'organization.capability.deactivate',
        'mp25m',
        'organization_capabilities',
        v_capability.id,
        v_reason,
        jsonb_build_object(
            'organization_capability_id',
                v_existing.id,
            'organization_id',
                v_existing.organization_id,
            'skill_id',
                v_existing.skill_id,
            'node_id',
                v_existing.node_id,
            'verification_status',
                v_existing.verification_status,
            'notes',
                v_existing.notes,
            'source_id',
                v_existing.source_id,
            'ingestion_record_id',
                v_existing.ingestion_record_id,
            'last_self_reported_at',
                v_existing.last_self_reported_at,
            'active',
                v_existing.active
        ),
        jsonb_build_object(
            'organization_capability_id',
                v_capability.id,
            'organization_id',
                v_capability.organization_id,
            'skill_id',
                v_capability.skill_id,
            'node_id',
                v_capability.node_id,
            'verification_status',
                v_capability.verification_status,
            'notes',
                v_capability.notes,
            'source_id',
                v_capability.source_id,
            'ingestion_record_id',
                v_capability.ingestion_record_id,
            'last_self_reported_at',
                v_capability.last_self_reported_at,
            'active',
                v_capability.active
        ),
        'allowed',
        jsonb_build_object(
            'organization_id',
                v_capability.organization_id,
            'skill_id',
                v_capability.skill_id,
            'skill_name',
                v_skill_name,
            'scope_kind',
                case
                    when v_capability.node_id is null
                    then 'institutional'
                    else 'node'
                end,
            'scope_node_id',
                v_capability.node_id,
            'node_name',
                v_node_name,
            'operation',
                'deactivate',
            'evidence_added',
                false
        )
    );
end;
$function$;


-- ---------------------------------------------------------------------------
-- 5. PRIVILEGIOS SERVER-ONLY
-- ---------------------------------------------------------------------------

revoke all
on function mp25m_api.add_organization_capability(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.add_organization_capability(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text
)
to service_role;


revoke all
on function mp25m_api.update_organization_capability(
    uuid,
    uuid,
    uuid,
    text,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.update_organization_capability(
    uuid,
    uuid,
    uuid,
    text,
    text
)
to service_role;


revoke all
on function mp25m_api.resolve_organization_capability(
    uuid,
    uuid,
    uuid,
    text,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.resolve_organization_capability(
    uuid,
    uuid,
    uuid,
    text,
    text
)
to service_role;


revoke all
on function mp25m_api.deactivate_organization_capability(
    uuid,
    uuid,
    uuid,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.deactivate_organization_capability(
    uuid,
    uuid,
    uuid,
    text
)
to service_role;


comment on function mp25m_api.add_organization_capability(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text
) is
    'Creates or reactivates an active organization-capability relation from the backoffice. New relations start as candidate and evidence is optional.';

comment on function mp25m_api.update_organization_capability(
    uuid,
    uuid,
    uuid,
    text,
    text
) is
    'Updates editable details of an active organization-capability relation without changing scope or verification status.';

comment on function mp25m_api.resolve_organization_capability(
    uuid,
    uuid,
    uuid,
    text,
    text
) is
    'Explicitly confirms or rejects an active organization-capability relation with required reason, evidence and audit.';

comment on function mp25m_api.deactivate_organization_capability(
    uuid,
    uuid,
    uuid,
    text
) is
    'Deactivates an active organization-capability relation without deleting it and without changing verification status.';


commit;
