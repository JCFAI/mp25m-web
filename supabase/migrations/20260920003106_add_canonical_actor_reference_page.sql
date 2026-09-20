-- Server-only, keyset-paginated reference list for canonical actors.
--
-- This function intentionally excludes provisional actor candidates and
-- private contact data. The HTTP layer owns cursor encoding; SQL receives
-- the explicit continuation keys that match the deterministic ORDER BY.

create or replace function mp25m_api.canonical_actor_reference_page(
    p_query text default '',
    p_actor_types text[] default array['person', 'organization']::text[],
    p_node_ids uuid[] default '{}'::uuid[],
    p_after_related boolean default null,
    p_after_name text default null,
    p_after_actor_type text default null,
    p_after_actor_id uuid default null,
    p_limit integer default 25
)
returns table (
    actor_type text,
    actor_id uuid,
    display_name text,
    type_label text,
    node_ids uuid[],
    node_names text[],
    role_names text[],
    is_related_to_selected_node boolean,
    is_provisional boolean,
    cursor_name text
)
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
with params as (
    select
        regexp_replace(
            extensions.unaccent(
                lower(btrim(coalesce(p_query, '')))
            ),
            '[^a-z0-9]+',
            ' ',
            'g'
        ) as search_term,
        coalesce(p_actor_types, '{}'::text[]) as actor_types,
        coalesce(p_node_ids, '{}'::uuid[]) as selected_node_ids,
        least(greatest(coalesce(p_limit, 25), 1), 50) as requested_limit,
        (
            p_after_related is null
            and p_after_name is null
            and p_after_actor_type is null
            and p_after_actor_id is null
        ) as has_no_cursor,
        (
            p_after_related is not null
            and p_after_name is not null
            and p_after_actor_type is not null
            and p_after_actor_id is not null
        ) as has_complete_cursor
),
person_matches as (
    select
        'person'::text as actor_type,
        person_record.id as actor_id,
        person_record.display_name::text as display_name,
        'Persona'::text as type_label,
        coalesce(person_nodes.node_ids, '{}'::uuid[]) as node_ids,
        coalesce(person_nodes.node_names, '{}'::text[]) as node_names,
        coalesce(person_roles.role_names, '{}'::text[]) as role_names,
        coalesce(person_nodes.is_related, false)
            as is_related_to_selected_node,
        false as is_provisional,
        person_record.normalized_name::text as cursor_name
    from mp25m.persons person_record
    cross join params
    left join lateral (
        select
            array_agg(node_row.node_id order by node_row.node_name, node_row.node_id)
                as node_ids,
            array_agg(node_row.node_name order by node_row.node_name, node_row.node_id)
                as node_names,
            bool_or(
                node_row.node_id = any(params.selected_node_ids)
            ) as is_related
        from (
            select distinct
                participation.node_id,
                regexp_replace(
                    node_record.name::text,
                    '^[Nn]odo[[:space:]]+',
                    ''
                ) as node_name
            from mp25m.node_participations participation
            join mp25m.nodes node_record
              on node_record.id = participation.node_id
            where participation.person_id = person_record.id
              and participation.status = 'active'
              and participation.verification_status = 'confirmed'
              and (
                  participation.ended_on is null
                  or participation.ended_on >= current_date
              )
              and node_record.status = 'active'
        ) node_row
    ) person_nodes on true
    left join lateral (
        select
            array_agg(role_row.role_name order by role_row.role_name)
                as role_names
        from (
            select distinct role_record.name::text as role_name
            from mp25m.node_participations participation
            join mp25m.node_participation_roles participation_role
              on participation_role.participation_id = participation.id
            join mp25m.roles role_record
              on role_record.code = participation_role.role_code
            where participation.person_id = person_record.id
              and participation.status = 'active'
              and participation.verification_status = 'confirmed'
              and (
                  participation.ended_on is null
                  or participation.ended_on >= current_date
              )
              and participation_role.verification_status = 'confirmed'
              and (
                  participation_role.ended_on is null
                  or participation_role.ended_on >= current_date
              )
              and role_record.active = true
        ) role_row
    ) person_roles on true
    where person_record.record_status = 'active'
      and 'person' = any(params.actor_types)
      and (
          params.search_term = ''
          or person_record.normalized_name ilike
              '%' || params.search_term || '%'
      )
),
organization_matches as (
    select
        'organization'::text as actor_type,
        organization_record.id as actor_id,
        organization_record.name::text as display_name,
        organization_type.name::text as type_label,
        coalesce(organization_nodes.node_ids, '{}'::uuid[]) as node_ids,
        coalesce(organization_nodes.node_names, '{}'::text[]) as node_names,
        '{}'::text[] as role_names,
        coalesce(organization_nodes.is_related, false)
            as is_related_to_selected_node,
        false as is_provisional,
        organization_record.normalized_name::text as cursor_name
    from mp25m.organizations organization_record
    join mp25m.organization_types organization_type
      on organization_type.code = organization_record.organization_type_code
    cross join params
    left join lateral (
        select
            array_agg(node_row.node_id order by node_row.node_name, node_row.node_id)
                as node_ids,
            array_agg(node_row.node_name order by node_row.node_name, node_row.node_id)
                as node_names,
            bool_or(
                node_row.node_id = any(params.selected_node_ids)
            ) as is_related
        from (
            select distinct
                organization_node.node_id,
                regexp_replace(
                    node_record.name::text,
                    '^[Nn]odo[[:space:]]+',
                    ''
                ) as node_name
            from mp25m.organization_nodes organization_node
            join mp25m.nodes node_record
              on node_record.id = organization_node.node_id
            where organization_node.organization_id = organization_record.id
              and organization_node.active = true
              and organization_node.verification_status = 'confirmed'
              and (
                  organization_node.started_on is null
                  or organization_node.started_on <= current_date
              )
              and (
                  organization_node.ended_on is null
                  or organization_node.ended_on >= current_date
              )
              and node_record.status = 'active'
        ) node_row
    ) organization_nodes on true
    where organization_record.record_status = 'active'
      and organization_type.is_active = true
      and 'organization' = any(params.actor_types)
      and (
          params.search_term = ''
          or organization_record.normalized_name ilike
              '%' || params.search_term || '%'
      )
),
all_matches as (
    select * from person_matches
    union all
    select * from organization_matches
),
continued_matches as (
    select all_matches.*
    from all_matches
    cross join params
    where params.has_no_cursor
       or (
          params.has_complete_cursor
          and (
              all_matches.is_related_to_selected_node < p_after_related
              or (
                  all_matches.is_related_to_selected_node = p_after_related
                  and all_matches.cursor_name > p_after_name
              )
              or (
                  all_matches.is_related_to_selected_node = p_after_related
                  and all_matches.cursor_name = p_after_name
                  and all_matches.actor_type > p_after_actor_type
              )
              or (
                  all_matches.is_related_to_selected_node = p_after_related
                  and all_matches.cursor_name = p_after_name
                  and all_matches.actor_type = p_after_actor_type
                  and all_matches.actor_id > p_after_actor_id
              )
          )
       )
)
select
    continued_matches.actor_type,
    continued_matches.actor_id,
    continued_matches.display_name,
    continued_matches.type_label,
    continued_matches.node_ids,
    continued_matches.node_names,
    continued_matches.role_names,
    continued_matches.is_related_to_selected_node,
    continued_matches.is_provisional,
    continued_matches.cursor_name
from continued_matches
cross join params
order by
    continued_matches.is_related_to_selected_node desc,
    continued_matches.cursor_name asc,
    continued_matches.actor_type asc,
    continued_matches.actor_id asc
limit ((select requested_limit from params) + 1);
$function$;

revoke all
on function mp25m_api.canonical_actor_reference_page(
    text,
    text[],
    uuid[],
    boolean,
    text,
    text,
    uuid,
    integer
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.canonical_actor_reference_page(
    text,
    text[],
    uuid[],
    boolean,
    text,
    text,
    uuid,
    integer
)
to service_role;

comment on function mp25m_api.canonical_actor_reference_page(
    text,
    text[],
    uuid[],
    boolean,
    text,
    text,
    uuid,
    integer
) is
    'Server-only keyset page of active canonical persons and organizations. Excludes provisional candidates and contact data.';
