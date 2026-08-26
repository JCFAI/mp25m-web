-- Read-only territorial context for person actor candidates.
--
-- Identity resolution and territorial participation are independent.
-- A resolved person may participate in multiple nodes and may have
-- different territorial roles in each node.
--
-- Candidate nodes remain provenance. This function never creates or
-- confirms a node participation.

create or replace function
mp25m_api.actor_candidate_territorial_context(
    p_candidate_id uuid
)
returns table (
    node_id uuid,
    node_name text,
    has_canonical_participation boolean,
    participation_id uuid,
    participation_status text,
    participation_verification_status text,
    role_codes text[],
    role_names text[],
    role_verification_statuses text[],
    reported_by_candidate boolean
)
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_actor_kind text;
    v_person_id uuid;
begin
    select
        ac.actor_kind,
        ac.resolved_person_id
    into
        v_actor_kind,
        v_person_id
    from mp25m.actor_candidates ac
    where ac.id = p_candidate_id;

    if not found then
        raise exception
            'Actor candidate not found'
            using errcode = 'P0002';
    end if;

    if v_actor_kind <> 'person' then
        raise exception
            'Actor candidate is not a person'
            using errcode = '22023';
    end if;

    return query
    with candidate_nodes as (
        select
            acn.node_id
        from mp25m.actor_candidate_nodes acn
        where acn.actor_candidate_id =
            p_candidate_id
    ),

    person_participations as (
        select
            np.id,
            np.node_id,
            np.status::text as status,
            np.verification_status::text
                as verification_status

        from mp25m.node_participations np

        where np.person_id = v_person_id
          and np.status = 'active'
          and (
              np.ended_on is null
              or np.ended_on >= current_date
          )
    ),

    role_summary as (
        select
            npr.participation_id,

            array_agg(
                npr.role_code::text
                order by r.name, npr.role_code
            ) as role_codes,

            array_agg(
                r.name::text
                order by r.name, npr.role_code
            ) as role_names,

            array_agg(
                npr.verification_status::text
                order by r.name, npr.role_code
            ) as role_verification_statuses

        from mp25m.node_participation_roles npr

        join mp25m.roles r
          on r.code = npr.role_code

        where (
            npr.ended_on is null
            or npr.ended_on >= current_date
        )
          and npr.verification_status <> 'rejected'
          and r.active = true

        group by
            npr.participation_id
    ),

    all_nodes as (
        select cn.node_id
        from candidate_nodes cn

        union

        select pp.node_id
        from person_participations pp
    )

    select
        an.node_id,

        regexp_replace(
            n.name::text,
            '^[Nn]odo[[:space:]]+',
            ''
        ) as node_name,

        pp.id is not null
            as has_canonical_participation,

        pp.id
            as participation_id,

        pp.status
            as participation_status,

        pp.verification_status
            as participation_verification_status,

        coalesce(
            rs.role_codes,
            '{}'::text[]
        ) as role_codes,

        coalesce(
            rs.role_names,
            '{}'::text[]
        ) as role_names,

        coalesce(
            rs.role_verification_statuses,
            '{}'::text[]
        ) as role_verification_statuses,

        cn.node_id is not null
            as reported_by_candidate

    from all_nodes an

    join mp25m.nodes n
      on n.id = an.node_id

    left join person_participations pp
      on pp.node_id = an.node_id

    left join role_summary rs
      on rs.participation_id = pp.id

    left join candidate_nodes cn
      on cn.node_id = an.node_id

    order by
        lower(n.name),
        an.node_id;
end;
$function$;


revoke all
on function
mp25m_api.actor_candidate_territorial_context(uuid)
from public, anon, authenticated, service_role;

grant execute
on function
mp25m_api.actor_candidate_territorial_context(uuid)
to service_role;