-- Incremento 2 - server-only API for opportunities.
--
-- mp25m remains the canonical data schema.
-- mp25m_api is the PostgREST boundary used exclusively by the backend.
-- No anon/authenticated access is granted.

create view mp25m_api.opportunity_list
with (security_invoker = true)
as
select
    o.id,
    o.title,
    o.description,
    o.kind,
    o.status,
    o.priority,
    o.source_text,
    o.due_date,
    o.created_by_internal_user_id,
    o.assigned_to_internal_user_id,
    o.resolved_at,
    o.created_at,
    o.updated_at,
    coalesce(rel.node_ids, '{}'::uuid[]) as node_ids,
    coalesce(rel.node_names, '{}'::text[]) as node_names
from mp25m.opportunities o
left join lateral (
    select
        array_agg(n.id order by n.name) as node_ids,
        array_agg(n.name order by n.name) as node_names
    from mp25m.opportunity_nodes odn
    join mp25m.nodes n
      on n.id = odn.node_id
    where odn.opportunity_id = o.id
) rel on true;

create view mp25m_api.opportunity_node_options
with (security_invoker = true)
as
select
    n.id,
    n.node_number,
    n.name,
    n.status
from mp25m.nodes n
where n.status = 'active'
order by
    n.node_number nulls last,
    n.name;


create or replace function mp25m_api.create_opportunity(
    p_created_by_internal_user_id uuid,
    p_title text,
    p_description text,
    p_kind text,
    p_status text,
    p_priority text,
    p_source_text text,
    p_due_date date,
    p_assigned_to_internal_user_id uuid,
    p_node_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $$
declare
    v_opportunity_id uuid;
begin
    if not exists (
        select 1
        from mp25m.internal_users iu
        where iu.id = p_created_by_internal_user_id
          and iu.status = 'active'
          and iu.deleted_at is null
    ) then
        raise exception 'Invalid or inactive internal user'
            using errcode = '42501';
    end if;

    if p_assigned_to_internal_user_id is not null
       and not exists (
            select 1
            from mp25m.internal_users iu
            where iu.id = p_assigned_to_internal_user_id
              and iu.status = 'active'
              and iu.deleted_at is null
       )
    then
        raise exception 'Invalid or inactive assigned internal user'
            using errcode = '23503';
    end if;

    insert into mp25m.opportunities (
        title,
        description,
        kind,
        status,
        priority,
        source_text,
        due_date,
        created_by_internal_user_id,
        assigned_to_internal_user_id
    )
    values (
        btrim(p_title),
        btrim(p_description),
        p_kind,
        p_status,
        p_priority,
        nullif(btrim(p_source_text), ''),
        p_due_date,
        p_created_by_internal_user_id,
        p_assigned_to_internal_user_id
    )
    returning id
    into v_opportunity_id;

    insert into mp25m.opportunity_nodes (
        opportunity_id,
        node_id
    )
    select
        v_opportunity_id,
        node_id
    from (
        select distinct unnest(
            coalesce(p_node_ids, '{}'::uuid[])
        ) as node_id
    ) nodes;

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
        p_created_by_internal_user_id,
        'opportunity.create',
        'mp25m',
        'opportunities',
        v_opportunity_id,
        jsonb_build_object(
            'title', btrim(p_title),
            'description', btrim(p_description),
            'kind', p_kind,
            'status', p_status,
            'priority', p_priority,
            'source_text', nullif(btrim(p_source_text), ''),
            'due_date', p_due_date,
            'assigned_to_internal_user_id',
                p_assigned_to_internal_user_id
        ),
        'success',
        jsonb_build_object(
            'node_ids',
            coalesce(p_node_ids, '{}'::uuid[])
        )
    );

    return v_opportunity_id;
end;
$$;


revoke all
on mp25m_api.opportunity_list
from public, anon, authenticated;

revoke all
on mp25m_api.opportunity_node_options
from public, anon, authenticated;

grant select
on mp25m_api.opportunity_list
to service_role;

grant select
on mp25m_api.opportunity_node_options
to service_role;


revoke execute
on function mp25m_api.create_opportunity(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    date,
    uuid,
    uuid[]
)
from public, anon, authenticated;

grant execute
on function mp25m_api.create_opportunity(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    date,
    uuid,
    uuid[]
)
to service_role;


comment on view mp25m_api.opportunity_list is
    'Server-only read model for the MP25M opportunities module.';

comment on view mp25m_api.opportunity_node_options is
    'Server-only active node lookup for opportunities.';

comment on function mp25m_api.create_opportunity(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    date,
    uuid,
    uuid[]
) is
    'Atomically creates an opportunity, its node links and its audit event.';