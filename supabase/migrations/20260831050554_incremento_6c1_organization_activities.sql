-- Incremento 6C.1 - Actividades de organizaciones.
--
-- Agrega un catalogo canonico de actividades institucionales y una capa
-- de sugerencias hacia capacidades. Las actividades orientan la carga:
-- no crean ni confirman capacidades automaticamente.

begin;


-- ---------------------------------------------------------------------------
-- 1. MODELO NORMALIZADO DE ACTIVIDADES
-- ---------------------------------------------------------------------------

create table if not exists mp25m.activities (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  normalized_name text not null,

  description text,

  active boolean not null default true,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint activities_name_length_check
    check (
      char_length(btrim(name)) between 2 and 200
    ),

  constraint activities_normalized_name_check
    check (
      mp25m_private.normalize_text(name) is not null
      and normalized_name =
        mp25m_private.normalize_text(name)
    )
);


create unique index if not exists
activities_normalized_name_idx
on mp25m.activities(normalized_name);


drop trigger if exists trg_activities_updated_at
on mp25m.activities;


create trigger trg_activities_updated_at
before update on mp25m.activities
for each row
execute function mp25m.set_updated_at();


create table if not exists mp25m.organization_activities (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references mp25m.organizations(id)
    on delete restrict,

  activity_id uuid not null
    references mp25m.activities(id)
    on delete restrict,

  verification_status text not null default 'candidate'
    check (
      verification_status in (
        'self_reported',
        'candidate',
        'confirmed',
        'rejected'
      )
    ),

  notes text,

  active boolean not null default true,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint organization_activities_unique_activity
    unique (organization_id, activity_id)
);


create index if not exists
organization_activities_organization_idx
on mp25m.organization_activities(organization_id);


create index if not exists
organization_activities_activity_idx
on mp25m.organization_activities(activity_id);


create index if not exists
organization_activities_status_idx
on mp25m.organization_activities(verification_status);


drop trigger if exists trg_organization_activities_updated_at
on mp25m.organization_activities;


create trigger trg_organization_activities_updated_at
before update on mp25m.organization_activities
for each row
execute function mp25m.set_updated_at();


create table if not exists mp25m.activity_skill_suggestions (
  activity_id uuid not null
    references mp25m.activities(id)
    on delete cascade,

  skill_id uuid not null
    references mp25m.skills(id)
    on delete cascade,

  sort_order integer not null default 0
    check (sort_order >= 0),

  active boolean not null default true,

  created_at timestamptz not null default now(),

  primary key (activity_id, skill_id)
);


create index if not exists
activity_skill_suggestions_skill_idx
on mp25m.activity_skill_suggestions(skill_id);


create table if not exists mp25m.organization_activity_proposals (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references mp25m.organizations(id)
    on delete cascade,

  proposed_name text not null,

  normalized_name text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'mapped',
        'rejected'
      )
    ),

  resolved_activity_id uuid
    references mp25m.activities(id)
    on delete restrict,

  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  resolved_by_internal_user_id uuid
    references mp25m.internal_users(id)
    on delete restrict,

  resolution_reason text,

  created_at timestamptz not null default now(),

  resolved_at timestamptz,

  constraint organization_activity_proposals_name_length_check
    check (
      char_length(btrim(proposed_name))
        between 2 and 200
    ),

  constraint organization_activity_proposals_normalized_name_check
    check (
      mp25m_private.normalize_text(proposed_name) is not null
      and normalized_name =
        mp25m_private.normalize_text(proposed_name)
    ),

  constraint organization_activity_proposals_reason_length_check
    check (
      resolution_reason is null
      or char_length(btrim(resolution_reason))
        between 3 and 2000
    ),

  constraint organization_activity_proposals_resolution_check
    check (
      (
        status = 'pending'
        and resolved_activity_id is null
        and resolved_by_internal_user_id is null
        and resolution_reason is null
        and resolved_at is null
      )
      or (
        status = 'mapped'
        and resolved_activity_id is not null
        and resolved_by_internal_user_id is not null
        and resolution_reason is not null
        and resolved_at is not null
      )
      or (
        status = 'rejected'
        and resolved_activity_id is null
        and resolved_by_internal_user_id is not null
        and resolution_reason is not null
        and resolved_at is not null
      )
    )
);


