-- Incremento 11A
-- Resultados y aprendizaje
--
-- Incorpora Resultados estructurados para Articulaciones y Proyectos
-- y contribuciones explícitas de Personas u Organizaciones.
--
-- No incorpora economía monetaria.
-- No infiere relaciones con Opportunities.
-- No migra automáticamente cierres, entregables ni seguimientos históricos.

create table mp25m.results (
  id uuid primary key default gen_random_uuid(),

  articulation_id uuid,
  project_id uuid,

  result_type text not null,
  title text not null,
  description text not null,
  result_date date not null,
  evidence_reference text,

  created_by_internal_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  voided_at timestamptz,
  voided_by_internal_user_id uuid,
  void_rationale text,

  constraint results_articulation_fk
    foreign key (articulation_id)
    references mp25m.opportunity_articulations(id)
    on delete restrict,

  constraint results_project_fk
    foreign key (project_id)
    references mp25m.projects(id)
    on delete restrict,

  constraint results_created_by_fk
    foreign key (created_by_internal_user_id)
    references mp25m.internal_users(id)
    on delete restrict,

  constraint results_voided_by_fk
    foreign key (voided_by_internal_user_id)
    references mp25m.internal_users(id)
    on delete restrict,

  constraint results_origin_xor
    check (
      (articulation_id is not null)
      <>
      (project_id is not null)
    ),

  constraint results_type_check
    check (
      result_type in (
        'productive',
        'economic',
        'territorial',
        'organizational',
        'strategic',
        'institutional',
        'communication',
        'learning',
        'other'
      )
    ),

  constraint results_title_check
    check (
      char_length(btrim(title))
      between 3 and 200
    ),

  constraint results_description_check
    check (
      char_length(btrim(description))
      between 3 and 10000
    ),

  constraint results_evidence_reference_check
    check (
      evidence_reference is null
      or char_length(btrim(evidence_reference))
         between 3 and 2000
    ),

  constraint results_void_state_check
    check (
      (
        voided_at is null
        and voided_by_internal_user_id is null
        and void_rationale is null
      )
      or
      (
        voided_at is not null
        and voided_by_internal_user_id is not null
        and char_length(
          btrim(coalesce(void_rationale, ''))
        ) between 3 and 10000
      )
    )
);

create index results_articulation_idx
  on mp25m.results (
    articulation_id,
    result_date desc,
    created_at desc
  )
  where articulation_id is not null;

create index results_project_idx
  on mp25m.results (
    project_id,
    result_date desc,
    created_at desc
  )
  where project_id is not null;


create table mp25m.result_contributions (
  id uuid primary key default gen_random_uuid(),

  result_id uuid not null,

  person_id uuid,
  organization_id uuid,

  contribution_summary text not null,
  evidence_reference text,

  added_by_internal_user_id uuid not null,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  removed_at timestamptz,
  removed_by_internal_user_id uuid,
  removal_rationale text,

  constraint result_contributions_result_fk
    foreign key (result_id)
    references mp25m.results(id)
    on delete restrict,

  constraint result_contributions_person_fk
    foreign key (person_id)
    references mp25m.persons(id)
    on delete restrict,

  constraint result_contributions_organization_fk
    foreign key (organization_id)
    references mp25m.organizations(id)
    on delete restrict,

  constraint result_contributions_added_by_fk
    foreign key (added_by_internal_user_id)
    references mp25m.internal_users(id)
    on delete restrict,

  constraint result_contributions_removed_by_fk
    foreign key (removed_by_internal_user_id)
    references mp25m.internal_users(id)
    on delete restrict,

  constraint result_contributions_actor_xor
    check (
      (person_id is not null)
      <>
      (organization_id is not null)
    ),

  constraint result_contributions_summary_check
    check (
      char_length(btrim(contribution_summary))
      between 3 and 10000
    ),

  constraint result_contributions_evidence_reference_check
    check (
      evidence_reference is null
      or char_length(btrim(evidence_reference))
         between 3 and 2000
    ),

  constraint result_contributions_removal_state_check
    check (
      (
        removed_at is null
        and removed_by_internal_user_id is null
        and removal_rationale is null
      )
      or
      (
        removed_at is not null
        and removed_by_internal_user_id is not null
        and char_length(
          btrim(coalesce(removal_rationale, ''))
        ) between 3 and 10000
      )
    )
);

