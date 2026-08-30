-- Incremento 5D - Busqueda por tipo, propuestas de tipos y lectura inversa
-- de vinculos organizacion-nodo pendientes.
--
-- Las propuestas de tipo no se convierten automaticamente en tipos canonicos.
-- Toda escritura sensible queda encapsulada en funciones server-only auditadas.

begin;


-- ---------------------------------------------------------------------------
-- 1. PROPUESTAS DE TIPOS DE ORGANIZACION
-- ---------------------------------------------------------------------------

create table mp25m.organization_type_proposals (
    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null
        references mp25m.organizations(id)
        on delete cascade,

    proposed_name text not null,
    normalized_name text not null,

    status text not null default 'pending',

    resolved_organization_type_code text null
        references mp25m.organization_types(code)
        on delete restrict,

    created_by_internal_user_id uuid not null
        references mp25m.internal_users(id)
        on delete restrict,

    resolved_by_internal_user_id uuid null
        references mp25m.internal_users(id)
        on delete restrict,

    resolution_reason text null,

    created_at timestamptz not null default now(),
    resolved_at timestamptz null,

    constraint organization_type_proposals_name_length_check
        check (
            char_length(btrim(proposed_name))
                between 2 and 120
        ),

    constraint organization_type_proposals_normalized_not_blank_check
        check (
            char_length(btrim(normalized_name)) > 0
        ),

    constraint organization_type_proposals_status_check
        check (
            status in (
                'pending',
                'mapped',
                'approved',
                'rejected'
            )
        ),

    constraint organization_type_proposals_reason_length_check
        check (
            resolution_reason is null
            or char_length(btrim(resolution_reason))
                between 3 and 2000
        ),

    constraint organization_type_proposals_resolution_check
        check (
            (
                status = 'pending'
                and resolved_organization_type_code is null
                and resolved_by_internal_user_id is null
                and resolution_reason is null
                and resolved_at is null
            )
            or (
                status in ('mapped', 'approved')
                and resolved_organization_type_code is not null
                and resolved_by_internal_user_id is not null
                and nullif(
                    btrim(resolution_reason),
                    ''
                ) is not null
                and resolved_at is not null
            )
            or (
                status = 'rejected'
                and resolved_organization_type_code is null
                and resolved_by_internal_user_id is not null
                and nullif(
                    btrim(resolution_reason),
                    ''
                ) is not null
                and resolved_at is not null
            )
        )
);

create unique index
organization_type_proposals_one_pending_per_org_idx
on mp25m.organization_type_proposals(organization_id)
where status = 'pending';

create index organization_type_proposals_organization_status_idx
on mp25m.organization_type_proposals(
    organization_id,
    status,
    created_at desc
);

create index organization_type_proposals_normalized_status_idx
on mp25m.organization_type_proposals(
    normalized_name,
    status
);

alter table mp25m.organization_type_proposals
    enable row level security;

revoke all on table mp25m.organization_type_proposals
    from public, anon, authenticated;

grant select, insert, update
on table mp25m.organization_type_proposals
to service_role;

grant select, insert, update
on table mp25m.organization_types
to service_role;


-- ---------------------------------------------------------------------------
-- 2. LECTURAS SERVER-ONLY
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.organization_type_proposal_list
with (security_invoker = true)
as
select
    proposal.id,

    proposal.organization_id,

    proposal.proposed_name::text
        as proposed_name,

    proposal.normalized_name::text
        as normalized_name,

    proposal.status::text
        as status,

    proposal.resolved_organization_type_code,

    resolved_type.name::text
        as resolved_organization_type_name,

    proposal.created_by_internal_user_id,

    proposal.resolved_by_internal_user_id,

    proposal.resolution_reason,

    proposal.created_at,

    proposal.resolved_at

from mp25m.organization_type_proposals proposal

left join mp25m.organization_types resolved_type
  on resolved_type.code =
    proposal.resolved_organization_type_code;


create or replace view
mp25m_api.node_pending_organization_list
with (security_invoker = true)
as
select
    organization_node.node_id,

    organization_record.id
        as organization_id,

    organization_record.name::text
        as organization_name,

    organization_record.organization_type_code,

    organization_type.name::text
        as organization_type_name,

    organization_node.verification_status::text
        as verification_status,

    organization_node.evidence_text,

    organization_node.started_on,

    organization_node.ended_on,

    organization_record.notes,

    organization_record.record_status::text
        as record_status

from mp25m.organization_nodes organization_node

join mp25m.organizations organization_record
  on organization_record.id =
    organization_node.organization_id

join mp25m.organization_types organization_type
  on organization_type.code =
    organization_record.organization_type_code

where organization_record.record_status = 'active'

  and organization_type.is_active = true

  and organization_node.active = true

  and organization_node.verification_status = 'pending'

  and (
      organization_node.started_on is null
      or organization_node.started_on <= current_date
  )

  and (
      organization_node.ended_on is null
      or organization_node.ended_on >= current_date
  );

revoke all privileges
on table
    mp25m_api.organization_type_proposal_list,
    mp25m_api.node_pending_organization_list