create unique index if not exists
organization_activity_proposals_one_pending_name_per_org_idx
on mp25m.organization_activity_proposals(
  organization_id,
  normalized_name
)
where status = 'pending';


create index if not exists
organization_activity_proposals_organization_status_idx
on mp25m.organization_activity_proposals(
  organization_id,
  status,
  created_at desc
);


alter table mp25m.activities
  enable row level security;


alter table mp25m.organization_activities
  enable row level security;


alter table mp25m.activity_skill_suggestions
  enable row level security;


alter table mp25m.organization_activity_proposals
  enable row level security;


revoke all
on table
  mp25m.activities,
  mp25m.organization_activities,
  mp25m.activity_skill_suggestions,
  mp25m.organization_activity_proposals
from public, anon, authenticated, service_role;


grant select
on table
  mp25m.activities,
  mp25m.activity_skill_suggestions
to service_role;


grant select, insert, update
on table
  mp25m.organization_activities
to service_role;


grant select, insert
on table
  mp25m.organization_activity_proposals
to service_role;


-- ---------------------------------------------------------------------------
-- 2. CATALOGO INICIAL Y SUGERENCIAS
-- ---------------------------------------------------------------------------

with activity_seed(name, description) as (
  values
    (
      'Fabricación de piezas',
      'Produccion institucional de piezas o componentes.'
    ),
    (
      'Metalmecánica',
      'Actividad productiva metalmecanica.'
    ),
    (
      'Producción de alimentos',
      'Elaboracion o produccion de alimentos.'
    ),
    (
      'Distribución de alimentos',
      'Distribucion, abastecimiento o logistica de alimentos.'
    ),
    (
      'Producción agropecuaria',
      'Produccion primaria agropecuaria.'
    ),
    (
      'Construcción',
      'Servicios u obras de construccion.'
    ),
    (
      'Servicios de ingeniería',
      'Servicios profesionales de ingenieria.'
    ),
    (
      'Servicios informáticos y digitales',
      'Servicios tecnologicos, informaticos o digitales.'
    ),
    (
      'Automatización industrial',
      'Automatizacion de procesos o sistemas industriales.'
    ),
    (
      'Consultoría',
      'Consultoria tecnica, organizacional o institucional.'
    ),
    (
      'Capacitación y formación',
      'Formacion, capacitacion o transferencia de conocimientos.'
    ),
    (
      'Gestión de proyectos',
      'Gestion, coordinacion o seguimiento de proyectos.'
    ),
    (
      'Logística y distribución',
      'Gestion logistica o distribucion de bienes.'
    ),
    (
      'Producción cultural',
      'Produccion de bienes, servicios o actividades culturales.'
    ),
    (
      'Servicios energéticos',
      'Servicios vinculados con energia.'
    ),
    (
      'Articulación territorial',
      'Articulacion institucional en territorio.'
    )
)
insert into mp25m.activities (
  name,
  normalized_name,
  description,
  active
)
select
  activity_seed.name,
  mp25m_private.normalize_text(activity_seed.name),
  activity_seed.description,
  true
from activity_seed
on conflict (normalized_name) do update
set active = true,
    description = coalesce(
      mp25m.activities.description,
      excluded.description
    );


