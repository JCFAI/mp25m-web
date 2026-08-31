-- Incremento 6A - Habilidades y capacidades.
--
-- Expone un read model server-only para:
--   - directorio global de habilidades/capacidades;
--   - ficha global de una habilidad;
--   - aliases;
--   - personas, organizaciones y presencia territorial.
--
-- Todo es solo lectura. No se crean datos, no se editan skills
-- ni se agregan flujos de validacion.

begin;


-- ---------------------------------------------------------------------------
-- 1. OPCIONES DE CATEGORIA
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.skill_category_options
with (security_invoker = true)
as
select
  sc.code::text as code,

  sc.name::text as name,

  sc.description,

  sc.sort_order,

  coalesce(
    skill_stats.skill_count,
    0
  )::integer as skill_count

from mp25m.skill_categories sc

left join lateral (
  select
    count(*)::integer as skill_count

  from mp25m.skills s

  where s.category_code = sc.code

    and s.active = true
) skill_stats on true

where sc.active = true;


-- ---------------------------------------------------------------------------
-- 2. ALIASES DE HABILIDADES
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.skill_alias_list
with (security_invoker = true)
as
select
  s.id as skill_id,

  sa.id as alias_id,

  sa.alias::text as alias,

  sa.normalized_alias::text
    as normalized_alias

from mp25m.skill_aliases sa

join mp25m.skills s
  on s.id = sa.skill_id

where s.active = true;


-- ---------------------------------------------------------------------------
-- 3. PERSONAS ASOCIADAS A UNA HABILIDAD
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.skill_person_list
with (security_invoker = true)
as
select
  ps.skill_id,

  ps.id as person_skill_id,

  p.id as person_id,

  p.display_name::text as display_name,

  p.profession_text,

  ps.proficiency_level,

  ps.verification_status::text
    as verification_status,

  ps.experience_range::text
    as experience_range,

  ps.experience_notes,

  ps.notes,

  ps.last_self_reported_at,

  coalesce(
    node_data.node_ids,
    '{}'::uuid[]
  ) as node_ids,

  coalesce(
    node_data.node_numbers,
    '{}'::integer[]
  ) as node_numbers,

  coalesce(
    node_data.node_names,
    '{}'::text[]
  ) as node_names,

  ps.created_at,

  ps.updated_at

from mp25m.person_skills ps

join mp25m.persons p
  on p.id = ps.person_id

join mp25m.skills s
  on s.id = ps.skill_id

left join lateral (
  select
    array_agg(
      x.node_id
      order by x.node_name
    ) as node_ids,

    array_agg(
      x.node_number
      order by x.node_name
    ) as node_numbers,

    array_agg(
      x.node_name
      order by x.node_name
    ) as node_names

  from (
    select distinct
      n.id as node_id,

      n.node_number,

      regexp_replace(
        n.name::text,
        '^[Nn]odo[[:space:]]+',
        ''
      ) as node_name

    from mp25m.node_participations np

    join mp25m.nodes n
      on n.id = np.node_id

    where np.person_id = p.id

      and np.status = 'active'

      and np.verification_status =
        'confirmed'

      and (
        np.ended_on is null
        or np.ended_on >= current_date
      )

      and n.status = 'active'
  ) x
) node_data on true

where p.record_status = 'active'

  and ps.active = true

  and ps.verification_status <>
    'rejected'

  and s.active = true

  and s.applies_to_person = true;


-- ---------------------------------------------------------------------------
-- 4. ORGANIZACIONES ASOCIADAS A UNA HABILIDAD
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.skill_organization_capability_list
with (security_invoker = true)
as
select
  oc.skill_id,

  oc.id
    as organization_capability_id,

  o.id as organization_id,

  o.name::text
    as organization_name,

  o.organization_type_code,

  ot.name::text
    as organization_type_name,

  oc.node_id
    as scope_node_id,

  n.node_number
    as scope_node_number,

  case
    when oc.node_id is null
      then null
    else regexp_replace(
      n.name::text,
      '^[Nn]odo[[:space:]]+',
      ''
    )
  end as scope_node_name,

  oc.verification_status::text
    as verification_status,

  oc.notes,

  oc.source_id,

  ds.name::text
    as source_name,

  oc.ingestion_record_id,

  oc.last_self_reported_at,

  coalesce(
    evidence_stats.evidence_count,
    0
  )::integer
    as evidence_count,

  oc.created_at,

  oc.updated_at

