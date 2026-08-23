-- Incremento 2 - server-only unified actor search for opportunity origins.
--
-- Searches canonical persons, canonical organizations and pending
-- provisional actors through a single service_role-only RPC.
--
-- Results related to the nodes currently selected in the opportunity
-- are ranked first.

create extension if not exists unaccent
with schema extensions;


create index if not exists idx_persons_active_search_trgm
on mp25m.persons
using gin (
    normalized_name extensions.gin_trgm_ops
)
where record_status = 'active';


create or replace function mp25m_api.search_opportunity_actors(
    p_query text,
    p_node_ids uuid[] default '{}'::uuid[],
    p_limit integer default 10
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
    is_provisional boolean
)
language sql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
with params as (
    select
        regexp_replace(
            extensions.unaccent(
                lower(
                    btrim(coalesce(p_query, ''))
                )
            ),
            '[^a-z0-9]+',
            ' ',
            'g'
        ) as search_term,

        coalesce(
            p_node_ids,
            '{}'::uuid[]
        ) as selected_node_ids,

        least(
            greatest(
                coalesce(p_limit, 10),
                1
            ),
            10
        ) as result_limit
),

person_matches as (
    select
        'person'::text as actor_type,
        p.id as actor_id,
        p.display_name::text as display_name,
        'Persona'::text as type_label,

        coalesce(
            pn.node_ids,
            '{}'::uuid[]
        ) as node_ids,

        coalesce(
            pn.node_names,
            '{}'::text[]
        ) as node_names,

        coalesce(
            pr.role_names,
            '{}'::text[]
        ) as role_names,

        coalesce(
            pn.is_related_to_selected_node,
            false
        ) as is_related_to_selected_node,

        false as is_provisional,

        case
            when p.normalized_name like
                params.search_term || '%'
            then 1
            else 0
        end as prefix_rank,

        extensions.similarity(
            p.normalized_name,
            params.search_term
        ) as similarity_rank

    from mp25m.persons p
    cross join params

    left join lateral (
        select
            array_agg(
                x.node_id
                order by x.node_name
            ) as node_ids,

            array_agg(
                x.node_name
                order by x.node_name
            ) as node_names,

            bool_or(
                x.node_id = any(
                    params.selected_node_ids
                )
            ) as is_related_to_selected_node

        from (
            select distinct
                np.node_id,

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

    where p.record_status = 'active'
      and char_length(params.search_term) >= 2
      and p.normalized_name ilike
          '%' || params.search_term || '%'
),

organization_matches as (
    select
        'organization'::text as actor_type,
        o.id as actor_id,
        o.name::text as display_name,
        ot.name::text as type_label,

        coalesce(
            onodes.node_ids,
            '{}'::uuid[]
        ) as node_ids,

        coalesce(
            onodes.node_names,
            '{}'::text[]
        ) as node_names,

        '{}'::text[] as role_names,

        coalesce(
            onodes.is_related_to_selected_node,
            false
        ) as is_related_to_selected_node,

        false as is_provisional,

        case
            when o.normalized_name like
                params.search_term || '%'
            then 1
            else 0
        end as prefix_rank,

        extensions.similarity(
            o.normalized_name,
            params.search_term
        ) as similarity_rank

    from mp25m.organizations o
    join mp25m.organization_types ot
      on ot.code = o.organization_type_code
    cross join params

    left join lateral (
        select
            array_agg(
                x.node_id
                order by x.node_name
            ) as node_ids,

            array_agg(
                x.node_name
                order by x.node_name
            ) as node_names,

            bool_or(
                x.node_id = any(
                    params.selected_node_ids
                )
            ) as is_related_to_selected_node

        from (
            select distinct
                orgn.node_id,

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

    where o.record_status = 'active'
      and char_length(params.search_term) >= 2
      and o.normalized_name ilike
          '%' || params.search_term || '%'
),

candidate_matches as (
    select
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

        coalesce(
            cnodes.node_ids,
            '{}'::uuid[]
        ) as node_ids,

        coalesce(
            cnodes.node_names,
            '{}'::text[]
        ) as node_names,

        '{}'::text[] as role_names,

        coalesce(
            cnodes.is_related_to_selected_node,
            false
        ) as is_related_to_selected_node,

        true as is_provisional,

        case
            when ac.normalized_name like
                params.search_term || '%'
            then 1
            else 0
        end as prefix_rank,

        extensions.similarity(
            ac.normalized_name,
            params.search_term
        ) as similarity_rank

    from mp25m.actor_candidates ac
    left join mp25m.organization_types ot
      on ot.code = ac.organization_type_code
    cross join params

    left join lateral (
        select
            array_agg(
                x.node_id
                order by x.node_name
            ) as node_ids,

            array_agg(
                x.node_name
                order by x.node_name
            ) as node_names,

            bool_or(
                x.node_id = any(
                    params.selected_node_ids
                )
            ) as is_related_to_selected_node

        from (
            select distinct
                acn.node_id,

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

    where ac.status = 'pending'
      and char_length(params.search_term) >= 2
      and ac.normalized_name ilike
          '%' || params.search_term || '%'
),

all_matches as (
    select * from person_matches
    union all
    select * from organization_matches
    union all
    select * from candidate_matches
)

select
    all_matches.actor_type,
    all_matches.actor_id,
    all_matches.display_name,
    all_matches.type_label,
    all_matches.node_ids,
    all_matches.node_names,
    all_matches.role_names,
    all_matches.is_related_to_selected_node,
    all_matches.is_provisional

from all_matches
cross join params

order by
    all_matches.is_related_to_selected_node desc,
    all_matches.prefix_rank desc,
    all_matches.similarity_rank desc,
    all_matches.display_name asc

limit (
    select result_limit
    from params
);
$function$;


revoke all
on function mp25m_api.search_opportunity_actors(
    text,
    uuid[],
    integer
)
from public, anon, authenticated;

grant execute
on function mp25m_api.search_opportunity_actors(
    text,
    uuid[],
    integer
)
to service_role;


comment on function mp25m_api.search_opportunity_actors(
    text,
    uuid[],
    integer
) is
    'Server-only unified autocomplete for opportunity origin actors. Searches active persons, active organizations and pending actor candidates, prioritizing actors related to selected nodes.';