from
    public,
    anon,
    authenticated,
    service_role;

grant select
on table
    mp25m_api.organization_type_proposal_list,
    mp25m_api.node_pending_organization_list
to service_role;


-- ---------------------------------------------------------------------------
-- 3. ALTA DE ORGANIZACION CON PROPUESTA DE TIPO
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.create_organization_with_type_proposal(
    p_actor_internal_user_id uuid,
    p_name text,
    p_proposed_type_name text,
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
    v_organization_id uuid;
    v_proposal_id uuid;
    v_proposed_name text;
    v_normalized_name text;
begin
    v_proposed_name :=
        nullif(
            btrim(
                coalesce(
                    p_proposed_type_name,
                    ''
                )
            ),
            ''
        );

    if v_proposed_name is null
       or char_length(v_proposed_name) < 2
       or char_length(v_proposed_name) > 120
    then
        raise exception
            'Organization type proposal name must contain between 2 and 120 characters'
            using errcode = '22023';
    end if;

    v_normalized_name :=
        mp25m_private.normalize_text(v_proposed_name);

    if v_normalized_name is null then
        raise exception
            'Organization type proposal name cannot be normalized'
            using errcode = '22023';
    end if;

    v_organization_id :=
        mp25m_api.create_organization(
            p_actor_internal_user_id,
            p_name,
            'other',
            p_notes
        );

    insert into mp25m.organization_type_proposals (
        organization_id,
        proposed_name,
        normalized_name,
        status,
        created_by_internal_user_id
    )
    values (
        v_organization_id,
        v_proposed_name,
        v_normalized_name,
        'pending',
        p_actor_internal_user_id
    )
    returning id
    into v_proposal_id;

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
        'organization.type_proposal.create',
        'mp25m',
        'organization_type_proposals',
        v_proposal_id,
        jsonb_build_object(
            'organization_id',
                v_organization_id,
            'proposed_name',
                v_proposed_name,
            'normalized_name',
                v_normalized_name,
            'status',
                'pending'
        ),
        'allowed',
        jsonb_build_object(
            'organization_id',
                v_organization_id
        )
    );

    return v_organization_id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 4. RESOLUCION DE PROPUESTAS DE TIPO
-- ---------------------------------------------------------------------------

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
    v_base_type_code text;
    v_new_type_code text;
    v_display_order integer;
    v_suffix integer := 2;
    v_audit_action text;
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
        'rejected'
    ) then
        raise exception
            'Invalid organization type proposal resolution action'
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

    elsif v_resolution_action = 'approved' then
        perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
                'mp25m.organization_type_proposals.approve',
                0
            )
        );

        select
            ot.code,
            ot.name::text
        into
            v_matching_type_code,
            v_matching_type_name
        from mp25m.organization_types ot
        where ot.is_active = true
          and (
              mp25m_private.normalize_text(ot.name)
                  = v_proposal.normalized_name

              or extensions.similarity(
                  mp25m_private.normalize_text(ot.name),
                  v_proposal.normalized_name
              ) >= 0.70

              or (
                  ot.code = 'educational_institution'
                  and v_proposal.normalized_name
                      ~ '(^| )(universidad|universitaria|universitario|facultad|instituto educativo|escuela|colegio)( |$)'
              )
          )
        order by
            case
                when mp25m_private.normalize_text(ot.name)
                    = v_proposal.normalized_name
                then 0
                else 1
            end,
            extensions.similarity(
                mp25m_private.normalize_text(ot.name),
                v_proposal.normalized_name
            ) desc,
            ot.display_order,
            ot.name
        limit 1;

        if found then
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
            'organization.type_proposal.approve';

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
                end
        ),
        'allowed',
        jsonb_build_object(
            'organization_id',
                v_proposal.organization_id,
            'resolution_action',
                v_resolution_action,
            'existing_organization_type_code',
                p_existing_organization_type_code
        )
    );
end;
$function$;


-- ---------------------------------------------------------------------------
-- 5. PRIVILEGIOS SERVER-ONLY
-- ---------------------------------------------------------------------------

revoke all
on function mp25m_api.create_organization_with_type_proposal(
    uuid, text, text, text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.create_organization_with_type_proposal(
    uuid, text, text, text
)
to service_role;

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


comment on table mp25m.organization_type_proposals is
    'Pending and resolved proposals for organization types. A proposal is never a canonical type until explicitly resolved.';

comment on view mp25m_api.organization_type_proposal_list is
    'Server-only list of organization type proposals by organization, preserving canonical type separation.';

comment on view mp25m_api.node_pending_organization_list is
    'Server-only pending organization-node links for node profiles. It does not feed confirmed organization counters.';

comment on function mp25m_api.create_organization_with_type_proposal(
    uuid, text, text, text
) is
    'Creates a canonical organization as other and records a pending organization type proposal, auditing the proposal.';

comment on function mp25m_api.resolve_organization_type_proposal(
    uuid, uuid, text, text, text
) is
    'Maps, approves or rejects one pending organization type proposal with administrator or validator global access.';


commit;
