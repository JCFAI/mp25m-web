-- Incremento 5A - Organizaciones.
--
-- Fortalece la relacion organizacion-nodo con validacion,
-- trazabilidad y vigencia.
--
-- Agrega vistas server-only para:
--   - directorio de organizaciones;
--   - ficha canonica;
--   - nodos;
--   - capacidades;
--   - articulaciones;
--   - tipos de organizacion.
--
-- No se crean datos ni se infieren organizaciones desde
-- vectores territoriales u otras evidencias textuales.

begin;


-- ---------------------------------------------------------------------------
-- 1. FORTALECER ORGANIZATION_NODES
-- ---------------------------------------------------------------------------

alter table mp25m.organization_nodes
  add column if not exists verification_status varchar(20)
    not null default 'pending',

  add column if not exists evidence_text text,

  add column if not exists source_id uuid
    references mp25m.data_sources(id)
    on delete set null,

  add column if not exists ingestion_record_id bigint
    references mp25m.ingestion_records(id)
    on delete set null,

  add column if not exists notes text,

  add column if not exists started_on date,

  add column if not exists ended_on date,

  add column if not exists active boolean
    not null default true,

  add column if not exists updated_at timestamptz
    not null default now();


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'organization_nodes_verification_status_check'
      and conrelid =
        'mp25m.organization_nodes'::regclass
  ) then
    alter table mp25m.organization_nodes
      add constraint
        organization_nodes_verification_status_check
      check (
        verification_status in (
          'pending',
          'confirmed',
          'rejected'
        )
      );
  end if;
end
$$;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'organization_nodes_dates_check'
      and conrelid =
        'mp25m.organization_nodes'::regclass
  ) then
    alter table mp25m.organization_nodes
      add constraint
        organization_nodes_dates_check
      check (
        ended_on is null
        or started_on is null
        or ended_on >= started_on
      );
  end if;
end
$$;


create index if not exists
idx_organization_nodes_node_status
on mp25m.organization_nodes (
  node_id,
  verification_status,
  active
);


create index if not exists
idx_organization_nodes_organization_status
on mp25m.organization_nodes (
  organization_id,
  verification_status,
  active
);


drop trigger if exists
trg_organization_nodes_updated_at
on mp25m.organization_nodes;


create trigger trg_organization_nodes_updated_at
before update on mp25m.organization_nodes
for each row
execute function mp25m.set_updated_at();


comment on table mp25m.organization_nodes is
  'Relacion territorial entre organizaciones y nodos, con validacion, trazabilidad y vigencia independientes.';


-- ---------------------------------------------------------------------------
-- 2. DIRECTORIO DE ORGANIZACIONES
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.organization_directory
with (security_invoker = true)
as
select
  o.id,

  o.name::text as display_name,

  o.normalized_name::text
    as search_name,

  o.organization_type_code,

  ot.name::text
    as organization_type_name,

  o.notes,

  o.record_status::text
    as record_status,

  coalesce(
    node_stats.confirmed_node_count,
    0
  )::integer as confirmed_node_count,

  coalesce(
    capability_stats.capability_count,
    0
  )::integer as capability_count

from mp25m.organizations o

join mp25m.organization_types ot
  on ot.code = o.organization_type_code

left join lateral (
  select
    count(*)::integer
      as confirmed_node_count

  from mp25m.organization_nodes onode

  join mp25m.nodes n
    on n.id = onode.node_id

  where onode.organization_id = o.id

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
) node_stats on true

left join lateral (
  select
    count(*)::integer
      as capability_count

  from mp25m.organization_capabilities oc

  join mp25m.skills s
    on s.id = oc.skill_id

  where oc.organization_id = o.id

    and oc.active = true

    and oc.verification_status <>
      'rejected'

    and s.active = true

    and s.applies_to_organization = true
) capability_stats on true

where o.record_status = 'active'

  and ot.is_active = true;


-- ---------------------------------------------------------------------------
-- 3. FICHA CANONICA DE ORGANIZACION
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.organization_profile
with (security_invoker = true)
as
select
  o.id,

  o.name::text as display_name,

  o.normalized_name::text
    as search_name,

  o.organization_type_code,

  ot.name::text
    as organization_type_name,

  o.notes,

  o.record_status::text
    as record_status,

  coalesce(
    node_stats.confirmed_node_count,
    0
  )::integer as confirmed_node_count,

  coalesce(
    capability_stats.capability_count,
    0
  )::integer as capability_count,

  coalesce(
    capability_stats.confirmed_capability_count,
    0
  )::integer
    as confirmed_capability_count,

  coalesce(
    articulation_stats.articulation_count,
    0
  )::integer
    as articulation_count,

  o.created_at,
  o.updated_at

from mp25m.organizations o

join mp25m.organization_types ot
  on ot.code = o.organization_type_code