create index result_contributions_result_idx
  on mp25m.result_contributions (
    result_id,
    added_at
  )
  where removed_at is null;

create unique index result_contributions_active_person_uidx
  on mp25m.result_contributions (
    result_id,
    person_id
  )
  where removed_at is null
    and person_id is not null;

create unique index result_contributions_active_organization_uidx
  on mp25m.result_contributions (
    result_id,
    organization_id
  )
  where removed_at is null
    and organization_id is not null;


-- ---------------------------------------------------------------------------
-- Seguridad de tablas
-- ---------------------------------------------------------------------------

alter table mp25m.results
  enable row level security;

alter table mp25m.result_contributions
  enable row level security;

revoke all
  on table mp25m.results
  from public, anon, authenticated, service_role;

revoke all
  on table mp25m.result_contributions
  from public, anon, authenticated, service_role;

grant select, insert, update
  on table mp25m.results
  to service_role;

grant select, insert, update
  on table mp25m.result_contributions
  to service_role;


-- ---------------------------------------------------------------------------
-- Lectura de Resultados
-- ---------------------------------------------------------------------------

create view mp25m_api.result_list
with (security_invoker = true)
as
select
  result.id
    as result_id,

  result.articulation_id,
  result.project_id,

  case
    when result.articulation_id is not null
      then 'articulation'::text
    else 'project'::text
  end
    as source_type,

  coalesce(
    result.articulation_id,
    result.project_id
  )
    as source_id,

  coalesce(
    articulation.title,
    project.title
  )
    as source_title,

  result.result_type,
  result.title,
  result.description,
  result.result_date,
  result.evidence_reference,

  result.created_by_internal_user_id,
  created_by.display_name
    as created_by_display_name,

  result.created_at,
  result.updated_at,

  result.voided_at,
  result.voided_by_internal_user_id,
  voided_by.display_name
    as voided_by_display_name,

  result.void_rationale,

  coalesce(
    contribution_count.active_contribution_count,
    0
  )::integer
    as active_contribution_count

from mp25m.results result

left join mp25m.opportunity_articulations articulation
  on articulation.id =
    result.articulation_id

left join mp25m.projects project
  on project.id =
    result.project_id

join mp25m.internal_users created_by
  on created_by.id =
    result.created_by_internal_user_id

left join mp25m.internal_users voided_by
  on voided_by.id =
    result.voided_by_internal_user_id

left join lateral (
  select
    count(*)::integer
      as active_contribution_count
  from mp25m.result_contributions contribution
  where contribution.result_id =
      result.id
    and contribution.removed_at
      is null
) contribution_count
  on true;


-- ---------------------------------------------------------------------------
-- Lectura de contribuciones
-- ---------------------------------------------------------------------------

create view mp25m_api.result_contribution_list
with (security_invoker = true)
as
select
  contribution.id
    as contribution_id,

  contribution.result_id,

  contribution.person_id,
  contribution.organization_id,

  case
    when contribution.person_id is not null
      then 'person'::text
    else 'organization'::text
  end
    as actor_type,

  coalesce(
    contribution.person_id,
    contribution.organization_id
  )
    as actor_id,

  coalesce(
    person.display_name,
    organization.name
  )
    as display_name,

  contribution.contribution_summary,
  contribution.evidence_reference,

  contribution.added_by_internal_user_id,
  added_by.display_name
    as added_by_display_name,

  contribution.added_at,
  contribution.updated_at,

  contribution.removed_at,
  contribution.removed_by_internal_user_id,
  removed_by.display_name
    as removed_by_display_name,

  contribution.removal_rationale

from mp25m.result_contributions contribution

left join mp25m.persons person
  on person.id =
    contribution.person_id

left join mp25m.organizations organization
  on organization.id =
    contribution.organization_id

join mp25m.internal_users added_by
  on added_by.id =
    contribution.added_by_internal_user_id

left join mp25m.internal_users removed_by
  on removed_by.id =
    contribution.removed_by_internal_user_id;


-- ---------------------------------------------------------------------------
-- Candidatos históricos a contribuyentes
-- ---------------------------------------------------------------------------