from mp25m.organization_capabilities oc

join mp25m.organizations o
  on o.id = oc.organization_id

join mp25m.organization_types ot
  on ot.code =
    o.organization_type_code

join mp25m.skills s
  on s.id = oc.skill_id

left join mp25m.nodes n
  on n.id = oc.node_id

left join mp25m.data_sources ds
  on ds.id = oc.source_id

left join lateral (
  select
    count(*)::integer
      as evidence_count

  from mp25m.organization_capability_evidence oce

  where oce.organization_capability_id =
    oc.id
) evidence_stats on true

where oc.active = true

  and oc.verification_status <>
    'rejected'

  and o.record_status = 'active'

  and ot.is_active = true

  and s.active = true

  and s.applies_to_organization = true;


-- ---------------------------------------------------------------------------
-- 5. PRESENCIA TERRITORIAL DE UNA HABILIDAD
--
-- Las capacidades institucionales de organizaciones (node_id null)
-- no se proyectan ni inventan nodos en este directorio global.
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.skill_node_presence_list
with (security_invoker = true)
as
with person_node_presence as (
  select distinct
    ps.skill_id,

    np.node_id,

    ps.person_id,

    null::uuid as organization_id

  from mp25m.person_skills ps

  join mp25m.persons p
    on p.id = ps.person_id

  join mp25m.skills s
    on s.id = ps.skill_id

  join mp25m.node_participations np
    on np.person_id = ps.person_id

  join mp25m.nodes n
    on n.id = np.node_id

  where p.record_status = 'active'

    and ps.active = true

    and ps.verification_status <>
      'rejected'

    and s.active = true

    and s.applies_to_person = true

    and np.status = 'active'

    and np.verification_status =
      'confirmed'

    and (
      np.ended_on is null
      or np.ended_on >= current_date
    )

    and n.status = 'active'
),

organization_node_presence as (
  select distinct
    oc.skill_id,

    oc.node_id,

    null::uuid as person_id,

    oc.organization_id

  from mp25m.organization_capabilities oc

  join mp25m.organizations o
    on o.id = oc.organization_id

  join mp25m.organization_types ot
    on ot.code =
      o.organization_type_code

  join mp25m.skills s
    on s.id = oc.skill_id

  join mp25m.organization_nodes onode
    on onode.organization_id =
      oc.organization_id

   and onode.node_id = oc.node_id

  join mp25m.nodes n
    on n.id = oc.node_id

  where oc.node_id is not null

    and oc.active = true

    and oc.verification_status <>
      'rejected'

    and o.record_status = 'active'

    and ot.is_active = true

    and s.active = true

    and s.applies_to_organization = true

    and onode.active = true

    and onode.verification_status =
      'confirmed'

    and (
      onode.started_on is null
      or onode.started_on <= current_date
    )

    and (
      onode.ended_on is null
      or onode.ended_on >= current_date
    )

    and n.status = 'active'
),

combined_node_presence as (
  select *
  from person_node_presence

  union all

  select *
  from organization_node_presence
)

select
  cnp.skill_id,

  n.id as node_id,

  n.node_number,

  regexp_replace(
    n.name::text,
    '^[Nn]odo[[:space:]]+',
    ''
  ) as node_name,

  (
    count(distinct cnp.person_id)
    filter (
      where cnp.person_id is not null
    )
  )::integer as person_count,

  (
    count(distinct cnp.organization_id)
    filter (
      where cnp.organization_id is not null
    )
  )::integer as organization_count

from combined_node_presence cnp

join mp25m.nodes n
  on n.id = cnp.node_id

group by
  cnp.skill_id,
  n.id,
  n.node_number,
  n.name;


