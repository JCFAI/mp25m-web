-- Incremento 14A
-- Economía operativa manual
--
-- Fuente monetaria estructurada y trazable para:
-- - Oportunidades
-- - Articulaciones
-- - Proyectos
--
-- No incorpora:
-- - pagos;
-- - facturación;
-- - conversión de moneda;
-- - distribución automática;
-- - indicadores económicos agregados.

begin;


-- ============================================================
-- 1. IDENTIDAD DE FICHA ECONÓMICA
-- ============================================================

create table mp25m.economic_profiles (
  id uuid primary key default gen_random_uuid(),

  opportunity_id uuid
    references mp25m.opportunities(id)
    on delete restrict,

  articulation_id uuid
    references mp25m.opportunity_articulations(id)
    on delete restrict,

  project_id uuid
    references mp25m.projects(id)
    on delete restrict,

  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  created_at timestamptz not null default now(),

  constraint economic_profiles_source_xor
    check (
      num_nonnulls(
        opportunity_id,
        articulation_id,
        project_id
      ) = 1
    )
);


create unique index economic_profiles_opportunity_uidx
  on mp25m.economic_profiles(opportunity_id)
  where opportunity_id is not null;

create unique index economic_profiles_articulation_uidx
  on mp25m.economic_profiles(articulation_id)
  where articulation_id is not null;

create unique index economic_profiles_project_uidx
  on mp25m.economic_profiles(project_id)
  where project_id is not null;


-- ============================================================
-- 2. REVISIONES INMUTABLES
-- ============================================================

create table mp25m.economic_profile_revisions (
  id uuid primary key default gen_random_uuid(),

  economic_profile_id uuid not null
    references mp25m.economic_profiles(id)
    on delete restrict,

  revision_no integer not null
    check (revision_no > 0),

  currency_code text,

  estimated_value numeric(24,4),
  estimated_costs numeric(24,4),
  probability_percent numeric(5,2),

  participant_income_potential numeric(24,4),
  mp25m_contribution_potential numeric(24,4),

  distribution_notes text,

  agreed_value numeric(24,4),

  collection_status text,

  collected_amount numeric(24,4),

  final_costs numeric(24,4),
  participant_income_final numeric(24,4),
  mp25m_contribution_final numeric(24,4),

  final_result_amount numeric(24,4),

  economic_summary text,
  evidence_reference text,

  rationale text not null,

  changed_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  changed_at timestamptz not null default now(),

  constraint economic_profile_revisions_number_uidx
    unique (
      economic_profile_id,
      revision_no
    ),

  constraint economic_profile_revisions_currency_check
    check (
      currency_code is null
      or currency_code ~ '^[A-Z]{3}$'
    ),

  constraint economic_profile_revisions_estimated_value_check
    check (
      estimated_value is null
      or estimated_value >= 0
    ),

  constraint economic_profile_revisions_estimated_costs_check
    check (
      estimated_costs is null
      or estimated_costs >= 0
    ),

  constraint economic_profile_revisions_probability_check
    check (
      probability_percent is null
      or (
        probability_percent >= 0
        and probability_percent <= 100
      )
    ),

  constraint economic_profile_revisions_participant_income_potential_check
    check (
      participant_income_potential is null
      or participant_income_potential >= 0
    ),

  constraint economic_profile_revisions_mp25m_contribution_potential_check
    check (
      mp25m_contribution_potential is null
      or mp25m_contribution_potential >= 0
    ),

  constraint economic_profile_revisions_agreed_value_check
    check (
      agreed_value is null
      or agreed_value >= 0
    ),

  constraint economic_profile_revisions_collection_status_check
    check (
      collection_status is null
      or collection_status in (
        'pending',
        'partial',
        'collected',
        'uncollectible',
        'cancelled',
        'not_applicable'
      )
    ),

  constraint economic_profile_revisions_collected_amount_check
    check (
      collected_amount is null
      or collected_amount >= 0
    ),

  constraint economic_profile_revisions_final_costs_check
    check (
      final_costs is null
      or final_costs >= 0
    ),

  constraint economic_profile_revisions_participant_income_final_check
    check (
      participant_income_final is null
      or participant_income_final >= 0
    ),

  constraint economic_profile_revisions_mp25m_contribution_final_check
    check (
      mp25m_contribution_final is null
      or mp25m_contribution_final >= 0
    ),

  constraint economic_profile_revisions_currency_required_check
    check (
      (
        estimated_value is null
        and estimated_costs is null
        and participant_income_potential is null
        and mp25m_contribution_potential is null
        and agreed_value is null
        and collected_amount is null
        and final_costs is null
        and participant_income_final is null
        and mp25m_contribution_final is null
        and final_result_amount is null
      )
      or currency_code is not null
    ),

  constraint economic_profile_revisions_distribution_notes_check
    check (
      distribution_notes is null
      or char_length(btrim(distribution_notes))
        between 3 and 10000
    ),

  constraint economic_profile_revisions_summary_check
    check (
      economic_summary is null
      or char_length(btrim(economic_summary))
        between 3 and 10000
    ),

  constraint economic_profile_revisions_evidence_check
    check (
      evidence_reference is null
      or char_length(btrim(evidence_reference))
        between 3 and 2000
    ),

  constraint economic_profile_revisions_rationale_check
    check (
      char_length(btrim(rationale))
        between 3 and 2000
    ),

  constraint economic_profile_revisions_content_check
    check (
      currency_code is not null
      or estimated_value is not null
      or estimated_costs is not null
      or probability_percent is not null
      or participant_income_potential is not null
      or mp25m_contribution_potential is not null
      or distribution_notes is not null
      or agreed_value is not null
      or collection_status is not null
      or collected_amount is not null
      or final_costs is not null
      or participant_income_final is not null
      or mp25m_contribution_final is not null
      or final_result_amount is not null
      or economic_summary is not null
      or evidence_reference is not null
    )
);