do $$
declare
  v_skill_names text[] := array[
    'Automatización industrial',
    'Desarrollo de productos',
    'Digitalización',
    'Ingeniería de procesos',
    'Ingeniería de productos',
    'Seguridad industrial',
    'Transformación digital',
    'Distribución de alimentos',
    'Fabricación de piezas',
    'Metalmecánica',
    'Consultoría',
    'Gestión cooperativa',
    'Gestión de procesos',
    'Gestión de proyectos',
    'Planificación',
    'Capacitación',
    'Articulación territorial',
    'Desarrollo territorial',
    'Construcción',
    'Producción de alimentos agroecológicos',
    'Producción granaria',
    'Industrias culturales',
    'Energía',
    'Alimentos'
  ];
  v_expected_count integer :=
    array_length(v_skill_names, 1);
  v_matched_count integer;
  v_updated_count integer;
  v_missing_names text[];
  v_person_disabled_names text[];
begin
  with expected_skills as (
    select
      skill_name,
      mp25m_private.normalize_text(skill_name)
        as normalized_name
    from unnest(v_skill_names) as seed(skill_name)
  )
  select
    count(s.id)::integer,
    coalesce(
      array_agg(es.skill_name order by es.skill_name)
        filter (where s.id is null),
      '{}'::text[]
    ),
    coalesce(
      array_agg(s.name::text order by s.name)
        filter (
          where s.id is not null
            and s.applies_to_person is distinct from true
        ),
      '{}'::text[]
    )
  into
    v_matched_count,
    v_missing_names,
    v_person_disabled_names
  from expected_skills es
  left join mp25m.skills s
    on s.normalized_name::text = es.normalized_name;

  if v_matched_count <> v_expected_count then
    raise exception
      'Expected % organization skill seeds, found %. Missing: %',
      v_expected_count,
      v_matched_count,
      array_to_string(v_missing_names, ', ')
      using errcode = 'P0002';
  end if;

  if array_length(v_person_disabled_names, 1) is not null then
    raise exception
      'Organization skill seeds must keep applies_to_person = true. Invalid skills: %',
      array_to_string(v_person_disabled_names, ', ')
      using errcode = '22023';
  end if;

  with expected_skills as (
    select
      mp25m_private.normalize_text(skill_name)
        as normalized_name
    from unnest(v_skill_names) as seed(skill_name)
  )
  update mp25m.skills s
  set applies_to_organization = true
  from expected_skills es
  where s.normalized_name::text =
      es.normalized_name;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> v_expected_count then
    raise exception
      'Expected to update % organization skill seeds, updated %',
      v_expected_count,
      v_updated_count
      using errcode = 'P0002';
  end if;
end;
$$;


with suggestion_seed(activity_name, skill_name, sort_order) as (
  values
    ('Fabricación de piezas', 'Fabricación de piezas', 10),
    ('Fabricación de piezas', 'Ingeniería de productos', 20),
    ('Fabricación de piezas', 'Desarrollo de productos', 30),
    ('Metalmecánica', 'Metalmecánica', 10),
    ('Metalmecánica', 'Fabricación de piezas', 20),
    ('Metalmecánica', 'Seguridad industrial', 30),
    ('Producción de alimentos', 'Alimentos', 10),
    (
      'Distribución de alimentos',
      'Distribución de alimentos',
      10
    ),
    (
      'Distribución de alimentos',
      'Gestión de procesos',
      20
    ),
    ('Producción agropecuaria', 'Alimentos', 10),
    ('Construcción', 'Construcción', 10),
    ('Construcción', 'Seguridad industrial', 20),
    ('Construcción', 'Planificación', 30),
    ('Servicios de ingeniería', 'Ingeniería de procesos', 10),
    ('Servicios de ingeniería', 'Ingeniería de productos', 20),
    ('Servicios de ingeniería', 'Desarrollo de productos', 30),
    ('Servicios de ingeniería', 'Consultoría', 40),
    ('Servicios informáticos y digitales', 'Digitalización', 10),
    (
      'Servicios informáticos y digitales',
      'Transformación digital',
      20
    ),
    (
      'Automatización industrial',
      'Automatización industrial',
      10
    ),
    (
      'Automatización industrial',
      'Ingeniería de procesos',
      20
    ),
    ('Consultoría', 'Consultoría', 10),
    ('Consultoría', 'Planificación', 20),
    ('Consultoría', 'Gestión de proyectos', 30),
    ('Capacitación y formación', 'Capacitación', 10),
    ('Gestión de proyectos', 'Gestión de proyectos', 10),
    ('Gestión de proyectos', 'Planificación', 20),
    (
      'Logística y distribución',
      'Gestión de procesos',
      10
    ),
    ('Producción cultural', 'Industrias culturales', 10),
    ('Servicios energéticos', 'Energía', 10),
    ('Servicios energéticos', 'Seguridad industrial', 20),
    (
      'Articulación territorial',
      'Articulación territorial',
      10
    ),
    (
      'Articulación territorial',
      'Desarrollo territorial',
      20
    ),
    (
      'Articulación territorial',
      'Gestión cooperativa',
      30
    )
)
insert into mp25m.activity_skill_suggestions (
  activity_id,
  skill_id,
  sort_order,
  active
)
select
  a.id,
  s.id,
  ss.sort_order,
  true
