-- Incremento 3 - directorio y perfil de nodos.
--
-- Las vistas son exclusivamente de lectura para el backend.
-- Solo se consideran participaciones territoriales confirmadas
-- para incorporar una persona a la composición de un nodo.
--
-- Los roles y las habilidades conservan sus propios estados
-- de validación y no se infieren a partir de la participación.

create or replace view
mp25m_api.node_directory
with (security_invoker = true)
as
select
    n.id,
    n.node_number,
    regexp_replace(
        n.name::text,
        '^[Nn]odo[[:space:]]+',
        ''
    ) as display_name,
    regexp_replace(
        n.normalized_name::text,
        '^nodo[[:space:]]+',
        '',
        'i'
    ) as search_name,
    n.status::text as status,
    primary_jurisdiction.jurisdiction_name,
    primary_jurisdiction.jurisdiction_type_name
from mp25m.nodes n
left join lateral (
    select
        j.name::text as jurisdiction_name,
        jt.name::text as jurisdiction_type_name
    from mp25m.node_jurisdictions nj
    join mp25m.jurisdictions j
      on j.id = nj.jurisdiction_id
    join mp25m.jurisdiction_types jt
      on jt.code = j.type_code
    where nj.node_id = n.id
    order by
        nj.is_primary desc,
        j.name
    limit 1
) primary_jurisdiction on true
where n.status = 'active';


create or replace view
mp25m_api.node_profile
with (security_invoker = true)
as
select
    n.id,
    n.node_number,
    regexp_replace(
        n.name::text,
        '^[Nn]odo[[:space:]]+',
        ''
    ) as display_name,
    n.slug::text as slug,
    n.description,
    n.status::text as status,
    n.started_on,
    primary_jurisdiction.jurisdiction_name,
    primary_jurisdiction.jurisdiction_type_name,
    coalesce(
        people_stats.confirmed_people_count,
        0
    ) as confirmed_people_count,
    coalesce(
        skill_stats.people_with_skills_count,
        0
    ) as people_with_skills_count,
    coalesce(
        skill_stats.reported_skill_count,
        0
    ) as reported_skill_count,
    coalesce(
        skill_stats.confirmed_skill_count,
        0
    ) as confirmed_skill_count,
    coalesce(
        articulation_stats.articulation_count,
        0
    ) as articulation_count,
    coalesce(
        organization_stats.organization_count,
        0
    ) as organization_count,
    n.created_at,
    n.updated_at
from mp25m.nodes n
left join lateral (
    select
        j.name::text as jurisdiction_name,
        jt.name::text as jurisdiction_type_name
    from mp25m.node_jurisdictions nj
    join mp25m.jurisdictions j
      on j.id = nj.jurisdiction_id
    join mp25m.jurisdiction_types jt
      on jt.code = j.type_code
    where nj.node_id = n.id
    order by
        nj.is_primary desc,
        j.name
    limit 1
) primary_jurisdiction on true
left join lateral (
    select
        count(distinct np.person_id)::integer
            as confirmed_people_count
    from mp25m.node_participations np
    join mp25m.persons p
      on p.id = np.person_id
    where np.node_id = n.id
      and np.status = 'active'
      and np.verification_status = 'confirmed'
      and (
          np.ended_on is null
          or np.ended_on >= current_date
      )
      and p.record_status = 'active'
) people_stats on true
left join lateral (
    select
        count(distinct np.person_id)::integer
            as people_with_skills_count,
        count(distinct ps.skill_id)::integer
            as reported_skill_count,
        (
            count(distinct ps.skill_id)
            filter (
                where ps.verification_status =
                    'confirmed'
            )
        )::integer as confirmed_skill_count
    from mp25m.node_participations np
    join mp25m.persons p
      on p.id = np.person_id
    join mp25m.person_skills ps
      on ps.person_id = p.id
    join mp25m.skills s
      on s.id = ps.skill_id
    where np.node_id = n.id
      and np.status = 'active'
      and np.verification_status = 'confirmed'
      and (
          np.ended_on is null
          or np.ended_on >= current_date
      )
      and p.record_status = 'active'
      and ps.active = true
      and ps.verification_status <> 'rejected'
      and s.active = true
) skill_stats on true
left join lateral (
    select
        count(*)::integer as articulation_count
    from mp25m.opportunity_nodes opportunity_node
    where opportunity_node.node_id = n.id
) articulation_stats on true
left join lateral (
    select
        count(*)::integer as organization_count
    from mp25m.organization_nodes organization_node
    join mp25m.organizations organization_record
      on organization_record.id =
          organization_node.organization_id
    where organization_node.node_id = n.id
      and organization_record.record_status =
          'active'
) organization_stats on true;


create or replace view
mp25m_api.node_jurisdiction_list
with (security_invoker = true)
as
select
    nj.node_id,
    j.id as jurisdiction_id,
    j.name::text as jurisdiction_name,
    j.type_code::text as jurisdiction_type_code,
    jt.name::text as jurisdiction_type_name,
    j.parent_id,
    parent_jurisdiction.name::text
        as parent_jurisdiction_name,
    j.official_code::text as official_code,
    j.latitude,
    j.longitude,
    nj.is_primary,
    nj.coverage_notes
from mp25m.node_jurisdictions nj
join mp25m.jurisdictions j
  on j.id = nj.jurisdiction_id
join mp25m.jurisdiction_types jt
  on jt.code = j.type_code