left join lateral (
  select
    count(*)::integer
      as confirmed_node_count

  from mp25m.organization_nodes onode

  join mp25m.nodes n
    on n.id = onode.node_id

  where onode.organization_id = o.id

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
) node_stats on true

left join lateral (
  select
    count(*)::integer
      as capability_count,

    (
      count(*)
      filter (
        where oc.verification_status =
          'confirmed'
      )
    )::integer
      as confirmed_capability_count

  from mp25m.organization_capabilities oc

  join mp25m.skills s
    on s.id = oc.skill_id

  where oc.organization_id = o.id

    and oc.active = true

    and oc.verification_status <>
      'rejected'

    and s.active = true

    and s.applies_to_organization = true
) capability_stats on true

left join lateral (
  select
    count(
      distinct oo.opportunity_id
    )::integer
      as articulation_count

  from mp25m.opportunity_origins oo

  where oo.organization_id = o.id
) articulation_stats on true

where o.record_status = 'active'

  and ot.is_active = true;


-- ---------------------------------------------------------------------------
-- 4. NODOS DE UNA ORGANIZACION
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.organization_node_list
with (security_invoker = true)
as
select
  onode.organization_id,

  n.id as node_id,

  n.node_number,

  regexp_replace(
    n.name::text,
    '^[Nn]odo[[:space:]]+',
    ''
  ) as node_name,

  onode.verification_status::text
    as verification_status,

  onode.evidence_text,

  onode.source_id,

  ds.name::text
    as source_name,

  onode.ingestion_record_id,

  onode.notes,

  onode.started_on,

  onode.ended_on,

  onode.created_at,

  onode.updated_at

from mp25m.organization_nodes onode

join mp25m.nodes n
  on n.id = onode.node_id

left join mp25m.data_sources ds
  on ds.id = onode.source_id

where onode.active = true

  and onode.verification_status <>
    'rejected'

  and (
    onode.started_on is null
    or onode.started_on <= current_date
  )

  and (
    onode.ended_on is null
    or onode.ended_on >= current_date
  )

  and n.status = 'active';


-- ---------------------------------------------------------------------------
-- 5. CAPACIDADES DE UNA ORGANIZACION
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.organization_capability_list
with (security_invoker = true)
as
select
  oc.organization_id,

  oc.id
    as organization_capability_id,

  s.id as skill_id,

  s.name::text
    as capability_name,

  s.normalized_name::text
    as capability_search_name,

  s.category_code::text
    as category_code,

  sc.name::text
    as category_name,

  oc.node_id
    as scope_node_id,

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

join mp25m.skills s
  on s.id = oc.skill_id

left join mp25m.skill_categories sc
  on sc.code = s.category_code

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

  and s.active = true

  and s.applies_to_organization = true;


-- ---------------------------------------------------------------------------
-- 6. ARTICULACIONES DE UNA ORGANIZACION
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.organization_articulation_list
with (security_invoker = true)
as
select
  oo.organization_id,

  o.id as opportunity_id,

  o.title,

  o.description,

  o.kind,

  o.status,

  o.priority,

  o.due_date,

  o.resolved_at,

  o.created_at,

  o.updated_at

from mp25m.opportunity_origins oo

join mp25m.opportunities o
  on o.id = oo.opportunity_id

where oo.organization_id is not null;


-- ---------------------------------------------------------------------------
-- 7. TIPOS DE ORGANIZACION
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.organization_type_options
with (security_invoker = true)
as
select
  ot.code,

  ot.name::text as name,

  ot.display_order

from mp25m.organization_types ot

where ot.is_active = true;


-- ---------------------------------------------------------------------------
-- 8. CORREGIR ORGANIZACIONES MOSTRADAS EN LA FICHA DEL NODO
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.node_organization_list
with (security_invoker = true)
as
select
  organization_node.node_id,

  organization_record.id
    as organization_id,

  organization_record.name::text
    as organization_name,

  organization_record.organization_type_code,

  organization_type.name::text
    as organization_type_name,

  organization_record.notes,

  organization_record.record_status::text
    as record_status

from mp25m.organization_nodes
  organization_node

join mp25m.organizations
  organization_record
  on organization_record.id =
    organization_node.organization_id

join mp25m.organization_types
  organization_type
  on organization_type.code =
    organization_record.organization_type_code

where organization_record.record_status =
    'active'

  and organization_type.is_active = true

  and organization_node.active = true

  and organization_node.verification_status =
    'confirmed'

  and (
    organization_node.started_on is null
    or organization_node.started_on <=
      current_date
  )

  and (
    organization_node.ended_on is null
    or organization_node.ended_on >=
      current_date
  );