from suggestion_seed ss
join mp25m.activities a
  on a.normalized_name =
    mp25m_private.normalize_text(ss.activity_name)
join mp25m.skills s
  on s.normalized_name::text =
    mp25m_private.normalize_text(ss.skill_name)
where a.active = true
  and s.active = true
  and s.applies_to_organization = true
on conflict (activity_id, skill_id) do update
set sort_order = excluded.sort_order,
    active = true;


-- ---------------------------------------------------------------------------
-- 3. LECTURAS SERVER-ONLY
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.activity_directory
with (security_invoker = true)
as
select
  a.id,

  a.name::text as display_name,

  a.normalized_name::text as search_name,

  a.normalized_name::text as search_text,

  a.description,

  coalesce(
    organization_stats.organization_count,
    0
  )::integer as organization_count,

  coalesce(
    suggestion_stats.suggested_skill_count,
    0
  )::integer as suggested_skill_count,

  a.created_at,

  a.updated_at

from mp25m.activities a

left join lateral (
  select
    count(distinct oa.organization_id)::integer
      as organization_count

  from mp25m.organization_activities oa

  join mp25m.organizations o
    on o.id = oa.organization_id

  where oa.activity_id = a.id
    and oa.active = true
    and oa.verification_status <> 'rejected'
    and o.record_status = 'active'
) organization_stats on true

left join lateral (
  select
    count(*)::integer as suggested_skill_count

  from mp25m.activity_skill_suggestions ass

  join mp25m.skills s
    on s.id = ass.skill_id

  where ass.activity_id = a.id
    and ass.active = true
    and s.active = true
    and s.applies_to_organization = true
) suggestion_stats on true

where a.active = true;


create or replace view
mp25m_api.organization_activity_list
with (security_invoker = true)
as
select
  oa.organization_id,

  oa.id as organization_activity_id,

  a.id as activity_id,

  a.name::text as activity_name,

  a.normalized_name::text as activity_search_name,

  oa.verification_status::text
    as verification_status,

  oa.notes,

  oa.created_at,

  oa.updated_at

from mp25m.organization_activities oa

join mp25m.activities a
  on a.id = oa.activity_id

join mp25m.organizations o
  on o.id = oa.organization_id

where oa.active = true
  and oa.verification_status <> 'rejected'
  and a.active = true
  and o.record_status = 'active';


create or replace view
mp25m_api.activity_skill_suggestion_list
with (security_invoker = true)
as
select
  ass.activity_id,

  a.name::text as activity_name,

  s.id as skill_id,

  s.name::text as skill_name,

  s.normalized_name::text as skill_search_name,

  s.category_code::text as category_code,

  sc.name::text as category_name,

  s.description,

  ass.sort_order

from mp25m.activity_skill_suggestions ass

join mp25m.activities a
  on a.id = ass.activity_id

join mp25m.skills s
  on s.id = ass.skill_id

left join mp25m.skill_categories sc
  on sc.code = s.category_code