left join mp25m.jurisdictions parent_jurisdiction
  on parent_jurisdiction.id = j.parent_id;


create or replace view
mp25m_api.node_participant_list
with (security_invoker = true)
as
select
    np.node_id,
    np.id as participation_id,
    p.id as person_id,
    p.display_name::text as display_name,
    p.normalized_name::text as search_name,
    p.primary_activity_text,
    p.profession_text,
    np.started_on,
    np.ended_on,
    np.notes as participation_notes,
    coalesce(
        role_data.role_codes,
        '{}'::text[]
    ) as role_codes,
    coalesce(
        role_data.role_names,
        '{}'::text[]
    ) as role_names,
    coalesce(
        role_data.role_verification_statuses,
        '{}'::text[]
    ) as role_verification_statuses
from mp25m.node_participations np
join mp25m.persons p
  on p.id = np.person_id
left join lateral (
    select
        array_agg(
            role_row.role_code
            order by role_row.role_name
        ) as role_codes,
        array_agg(
            role_row.role_name
            order by role_row.role_name
        ) as role_names,
        array_agg(
            role_row.verification_status
            order by role_row.role_name
        ) as role_verification_statuses
    from (
        select
            npr.role_code::text as role_code,
            r.name::text as role_name,
            npr.verification_status::text
                as verification_status
        from mp25m.node_participation_roles npr
        join mp25m.roles r
          on r.code = npr.role_code
        where npr.participation_id = np.id
          and (
              npr.ended_on is null
              or npr.ended_on >= current_date
          )
          and npr.verification_status <>
              'rejected'
          and r.active = true
    ) role_row
) role_data on true
where np.status = 'active'
  and np.verification_status = 'confirmed'
  and (
      np.ended_on is null
      or np.ended_on >= current_date
  )
  and p.record_status = 'active';


create or replace view
mp25m_api.node_skill_summary
with (security_invoker = true)
as
select
    np.node_id,
    s.id as skill_id,
    s.name::text as skill_name,
    s.normalized_name::text as skill_search_name,
    s.category_code::text as category_code,
    sc.name::text as category_name,
    count(distinct p.id)::integer
        as person_count,
    (
        count(distinct p.id)
        filter (
            where ps.verification_status =
                'confirmed'
        )
    )::integer as confirmed_person_count,
    (
        count(distinct p.id)
        filter (
            where ps.verification_status =
                'pending'
        )
    )::integer as pending_person_count
from mp25m.node_participations np
join mp25m.persons p
  on p.id = np.person_id
join mp25m.person_skills ps
  on ps.person_id = p.id
join mp25m.skills s
  on s.id = ps.skill_id
left join mp25m.skill_categories sc
  on sc.code = s.category_code
where np.status = 'active'
  and np.verification_status = 'confirmed'
  and (
      np.ended_on is null
      or np.ended_on >= current_date
  )
  and p.record_status = 'active'
  and ps.active = true
  and ps.verification_status <> 'rejected'
  and s.active = true
group by
    np.node_id,
    s.id,
    s.name,
    s.normalized_name,
    s.category_code,
    sc.name;


create or replace view
mp25m_api.node_articulation_list
with (security_invoker = true)
as
select
    opportunity_node.node_id,
    o.id as opportunity_id,
    o.title,
    o.description,
    o.kind,
    o.status,
    o.priority,
    o.source_text,
    o.due_date,
    o.resolved_at,
    o.created_at,
    o.updated_at
from mp25m.opportunity_nodes opportunity_node
join mp25m.opportunities o
  on o.id = opportunity_node.opportunity_id;


create or replace view
mp25m_api.node_organization_list
with (security_invoker = true)
as
select
    organization_node.node_id,
    organization_record.id as organization_id,
    organization_record.name::text
        as organization_name,
    organization_record.organization_type_code,
    organization_type.name::text
        as organization_type_name,
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
  and organization_type.is_active = true;


revoke all privileges
on table
    mp25m_api.node_directory,
    mp25m_api.node_profile,
    mp25m_api.node_jurisdiction_list,
    mp25m_api.node_participant_list,
    mp25m_api.node_skill_summary,
    mp25m_api.node_articulation_list,
    mp25m_api.node_organization_list
from public, anon, authenticated, service_role;


grant select
on table
    mp25m_api.node_directory,
    mp25m_api.node_profile,
    mp25m_api.node_jurisdiction_list,
    mp25m_api.node_participant_list,
    mp25m_api.node_skill_summary,
    mp25m_api.node_articulation_list,
    mp25m_api.node_organization_list
to service_role;


comment on view mp25m_api.node_directory is
    'Server-only searchable directory of active MP25M nodes.';

comment on view mp25m_api.node_profile is
    'Server-only summary and validated aggregate counts for an MP25M node.';

comment on view mp25m_api.node_jurisdiction_list is
    'Server-only jurisdiction and territorial coverage data for MP25M nodes.';

comment on view mp25m_api.node_participant_list is
    'Server-only confirmed active participants of MP25M nodes; role validation remains independent.';

comment on view mp25m_api.node_skill_summary is
    'Server-only skill aggregation for confirmed node participants, preserving skill validation status.';

comment on view mp25m_api.node_articulation_list is
    'Server-only articulations related to each MP25M node.';

comment on view mp25m_api.node_organization_list is
    'Server-only canonical active organizations related to each MP25M node.';