create view mp25m_api.result_contributor_candidate_list
with (security_invoker = true)
as
select
  candidate.source_type,
  candidate.source_id,
  candidate.actor_type,
  candidate.actor_id,
  candidate.display_name,

  bool_or(
    candidate.removed_at is null
  )
    as is_current_participant,

  max(candidate.added_at)
    as last_participated_at

from (
  select
    'articulation'::text
      as source_type,

    participant.articulation_id
      as source_id,

    case
      when participant.person_id is not null
        then 'person'::text
      else 'organization'::text
    end
      as actor_type,

    coalesce(
      participant.person_id,
      participant.organization_id
    )
      as actor_id,

    coalesce(
      person.display_name,
      organization.name
    )
      as display_name,

    participant.added_at,
    participant.removed_at

  from mp25m.opportunity_articulation_participants participant

  left join mp25m.persons person
    on person.id =
      participant.person_id

  left join mp25m.organizations organization
    on organization.id =
      participant.organization_id

  union all

  select
    'project'::text
      as source_type,

    participant.project_id
      as source_id,

    case
      when participant.person_id is not null
        then 'person'::text
      else 'organization'::text
    end
      as actor_type,

    coalesce(
      participant.person_id,
      participant.organization_id
    )
      as actor_id,

    coalesce(
      person.display_name,
      organization.name
    )
      as display_name,

    participant.added_at,
    participant.removed_at

  from mp25m.project_participants participant

  left join mp25m.persons person
    on person.id =
      participant.person_id

  left join mp25m.organizations organization
    on organization.id =
      participant.organization_id
) candidate

group by
  candidate.source_type,
  candidate.source_id,
  candidate.actor_type,
  candidate.actor_id,
  candidate.display_name;


revoke all
  on mp25m_api.result_list,
     mp25m_api.result_contribution_list,
     mp25m_api.result_contributor_candidate_list
  from public, anon, authenticated, service_role;

grant select
  on mp25m_api.result_list,
     mp25m_api.result_contribution_list,
     mp25m_api.result_contributor_candidate_list
  to service_role;