create index economic_profile_revisions_profile_idx
  on mp25m.economic_profile_revisions(
    economic_profile_id,
    revision_no desc
  );

create index economic_profile_revisions_changed_at_idx
  on mp25m.economic_profile_revisions(
    changed_at desc
  );


-- ============================================================
-- 3. PRIVILEGIOS SERVER-ONLY
-- ============================================================

alter table mp25m.economic_profiles
  enable row level security;

alter table mp25m.economic_profile_revisions
  enable row level security;


revoke all
  on table
    mp25m.economic_profiles,
    mp25m.economic_profile_revisions
  from public, anon, authenticated, service_role;


grant select, insert
  on table
    mp25m.economic_profiles,
    mp25m.economic_profile_revisions
  to service_role;


-- ============================================================
-- 4. LECTURA ACTUAL
-- ============================================================

create view mp25m_api.economic_profile_current
with (security_invoker = true)
as
select
  profile.id
    as economic_profile_id,

  case
    when profile.opportunity_id is not null
      then 'opportunity'
    when profile.articulation_id is not null
      then 'articulation'
    else 'project'
  end
    as source_type,

  coalesce(
    profile.opportunity_id,
    profile.articulation_id,
    profile.project_id
  )
    as source_id,

  profile.opportunity_id,
  profile.articulation_id,
  profile.project_id,

  revision.id
    as revision_id,

  revision.revision_no,

  revision.currency_code,

  revision.estimated_value,
  revision.estimated_costs,

  case
    when revision.estimated_value is not null
      and revision.estimated_costs is not null
    then
      revision.estimated_value
      - revision.estimated_costs
    else null
  end
    as estimated_margin,

  revision.probability_percent,

  revision.participant_income_potential,
  revision.mp25m_contribution_potential,

  revision.distribution_notes,

  revision.agreed_value,
  revision.collection_status,
  revision.collected_amount,

  revision.final_costs,
  revision.participant_income_final,
  revision.mp25m_contribution_final,
  revision.final_result_amount,

  revision.economic_summary,
  revision.evidence_reference,

  revision.rationale,

  revision.changed_by_internal_user_id,

  changed_by.display_name
    as changed_by_display_name,

  revision.changed_at,

  profile.created_by_internal_user_id,
  profile.created_at

from mp25m.economic_profiles profile

join lateral (
  select revision.*
  from mp25m.economic_profile_revisions revision
  where revision.economic_profile_id =
      profile.id
  order by revision.revision_no desc
  limit 1
) revision
  on true

join mp25m.internal_users changed_by
  on changed_by.id =
    revision.changed_by_internal_user_id;


-- ============================================================
-- 5. HISTORIAL
-- ============================================================

