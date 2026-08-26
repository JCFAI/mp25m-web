-- Incremento 2 - opportunity detail, origins, history and status management.
--
-- All exposed objects remain server-only through mp25m_api.
-- Status changes preserve audit history and manage resolved_at atomically.

create or replace view mp25m_api.opportunity_origin_list
with (security_invoker = true)
as

-- Canonical persons.
select
    oo.id as origin_id,
    oo.opportunity_id,
    'person'::text as actor_type,
    p.id as actor_id,
    p.display_name::text as display_name,
    'Persona'::text as type_label,
    false as is_provisional,
    p.record_status::text as actor_status,
    null::text as context_text,

    coalesce(
        pn.node_names,
        '{}'::text[]
    ) as node_names,

    coalesce(
        pr.role_names,
        '{}'::text[]
    ) as role_names

from mp25m.opportunity_origins oo
join mp25m.persons p
  on p.id = oo.person_id

left join lateral (
    select
        array_agg(
            x.node_name
            order by x.node_name
        ) as node_names
    from (
        select distinct
            regexp_replace(
                n.name,
                '^Nodo[[:space:]]+',
                '',
                'i'
            ) as node_name
        from mp25m.node_participations np
        join mp25m.nodes n
          on n.id = np.node_id
        where np.person_id = p.id
          and np.status = 'active'
          and np.ended_on is null
          and np.verification_status = 'confirmed'
          and n.status = 'active'
    ) x
) pn on true

left join lateral (
    select
        array_agg(
            x.role_name
            order by x.role_name
        ) as role_names
    from (
        select distinct
            r.name::text as role_name
        from mp25m.node_participations np
        join mp25m.node_participation_roles npr
          on npr.participation_id = np.id
        join mp25m.roles r
          on r.code = npr.role_code
        where np.person_id = p.id
          and np.status = 'active'
          and np.ended_on is null
          and np.verification_status = 'confirmed'
          and npr.ended_on is null
          and npr.verification_status = 'confirmed'
          and r.active = true
    ) x
) pr on true

where oo.person_id is not null

union all

-- Canonical organizations.
select
    oo.id as origin_id,
    oo.opportunity_id,
    'organization'::text as actor_type,
    o.id as actor_id,
    o.name::text as display_name,
    ot.name::text as type_label,
    false as is_provisional,
    o.record_status::text as actor_status,
    null::text as context_text,

    coalesce(
        onodes.node_names,
        '{}'::text[]
    ) as node_names,

    '{}'::text[] as role_names

from mp25m.opportunity_origins oo
join mp25m.organizations o
  on o.id = oo.organization_id
join mp25m.organization_types ot
  on ot.code = o.organization_type_code

left join lateral (
    select
        array_agg(
            x.node_name
            order by x.node_name
        ) as node_names
    from (
        select distinct
            regexp_replace(
                n.name,
                '^Nodo[[:space:]]+',
                '',
                'i'
            ) as node_name
        from mp25m.organization_nodes orgn
        join mp25m.nodes n
          on n.id = orgn.node_id
        where orgn.organization_id = o.id
          and n.status = 'active'
    ) x
) onodes on true

where oo.organization_id is not null

union all

-- Provisional actors.
select
    oo.id as origin_id,
    oo.opportunity_id,
    'candidate'::text as actor_type,
    ac.id as actor_id,
    ac.display_name::text as display_name,

    case
        when ac.actor_kind = 'person'
            then 'Persona'
        else coalesce(
            ot.name,
            'Organización'
        )
    end::text as type_label,

    true as is_provisional,
    ac.status::text as actor_status,
    ac.context_text,

    coalesce(
        cnodes.node_names,
        '{}'::text[]
    ) as node_names,

    '{}'::text[] as role_names

from mp25m.opportunity_origins oo
join mp25m.actor_candidates ac
  on ac.id = oo.actor_candidate_id
left join mp25m.organization_types ot
  on ot.code = ac.organization_type_code

left join lateral (
    select
        array_agg(
            x.node_name
            order by x.node_name
        ) as node_names
    from (
        select distinct
            regexp_replace(
                n.name,
                '^Nodo[[:space:]]+',
                '',
                'i'
            ) as node_name
        from mp25m.actor_candidate_nodes acn
        join mp25m.nodes n
          on n.id = acn.node_id
        where acn.actor_candidate_id = ac.id
          and n.status = 'active'
    ) x
) cnodes on true