where ass.active = true
  and a.active = true
  and s.active = true
  and s.applies_to_organization = true;


create or replace view
mp25m_api.organization_activity_proposal_list
with (security_invoker = true)
as
select
  proposal.organization_id,

  proposal.id as proposal_id,

  proposal.proposed_name::text
    as proposed_name,

  proposal.normalized_name::text
    as normalized_name,

  proposal.status::text as status,

  proposal.resolved_activity_id,

  resolved_activity.name::text
    as resolved_activity_name,

  proposal.created_by_internal_user_id,

  proposal.resolved_by_internal_user_id,

  proposal.resolution_reason,

  proposal.created_at,

  proposal.resolved_at

from mp25m.organization_activity_proposals proposal

join mp25m.organizations o
  on o.id = proposal.organization_id

left join mp25m.activities resolved_activity
  on resolved_activity.id =
    proposal.resolved_activity_id

where o.record_status = 'active';


revoke all privileges
on table
  mp25m_api.activity_directory,
  mp25m_api.organization_activity_list,
  mp25m_api.activity_skill_suggestion_list,
  mp25m_api.organization_activity_proposal_list
from public, anon, authenticated, service_role;


grant select
on table
  mp25m_api.activity_directory,
  mp25m_api.organization_activity_list,
  mp25m_api.activity_skill_suggestion_list,
  mp25m_api.organization_activity_proposal_list
to service_role;


-- ---------------------------------------------------------------------------
-- 4. WRITE API SERVER-ONLY
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.add_organization_activity(
  p_actor_internal_user_id uuid,
  p_organization_id uuid,
  p_activity_id uuid,
  p_notes text default null
)
returns table (
  organization_activity_id uuid,
  activity_id uuid,
  activity_name text,
  organization_name text,
  verification_status text,
  operation text
)
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_existing mp25m.organization_activities%rowtype;
  v_activity_link mp25m.organization_activities%rowtype;
  v_activity_name text;
  v_organization_name text;
  v_notes text;
  v_action text;
  v_operation text;