-- ---------------------------------------------------------------------------
-- 8B. CORREGIR CONTEO DE ORGANIZACIONES EN NODE_PROFILE
--
-- Solo cuentan organizaciones con vínculo territorial:
--   - activo;
--   - confirmado;
--   - vigente.
-- ---------------------------------------------------------------------------

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
    j.name::text
      as jurisdiction_name,

    jt.name::text
      as jurisdiction_type_name

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
    count(
      distinct np.person_id
    )::integer
      as confirmed_people_count

  from mp25m.node_participations np

  join mp25m.persons p
    on p.id = np.person_id

  where np.node_id = n.id

    and np.status = 'active'

    and np.verification_status =
      'confirmed'

    and (
      np.ended_on is null
      or np.ended_on >= current_date
    )

    and p.record_status = 'active'
) people_stats on true

left join lateral (
  select
    count(
      distinct np.person_id
    )::integer
      as people_with_skills_count,

    count(
      distinct ps.skill_id
    )::integer
      as reported_skill_count,

    (
      count(
        distinct ps.skill_id
      )
      filter (
        where ps.verification_status =
          'confirmed'
      )
    )::integer
      as confirmed_skill_count

  from mp25m.node_participations np

  join mp25m.persons p
    on p.id = np.person_id

  join mp25m.person_skills ps
    on ps.person_id = p.id

  join mp25m.skills s
    on s.id = ps.skill_id

  where np.node_id = n.id

    and np.status = 'active'

    and np.verification_status =
      'confirmed'

    and (
      np.ended_on is null
      or np.ended_on >= current_date
    )

    and p.record_status = 'active'

    and ps.active = true

    and ps.verification_status <>
      'rejected'

    and s.active = true

    and s.applies_to_person = true
) skill_stats on true

left join lateral (
  select
    count(*)::integer
      as articulation_count

  from mp25m.opportunity_nodes
    opportunity_node

  where opportunity_node.node_id =
    n.id
) articulation_stats on true

left join lateral (
  select
    count(*)::integer
      as organization_count

  from mp25m.organization_nodes
    organization_node

  join mp25m.organizations
    organization_record
    on organization_record.id =
      organization_node.organization_id

  where organization_node.node_id =
      n.id

    and organization_node.active = true

    and organization_node.verification_status =
      'confirmed'

    and (
      organization_node.started_on is null
      or organization_node.started_on <=
        current_date
    )

    and (
      organization_node.ended_on is null
      or organization_node.ended_on >=
        current_date
    )

    and organization_record.record_status =
      'active'
) organization_stats on true;

-- ---------------------------------------------------------------------------
-- 9. CORREGIR PROYECCION DE CAPACIDADES ORGANIZACIONALES AL NODO
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.node_organization_capability_list
with (security_invoker = true)
as
select
  coalesce(
    oc.node_id,
    organization_node.node_id
  ) as node_id,

  o.id as organization_id,

  o.name::text
    as organization_name,

  o.organization_type_code,

  ot.name::text
    as organization_type_name,

  oc.id
    as organization_capability_id,

  s.id as skill_id,

  s.name::text
    as capability_name,

  s.normalized_name::text
    as capability_search_name,

  s.category_code::text
    as category_code,

  sc.name::text
    as category_name,

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

left join mp25m.skill_categories sc
  on sc.code = s.category_code

left join mp25m.data_sources ds
  on ds.id = oc.source_id

join mp25m.organization_nodes
  organization_node
  on organization_node.organization_id =
      o.id

 and (
   oc.node_id is null
   or organization_node.node_id =
     oc.node_id
 )

 and organization_node.active = true

 and organization_node.verification_status =
      'confirmed'

 and (
   organization_node.started_on is null
   or organization_node.started_on <=
     current_date
 )

 and (
   organization_node.ended_on is null
   or organization_node.ended_on >=
     current_date
 )

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

  and s.applies_to_organization = true
;


-- ---------------------------------------------------------------------------
-- 10. PRIVILEGIOS SERVER-ONLY
-- ---------------------------------------------------------------------------

revoke all privileges
on table
  mp25m_api.organization_directory,
  mp25m_api.organization_profile,
  mp25m_api.organization_node_list,
  mp25m_api.organization_capability_list,
  mp25m_api.organization_articulation_list,
  mp25m_api.organization_type_options
from
  public,
  anon,
  authenticated,
  service_role;


grant select
on table
  mp25m_api.organization_directory,
  mp25m_api.organization_profile,
  mp25m_api.organization_node_list,
  mp25m_api.organization_capability_list,
  mp25m_api.organization_articulation_list,
  mp25m_api.organization_type_options
to service_role;


comment on view
mp25m_api.organization_directory is
  'Directorio server-only de organizaciones canonicas activas.';

comment on view
mp25m_api.organization_profile is
  'Ficha server-only de organizaciones canonicas activas.';

comment on view
mp25m_api.organization_node_list is
  'Vinculos territoriales vigentes de organizaciones, preservando validacion y trazabilidad.';

comment on view
mp25m_api.organization_capability_list is
  'Capacidades vigentes de una organizacion, con alcance general o territorial.';

comment on view
mp25m_api.organization_articulation_list is
  'Oportunidades y necesidades donde la organizacion figura como origen.';

commit;