where oo.actor_candidate_id is not null;


revoke all
on mp25m_api.opportunity_origin_list
from public, anon, authenticated, service_role;

grant select
on mp25m_api.opportunity_origin_list
to service_role;


create or replace view mp25m_api.opportunity_history
with (security_invoker = true)
as
select
    case
        when ae.target_schema = 'mp25m'
         and ae.target_table = 'opportunities'
            then ae.target_id

        when coalesce(
            ae.metadata ->> 'opportunity_id',
            ''
        ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            then (
                ae.metadata ->> 'opportunity_id'
            )::uuid

        else null
    end as opportunity_id,

    ae.id as event_id,
    ae.action,
    ae.actor_internal_user_id,
    ae.target_table,
    ae.target_id,
    ae.reason,
    ae.old_data,
    ae.new_data,
    ae.result,
    ae.metadata,
    ae.occurred_at

from mp25m.audit_events ae

where
    (
        ae.target_schema = 'mp25m'
        and ae.target_table = 'opportunities'
        and ae.target_id is not null
    )
    or
    (
        coalesce(
            ae.metadata ->> 'opportunity_id',
            ''
        ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    );


revoke all
on mp25m_api.opportunity_history
from public, anon, authenticated, service_role;

grant select
on mp25m_api.opportunity_history
to service_role;


create index if not exists idx_audit_events_target_history
on mp25m.audit_events (
    target_schema,
    target_table,
    target_id,
    occurred_at desc
);

create index if not exists idx_audit_events_opportunity_metadata
on mp25m.audit_events (
    (
        metadata ->> 'opportunity_id'
    ),
    occurred_at desc
)
where metadata ? 'opportunity_id';


create or replace function mp25m_api.update_opportunity_status(
    p_actor_internal_user_id uuid,
    p_opportunity_id uuid,
    p_new_status text,
    p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_old_status text;
    v_old_resolved_at timestamptz;
    v_new_resolved_at timestamptz;
begin
    if not exists (
        select 1
        from mp25m.internal_users iu
        where iu.id = p_actor_internal_user_id
          and iu.status = 'active'
          and iu.deleted_at is null
    ) then
        raise exception 'Invalid or inactive internal user'
            using errcode = '42501';
    end if;

    if p_new_status not in (
        'open',
        'under_analysis',
        'in_progress',
        'resolved',
        'discarded'
    ) then
        raise exception 'Invalid opportunity status'
            using errcode = '22023';
    end if;

    select
        o.status,
        o.resolved_at
    into
        v_old_status,
        v_old_resolved_at
    from mp25m.opportunities o
    where o.id = p_opportunity_id
    for update;

    if not found then
        raise exception 'Opportunity not found'
            using errcode = 'P0002';
    end if;

    if v_old_status = p_new_status then
        raise exception 'Opportunity already has the requested status'
            using errcode = '22023';
    end if;

    v_new_resolved_at :=
        case
            when p_new_status = 'resolved'
                then now()
            else null
        end;

    update mp25m.opportunities
    set
        status = p_new_status,
        resolved_at = v_new_resolved_at
    where id = p_opportunity_id;

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
        'opportunity.status_change',
        'mp25m',
        'opportunities',
        p_opportunity_id,
        nullif(
            btrim(p_reason),
            ''
        ),
        jsonb_build_object(
            'status',
                v_old_status,
            'resolved_at',
                v_old_resolved_at
        ),
        jsonb_build_object(
            'status',
                p_new_status,
            'resolved_at',
                v_new_resolved_at
        ),
        'allowed',
        '{}'::jsonb
    );
end;
$function$;


revoke all
on function mp25m_api.update_opportunity_status(
    uuid,
    uuid,
    text,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.update_opportunity_status(
    uuid,
    uuid,
    text,
    text
)
to service_role;


comment on view mp25m_api.opportunity_origin_list is
    'Server-only opportunity origin actors with territorial context.';

comment on view mp25m_api.opportunity_history is
    'Server-only audit history associated with opportunities.';

comment on function mp25m_api.update_opportunity_status(
    uuid,
    uuid,
    text,
    text
) is
    'Atomically changes an opportunity lifecycle status and records the change in audit history.';