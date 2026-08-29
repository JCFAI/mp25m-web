-- Incremento 4 - Mapa de capacidades.
--
-- Integra tres dimensiones:
--   1. vectores territoriales del nodo;
--   2. capacidades/habilidades de personas;
--   3. capacidades de organizaciones.
--
-- El catálogo mp25m.skills se conserva por compatibilidad,
-- pero conceptualmente funciona como catálogo común de capacidades.
--
-- Las capacidades de personas y organizaciones mantienen
-- estados de validación independientes y trazabilidad de evidencia.

begin;


-- ---------------------------------------------------------------------------
-- 1. CATÁLOGO COMÚN DE CAPACIDADES
-- ---------------------------------------------------------------------------

alter table mp25m.skills
  add column if not exists applies_to_person boolean
    not null default true,
  add column if not exists applies_to_organization boolean
    not null default false;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'skills_applies_to_some_actor_check'
      and conrelid = 'mp25m.skills'::regclass
  ) then
    alter table mp25m.skills
      add constraint skills_applies_to_some_actor_check
      check (
        applies_to_person = true
        or applies_to_organization = true
      );
  end if;
end
$$;


comment on column mp25m.skills.applies_to_person is
  'La capacidad puede asignarse a personas mediante person_skills.';

comment on column mp25m.skills.applies_to_organization is
  'La capacidad puede asignarse a organizaciones mediante organization_capabilities.';


-- ---------------------------------------------------------------------------
-- 2. CAPACIDADES DE ORGANIZACIONES
-- ---------------------------------------------------------------------------

create table if not exists mp25m.organization_capabilities (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references mp25m.organizations(id)
    on delete restrict,

  skill_id uuid not null
    references mp25m.skills(id)
    on delete restrict,

  -- NULL significa capacidad institucional/general.
  -- Con valor significa capacidad disponible o relevante
  -- específicamente en ese nodo.
  node_id uuid
    references mp25m.nodes(id)
    on delete restrict,

  verification_status varchar(20)
    not null default 'self_reported'
    check (
      verification_status in (
        'self_reported',
        'candidate',
        'confirmed',
        'rejected'
      )
    ),

  notes text,

  source_id uuid
    references mp25m.data_sources(id)
    on delete set null,

  ingestion_record_id bigint
    references mp25m.ingestion_records(id)
    on delete set null,

  last_self_reported_at timestamptz,

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create unique index if not exists
ux_organization_capabilities_scope
on mp25m.organization_capabilities (
  organization_id,
  skill_id,
  coalesce(
    node_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  )
);


create index if not exists
idx_organization_capabilities_organization
on mp25m.organization_capabilities(organization_id);


create index if not exists
idx_organization_capabilities_skill
on mp25m.organization_capabilities(skill_id);


create index if not exists
idx_organization_capabilities_node
on mp25m.organization_capabilities(node_id);


create index if not exists
idx_organization_capabilities_status
on mp25m.organization_capabilities(verification_status);


drop trigger if exists
trg_organization_capabilities_updated_at
on mp25m.organization_capabilities;


create trigger trg_organization_capabilities_updated_at
before update on mp25m.organization_capabilities
for each row
execute function mp25m.set_updated_at();


comment on table mp25m.organization_capabilities is
  'Capacidades atribuidas a organizaciones, opcionalmente acotadas a un nodo territorial.';


-- ---------------------------------------------------------------------------
-- 3. EVIDENCIA DE CAPACIDADES ORGANIZACIONALES
-- ---------------------------------------------------------------------------

create table if not exists
mp25m.organization_capability_evidence (
  id uuid primary key default gen_random_uuid(),

  organization_capability_id uuid not null
    references mp25m.organization_capabilities(id)
    on delete cascade,

  source_id uuid
    references mp25m.data_sources(id)
    on delete set null,

  ingestion_record_id bigint
    references mp25m.ingestion_records(id)
    on delete set null,

  evidence_type varchar(30)
    not null
    check (
      evidence_type in (
        'self_reported',
        'source_record',
        'document',
        'site_visit',
        'admin_validation',
        'other'
      )
    ),

  evidence_text text not null,

  confidence numeric(4,3)
    check (
      confidence is null
      or confidence between 0 and 1
    ),

  created_at timestamptz not null default now()
);


create index if not exists
idx_organization_capability_evidence_capability
on mp25m.organization_capability_evidence(
  organization_capability_id
);


create index if not exists
idx_organization_capability_evidence_ingestion
on mp25m.organization_capability_evidence(
  ingestion_record_id
);


comment on table
mp25m.organization_capability_evidence is
  'Evidencia y trazabilidad utilizada para sostener o validar una capacidad organizacional.';


-- ---------------------------------------------------------------------------
-- 4. CORREGIR RESUMEN DE CAPACIDADES DE PERSONAS
--
-- person_skills no posee estado "pending".
-- Los estados reales son:
-- self_reported / candidate / confirmed / rejected.
--
-- pending_person_count se conserva temporalmente por compatibilidad
-- y equivale a candidate_person_count.
-- ---------------------------------------------------------------------------

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
      where ps.verification_status = 'confirmed'
    )
  )::integer as confirmed_person_count,

  (
    count(distinct p.id)
    filter (
      where ps.verification_status = 'candidate'
    )
  )::integer as pending_person_count,

  (
    count(distinct p.id)
    filter (
      where ps.verification_status = 'self_reported'
    )
  )::integer as self_reported_person_count,

  (
    count(distinct p.id)
    filter (
      where ps.verification_status = 'candidate'
    )
  )::integer as candidate_person_count,

  (
    count(distinct p.id)
    filter (
      where ps.verification_status in (
        'self_reported',
        'candidate'
      )
    )
  )::integer as unconfirmed_person_count

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

  and s.applies_to_person = true

