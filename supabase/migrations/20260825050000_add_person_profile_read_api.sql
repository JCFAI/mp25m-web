-- Read-only API for the canonical person profile.
--
-- A person is progressively enriched over time.
-- Identity, territorial participation, territorial roles,
-- skills and articulations remain independent dimensions.
--
-- These views expose canonical data and provenance without
-- granting direct application access to mp25m base tables.

create or replace view
mp25m_api.person_profile
with (security_invoker = true)
as
select
    p.id,
    p.display_name::text as display_name,
    p.first_name::text as first_name,
    p.last_name::text as last_name,
    p.primary_activity_text,
    p.profession_text,
    p.experience_text,
    p.birth_date,
    p.gender::text as gender,
    p.notes,
    p.record_status::text as record_status,
    p.merged_into_id,
    p.residence_province_text,
    p.residence_locality_text,
    p.created_at,
    p.updated_at
from mp25m.persons p;


create or replace view
mp25m_api.person_territorial_profile
with (security_invoker = true)
as
select
    np.id as participation_id,
    np.person_id,
    np.node_id,
    regexp_replace(
        n.name::text,
        '^[Nn]odo[[:space:]]+',
        ''
    ) as node_name,
    np.status::text as participation_status,
    np.verification_status::text
        as participation_verification_status,
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
join mp25m.nodes n
  on n.id = np.node_id
left join lateral (
    select
        array_agg(
            x.role_code
            order by x.role_name
        ) as role_codes,
        array_agg(
            x.role_name
            order by x.role_name
        ) as role_names,
        array_agg(
            x.verification_status
            order by x.role_name
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
          and npr.verification_status::text <>
              'rejected'
          and r.active = true
    ) x
) role_data on true;


create or replace view
mp25m_api.person_articulation_list
with (security_invoker = true)
as
select
    oo.person_id,
    o.id as opportunity_id,
    o.title,
    o.description,
    o.kind,
    o.status,
    o.priority,
    o.source_text,
    o.due_date,
    o.created_at,
    o.updated_at,
    coalesce(
        node_data.node_names,
        '{}'::text[]
    ) as node_names
from mp25m.opportunity_origins oo
join mp25m.opportunities o
  on o.id = oo.opportunity_id
left join lateral (
    select array_agg(
        x.node_name
        order by x.node_name
    ) as node_names
    from (
        select distinct
            regexp_replace(
                n.name::text,
                '^[Nn]odo[[:space:]]+',
                ''
            ) as node_name
        from mp25m.opportunity_nodes opportunity_node
        join mp25m.nodes n
          on n.id = opportunity_node.node_id
        where opportunity_node.opportunity_id =
            o.id
    ) x
) node_data on true
where oo.person_id is not null;


create or replace view
mp25m_api.person_identity_aliases
with (security_invoker = true)
as
select
    ac.resolved_person_id as person_id,
    ac.id as actor_candidate_id,
    ac.display_name as reported_name,
    ac.context_text,
    ac.status,
    ac.created_at,
    coalesce(
        candidate_nodes.node_names,
        '{}'::text[]
    ) as reported_node_names,
    coalesce(
        articulation_data.opportunity_ids,
        '{}'::uuid[]
    ) as opportunity_ids,
    coalesce(
        articulation_data.opportunity_titles,
        '{}'::text[]
    ) as opportunity_titles
from mp25m.actor_candidates ac
left join lateral (
    select array_agg(
        x.node_name
        order by x.node_name
    ) as node_names
    from (
        select distinct
            regexp_replace(
                n.name::text,
                '^[Nn]odo[[:space:]]+',
                ''
            ) as node_name
        from mp25m.actor_candidate_nodes acn
        join mp25m.nodes n
          on n.id = acn.node_id
        where acn.actor_candidate_id = ac.id
    ) x
) candidate_nodes on true
left join lateral (
    select
        array_agg(
            x.opportunity_id
            order by x.opportunity_title
        ) as opportunity_ids,
        array_agg(
            x.opportunity_title
            order by x.opportunity_title
        ) as opportunity_titles
    from (
        select distinct
            o.id as opportunity_id,
            o.title as opportunity_title
        from mp25m.audit_events ae
        join mp25m.opportunities o
          on o.id = ae.target_id
        where ae.action =
            'opportunity.origin_resolved'
          and ae.metadata ->>
              'actor_candidate_id' =
              ac.id::text
    ) x
) articulation_data on true
where ac.resolved_person_id is not null
  and ac.status in (
      'merged',
      'approved'
  );


create or replace view
mp25m_api.person_skill_list
with (security_invoker = true)
as
select
    ps.id as person_skill_id,
    ps.person_id,
    s.id as skill_id,
    s.name::text as skill_name,
    s.category_code::text as category_code,
    sc.name::text as category_name,
    ps.proficiency_level,
    ps.verification_status::text
        as verification_status,
    ps.experience_range::text
        as experience_range,
    ps.experience_notes,
    ps.notes,
    ps.last_self_reported_at,
    ps.active,
    ps.created_at,
    ps.updated_at
from mp25m.person_skills ps
join mp25m.skills s
  on s.id = ps.skill_id
left join mp25m.skill_categories sc
  on sc.code = s.category_code;


revoke all
on mp25m_api.person_profile
from public, anon, authenticated, service_role;

revoke all
on mp25m_api.person_territorial_profile
from public, anon, authenticated, service_role;

revoke all
on mp25m_api.person_articulation_list
from public, anon, authenticated, service_role;

revoke all
on mp25m_api.person_identity_aliases
from public, anon, authenticated, service_role;

revoke all
on mp25m_api.person_skill_list
from public, anon, authenticated, service_role;


grant select
on mp25m_api.person_profile
to service_role;

grant select
on mp25m_api.person_territorial_profile
to service_role;

grant select
on mp25m_api.person_articulation_list
to service_role;

grant select
on mp25m_api.person_identity_aliases
to service_role;

grant select
on mp25m_api.person_skill_list
to service_role;