-- ---------------------------------------------------------------------------
-- 6. DIRECTORIO GLOBAL DE HABILIDADES
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.skill_directory
with (security_invoker = true)
as
select
  s.id,

  s.name::text as display_name,

  s.normalized_name::text
    as search_name,

  concat_ws(
    ' ',
    s.normalized_name::text,
    coalesce(
      alias_stats.alias_search_text,
      ''
    )
  ) as search_text,

  s.category_code::text
    as category_code,

  sc.name::text as category_name,

  s.description,

  s.applies_to_person,

  s.applies_to_organization,

  coalesce(
    person_stats.person_count,
    0
  )::integer as person_count,

  coalesce(
    organization_stats.organization_count,
    0
  )::integer as organization_count,

  coalesce(
    node_stats.node_count,
    0
  )::integer as node_count,

  coalesce(
    alias_stats.alias_count,
    0
  )::integer as alias_count,

  s.created_at,

  s.updated_at

from mp25m.skills s

left join mp25m.skill_categories sc
  on sc.code = s.category_code

left join lateral (
  select
    count(*)::integer
      as alias_count,

    string_agg(
      sa.normalized_alias::text,
      ' '
      order by sa.normalized_alias
    ) as alias_search_text

  from mp25m.skill_aliases sa

  where sa.skill_id = s.id
) alias_stats on true

left join lateral (
  select
    count(distinct spl.person_id)::integer
      as person_count

  from mp25m_api.skill_person_list spl

  where spl.skill_id = s.id
) person_stats on true

left join lateral (
  select
    count(
      distinct soc.organization_id
    )::integer as organization_count

  from mp25m_api.skill_organization_capability_list soc

  where soc.skill_id = s.id
) organization_stats on true

left join lateral (
  select
    count(*)::integer
      as node_count

  from mp25m_api.skill_node_presence_list snp

  where snp.skill_id = s.id
) node_stats on true

where s.active = true;


-- ---------------------------------------------------------------------------
-- 7. FICHA GLOBAL DE UNA HABILIDAD
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.skill_profile
with (security_invoker = true)
as
select
  sd.id,

  sd.display_name,

  sd.search_name,

  sd.category_code,

  sd.category_name,

  sd.description,

  sd.applies_to_person,

  sd.applies_to_organization,

  sd.person_count,

  sd.organization_count,

  sd.node_count,

  sd.alias_count,

  sd.created_at,

  sd.updated_at

from mp25m_api.skill_directory sd;


-- ---------------------------------------------------------------------------
-- 8. PRIVILEGIOS SERVER-ONLY
-- ---------------------------------------------------------------------------

revoke all privileges
on table
  mp25m_api.skill_category_options,
  mp25m_api.skill_alias_list,
  mp25m_api.skill_person_list,
  mp25m_api.skill_organization_capability_list,
  mp25m_api.skill_node_presence_list,
  mp25m_api.skill_directory,
  mp25m_api.skill_profile
from
  public,
  anon,
  authenticated,
  service_role;


grant select
on table
  mp25m_api.skill_category_options,
  mp25m_api.skill_alias_list,
  mp25m_api.skill_person_list,
  mp25m_api.skill_organization_capability_list,
  mp25m_api.skill_node_presence_list,
  mp25m_api.skill_directory,
  mp25m_api.skill_profile
to service_role;


comment on view mp25m_api.skill_category_options is
  'Categorias activas del catalogo de habilidades/capacidades para filtros internos.';

comment on view mp25m_api.skill_alias_list is
  'Aliases existentes de habilidades activas, expuestos solo para lectura interna.';

comment on view mp25m_api.skill_person_list is
  'Personas activas asociadas a habilidades activas, sin exigir credencial formal.';

comment on view mp25m_api.skill_organization_capability_list is
  'Capacidades organizacionales activas por habilidad, con alcance institucional o territorial.';

comment on view mp25m_api.skill_node_presence_list is
  'Presencia territorial de habilidades por personas confirmadas en nodos o capacidades organizacionales con nodo especifico y vinculo territorial confirmado.';

comment on view mp25m_api.skill_directory is
  'Directorio server-only de habilidades/capacidades activas con conteos desduplicados.';

comment on view mp25m_api.skill_profile is
  'Ficha server-only de una habilidad/capacidad activa.';


commit;