group by
  np.node_id,
  s.id,
  s.name,
  s.normalized_name,
  s.category_code,
  sc.name;


-- ---------------------------------------------------------------------------
-- 5. VECTORES TERRITORIALES DEL NODO
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.node_vector_list
with (security_invoker = true)
as
select
  nv.node_id,

  v.id as vector_id,
  v.name::text as vector_name,
  v.normalized_name::text as vector_search_name,

  nv.verification_status::text
    as verification_status,

  nv.evidence_text,

  nv.source_id,

  ds.name::text as source_name,

  nv.created_at,
  nv.updated_at

from mp25m.node_vectors nv

join mp25m.vectors v
  on v.id = nv.vector_id

left join mp25m.data_sources ds
  on ds.id = nv.source_id

where v.active = true
  and nv.verification_status <> 'rejected';


-- ---------------------------------------------------------------------------
-- 6. PERSONAS Y CAPACIDADES POR NODO
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.node_person_capability_list
with (security_invoker = true)
as
select
  np.node_id,

  p.id as person_id,
  p.display_name::text as display_name,

  ps.id as person_skill_id,

  s.id as skill_id,
  s.name::text as skill_name,
  s.normalized_name::text as skill_search_name,

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

  coalesce(
    other_nodes.other_node_ids,
    '{}'::uuid[]
  ) as other_node_ids,

  coalesce(
    other_nodes.other_node_names,
    '{}'::text[]
  ) as other_node_names

from mp25m.node_participations np

join mp25m.persons p
  on p.id = np.person_id

join mp25m.person_skills ps
  on ps.person_id = p.id

join mp25m.skills s
  on s.id = ps.skill_id

left join mp25m.skill_categories sc
  on sc.code = s.category_code