begin
  if not exists (
    select 1
    from mp25m.internal_users iu

    join mp25m.access_role_assignments ara
      on ara.internal_user_id = iu.id

    join mp25m.access_roles ar
      on ar.code = ara.access_role_code

    join mp25m.access_scopes scope
      on scope.id = ara.access_scope_id

    where iu.id = p_actor_internal_user_id
      and iu.status = 'active'
      and iu.deleted_at is null
      and ara.status = 'active'
      and ara.revoked_at is null
      and ara.valid_from <= now()
      and (
        ara.valid_until is null
        or ara.valid_until > now()
      )
      and ar.code in (
        'administrator',
        'validator'
      )
      and ar.is_active = true
      and ar.deleted_at is null
      and scope.scope_type = 'global'
      and scope.is_active = true
      and scope.deleted_at is null
  ) then
    raise exception
      'Internal user cannot manage organization activities'
      using errcode = '42501';
  end if;

  select o.name::text
  into v_organization_name
  from mp25m.organizations o
  where o.id = p_organization_id
    and o.record_status = 'active';

  if not found then
    raise exception
      'Organization not found or inactive'
      using errcode = 'P0002';
  end if;

  select a.name::text
  into v_activity_name
  from mp25m.activities a
  where a.id = p_activity_id
    and a.active = true;

  if not found then
    raise exception
      'Activity not found or inactive'
      using errcode = 'P0002';
  end if;

  v_notes :=
    nullif(
      btrim(
        coalesce(
          p_notes,
          ''
        )
      ),
      ''
    );

  if v_notes is not null
     and char_length(v_notes) > 2000
  then
    raise exception
      'Organization activity notes cannot exceed 2000 characters'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'mp25m.organization_activity.add:' ||
      p_organization_id::text ||
      ':' ||
      p_activity_id::text,
      0
    )
  );

  select oa.*
  into v_existing
  from mp25m.organization_activities oa
  where oa.organization_id = p_organization_id
    and oa.activity_id = p_activity_id
  for update;

  if found then
    if v_existing.active = true then
      raise exception
        'Organization already has this activity registered'
        using errcode = '23505';
    end if;

    update mp25m.organization_activities
    set active = true,
        verification_status =
          case
            when v_existing.verification_status =
              'rejected'
            then 'candidate'
            else v_existing.verification_status
          end,
        notes = v_notes
    where id = v_existing.id
    returning *
    into v_activity_link;

    v_action := 'organization.activity.reactivate';
    v_operation := 'reactivate';
  else
    insert into mp25m.organization_activities (
      organization_id,
      activity_id,
      verification_status,
      notes,
      active
    )
    values (
      p_organization_id,
      p_activity_id,
      'candidate',
      v_notes,
      true
    )
    returning *
    into v_activity_link;

    v_action := 'organization.activity.add';
    v_operation := 'add';
  end if;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    old_data,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    v_action,
    'mp25m',
    'organization_activities',
    v_activity_link.id,
    case
      when v_existing.id is null
        then null
      else jsonb_build_object(
        'organization_activity_id',
          v_existing.id,
        'organization_id',
          v_existing.organization_id,
        'activity_id',
          v_existing.activity_id,
        'verification_status',
          v_existing.verification_status,
        'notes',
          v_existing.notes,
        'active',
          v_existing.active
      )
    end,
    jsonb_build_object(
      'organization_activity_id',
        v_activity_link.id,
      'organization_id',
        v_activity_link.organization_id,
      'activity_id',
        v_activity_link.activity_id,
      'verification_status',
        v_activity_link.verification_status,
      'notes',
        v_activity_link.notes,
      'active',
        v_activity_link.active
    ),
    'allowed',
    jsonb_build_object(
      'organization_id',
        v_activity_link.organization_id,
      'activity_id',
        v_activity_link.activity_id,
      'activity_name',
        v_activity_name,
      'operation',
        v_operation
    )
  );

  return query
  select
    v_activity_link.id,
    v_activity_link.activity_id,
    v_activity_name,
    v_organization_name,
    v_activity_link.verification_status::text,
    v_operation;
end;
$function$;


create or replace function
mp25m_api.propose_organization_activity(
  p_actor_internal_user_id uuid,
  p_organization_id uuid,
  p_proposed_name text
)
returns uuid
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_organization_name text;
  v_proposed_name text;
  v_normalized_name text;
  v_existing_activity_name text;
  v_existing_proposal_id uuid;
  v_proposal_id uuid;
