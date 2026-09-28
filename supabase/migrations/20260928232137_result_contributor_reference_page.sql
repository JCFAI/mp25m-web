-- Dedicated server-only reference search for Result contributors.
--
-- Unlike the opportunity actor reference page, Results must be able to
-- select canonical actors that are archived as well as active. Merged rows
-- are superseded identities and are intentionally not offered for selection.
-- Private contact data is never exposed.

create or replace function mp25m_api.result_contributor_reference_page(
    p_query text default '',
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
    record_status text,
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
        least(greatest(coalesce(p_limit, 25), 1), 50)
            as requested_limit,
        (
            p_after_name is null
            and p_after_actor_type is null
            and p_after_actor_id is null
        ) as has_no_cursor,
        (
            p_after_name is not null
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
        person_record.record_status::text as record_status,
        coalesce(
            nullif(person_record.normalized_name::text, ''),
            regexp_replace(
                extensions.unaccent(
                    lower(person_record.display_name::text)
                ),
                '[^a-z0-9]+',
                ' ',
                'g'
            )
        ) as cursor_name
    from mp25m.persons person_record
    cross join params
    where person_record.record_status in ('active', 'archived')
      and (
          params.search_term = ''
          or coalesce(
              nullif(person_record.normalized_name::text, ''),
              regexp_replace(
                  extensions.unaccent(
                      lower(person_record.display_name::text)
                  ),
                  '[^a-z0-9]+',
                  ' ',
                  'g'
              )
          ) ilike '%' || params.search_term || '%'
      )
),
organization_matches as (
    select
        'organization'::text as actor_type,
        organization_record.id as actor_id,
        organization_record.name::text as display_name,
        organization_type.name::text as type_label,
        organization_record.record_status::text as record_status,
        coalesce(
            nullif(organization_record.normalized_name::text, ''),
            regexp_replace(
                extensions.unaccent(
                    lower(organization_record.name::text)
                ),
                '[^a-z0-9]+',
                ' ',
                'g'
            )
        ) as cursor_name
    from mp25m.organizations organization_record
    join mp25m.organization_types organization_type
      on organization_type.code =
         organization_record.organization_type_code
    cross join params
    where organization_record.record_status in ('active', 'archived')
      and (
          params.search_term = ''
          or coalesce(
              nullif(organization_record.normalized_name::text, ''),
              regexp_replace(
                  extensions.unaccent(
                      lower(organization_record.name::text)
                  ),
                  '[^a-z0-9]+',
                  ' ',
                  'g'
              )
          ) ilike '%' || params.search_term || '%'
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
              all_matches.cursor_name > p_after_name
              or (
                  all_matches.cursor_name = p_after_name
                  and all_matches.actor_type > p_after_actor_type
              )
              or (
                  all_matches.cursor_name = p_after_name
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
    continued_matches.record_status,
    continued_matches.cursor_name
from continued_matches
cross join params
order by
    continued_matches.cursor_name asc,
    continued_matches.actor_type asc,
    continued_matches.actor_id asc
limit ((select requested_limit from params) + 1);
$function$;

revoke all
on function mp25m_api.result_contributor_reference_page(
    text,
    text,
    text,
    uuid,
    integer
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.result_contributor_reference_page(
    text,
    text,
    text,
    uuid,
    integer
)
to service_role;

comment on function mp25m_api.result_contributor_reference_page(
    text,
    text,
    text,
    uuid,
    integer
) is
    'Server-only keyset page of active and archived canonical Result contributors. Excludes merged identities and private contact data.';