left join lateral (
  select
    array_agg(
      distinct other_node.id
      order by other_node.id
    ) as other_node_ids,

    array_agg(
      distinct regexp_replace(
        other_node.name::text,
        '^[Nn]odo[[:space:]]+',
        ''
      )
      order by regexp_replace(
        other_node.name::text,
        '^[Nn]odo[[:space:]]+',
        ''
      )
    ) as other_node_names

  from mp25m.node_participations other_np

  join mp25m.nodes other_node
    on other_node.id = other_np.node_id

  where other_np.person_id = p.id

    and other_np.node_id <> np.node_id

    and other_np.status = 'active'

    and other_np.verification_status = 'confirmed'

    and (
      other_np.ended_on is null
      or other_np.ended_on >= current_date
    )

    and other_node.status = 'active'
) other_nodes on true

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

  and s.applies_to_person = true;


-- ---------------------------------------------------------------------------
-- 7. ORGANIZACIONES Y CAPACIDADES POR NODO
--
-- Una capacidad con node_id:
--   se muestra solamente en ese nodo.
--
-- Una capacidad sin node_id:
--   se proyecta a todos los nodos con los que la organización
--   tenga una relación organization_nodes.
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
  o.name::text as organization_name,

  o.organization_type_code,

  ot.name::text
    as organization_type_name,

  oc.id as organization_capability_id,

  s.id as skill_id,
  s.name::text as capability_name,
  s.normalized_name::text
    as capability_search_name,

  s.category_code::text as category_code,
  sc.name::text as category_name,

  oc.verification_status::text
    as verification_status,

  oc.notes,

  oc.source_id,
  ds.name::text as source_name,

  oc.ingestion_record_id,

  oc.last_self_reported_at,

  coalesce(
    evidence_stats.evidence_count,
    0
  )::integer as evidence_count,

  oc.created_at,
  oc.updated_at

from mp25m.organization_capabilities oc

join mp25m.organizations o
  on o.id = oc.organization_id

join mp25m.organization_types ot
  on ot.code = o.organization_type_code

join mp25m.skills s
  on s.id = oc.skill_id

left join mp25m.skill_categories sc
  on sc.code = s.category_code

left join mp25m.data_sources ds
  on ds.id = oc.source_id

left join mp25m.organization_nodes organization_node
  on organization_node.organization_id = o.id
 and oc.node_id is null

left join lateral (
  select
    count(*)::integer as evidence_count

  from mp25m.organization_capability_evidence oce

  where oce.organization_capability_id = oc.id
) evidence_stats on true

where oc.active = true

  and oc.verification_status <> 'rejected'

  and o.record_status = 'active'

  and ot.is_active = true

  and s.active = true

  and s.applies_to_organization = true

  and (
    oc.node_id is not null
    or organization_node.node_id is not null
  );


-- ---------------------------------------------------------------------------
-- 8. PRIVILEGIOS DE LECTURA SERVER-ONLY
-- ---------------------------------------------------------------------------

revoke all privileges
on table
  mp25m_api.node_vector_list,
  mp25m_api.node_person_capability_list,
  mp25m_api.node_organization_capability_list
from public, anon, authenticated, service_role;


grant select
on table
  mp25m_api.node_vector_list,
  mp25m_api.node_person_capability_list,
  mp25m_api.node_organization_capability_list
to service_role;


-- Refrescar explícitamente acceso a las nuevas tablas.
revoke all privileges
on table
  mp25m.organization_capabilities,
  mp25m.organization_capability_evidence
from public, anon, authenticated;


grant select, insert, update, delete
on table
  mp25m.organization_capabilities,
  mp25m.organization_capability_evidence
to service_role;


comment on view mp25m_api.node_vector_list is
  'Vectores territoriales activos asociados a cada nodo, preservando estado de validación y evidencia.';

comment on view mp25m_api.node_person_capability_list is
  'Capacidades de personas con participación territorial confirmada, incluyendo nivel, experiencia, validación y otros nodos.';

comment on view mp25m_api.node_organization_capability_list is
  'Capacidades organizacionales disponibles en cada nodo, incluyendo capacidades institucionales y capacidades específicas del territorio.';


commit;