begin
  if not exists (
    select 1
    from mp25m.internal_users iu

    join mp25m.access_role_assignments ara
      on ara.internal_user_id = iu.id

    join mp25m.access_roles ar
      on ar.code = ara.access_role_code

    join mp25m.access_scopes scope
      on scope.id = ara.access_scope_id

    where iu.id = p_actor_internal_user_id
      and iu.status = 'active'
      and iu.deleted_at is null
      and ara.status = 'active'
      and ara.revoked_at is null
      and ara.valid_from <= now()
      and (
        ara.valid_until is null
        or ara.valid_until > now()
      )
      and ar.code in (
        'administrator',
        'validator'
      )
      and ar.is_active = true
      and ar.deleted_at is null
      and scope.scope_type = 'global'
      and scope.is_active = true
      and scope.deleted_at is null
  ) then
    raise exception
      'Internal user cannot manage organization activities'
      using errcode = '42501';
  end if;

  select o.name::text
  into v_organization_name
  from mp25m.organizations o
  where o.id = p_organization_id
    and o.record_status = 'active';

  if not found then
    raise exception
      'Organization not found or inactive'
      using errcode = 'P0002';
  end if;

  v_proposed_name :=
    nullif(
      btrim(
        coalesce(
          p_proposed_name,
          ''
        )
      ),
      ''
    );

  if v_proposed_name is null
     or char_length(v_proposed_name) < 2
     or char_length(v_proposed_name) > 200
  then
    raise exception
      'Organization activity proposal name must contain between 2 and 200 characters'
      using errcode = '22023';
  end if;

  v_normalized_name :=
    mp25m_private.normalize_text(
      v_proposed_name
    );

  if v_normalized_name is null then
    raise exception
      'Organization activity proposal name is invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'mp25m.organization_activity.propose:' ||
      p_organization_id::text ||
      ':' ||
      v_normalized_name,
      0
    )
  );

  select a.name::text
  into v_existing_activity_name
  from mp25m.activities a
  where a.normalized_name = v_normalized_name
  limit 1;

  if found then
    raise exception
      'Canonical activity already exists: %',
      v_existing_activity_name
      using errcode = '23505';
  end if;

  select proposal.id
  into v_existing_proposal_id
  from mp25m.organization_activity_proposals proposal
  where proposal.organization_id = p_organization_id
    and proposal.normalized_name = v_normalized_name
    and proposal.status = 'pending'
  limit 1;

  if found then
    raise exception
      'Pending organization activity proposal already exists'
      using errcode = '23505';
  end if;

  insert into mp25m.organization_activity_proposals (
    organization_id,
    proposed_name,
    normalized_name,
    status,
    created_by_internal_user_id
  )
  values (
    p_organization_id,
    v_proposed_name,
    v_normalized_name,
    'pending',
    p_actor_internal_user_id
  )
  returning id
  into v_proposal_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'organization.activity.propose',
    'mp25m',
    'organization_activity_proposals',
    v_proposal_id,
    jsonb_build_object(
      'organization_id',
        p_organization_id,
      'proposed_name',
        v_proposed_name,
      'normalized_name',
        v_normalized_name,
      'status',
        'pending',
      'created_by_internal_user_id',
        p_actor_internal_user_id
    ),
    'allowed',
    jsonb_build_object(
      'organization_id',
        p_organization_id,
      'organization_name',
        v_organization_name,
      'proposed_name',
        v_proposed_name,
      'normalized_name',
        v_normalized_name,
      'operation',
        'propose'
    )
  );

  return v_proposal_id;
end;
$function$;


revoke all
on function mp25m_api.add_organization_activity(
  uuid,
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.add_organization_activity(
  uuid,
  uuid,
  uuid,
  text
)
to service_role;


revoke all
on function mp25m_api.propose_organization_activity(
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.propose_organization_activity(
  uuid,
  uuid,
  text
)
to service_role;


comment on table mp25m.activities is
  'Catalogo canonico de actividades institucionales. Una actividad describe que hace una organizacion.';

comment on table mp25m.organization_activities is
  'Relacion institucion-organizacion actividad. No implica capacidades ni presencia territorial.';

comment on table mp25m.activity_skill_suggestions is
  'Sugerencias de capacidades para orientar la carga a partir de una actividad canonica.';

comment on table mp25m.organization_activity_proposals is
  'Propuestas pendientes o resueltas de nuevas actividades para organizaciones; no crean actividad canonica automaticamente.';

comment on view mp25m_api.activity_directory is
  'Directorio server-only de actividades canonicas activas.';

comment on view mp25m_api.organization_activity_list is
  'Actividades activas registradas para una organizacion, preservando estado de validacion.';

comment on view mp25m_api.activity_skill_suggestion_list is
  'Capacidades sugeridas por actividad canonica, solo para orientar formularios.';

comment on view mp25m_api.organization_activity_proposal_list is
  'Propuestas de actividades por organizacion, separadas del catalogo canonico.';

comment on function mp25m_api.add_organization_activity(
  uuid,
  uuid,
  uuid,
  text
) is
  'Adds or reactivates one organization activity with administrator or validator global access. New rows start as candidate.';

comment on function mp25m_api.propose_organization_activity(
  uuid,
  uuid,
  text
) is
  'Records a pending organization activity proposal without creating a canonical activity.';


commit;
