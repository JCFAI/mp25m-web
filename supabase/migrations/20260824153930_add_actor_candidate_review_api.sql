-- Incremento 2 - actor candidate review API.
--
-- Candidate matching is advisory only.
-- A possible match never confirms identity automatically.
-- Candidate node context is provenance and must not be converted
-- automatically into confirmed node participation.

create or replace view mp25m_api.actor_candidate_review
with (security_invoker = true)
as
select
    ac.id,
    ac.actor_kind,
    ac.display_name,
    ac.normalized_name,
    ac.organization_type_code,
    ac.context_text,
    ac.status,
    ac.created_by_internal_user_id,
    ac.resolved_person_id,
    ac.resolved_organization_id,
    ac.created_at,

    coalesce(
        candidate_nodes.node_ids,
        '{}'::uuid[]
    ) as node_ids,

    coalesce(
        candidate_nodes.node_names,
        '{}'::text[]
    ) as node_names,

    coalesce(
        linked_opportunities.opportunity_ids,
        '{}'::uuid[]
    ) as opportunity_ids,

    coalesce(
        linked_opportunities.opportunity_titles,
        '{}'::text[]
    ) as opportunity_titles

from mp25m.actor_candidates ac

left join lateral (
    select
        array_agg(
            n.id
            order by n.name
        ) as node_ids,

        array_agg(
            regexp_replace(
                n.name,
                '^[Nn]odo[[:space:]]+',
                ''
            )
            order by n.name
        ) as node_names

    from mp25m.actor_candidate_nodes acn

    join mp25m.nodes n
      on n.id = acn.node_id

    where acn.actor_candidate_id = ac.id
) candidate_nodes on true

left join lateral (
    select
        array_agg(
            o.id
            order by o.created_at, o.id
        ) as opportunity_ids,

        array_agg(
            o.title
            order by o.created_at, o.id
        ) as opportunity_titles

    from mp25m.opportunity_origins oo

    join mp25m.opportunities o
      on o.id = oo.opportunity_id

    where oo.actor_candidate_id = ac.id
) linked_opportunities on true;


revoke all
on mp25m_api.actor_candidate_review
from public, anon, authenticated, service_role;

grant select
on mp25m_api.actor_candidate_review
to service_role;


create or replace function
mp25m_api.actor_candidate_person_matches(
    p_candidate_id uuid,
    p_limit integer default 10
)
returns table (
    person_id uuid,
    display_name text,
    normalized_name text,
    record_status text,
    similarity_score real,
    node_names text[],
    node_verification_statuses text[]
)
language plpgsql
security invoker
set search_path =
    pg_catalog,
    mp25m,
    mp25m_api,
    extensions
as $function$
declare
    v_candidate_kind text;
    v_candidate_name text;
    v_limit integer;
begin
    v_limit :=
        least(
            greatest(
                coalesce(p_limit, 10),
                1
            ),
            10
        );

    select
        ac.actor_kind,
        ac.normalized_name
    into
        v_candidate_kind,
        v_candidate_name
    from mp25m.actor_candidates ac
    where ac.id = p_candidate_id;

    if not found then
        raise exception
            'Actor candidate not found'
            using errcode = 'P0002';
    end if;

    if v_candidate_kind <> 'person' then
        raise exception
            'Actor candidate is not a person'
            using errcode = '22023';
    end if;

    return query
    with possible_matches as (
        select
            p.id,
            p.display_name,
            p.normalized_name,
            p.record_status,

            extensions.similarity(
                coalesce(
                    p.normalized_name,
                    ''
                ),
                v_candidate_name
            ) as score

        from mp25m.persons p

        where p.record_status = 'active'
          and p.normalized_name is not null
          and (
              p.normalized_name =
                  v_candidate_name

              or extensions.similarity(
                  p.normalized_name,
                  v_candidate_name
              ) >= 0.30

              or not exists (
                  select 1
                  from regexp_split_to_table(
                      v_candidate_name,
                      '[[:space:]]+'
                  ) token
                  where token <> ''
                    and p.normalized_name
                        not like
                        '%' || token || '%'
              )
          )
    )

    select
        pm.id as person_id,

        pm.display_name::text,

        pm.normalized_name::text,

        pm.record_status::text,

        pm.score as similarity_score,

        coalesce(
            person_nodes.node_names,
            '{}'::text[]
        ) as node_names,

        coalesce(
            person_nodes.verification_statuses,
            '{}'::text[]
        ) as node_verification_statuses

    from possible_matches pm

    left join lateral (
        select
            array_agg(
                regexp_replace(
                    n.name,
                    '^[Nn]odo[[:space:]]+',
                    ''
                )
                order by n.name
            ) as node_names,

            array_agg(
                np.verification_status::text
                order by n.name
            ) as verification_statuses

        from mp25m.node_participations np

        join mp25m.nodes n
          on n.id = np.node_id

        where np.person_id = pm.id
          and np.status = 'active'
    ) person_nodes on true

    order by
        case
            when pm.normalized_name =
                v_candidate_name
            then 0
            else 1
        end,

        pm.score desc,

        lower(pm.display_name),

        pm.id

    limit v_limit;
end;
$function$;


revoke all
on function mp25m_api.actor_candidate_person_matches(
    uuid,
    integer
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.actor_candidate_person_matches(
    uuid,
    integer
)
to service_role;


comment on view mp25m_api.actor_candidate_review is
    'Server-only actor candidate review data with provenance and linked opportunities.';

comment on function mp25m_api.actor_candidate_person_matches(
    uuid,
    integer
) is
    'Returns possible existing canonical-person matches for human review. A match is never confirmation.';