create view mp25m_api.economic_profile_revision_list
with (security_invoker = true)
as
select
  profile.id
    as economic_profile_id,

  case
    when profile.opportunity_id is not null
      then 'opportunity'
    when profile.articulation_id is not null
      then 'articulation'
    else 'project'
  end
    as source_type,

  coalesce(
    profile.opportunity_id,
    profile.articulation_id,
    profile.project_id
  )
    as source_id,

  profile.opportunity_id,
  profile.articulation_id,
  profile.project_id,

  revision.id
    as revision_id,

  revision.revision_no,

  revision.currency_code,

  revision.estimated_value,
  revision.estimated_costs,

  case
    when revision.estimated_value is not null
      and revision.estimated_costs is not null
    then
      revision.estimated_value
      - revision.estimated_costs
    else null
  end
    as estimated_margin,

  revision.probability_percent,

  revision.participant_income_potential,
  revision.mp25m_contribution_potential,

  revision.distribution_notes,

  revision.agreed_value,
  revision.collection_status,
  revision.collected_amount,

  revision.final_costs,
  revision.participant_income_final,
  revision.mp25m_contribution_final,
  revision.final_result_amount,

  revision.economic_summary,
  revision.evidence_reference,

  revision.rationale,

  revision.changed_by_internal_user_id,

  changed_by.display_name
    as changed_by_display_name,

  revision.changed_at

from mp25m.economic_profiles profile

join mp25m.economic_profile_revisions revision
  on revision.economic_profile_id =
    profile.id

join mp25m.internal_users changed_by
  on changed_by.id =
    revision.changed_by_internal_user_id;


revoke all
  on
    mp25m_api.economic_profile_current,
    mp25m_api.economic_profile_revision_list
  from public, anon, authenticated, service_role;


grant select
  on
    mp25m_api.economic_profile_current,
    mp25m_api.economic_profile_revision_list
  to service_role;


-- ============================================================
-- 6. AUTORIZACIÓN DERIVADA
-- ============================================================