-- ---------------------------------------------------------------------------
-- Permiso derivado para Resultados
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.can_manage_result(
  p_actor_internal_user_id uuid,
  p_result_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
  select exists (
    select 1
    from mp25m.results result
    where result.id = p_result_id
      and (
        (
          result.articulation_id is not null
          and mp25m_api.can_manage_articulation(
            p_actor_internal_user_id,
            result.articulation_id
          )
        )
        or
        (
          result.project_id is not null
          and mp25m_api.can_manage_project(
            p_actor_internal_user_id,
            result.project_id
          )
        )
      )
  );
$function$;


-- ---------------------------------------------------------------------------
-- Crear Resultado
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.create_result(
  p_actor_internal_user_id uuid,
  p_articulation_id uuid,
  p_project_id uuid,
  p_result_type text,
  p_title text,
  p_description text,
  p_result_date date,
  p_evidence_reference text default null
)
returns table (
  result_id uuid,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_result_id uuid;
  v_created_at timestamptz := now();

  v_result_type text :=
    lower(
      btrim(
        coalesce(
          p_result_type,
          ''
        )
      )
    );

  v_title text :=
    btrim(
      coalesce(
        p_title,
        ''
      )
    );

  v_description text :=
    btrim(
      coalesce(
        p_description,
        ''
      )
    );

  v_evidence_reference text :=
    nullif(
      btrim(
        coalesce(
          p_evidence_reference,
          ''
        )
      ),
      ''
    );
begin
  if
    (
      p_articulation_id is null
      and p_project_id is null
    )
    or
    (
      p_articulation_id is not null
      and p_project_id is not null
    )
  then
    raise exception
      'Result must belong to exactly one articulation or project'
      using errcode = '22023';
  end if;

  if v_result_type not in (
    'productive',
    'economic',
    'territorial',
    'organizational',
    'strategic',
    'institutional',
    'communication',
    'learning',
    'other'
  ) then
    raise exception
      'Invalid result type'
      using errcode = '22023';
  end if;

  if char_length(v_title)
      not between 3 and 200
  then
    raise exception
      'Result title must contain between 3 and 200 characters'
      using errcode = '22023';
  end if;

  if char_length(v_description)
      not between 3 and 10000
  then
    raise exception
      'Result description must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;

  if p_result_date is null then
    raise exception
      'Result date is required'
      using errcode = '22023';
  end if;

  if p_result_date > current_date then
    raise exception
      'Result date cannot be in the future'
      using errcode = '22023';
  end if;

  if
    v_evidence_reference is not null
    and char_length(v_evidence_reference)
        not between 3 and 2000
  then
    raise exception
      'Evidence reference must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;

  if p_articulation_id is not null then
    if not mp25m_api.can_manage_articulation(
      p_actor_internal_user_id,
      p_articulation_id
    ) then
      raise exception
        'Actor cannot manage articulation'
        using errcode = '42501';
    end if;
  else
    if not mp25m_api.can_manage_project(
      p_actor_internal_user_id,
      p_project_id
    ) then
      raise exception
        'Actor cannot manage project'
        using errcode = '42501';
    end if;
  end if;

  insert into mp25m.results (
    articulation_id,
    project_id,
    result_type,
    title,
    description,
    result_date,
    evidence_reference,
    created_by_internal_user_id,
    created_at,
    updated_at
  )
  values (
    p_articulation_id,
    p_project_id,
    v_result_type,
    v_title,
    v_description,
    p_result_date,
    v_evidence_reference,
    p_actor_internal_user_id,
    v_created_at,
    v_created_at
  )
  returning id
    into v_result_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'result.create',
    'mp25m',
    'results',
    v_result_id,
    null,

    jsonb_build_object(
      'articulation_id',
        p_articulation_id,
      'project_id',
        p_project_id,
      'result_type',
        v_result_type,
      'title',
        v_title,
      'description',
        v_description,
      'result_date',
        p_result_date,
      'evidence_reference',
        v_evidence_reference
    ),

    'allowed',

    jsonb_build_object(
      'result_id',
        v_result_id,
      'articulation_id',
        p_articulation_id,
      'project_id',
        p_project_id
    )
  );

  result_id := v_result_id;
  created_at := v_created_at;

  return next;
end;
$function$;


revoke all
  on function mp25m_api.can_manage_result(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.can_manage_result(uuid, uuid)
  to service_role;


revoke all
  on function mp25m_api.create_result(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    date,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.create_result(
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    date,
    text
  )
  to service_role;


-- ---------------------------------------------------------------------------
-- Corregir Resultado
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.update_result(
  p_actor_internal_user_id uuid,
  p_result_id uuid,
  p_result_type text,
  p_title text,
  p_description text,
  p_result_date date,
  p_evidence_reference text,
  p_rationale text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.results%rowtype;

  v_result_type text :=
    lower(
      btrim(
        coalesce(
          p_result_type,
          ''
        )
      )
    );

  v_title text :=
    btrim(
      coalesce(
        p_title,
        ''
      )
    );

  v_description text :=
    btrim(
      coalesce(
        p_description,
        ''
      )
    );

  v_evidence_reference text :=
    nullif(
      btrim(
        coalesce(
          p_evidence_reference,
          ''
        )
      ),
      ''
    );

  v_rationale text :=
    btrim(
      coalesce(
        p_rationale,
        ''
      )
    );

  v_updated_at timestamptz := now();
begin
  select result.*
    into v_before
  from mp25m.results result
  where result.id = p_result_id
  for update;

  if not found then
    raise exception
      'Result not found'
      using errcode = 'P0002';
  end if;

  if v_before.voided_at is not null then
    raise exception
      'Voided result cannot be updated'
      using errcode = '55000';
  end if;

  if not mp25m_api.can_manage_result(
    p_actor_internal_user_id,
    p_result_id
  ) then
    raise exception
      'Actor cannot manage result'
      using errcode = '42501';
  end if;

  if v_result_type not in (
    'productive',
    'economic',
    'territorial',
    'organizational',
    'strategic',
    'institutional',
    'communication',
    'learning',
    'other'
  ) then
    raise exception
      'Invalid result type'
      using errcode = '22023';
  end if;

  if char_length(v_title)
      not between 3 and 200
  then
    raise exception
      'Result title must contain between 3 and 200 characters'
      using errcode = '22023';
  end if;

  if char_length(v_description)
      not between 3 and 10000
  then
    raise exception
      'Result description must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;

  if p_result_date is null then
    raise exception
      'Result date is required'
      using errcode = '22023';
  end if;

  if p_result_date > current_date then
    raise exception
      'Result date cannot be in the future'
      using errcode = '22023';
  end if;

  if
    v_evidence_reference is not null
    and char_length(v_evidence_reference)
        not between 3 and 2000
  then
    raise exception
      'Evidence reference must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;

  if char_length(v_rationale)
      not between 3 and 10000
  then
    raise exception
      'Update rationale must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;

  update mp25m.results
  set
    result_type = v_result_type,
    title = v_title,
    description = v_description,
    result_date = p_result_date,
    evidence_reference = v_evidence_reference,
    updated_at = v_updated_at
  where id = p_result_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'result.update',
    'mp25m',
    'results',
    p_result_id,
    v_rationale,

    jsonb_build_object(
      'result_type',
        v_before.result_type,
      'title',
        v_before.title,
      'description',
        v_before.description,
      'result_date',
        v_before.result_date,
      'evidence_reference',
        v_before.evidence_reference
    ),

    jsonb_build_object(
      'result_type',
        v_result_type,
      'title',
        v_title,
      'description',
        v_description,
      'result_date',
        p_result_date,
      'evidence_reference',
        v_evidence_reference
    ),

    'allowed',

    jsonb_build_object(
      'result_id',
        p_result_id,
      'articulation_id',
        v_before.articulation_id,
      'project_id',
        v_before.project_id
    )
  );
end;
$function$;


-- ---------------------------------------------------------------------------
-- Anular Resultado
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.void_result(
  p_actor_internal_user_id uuid,
  p_result_id uuid,
  p_rationale text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.results%rowtype;

  v_rationale text :=
    btrim(
      coalesce(
        p_rationale,
        ''
      )
    );

  v_voided_at timestamptz := now();
begin
  select result.*
    into v_before
  from mp25m.results result
  where result.id = p_result_id
  for update;

  if not found then
    raise exception
      'Result not found'
      using errcode = 'P0002';
  end if;

  if v_before.voided_at is not null then
    raise exception
      'Result is already voided'
      using errcode = '55000';
  end if;

  if not mp25m_api.can_manage_result(
    p_actor_internal_user_id,
    p_result_id
  ) then
    raise exception
      'Actor cannot manage result'
      using errcode = '42501';
  end if;

  if char_length(v_rationale)
      not between 3 and 10000
  then
    raise exception
      'Void rationale must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;

  update mp25m.results
  set
    voided_at =
      v_voided_at,
    voided_by_internal_user_id =
      p_actor_internal_user_id,
    void_rationale =
      v_rationale,
    updated_at =
      v_voided_at
  where id = p_result_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'result.void',
    'mp25m',
    'results',
    p_result_id,
    v_rationale,

    jsonb_build_object(
      'voided_at',
        v_before.voided_at,
      'voided_by_internal_user_id',
        v_before.voided_by_internal_user_id,
      'void_rationale',
        v_before.void_rationale
    ),

    jsonb_build_object(
      'voided_at',
        v_voided_at,
      'voided_by_internal_user_id',
        p_actor_internal_user_id,
      'void_rationale',
        v_rationale
    ),

    'allowed',

    jsonb_build_object(
      'result_id',
        p_result_id,
      'articulation_id',
        v_before.articulation_id,
      'project_id',
        v_before.project_id
    )
  );
end;
$function$;


revoke all
  on function mp25m_api.update_result(
    uuid,
    uuid,
    text,
    text,
    text,
    date,
    text,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.update_result(
    uuid,
    uuid,
    text,
    text,
    text,
    date,
    text,
    text
  )
  to service_role;


revoke all
  on function mp25m_api.void_result(
    uuid,
    uuid,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.void_result(
    uuid,
    uuid,
    text
  )
  to service_role;


-- ---------------------------------------------------------------------------
-- Agregar contribución a Resultado
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.add_result_contribution(
  p_actor_internal_user_id uuid,
  p_result_id uuid,
  p_person_id uuid,
  p_organization_id uuid,
  p_contribution_summary text,
  p_evidence_reference text default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_result mp25m.results%rowtype;
  v_contribution_id uuid;
  v_added_at timestamptz := now();

  v_contribution_summary text :=
    btrim(
      coalesce(
        p_contribution_summary,
        ''
      )
    );

  v_evidence_reference text :=
    nullif(
      btrim(
        coalesce(
          p_evidence_reference,
          ''
        )
      ),
      ''
    );
begin
  if (
    (p_person_id is not null)::integer
    +
    (p_organization_id is not null)::integer
  ) <> 1 then
    raise exception
      'Result contribution must reference exactly one person or organization'
      using errcode = '22023';
  end if;

  if char_length(v_contribution_summary)
      not between 3 and 10000
  then
    raise exception
      'Contribution summary must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;

  if
    v_evidence_reference is not null
    and char_length(v_evidence_reference)
        not between 3 and 2000
  then
    raise exception
      'Evidence reference must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;

  select result.*
    into v_result
  from mp25m.results result
  where result.id = p_result_id
  for update;

  if not found then
    raise exception
      'Result not found'
      using errcode = 'P0002';
  end if;

  if v_result.voided_at is not null then
    raise exception
      'Cannot add contribution to voided result'
      using errcode = '55000';
  end if;

  if not mp25m_api.can_manage_result(
    p_actor_internal_user_id,
    p_result_id
  ) then
    raise exception
      'Actor cannot manage result'
      using errcode = '42501';
  end if;

  if
    p_person_id is not null
    and not exists (
      select 1
      from mp25m.persons person
      where person.id = p_person_id
    )
  then
    raise exception
      'Result contribution person not found'
      using errcode = '23503';
  end if;

  if
    p_organization_id is not null
    and not exists (
      select 1
      from mp25m.organizations organization
      where organization.id = p_organization_id
    )
  then
    raise exception
      'Result contribution organization not found'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from mp25m.result_contributions contribution
    where contribution.result_id = p_result_id
      and contribution.removed_at is null
      and (
        (
          p_person_id is not null
          and contribution.person_id = p_person_id
        )
        or
        (
          p_organization_id is not null
          and contribution.organization_id = p_organization_id
        )
      )
  ) then
    raise exception
      'Actor already has an active contribution to this result'
      using errcode = '23505';
  end if;

  insert into mp25m.result_contributions (
    result_id,
    person_id,
    organization_id,
    contribution_summary,
    evidence_reference,
    added_by_internal_user_id,
    added_at,
    updated_at
  )
  values (
    p_result_id,
    p_person_id,
    p_organization_id,
    v_contribution_summary,
    v_evidence_reference,
    p_actor_internal_user_id,
    v_added_at,
    v_added_at
  )
  returning id
    into v_contribution_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'result.contribution.add',
    'mp25m',
    'result_contributions',
    v_contribution_id,
    null,

    jsonb_build_object(
      'result_id',
        p_result_id,
      'person_id',
        p_person_id,
      'organization_id',
        p_organization_id,
      'contribution_summary',
        v_contribution_summary,
      'evidence_reference',
        v_evidence_reference
    ),

    'allowed',

    jsonb_build_object(
      'result_id',
        p_result_id,
      'articulation_id',
        v_result.articulation_id,
      'project_id',
        v_result.project_id,
      'person_id',
        p_person_id,
      'organization_id',
        p_organization_id
    )
  );

  return v_contribution_id;
end;
$function$;


revoke all
  on function mp25m_api.add_result_contribution(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.add_result_contribution(
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text
  )
  to service_role;


-- ---------------------------------------------------------------------------
-- Corregir contribución a Resultado
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.update_result_contribution(
  p_actor_internal_user_id uuid,
  p_contribution_id uuid,
  p_contribution_summary text,
  p_evidence_reference text,
  p_rationale text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.result_contributions%rowtype;
  v_result mp25m.results%rowtype;

  v_contribution_summary text :=
    btrim(coalesce(p_contribution_summary, ''));

  v_evidence_reference text :=
    nullif(
      btrim(coalesce(p_evidence_reference, '')),
      ''
    );

  v_rationale text :=
    btrim(coalesce(p_rationale, ''));

  v_updated_at timestamptz := now();
begin
  select contribution.*
    into v_before
  from mp25m.result_contributions contribution
  where contribution.id = p_contribution_id
    and contribution.removed_at is null
  for update;

  if not found then
    raise exception
      'Active result contribution not found'
      using errcode = 'P0002';
  end if;

  select result.*
    into v_result
  from mp25m.results result
  where result.id = v_before.result_id;

  if not found then
    raise exception
      'Result not found'
      using errcode = 'P0002';
  end if;

  if not mp25m_api.can_manage_result(
    p_actor_internal_user_id,
    v_before.result_id
  ) then
    raise exception
      'Actor cannot manage result'
      using errcode = '42501';
  end if;

  if char_length(v_contribution_summary)
      not between 3 and 10000
  then
    raise exception
      'Contribution summary must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;

  if
    v_evidence_reference is not null
    and char_length(v_evidence_reference)
        not between 3 and 2000
  then
    raise exception
      'Evidence reference must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;

  if char_length(v_rationale)
      not between 3 and 10000
  then
    raise exception
      'Contribution update rationale must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;

  update mp25m.result_contributions
  set
    contribution_summary = v_contribution_summary,
    evidence_reference = v_evidence_reference,
    updated_at = v_updated_at
  where id = p_contribution_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'result.contribution.update',
    'mp25m',
    'result_contributions',
    p_contribution_id,
    v_rationale,

    jsonb_build_object(
      'contribution_summary',
        v_before.contribution_summary,
      'evidence_reference',
        v_before.evidence_reference
    ),

    jsonb_build_object(
      'contribution_summary',
        v_contribution_summary,
      'evidence_reference',
        v_evidence_reference
    ),

    'allowed',

    jsonb_build_object(
      'result_id',
        v_before.result_id,
      'articulation_id',
        v_result.articulation_id,
      'project_id',
        v_result.project_id,
      'person_id',
        v_before.person_id,
      'organization_id',
        v_before.organization_id
    )
  );
end;
$function$;


-- ---------------------------------------------------------------------------
-- Retirar contribución a Resultado
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.remove_result_contribution(
  p_actor_internal_user_id uuid,
  p_contribution_id uuid,
  p_rationale text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.result_contributions%rowtype;
  v_result mp25m.results%rowtype;

  v_rationale text :=
    btrim(coalesce(p_rationale, ''));

  v_removed_at timestamptz := now();
begin
  select contribution.*
    into v_before
  from mp25m.result_contributions contribution
  where contribution.id = p_contribution_id
    and contribution.removed_at is null
  for update;

  if not found then
    raise exception
      'Active result contribution not found'
      using errcode = 'P0002';
  end if;

  select result.*
    into v_result
  from mp25m.results result
  where result.id = v_before.result_id;

  if not found then
    raise exception
      'Result not found'
      using errcode = 'P0002';
  end if;

  if not mp25m_api.can_manage_result(
    p_actor_internal_user_id,
    v_before.result_id
  ) then
    raise exception
      'Actor cannot manage result'
      using errcode = '42501';
  end if;

  if char_length(v_rationale)
      not between 3 and 10000
  then
    raise exception
      'Contribution removal rationale must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;

  update mp25m.result_contributions
  set
    removed_at = v_removed_at,
    removed_by_internal_user_id = p_actor_internal_user_id,
    removal_rationale = v_rationale,
    updated_at = v_removed_at
  where id = p_contribution_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'result.contribution.remove',
    'mp25m',
    'result_contributions',
    p_contribution_id,
    v_rationale,

    jsonb_build_object(
      'removed_at',
        v_before.removed_at,
      'removed_by_internal_user_id',
        v_before.removed_by_internal_user_id,
      'removal_rationale',
        v_before.removal_rationale
    ),

    jsonb_build_object(
      'removed_at',
        v_removed_at,
      'removed_by_internal_user_id',
        p_actor_internal_user_id,
      'removal_rationale',
        v_rationale
    ),

    'allowed',

    jsonb_build_object(
      'result_id',
        v_before.result_id,
      'articulation_id',
        v_result.articulation_id,
      'project_id',
        v_result.project_id,
      'person_id',
        v_before.person_id,
      'organization_id',
        v_before.organization_id
    )
  );
end;
$function$;


revoke all
  on function mp25m_api.update_result_contribution(
    uuid, uuid, text, text, text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.update_result_contribution(
    uuid, uuid, text, text, text
  )
  to service_role;

revoke all
  on function mp25m_api.remove_result_contribution(
    uuid, uuid, text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.remove_result_contribution(
    uuid, uuid, text
  )
  to service_role;