create or replace function
mp25m_api.can_manage_economic_source(
  p_actor_internal_user_id uuid,
  p_source_type text,
  p_source_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
  select
    case
      when lower(
        btrim(
          coalesce(p_source_type, '')
        )
      ) = 'opportunity'
      then
        exists (
          select 1
          from mp25m.opportunities opportunity
          where opportunity.id =
            p_source_id
        )

        and exists (
          select 1
          from mp25m.internal_users internal_user
          where internal_user.id =
              p_actor_internal_user_id
            and internal_user.status =
              'active'
            and internal_user.deleted_at
              is null
        )

        and exists (
          select 1
          from mp25m.access_role_assignments assignment

          join mp25m.access_roles role
            on role.code =
              assignment.access_role_code

          join mp25m.access_scopes scope
            on scope.id =
              assignment.access_scope_id

          where assignment.internal_user_id =
              p_actor_internal_user_id

            and assignment.status =
              'active'

            and assignment.revoked_at
              is null

            and assignment.valid_from <=
              now()

            and (
              assignment.valid_until is null
              or assignment.valid_until >
                now()
            )

            and role.is_active = true
            and role.deleted_at is null

            and scope.is_active = true
            and scope.deleted_at is null

            and (
              role.is_administrative = true
              or role.code in (
                'administrator',
                'articulator',
                'authority_analyst'
              )
            )
        )

      when lower(
        btrim(
          coalesce(p_source_type, '')
        )
      ) = 'articulation'
      then
        mp25m_api.can_manage_articulation(
          p_actor_internal_user_id,
          p_source_id
        )

      when lower(
        btrim(
          coalesce(p_source_type, '')
        )
      ) = 'project'
      then
        mp25m_api.can_manage_project(
          p_actor_internal_user_id,
          p_source_id
        )

      else false
    end;
$function$;


revoke all
  on function
    mp25m_api.can_manage_economic_source(
      uuid,
      text,
      uuid
    )
  from public, anon, authenticated, service_role;


grant execute
  on function
    mp25m_api.can_manage_economic_source(
      uuid,
      text,
      uuid
    )
  to service_role;


-- ============================================================
-- 7. CREAR / REVISAR FICHA ECONÓMICA
-- ============================================================

create or replace function
mp25m_api.save_economic_profile_revision(
  p_actor_internal_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_expected_revision_no integer,

  p_currency_code text,

  p_estimated_value numeric,
  p_estimated_costs numeric,
  p_probability_percent numeric,

  p_participant_income_potential numeric,
  p_mp25m_contribution_potential numeric,

  p_distribution_notes text,

  p_agreed_value numeric,

  p_collection_status text,
  p_collected_amount numeric,

  p_final_costs numeric,
  p_participant_income_final numeric,
  p_mp25m_contribution_final numeric,

  p_final_result_amount numeric,

  p_economic_summary text,
  p_evidence_reference text,

  p_rationale text
)
returns table (
  economic_profile_id uuid,
  revision_id uuid,
  revision_no integer
)
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_source_type text :=
    lower(
      btrim(
        coalesce(
          p_source_type,
          ''
        )
      )
    );

  v_currency_code text :=
    nullif(
      upper(
        btrim(
          coalesce(
            p_currency_code,
            ''
          )
        )
      ),
      ''
    );

  v_collection_status text :=
    nullif(
      lower(
        btrim(
          coalesce(
            p_collection_status,
            ''
          )
        )
      ),
      ''
    );

  v_distribution_notes text :=
    nullif(
      btrim(
        coalesce(
          p_distribution_notes,
          ''
        )
      ),
      ''
    );

  v_economic_summary text :=
    nullif(
      btrim(
        coalesce(
          p_economic_summary,
          ''
        )
      ),
      ''
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

  v_profile
    mp25m.economic_profiles%rowtype;

  v_current_revision
    mp25m.economic_profile_revisions%rowtype;

  v_new_revision
    mp25m.economic_profile_revisions%rowtype;

  v_revision_no integer;

  v_action text;

  v_old_data jsonb;
begin
  if v_source_type not in (
    'opportunity',
    'articulation',
    'project'
  ) then
    raise exception
      'Invalid economic profile source type'
      using errcode = '22023';
  end if;


  if p_source_id is null then
    raise exception
      'Economic profile source id is required'
      using errcode = '22023';
  end if;


  if v_source_type = 'opportunity'
     and not exists (
       select 1
       from mp25m.opportunities opportunity
       where opportunity.id =
         p_source_id
     )
  then
    raise exception
      'Opportunity not found'
      using errcode = 'P0002';

  elsif v_source_type = 'articulation'
     and not exists (
       select 1
       from mp25m.opportunity_articulations articulation
       where articulation.id =
         p_source_id
     )
  then
    raise exception
      'Articulation not found'
      using errcode = 'P0002';

  elsif v_source_type = 'project'
     and not exists (
       select 1
       from mp25m.projects project
       where project.id =
         p_source_id
     )
  then
    raise exception
      'Project not found'
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_economic_source(
    p_actor_internal_user_id,
    v_source_type,
    p_source_id
  ) then
    raise exception
      'Actor cannot manage economic profile'
      using errcode = '42501';
  end if;


  if p_expected_revision_no is null
     or p_expected_revision_no < 0
  then
    raise exception
      'Expected economic revision number is required'
      using errcode = '22023';
  end if;


  if v_currency_code is not null
     and v_currency_code !~ '^[A-Z]{3}$'
  then
    raise exception
      'Currency code must contain three uppercase letters'
      using errcode = '22023';
  end if;


  if p_estimated_value is not null
     and p_estimated_value < 0
  then
    raise exception
      'Estimated value cannot be negative'
      using errcode = '22023';
  end if;


  if p_estimated_costs is not null
     and p_estimated_costs < 0
  then
    raise exception
      'Estimated costs cannot be negative'
      using errcode = '22023';
  end if;


  if p_probability_percent is not null
     and (
       p_probability_percent < 0
       or p_probability_percent > 100
     )
  then
    raise exception
      'Probability must be between 0 and 100'
      using errcode = '22023';
  end if;


  if p_participant_income_potential is not null
     and p_participant_income_potential < 0
  then
    raise exception
      'Potential participant income cannot be negative'
      using errcode = '22023';
  end if;


  if p_mp25m_contribution_potential is not null
     and p_mp25m_contribution_potential < 0
  then
    raise exception
      'Potential MP25M contribution cannot be negative'
      using errcode = '22023';
  end if;


  if p_agreed_value is not null
     and p_agreed_value < 0
  then
    raise exception
      'Agreed value cannot be negative'
      using errcode = '22023';
  end if;


  if p_collected_amount is not null
     and p_collected_amount < 0
  then
    raise exception
      'Collected amount cannot be negative'
      using errcode = '22023';
  end if;


  if p_final_costs is not null
     and p_final_costs < 0
  then
    raise exception
      'Final costs cannot be negative'
      using errcode = '22023';
  end if;


  if p_participant_income_final is not null
     and p_participant_income_final < 0
  then
    raise exception
      'Final participant income cannot be negative'
      using errcode = '22023';
  end if;


  if p_mp25m_contribution_final is not null
     and p_mp25m_contribution_final < 0
  then
    raise exception
      'Final MP25M contribution cannot be negative'
      using errcode = '22023';
  end if;


  if v_collection_status is not null
     and v_collection_status not in (
       'pending',
       'partial',
       'collected',
       'uncollectible',
       'cancelled',
       'not_applicable'
     )
  then
    raise exception
      'Invalid collection status'
      using errcode = '22023';
  end if;


  if v_distribution_notes is not null
     and char_length(v_distribution_notes)
       not between 3 and 10000
  then
    raise exception
      'Distribution notes must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;


  if v_economic_summary is not null
     and char_length(v_economic_summary)
       not between 3 and 10000
  then
    raise exception
      'Economic summary must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;


  if v_evidence_reference is not null
     and char_length(v_evidence_reference)
       not between 3 and 2000
  then
    raise exception
      'Evidence reference must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;


  if char_length(v_rationale)
     not between 3 and 2000
  then
    raise exception
      'Economic revision rationale must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;


  if (
    p_estimated_value is not null
    or p_estimated_costs is not null
    or p_participant_income_potential is not null
    or p_mp25m_contribution_potential is not null
    or p_agreed_value is not null
    or p_collected_amount is not null
    or p_final_costs is not null
    or p_participant_income_final is not null
    or p_mp25m_contribution_final is not null
    or p_final_result_amount is not null
  )
  and v_currency_code is null
  then
    raise exception
      'Currency is required when monetary values are informed'
      using errcode = '22023';
  end if;


  if
    v_currency_code is null
    and p_estimated_value is null
    and p_estimated_costs is null
    and p_probability_percent is null
    and p_participant_income_potential is null
    and p_mp25m_contribution_potential is null
    and v_distribution_notes is null
    and p_agreed_value is null
    and v_collection_status is null
    and p_collected_amount is null
    and p_final_costs is null
    and p_participant_income_final is null
    and p_mp25m_contribution_final is null
    and p_final_result_amount is null
    and v_economic_summary is null
    and v_evidence_reference is null
  then
    raise exception
      'Economic profile revision must contain economic information'
      using errcode = '22023';
  end if;


  if v_source_type = 'opportunity' then
    select profile.*
    into v_profile
    from mp25m.economic_profiles profile
    where profile.opportunity_id =
      p_source_id
    for update;

  elsif v_source_type = 'articulation' then
    select profile.*
    into v_profile
    from mp25m.economic_profiles profile
    where profile.articulation_id =
      p_source_id
    for update;

  else
    select profile.*
    into v_profile
    from mp25m.economic_profiles profile
    where profile.project_id =
      p_source_id
    for update;
  end if;


  if not found then
    if p_expected_revision_no <> 0 then
      raise exception
        'Economic profile revision is stale'
        using errcode = '40001';
    end if;

    begin
      insert into mp25m.economic_profiles (
        opportunity_id,
        articulation_id,
        project_id,
        created_by_internal_user_id
      )
      values (
        case
          when v_source_type = 'opportunity'
            then p_source_id
          else null
        end,

        case
          when v_source_type = 'articulation'
            then p_source_id
          else null
        end,

        case
          when v_source_type = 'project'
            then p_source_id
          else null
        end,

        p_actor_internal_user_id
      )
      returning *
      into v_profile;

    exception
      when unique_violation then
        raise exception
          'Economic profile revision is stale'
          using errcode = '40001';
    end;

    v_revision_no := 1;
    v_action := 'economic.profile.create';
    v_old_data := null;

  else
    select revision.*
    into v_current_revision
    from mp25m.economic_profile_revisions revision
    where revision.economic_profile_id =
      v_profile.id
    order by revision.revision_no desc
    limit 1;

    if not found then
      raise exception
        'Economic profile has no revision'
        using errcode = 'P0002';
    end if;

    if p_expected_revision_no <>
       v_current_revision.revision_no
    then
      raise exception
        'Economic profile revision is stale'
        using errcode = '40001';
    end if;

    v_revision_no :=
      v_current_revision.revision_no + 1;

    v_action :=
      'economic.profile.revise';

    v_old_data :=
      to_jsonb(v_current_revision)
      - 'id'
      - 'economic_profile_id'
      - 'changed_by_internal_user_id'
      - 'changed_at';
  end if;


  insert into mp25m.economic_profile_revisions (
    economic_profile_id,
    revision_no,

    currency_code,

    estimated_value,
    estimated_costs,
    probability_percent,

    participant_income_potential,
    mp25m_contribution_potential,

    distribution_notes,

    agreed_value,

    collection_status,
    collected_amount,

    final_costs,
    participant_income_final,
    mp25m_contribution_final,

    final_result_amount,

    economic_summary,
    evidence_reference,

    rationale,

    changed_by_internal_user_id
  )
  values (
    v_profile.id,
    v_revision_no,

    v_currency_code,

    p_estimated_value,
    p_estimated_costs,
    p_probability_percent,

    p_participant_income_potential,
    p_mp25m_contribution_potential,

    v_distribution_notes,

    p_agreed_value,

    v_collection_status,
    p_collected_amount,

    p_final_costs,
    p_participant_income_final,
    p_mp25m_contribution_final,

    p_final_result_amount,

    v_economic_summary,
    v_evidence_reference,

    v_rationale,

    p_actor_internal_user_id
  )
  returning *
  into v_new_revision;


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
    v_action,
    'mp25m',
    'economic_profiles',
    v_profile.id,
    v_rationale,
    v_old_data,

    to_jsonb(v_new_revision)
      - 'id'
      - 'economic_profile_id'
      - 'changed_by_internal_user_id'
      - 'changed_at',

    'allowed',

    jsonb_build_object(
      'economic_profile_id',
        v_profile.id,
      'source_type',
        v_source_type,
      'source_id',
        p_source_id,
      'revision_id',
        v_new_revision.id,
      'revision_no',
        v_new_revision.revision_no
    )
  );


  economic_profile_id :=
    v_profile.id;

  revision_id :=
    v_new_revision.id;

  revision_no :=
    v_new_revision.revision_no;

  return next;
end;
$function$;


revoke all
  on function
    mp25m_api.save_economic_profile_revision(
      uuid,
      text,
      uuid,
      integer,
      text,
      numeric,
      numeric,
      numeric,
      numeric,
      numeric,
      text,
      numeric,
      text,
      numeric,
      numeric,
      numeric,
      numeric,
      numeric,
      text,
      text,
      text
    )
  from public, anon, authenticated, service_role;


grant execute
  on function
    mp25m_api.save_economic_profile_revision(
      uuid,
      text,
      uuid,
      integer,
      text,
      numeric,
      numeric,
      numeric,
      numeric,
      numeric,
      text,
      numeric,
      text,
      numeric,
      numeric,
      numeric,
      numeric,
      numeric,
      text,
      text,
      text
    )
  to service_role;


comment on table
  mp25m.economic_profiles
is
  'Stable economic profile identity for exactly one opportunity, articulation or project.';


comment on table
  mp25m.economic_profile_revisions
is
  'Immutable monetary revisions for one MP25M economic profile.';


comment on view
  mp25m_api.economic_profile_current
is
  'Current economic revision for each opportunity, articulation or project economic profile.';


comment on view
  mp25m_api.economic_profile_revision_list
is
  'Immutable economic revision history for opportunity, articulation and project economic profiles.';


comment on function
  mp25m_api.can_manage_economic_source(
    uuid,
    text,
    uuid
  )
is
  'Server-only derived authorization for 14A economic profile management.';


comment on function
  mp25m_api.save_economic_profile_revision(
    uuid,
    text,
    uuid,
    integer,
    text,
    numeric,
    numeric,
    numeric,
    numeric,
    numeric,
    text,
    numeric,
    text,
    numeric,
    numeric,
    numeric,
    numeric,
    numeric,
    text,
    text,
    text
  )
is
  'Creates or revises one manual economic profile with optimistic concurrency, immutable history and audit.';


commit;
