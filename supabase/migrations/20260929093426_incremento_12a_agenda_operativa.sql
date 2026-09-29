begin;

-- ============================================================================
-- MP25M — Incremento 12A
-- Agenda operativa
--
-- Primera etapa:
-- - entradas manuales de Agenda
-- - historial de estado
-- - integridad referencial
-- - RLS y privilegios mínimos
--
-- Las fechas derivadas de Oportunidades, Entregables y Temas NO se copian.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENTRADAS MANUALES DE AGENDA
-- ---------------------------------------------------------------------------

create table mp25m.agenda_entries (
  id uuid primary key default gen_random_uuid(),

  entry_type text not null
    check (
      entry_type in (
        'meeting',
        'visit',
        'training',
        'demonstration',
        'call',
        'follow_up',
        'deadline',
        'other'
      )
    ),

  title text not null
    check (
      char_length(btrim(title))
      between 3 and 200
    ),

  detail text not null
    check (
      char_length(btrim(detail))
      between 3 and 10000
    ),

  scheduled_date date not null,

  scheduled_time time without time zone,

  time_zone text not null
    default 'America/Argentina/Buenos_Aires'
    check (
      char_length(btrim(time_zone))
      between 1 and 200
    ),

  -- ---------------------------------------------------------
  -- Reuniones
  -- ---------------------------------------------------------

  meeting_mode text
    check (
      meeting_mode is null
      or meeting_mode in (
        'in_person',
        'virtual',
        'hybrid'
      )
    ),

  location_text text
    check (
      location_text is null
      or char_length(btrim(location_text))
         between 3 and 2000
    ),

  meeting_provider text
    check (
      meeting_provider is null
      or meeting_provider in (
        'google_meet',
        'jitsi',
        'other'
      )
    ),

  meeting_url text
    check (
      meeting_url is null
      or char_length(btrim(meeting_url))
         between 3 and 2000
    ),

  -- ---------------------------------------------------------
  -- Ciclo operativo
  -- ---------------------------------------------------------

  status text not null
    default 'scheduled'
    check (
      status in (
        'scheduled',
        'completed',
        'cancelled'
      )
    ),

  responsible_internal_user_id uuid
    references mp25m.internal_users(id)
    on delete restrict,

  -- ---------------------------------------------------------
  -- Origen explícito opcional.
  -- Cero o exactamente uno.
  -- ---------------------------------------------------------

  opportunity_id uuid
    references mp25m.opportunities(id)
    on delete restrict,

  articulation_id uuid
    references mp25m.opportunity_articulations(id)
    on delete restrict,

  project_id uuid
    references mp25m.projects(id)
    on delete restrict,

  theme_id uuid
    references mp25m.themes(id)
    on delete restrict,

  need_offer_id uuid
    references mp25m.needs_offers(id)
    on delete restrict,

  -- ---------------------------------------------------------
  -- Trazabilidad
  -- ---------------------------------------------------------

  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  completed_at timestamptz,

  cancelled_at timestamptz,

  status_rationale text,

  -- ---------------------------------------------------------
  -- Constraints
  -- ---------------------------------------------------------

  constraint agenda_entries_one_origin_check
    check (
      (opportunity_id is not null)::integer
      + (articulation_id is not null)::integer
      + (project_id is not null)::integer
      + (theme_id is not null)::integer
      + (need_offer_id is not null)::integer
      <= 1
    ),

  constraint agenda_entries_meeting_fields_check
    check (
      (
        entry_type = 'meeting'
      )
      or (
        meeting_mode is null
        and meeting_provider is null
        and meeting_url is null
      )
    ),

  constraint agenda_entries_virtual_provider_check
    check (
      meeting_provider is null
      or meeting_mode in (
        'virtual',
        'hybrid'
      )
    ),

  constraint agenda_entries_virtual_url_check
    check (
      meeting_url is null
      or meeting_mode in (
        'virtual',
        'hybrid'
      )
    ),

  constraint agenda_entries_terminal_state_check
    check (
      (
        status = 'scheduled'
        and completed_at is null
        and cancelled_at is null
        and status_rationale is null
      )
      or
      (
        status = 'completed'
        and completed_at is not null
        and cancelled_at is null
        and char_length(
          btrim(
            coalesce(
              status_rationale,
              ''
            )
          )
        ) between 3 and 10000
      )
      or
      (
        status = 'cancelled'
        and cancelled_at is not null
        and completed_at is null
        and char_length(
          btrim(
            coalesce(
              status_rationale,
              ''
            )
          )
        ) between 3 and 10000
      )
    )
);


-- ---------------------------------------------------------------------------
-- 2. HISTORIAL DE ESTADO
-- ---------------------------------------------------------------------------

create table mp25m.agenda_entry_status_history (
  id uuid primary key
    default gen_random_uuid(),

  agenda_entry_id uuid not null
    references mp25m.agenda_entries(id)
    on delete restrict,

  transition_no integer not null
    check (
      transition_no > 0
    ),

  status text not null
    check (
      status in (
        'scheduled',
        'completed',
        'cancelled'
      )
    ),

  rationale text not null
    check (
      char_length(btrim(rationale))
      between 3 and 10000
    ),

  changed_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  changed_at timestamptz not null
    default now(),

  unique (
    agenda_entry_id,
    transition_no
  )
);


-- ---------------------------------------------------------------------------
-- 3. UPDATED_AT
-- ---------------------------------------------------------------------------

create trigger trg_agenda_entries_updated_at
before update
on mp25m.agenda_entries
for each row
execute function mp25m.set_updated_at();


-- ---------------------------------------------------------------------------
-- 4. ÍNDICES
-- ---------------------------------------------------------------------------

create index agenda_entries_schedule_idx
  on mp25m.agenda_entries (
    scheduled_date,
    scheduled_time,
    id
  );

create index agenda_entries_responsible_schedule_idx
  on mp25m.agenda_entries (
    responsible_internal_user_id,
    scheduled_date
  )
  where responsible_internal_user_id
        is not null;

create index agenda_entries_status_schedule_idx
  on mp25m.agenda_entries (
    status,
    scheduled_date
  );

create index agenda_entries_opportunity_idx
  on mp25m.agenda_entries (
    opportunity_id
  )
  where opportunity_id is not null;

create index agenda_entries_articulation_idx
  on mp25m.agenda_entries (
    articulation_id
  )
  where articulation_id is not null;

create index agenda_entries_project_idx
  on mp25m.agenda_entries (
    project_id
  )
  where project_id is not null;

create index agenda_entries_theme_idx
  on mp25m.agenda_entries (
    theme_id
  )
  where theme_id is not null;

create index agenda_entries_need_offer_idx
  on mp25m.agenda_entries (
    need_offer_id
  )
  where need_offer_id is not null;

create index agenda_entry_status_history_entry_idx
  on mp25m.agenda_entry_status_history (
    agenda_entry_id,
    transition_no desc
  );


-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

alter table mp25m.agenda_entries
enable row level security;

alter table mp25m.agenda_entry_status_history
enable row level security;


-- ---------------------------------------------------------------------------
-- 6. PRIVILEGIOS
-- ---------------------------------------------------------------------------

revoke all
on table
  mp25m.agenda_entries,
  mp25m.agenda_entry_status_history
from
  public,
  anon,
  authenticated,
  service_role;

grant
  select,
  insert,
  update
on table
  mp25m.agenda_entries
to
  service_role;

grant
  select,
  insert
on table
  mp25m.agenda_entry_status_history
to
  service_role;


-- ---------------------------------------------------------------------------
-- 7. AUTORIZACIÓN DE AGENDA
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.can_create_agenda_entry(
  p_actor_internal_user_id uuid,
  p_opportunity_id uuid,
  p_articulation_id uuid,
  p_project_id uuid,
  p_theme_id uuid,
  p_need_offer_id uuid
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
    (
      (p_opportunity_id is not null)::integer
      + (p_articulation_id is not null)::integer
      + (p_project_id is not null)::integer
      + (p_theme_id is not null)::integer
      + (p_need_offer_id is not null)::integer
      <= 1
    )

    and exists (
      select 1
      from mp25m.internal_users internal_user
      where internal_user.id =
          p_actor_internal_user_id
        and internal_user.status = 'active'
        and internal_user.deleted_at is null
    )

    and case
      when p_opportunity_id is not null then
        mp25m_api.can_operate_opportunity_requirement(
          p_actor_internal_user_id,
          p_opportunity_id,
          'formulate'
        )

      when p_articulation_id is not null then
        mp25m_api.can_manage_articulation(
          p_actor_internal_user_id,
          p_articulation_id
        )

      when p_project_id is not null then
        mp25m_api.can_manage_project(
          p_actor_internal_user_id,
          p_project_id
        )

      when p_theme_id is not null then
        mp25m_api.can_operate_theme(
          p_actor_internal_user_id,
          p_theme_id,
          'manage'
        )

      when p_need_offer_id is not null then
        mp25m_api.can_operate_need_offer(
          p_actor_internal_user_id,
          p_need_offer_id,
          'manage'
        )

      else
        exists (
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
            and assignment.status = 'active'
            and assignment.revoked_at is null
            and assignment.valid_from <= now()
            and (
              assignment.valid_until is null
              or assignment.valid_until > now()
            )
            and role.is_active = true
            and role.deleted_at is null
            and scope.is_active = true
            and scope.deleted_at is null
        )
    end;
$function$;


create or replace function mp25m_api.can_manage_agenda_entry(
  p_actor_internal_user_id uuid,
  p_agenda_entry_id uuid
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
    exists (
      select 1
      from mp25m.internal_users internal_user
      where internal_user.id =
          p_actor_internal_user_id
        and internal_user.status = 'active'
        and internal_user.deleted_at is null
    )

    and exists (
      select 1
      from mp25m.agenda_entries entry
      where entry.id =
        p_agenda_entry_id
    )

    and exists (
      select 1
      from mp25m.agenda_entries entry
      where entry.id =
        p_agenda_entry_id

        and case
          when entry.opportunity_id is not null then
            mp25m_api.can_operate_opportunity_requirement(
              p_actor_internal_user_id,
              entry.opportunity_id,
              'formulate'
            )

          when entry.articulation_id is not null then
            mp25m_api.can_manage_articulation(
              p_actor_internal_user_id,
              entry.articulation_id
            )

          when entry.project_id is not null then
            mp25m_api.can_manage_project(
              p_actor_internal_user_id,
              entry.project_id
            )

          when entry.theme_id is not null then
            mp25m_api.can_operate_theme(
              p_actor_internal_user_id,
              entry.theme_id,
              'manage'
            )

          when entry.need_offer_id is not null then
            mp25m_api.can_operate_need_offer(
              p_actor_internal_user_id,
              entry.need_offer_id,
              'manage'
            )

          else
            entry.created_by_internal_user_id =
              p_actor_internal_user_id

            or exists (
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
                and assignment.status = 'active'
                and assignment.revoked_at is null
                and assignment.valid_from <= now()
                and (
                  assignment.valid_until is null
                  or assignment.valid_until > now()
                )
                and role.is_administrative = true
                and role.is_active = true
                and role.deleted_at is null
                and scope.scope_type = 'global'
                and scope.is_active = true
                and scope.deleted_at is null
            )
        end
    );
$function$;


revoke all
on function mp25m_api.can_create_agenda_entry(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated, service_role;

revoke all
on function mp25m_api.can_manage_agenda_entry(
  uuid,
  uuid
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.can_create_agenda_entry(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid
)
to service_role;

grant execute
on function mp25m_api.can_manage_agenda_entry(
  uuid,
  uuid
)
to service_role;


-- ---------------------------------------------------------------------------
-- 8. CREACIÓN
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.create_agenda_entry(
  p_actor_internal_user_id uuid,
  p_entry_type text,
  p_title text,
  p_detail text,
  p_scheduled_date date,
  p_scheduled_time time without time zone default null,
  p_time_zone text default 'America/Argentina/Buenos_Aires',
  p_meeting_mode text default null,
  p_location_text text default null,
  p_meeting_provider text default null,
  p_meeting_url text default null,
  p_responsible_internal_user_id uuid default null,
  p_opportunity_id uuid default null,
  p_articulation_id uuid default null,
  p_project_id uuid default null,
  p_theme_id uuid default null,
  p_need_offer_id uuid default null
)
returns table (
  agenda_entry_id uuid,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_entry_id uuid;
  v_created_at timestamptz;

  v_title text;
  v_detail text;
  v_time_zone text;
  v_meeting_mode text;
  v_location_text text;
  v_meeting_provider text;
  v_meeting_url text;

  v_origin_count integer;
begin
  v_title =
    nullif(
      btrim(
        coalesce(
          p_title,
          ''
        )
      ),
      ''
    );

  v_detail =
    nullif(
      btrim(
        coalesce(
          p_detail,
          ''
        )
      ),
      ''
    );

  v_time_zone =
    nullif(
      btrim(
        coalesce(
          p_time_zone,
          ''
        )
      ),
      ''
    );

  v_meeting_mode =
    nullif(
      btrim(
        coalesce(
          p_meeting_mode,
          ''
        )
      ),
      ''
    );

  v_location_text =
    nullif(
      btrim(
        coalesce(
          p_location_text,
          ''
        )
      ),
      ''
    );

  v_meeting_provider =
    nullif(
      btrim(
        coalesce(
          p_meeting_provider,
          ''
        )
      ),
      ''
    );

  v_meeting_url =
    nullif(
      btrim(
        coalesce(
          p_meeting_url,
          ''
        )
      ),
      ''
    );


  if p_entry_type not in (
    'meeting',
    'visit',
    'training',
    'demonstration',
    'call',
    'follow_up',
    'deadline',
    'other'
  ) then
    raise exception
      'Invalid agenda entry type'
      using errcode = '22023';
  end if;


  if v_title is null
     or char_length(v_title)
        not between 3 and 200
  then
    raise exception
      'Invalid agenda entry title'
      using errcode = '22023';
  end if;


  if v_detail is null
     or char_length(v_detail)
        not between 3 and 10000
  then
    raise exception
      'Invalid agenda entry detail'
      using errcode = '22023';
  end if;


  if p_scheduled_date is null then
    raise exception
      'Agenda scheduled date is required'
      using errcode = '22023';
  end if;


  if v_time_zone is null
     or not exists (
       select 1
       from pg_catalog.pg_timezone_names timezone_record
       where timezone_record.name =
         v_time_zone
     )
  then
    raise exception
      'Invalid agenda time zone'
      using errcode = '22023';
  end if;


  if p_entry_type <> 'meeting'
     and (
       v_meeting_mode is not null
       or v_meeting_provider is not null
       or v_meeting_url is not null
     )
  then
    raise exception
      'Meeting fields require a meeting agenda entry'
      using errcode = '22023';
  end if;


  if v_meeting_mode is not null
     and v_meeting_mode not in (
       'in_person',
       'virtual',
       'hybrid'
     )
  then
    raise exception
      'Invalid meeting mode'
      using errcode = '22023';
  end if;


  if v_meeting_provider is not null
     and v_meeting_provider not in (
       'google_meet',
       'jitsi',
       'other'
     )
  then
    raise exception
      'Invalid meeting provider'
      using errcode = '22023';
  end if;


  if (
       v_meeting_provider is not null
       or v_meeting_url is not null
     )
     and v_meeting_mode not in (
       'virtual',
       'hybrid'
     )
  then
    raise exception
      'Virtual meeting data requires virtual or hybrid mode'
      using errcode = '22023';
  end if;


  if v_location_text is not null
     and char_length(v_location_text)
        not between 3 and 2000
  then
    raise exception
      'Invalid agenda location'
      using errcode = '22023';
  end if;


  if v_meeting_url is not null
     and (
       char_length(v_meeting_url)
         not between 3 and 2000

       or v_meeting_url !~*
         '^https?://'
     )
  then
    raise exception
      'Invalid meeting URL'
      using errcode = '22023';
  end if;


  if p_responsible_internal_user_id
       is not null

     and not exists (
       select 1
       from mp25m.internal_users internal_user
       where internal_user.id =
           p_responsible_internal_user_id
         and internal_user.status = 'active'
         and internal_user.deleted_at is null
     )
  then
    raise exception
      'Invalid or inactive agenda responsible user'
      using errcode = '23503';
  end if;


  v_origin_count =
      (p_opportunity_id is not null)::integer
    + (p_articulation_id is not null)::integer
    + (p_project_id is not null)::integer
    + (p_theme_id is not null)::integer
    + (p_need_offer_id is not null)::integer;


  if v_origin_count > 1 then
    raise exception
      'Agenda entry accepts at most one explicit origin'
      using errcode = '22023';
  end if;


  if p_opportunity_id is not null
     and not exists (
       select 1
       from mp25m.opportunities opportunity
       where opportunity.id =
         p_opportunity_id
     )
  then
    raise exception
      'Agenda opportunity origin not found'
      using errcode = 'P0002';
  end if;


  if p_articulation_id is not null
     and not exists (
       select 1
       from mp25m.opportunity_articulations articulation
       where articulation.id =
         p_articulation_id
     )
  then
    raise exception
      'Agenda articulation origin not found'
      using errcode = 'P0002';
  end if;


  if p_project_id is not null
     and not exists (
       select 1
       from mp25m.projects project
       where project.id =
         p_project_id
     )
  then
    raise exception
      'Agenda project origin not found'
      using errcode = 'P0002';
  end if;


  if p_theme_id is not null
     and not exists (
       select 1
       from mp25m.themes theme
       where theme.id =
         p_theme_id
     )
  then
    raise exception
      'Agenda theme origin not found'
      using errcode = 'P0002';
  end if;


  if p_need_offer_id is not null
     and not exists (
       select 1
       from mp25m.needs_offers need_offer
       where need_offer.id =
         p_need_offer_id
     )
  then
    raise exception
      'Agenda need/offer origin not found'
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_create_agenda_entry(
    p_actor_internal_user_id,
    p_opportunity_id,
    p_articulation_id,
    p_project_id,
    p_theme_id,
    p_need_offer_id
  ) then
    raise exception
      'Internal user cannot create this agenda entry'
      using errcode = '42501';
  end if;


  insert into mp25m.agenda_entries (
    entry_type,
    title,
    detail,
    scheduled_date,
    scheduled_time,
    time_zone,
    meeting_mode,
    location_text,
    meeting_provider,
    meeting_url,
    status,
    responsible_internal_user_id,
    opportunity_id,
    articulation_id,
    project_id,
    theme_id,
    need_offer_id,
    created_by_internal_user_id
  )
  values (
    p_entry_type,
    v_title,
    v_detail,
    p_scheduled_date,
    p_scheduled_time,
    v_time_zone,
    v_meeting_mode,
    v_location_text,
    v_meeting_provider,
    v_meeting_url,
    'scheduled',
    p_responsible_internal_user_id,
    p_opportunity_id,
    p_articulation_id,
    p_project_id,
    p_theme_id,
    p_need_offer_id,
    p_actor_internal_user_id
  )
  returning
    id,
    mp25m.agenda_entries.created_at
  into
    v_entry_id,
    v_created_at;


  insert into mp25m.agenda_entry_status_history (
    agenda_entry_id,
    transition_no,
    status,
    rationale,
    changed_by_internal_user_id,
    changed_at
  )
  values (
    v_entry_id,
    1,
    'scheduled',
    v_detail,
    p_actor_internal_user_id,
    v_created_at
  );


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
    'agenda.entry.create',
    'mp25m',
    'agenda_entries',
    v_entry_id,
    v_detail,

    jsonb_build_object(
      'entry_type', p_entry_type,
      'title', v_title,
      'scheduled_date', p_scheduled_date,
      'scheduled_time', p_scheduled_time,
      'time_zone', v_time_zone,
      'meeting_mode', v_meeting_mode,
      'location_text', v_location_text,
      'meeting_provider', v_meeting_provider,
      'meeting_url', v_meeting_url,
      'status', 'scheduled',
      'responsible_internal_user_id',
        p_responsible_internal_user_id
    ),

    'allowed',

    jsonb_build_object(
      'opportunity_id', p_opportunity_id,
      'articulation_id', p_articulation_id,
      'project_id', p_project_id,
      'theme_id', p_theme_id,
      'need_offer_id', p_need_offer_id
    )
  );


  agenda_entry_id :=
    v_entry_id;

  created_at :=
    v_created_at;

  return next;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 9. CORRECCIÓN
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.update_agenda_entry(
  p_actor_internal_user_id uuid,
  p_agenda_entry_id uuid,
  p_entry_type text,
  p_title text,
  p_detail text,
  p_scheduled_date date,
  p_rationale text,
  p_scheduled_time time without time zone default null,
  p_time_zone text default 'America/Argentina/Buenos_Aires',
  p_meeting_mode text default null,
  p_location_text text default null,
  p_meeting_provider text default null,
  p_meeting_url text default null,
  p_responsible_internal_user_id uuid default null,
  p_opportunity_id uuid default null,
  p_articulation_id uuid default null,
  p_project_id uuid default null,
  p_theme_id uuid default null,
  p_need_offer_id uuid default null
)
returns table (
  agenda_entry_id uuid,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_before mp25m.agenda_entries%rowtype;

  v_title text;
  v_detail text;
  v_rationale text;
  v_time_zone text;
  v_meeting_mode text;
  v_location_text text;
  v_meeting_provider text;
  v_meeting_url text;

  v_origin_count integer;
  v_updated_at timestamptz;
  v_can_be_independent boolean;
begin
  select *
  into v_before
  from mp25m.agenda_entries entry
  where entry.id =
    p_agenda_entry_id
  for update;


  if not found then
    raise exception
      'Agenda entry not found'
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_agenda_entry(
    p_actor_internal_user_id,
    p_agenda_entry_id
  ) then
    raise exception
      'Internal user cannot update this agenda entry'
      using errcode = '42501';
  end if;


  if v_before.status <> 'scheduled' then
    raise exception
      'Only scheduled agenda entries may be corrected'
      using errcode = '22023';
  end if;


  v_title =
    nullif(
      btrim(
        coalesce(
          p_title,
          ''
        )
      ),
      ''
    );

  v_detail =
    nullif(
      btrim(
        coalesce(
          p_detail,
          ''
        )
      ),
      ''
    );

  v_rationale =
    nullif(
      btrim(
        coalesce(
          p_rationale,
          ''
        )
      ),
      ''
    );

  v_time_zone =
    nullif(
      btrim(
        coalesce(
          p_time_zone,
          ''
        )
      ),
      ''
    );

  v_meeting_mode =
    nullif(
      btrim(
        coalesce(
          p_meeting_mode,
          ''
        )
      ),
      ''
    );

  v_location_text =
    nullif(
      btrim(
        coalesce(
          p_location_text,
          ''
        )
      ),
      ''
    );

  v_meeting_provider =
    nullif(
      btrim(
        coalesce(
          p_meeting_provider,
          ''
        )
      ),
      ''
    );

  v_meeting_url =
    nullif(
      btrim(
        coalesce(
          p_meeting_url,
          ''
        )
      ),
      ''
    );


  if p_entry_type not in (
    'meeting',
    'visit',
    'training',
    'demonstration',
    'call',
    'follow_up',
    'deadline',
    'other'
  ) then
    raise exception
      'Invalid agenda entry type'
      using errcode = '22023';
  end if;


  if v_title is null
     or char_length(v_title)
        not between 3 and 200
  then
    raise exception
      'Invalid agenda entry title'
      using errcode = '22023';
  end if;


  if v_detail is null
     or char_length(v_detail)
        not between 3 and 10000
  then
    raise exception
      'Invalid agenda entry detail'
      using errcode = '22023';
  end if;


  if v_rationale is null
     or char_length(v_rationale)
        not between 3 and 10000
  then
    raise exception
      'Invalid agenda correction rationale'
      using errcode = '22023';
  end if;


  if p_scheduled_date is null then
    raise exception
      'Agenda scheduled date is required'
      using errcode = '22023';
  end if;


  if v_time_zone is null
     or not exists (
       select 1
       from pg_catalog.pg_timezone_names timezone_record
       where timezone_record.name =
         v_time_zone
     )
  then
    raise exception
      'Invalid agenda time zone'
      using errcode = '22023';
  end if;


  if p_entry_type <> 'meeting'
     and (
       v_meeting_mode is not null
       or v_meeting_provider is not null
       or v_meeting_url is not null
     )
  then
    raise exception
      'Meeting fields require a meeting agenda entry'
      using errcode = '22023';
  end if;


  if v_meeting_mode is not null
     and v_meeting_mode not in (
       'in_person',
       'virtual',
       'hybrid'
     )
  then
    raise exception
      'Invalid meeting mode'
      using errcode = '22023';
  end if;


  if v_meeting_provider is not null
     and v_meeting_provider not in (
       'google_meet',
       'jitsi',
       'other'
     )
  then
    raise exception
      'Invalid meeting provider'
      using errcode = '22023';
  end if;


  if (
       v_meeting_provider is not null
       or v_meeting_url is not null
     )
     and v_meeting_mode not in (
       'virtual',
       'hybrid'
     )
  then
    raise exception
      'Virtual meeting data requires virtual or hybrid mode'
      using errcode = '22023';
  end if;


  if v_location_text is not null
     and char_length(v_location_text)
        not between 3 and 2000
  then
    raise exception
      'Invalid agenda location'
      using errcode = '22023';
  end if;


  if v_meeting_url is not null
     and (
       char_length(v_meeting_url)
         not between 3 and 2000

       or v_meeting_url !~*
         '^https?://'
     )
  then
    raise exception
      'Invalid meeting URL'
      using errcode = '22023';
  end if;


  if p_responsible_internal_user_id
       is not null

     and not exists (
       select 1
       from mp25m.internal_users internal_user
       where internal_user.id =
           p_responsible_internal_user_id
         and internal_user.status = 'active'
         and internal_user.deleted_at is null
     )
  then
    raise exception
      'Invalid or inactive agenda responsible user'
      using errcode = '23503';
  end if;


  v_origin_count =
      (p_opportunity_id is not null)::integer
    + (p_articulation_id is not null)::integer
    + (p_project_id is not null)::integer
    + (p_theme_id is not null)::integer
    + (p_need_offer_id is not null)::integer;


  if v_origin_count > 1 then
    raise exception
      'Agenda entry accepts at most one explicit origin'
      using errcode = '22023';
  end if;


  if p_opportunity_id is not null
     and not exists (
       select 1
       from mp25m.opportunities opportunity
       where opportunity.id =
         p_opportunity_id
     )
  then
    raise exception
      'Agenda opportunity origin not found'
      using errcode = 'P0002';
  end if;


  if p_articulation_id is not null
     and not exists (
       select 1
       from mp25m.opportunity_articulations articulation
       where articulation.id =
         p_articulation_id
     )
  then
    raise exception
      'Agenda articulation origin not found'
      using errcode = 'P0002';
  end if;


  if p_project_id is not null
     and not exists (
       select 1
       from mp25m.projects project
       where project.id =
         p_project_id
     )
  then
    raise exception
      'Agenda project origin not found'
      using errcode = 'P0002';
  end if;


  if p_theme_id is not null
     and not exists (
       select 1
       from mp25m.themes theme
       where theme.id =
         p_theme_id
     )
  then
    raise exception
      'Agenda theme origin not found'
      using errcode = 'P0002';
  end if;


  if p_need_offer_id is not null
     and not exists (
       select 1
       from mp25m.needs_offers need_offer
       where need_offer.id =
         p_need_offer_id
     )
  then
    raise exception
      'Agenda need/offer origin not found'
      using errcode = 'P0002';
  end if;


  if v_origin_count > 0 then
    if not mp25m_api.can_create_agenda_entry(
      p_actor_internal_user_id,
      p_opportunity_id,
      p_articulation_id,
      p_project_id,
      p_theme_id,
      p_need_offer_id
    ) then
      raise exception
        'Internal user cannot assign this agenda origin'
        using errcode = '42501';
    end if;

  else
    select
      (
        v_before.created_by_internal_user_id =
          p_actor_internal_user_id
      )

      or exists (
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
          and assignment.status = 'active'
          and assignment.revoked_at is null
          and assignment.valid_from <= now()
          and (
            assignment.valid_until is null
            or assignment.valid_until > now()
          )
          and role.is_administrative = true
          and role.is_active = true
          and role.deleted_at is null
          and scope.scope_type = 'global'
          and scope.is_active = true
          and scope.deleted_at is null
      )
    into
      v_can_be_independent;


    if not v_can_be_independent then
      raise exception
        'Internal user cannot detach this agenda entry from its origin'
        using errcode = '42501';
    end if;
  end if;


  update mp25m.agenda_entries entry
  set
    entry_type =
      p_entry_type,

    title =
      v_title,

    detail =
      v_detail,

    scheduled_date =
      p_scheduled_date,

    scheduled_time =
      p_scheduled_time,

    time_zone =
      v_time_zone,

    meeting_mode =
      v_meeting_mode,

    location_text =
      v_location_text,

    meeting_provider =
      v_meeting_provider,

    meeting_url =
      v_meeting_url,

    responsible_internal_user_id =
      p_responsible_internal_user_id,

    opportunity_id =
      p_opportunity_id,

    articulation_id =
      p_articulation_id,

    project_id =
      p_project_id,

    theme_id =
      p_theme_id,

    need_offer_id =
      p_need_offer_id

  where entry.id =
    p_agenda_entry_id

  returning
    entry.updated_at
  into
    v_updated_at;


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    new_data,
    result
  )
  values (
    p_actor_internal_user_id,
    'agenda.entry.update',
    'mp25m',
    'agenda_entries',
    p_agenda_entry_id,
    v_rationale,

    jsonb_build_object(
      'entry_type', v_before.entry_type,
      'title', v_before.title,
      'detail', v_before.detail,
      'scheduled_date', v_before.scheduled_date,
      'scheduled_time', v_before.scheduled_time,
      'time_zone', v_before.time_zone,
      'meeting_mode', v_before.meeting_mode,
      'location_text', v_before.location_text,
      'meeting_provider', v_before.meeting_provider,
      'meeting_url', v_before.meeting_url,
      'responsible_internal_user_id',
        v_before.responsible_internal_user_id,
      'opportunity_id', v_before.opportunity_id,
      'articulation_id', v_before.articulation_id,
      'project_id', v_before.project_id,
      'theme_id', v_before.theme_id,
      'need_offer_id', v_before.need_offer_id
    ),

    jsonb_build_object(
      'entry_type', p_entry_type,
      'title', v_title,
      'detail', v_detail,
      'scheduled_date', p_scheduled_date,
      'scheduled_time', p_scheduled_time,
      'time_zone', v_time_zone,
      'meeting_mode', v_meeting_mode,
      'location_text', v_location_text,
      'meeting_provider', v_meeting_provider,
      'meeting_url', v_meeting_url,
      'responsible_internal_user_id',
        p_responsible_internal_user_id,
      'opportunity_id', p_opportunity_id,
      'articulation_id', p_articulation_id,
      'project_id', p_project_id,
      'theme_id', p_theme_id,
      'need_offer_id', p_need_offer_id
    ),

    'allowed'
  );


  agenda_entry_id :=
    p_agenda_entry_id;

  updated_at :=
    v_updated_at;

  return next;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 10. TRANSICIÓN
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.transition_agenda_entry(
  p_actor_internal_user_id uuid,
  p_agenda_entry_id uuid,
  p_status text,
  p_rationale text
)
returns table (
  agenda_entry_id uuid,
  transition_no integer,
  changed_at timestamptz
)
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_before mp25m.agenda_entries%rowtype;
  v_rationale text;
  v_transition_no integer;
  v_changed_at timestamptz;
begin
  v_rationale =
    nullif(
      btrim(
        coalesce(
          p_rationale,
          ''
        )
      ),
      ''
    );


  if p_status not in (
    'completed',
    'cancelled'
  ) then
    raise exception
      'Invalid agenda transition status'
      using errcode = '22023';
  end if;


  if v_rationale is null
     or char_length(v_rationale)
        not between 3 and 10000
  then
    raise exception
      'Invalid agenda transition rationale'
      using errcode = '22023';
  end if;


  select *
  into v_before
  from mp25m.agenda_entries entry
  where entry.id =
    p_agenda_entry_id
  for update;


  if not found then
    raise exception
      'Agenda entry not found'
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_agenda_entry(
    p_actor_internal_user_id,
    p_agenda_entry_id
  ) then
    raise exception
      'Internal user cannot transition this agenda entry'
      using errcode = '42501';
  end if;


  if v_before.status <> 'scheduled' then
    raise exception
      'Agenda entry is already terminal'
      using errcode = '22023';
  end if;


  select
    coalesce(
      max(history.transition_no),
      0
    ) + 1
  into
    v_transition_no
  from mp25m.agenda_entry_status_history history
  where history.agenda_entry_id =
    p_agenda_entry_id;


  update mp25m.agenda_entries entry
  set
    status =
      p_status,

    completed_at =
      case
        when p_status = 'completed'
          then now()
        else null
      end,

    cancelled_at =
      case
        when p_status = 'cancelled'
          then now()
        else null
      end,

    status_rationale =
      v_rationale

  where entry.id =
    p_agenda_entry_id

  returning
    entry.updated_at
  into
    v_changed_at;


  insert into mp25m.agenda_entry_status_history (
    agenda_entry_id,
    transition_no,
    status,
    rationale,
    changed_by_internal_user_id,
    changed_at
  )
  values (
    p_agenda_entry_id,
    v_transition_no,
    p_status,
    v_rationale,
    p_actor_internal_user_id,
    v_changed_at
  );


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
    'agenda.entry.transition',
    'mp25m',
    'agenda_entries',
    p_agenda_entry_id,
    v_rationale,

    jsonb_build_object(
      'status', v_before.status
    ),

    jsonb_build_object(
      'status', p_status
    ),

    'allowed',

    jsonb_build_object(
      'transition_no',
      v_transition_no
    )
  );


  agenda_entry_id :=
    p_agenda_entry_id;

  transition_no :=
    v_transition_no;

  changed_at :=
    v_changed_at;

  return next;
end;
$function$;


revoke all
on function mp25m_api.create_agenda_entry(
  uuid,
  text,
  text,
  text,
  date,
  time without time zone,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated, service_role;

revoke all
on function mp25m_api.update_agenda_entry(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  text,
  time without time zone,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated, service_role;

revoke all
on function mp25m_api.transition_agenda_entry(
  uuid,
  uuid,
  text,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.create_agenda_entry(
  uuid,
  text,
  text,
  text,
  date,
  time without time zone,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid
)
to service_role;

grant execute
on function mp25m_api.update_agenda_entry(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  text,
  time without time zone,
  text,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid
)
to service_role;

grant execute
on function mp25m_api.transition_agenda_entry(
  uuid,
  uuid,
  text,
  text
)
to service_role;


-- ---------------------------------------------------------------------------
-- 11. VISTA UNIFICADA DE AGENDA
-- ---------------------------------------------------------------------------

create view mp25m_api.agenda_item_list
with (security_invoker = true)
as

-- ===========================================================================
-- Entradas manuales
-- ===========================================================================

select
  'manual:' || entry.id::text
    as item_key,

  'manual'::text
    as item_kind,

  'manual'::text
    as item_origin,

  entry.id
    as agenda_entry_id,

  case
    when entry.opportunity_id is not null
      then 'opportunity'
    when entry.articulation_id is not null
      then 'articulation'
    when entry.project_id is not null
      then 'project'
    when entry.theme_id is not null
      then 'theme'
    when entry.need_offer_id is not null
      then 'need_offer'
    else null
  end::text
    as source_type,

  coalesce(
    entry.opportunity_id,
    entry.articulation_id,
    entry.project_id,
    entry.theme_id,
    entry.need_offer_id
  )
    as source_id,

  coalesce(
    entry.opportunity_id,
    entry.articulation_id,
    entry.project_id,
    entry.theme_id,
    entry.need_offer_id
  )
    as source_record_id,

  coalesce(
    opportunity.title,
    articulation.title,
    project.title,
    theme.name,
    need_offer.title
  )::text
    as source_title,

  entry.entry_type,
  entry.title,
  entry.detail,

  entry.scheduled_date,
  entry.scheduled_time,
  entry.time_zone,

  entry.meeting_mode,
  entry.location_text,
  entry.meeting_provider,
  entry.meeting_url,

  entry.status
    as agenda_status,

  entry.responsible_internal_user_id,

  responsible.display_name::text
    as responsible_display_name,

  entry.created_by_internal_user_id,

  creator.display_name::text
    as created_by_display_name,

  entry.completed_at,
  entry.cancelled_at,
  entry.status_rationale,

  entry.created_at,
  entry.updated_at

from mp25m.agenda_entries entry

left join mp25m.opportunities opportunity
  on opportunity.id =
    entry.opportunity_id

left join mp25m.opportunity_articulations articulation
  on articulation.id =
    entry.articulation_id

left join mp25m.projects project
  on project.id =
    entry.project_id

left join mp25m.themes theme
  on theme.id =
    entry.theme_id

left join mp25m.needs_offers need_offer
  on need_offer.id =
    entry.need_offer_id

left join mp25m.internal_users responsible
  on responsible.id =
    entry.responsible_internal_user_id

join mp25m.internal_users creator
  on creator.id =
    entry.created_by_internal_user_id


union all


-- ===========================================================================
-- Vencimientos derivados de Oportunidades
-- ===========================================================================

select
  'opportunity_due:' || opportunity.id::text
    as item_key,

  'opportunity_due'::text
    as item_kind,

  'derived'::text
    as item_origin,

  null::uuid
    as agenda_entry_id,

  'opportunity'::text
    as source_type,

  opportunity.id
    as source_id,

  opportunity.id
    as source_record_id,

  opportunity.title::text
    as source_title,

  'deadline'::text
    as entry_type,

  opportunity.title::text
    as title,

  opportunity.description::text
    as detail,

  opportunity.due_date
    as scheduled_date,

  null::time without time zone
    as scheduled_time,

  'America/Argentina/Buenos_Aires'::text
    as time_zone,

  null::text
    as meeting_mode,

  null::text
    as location_text,

  null::text
    as meeting_provider,

  null::text
    as meeting_url,

  'scheduled'::text
    as agenda_status,

  opportunity.assigned_to_internal_user_id
    as responsible_internal_user_id,

  responsible.display_name::text
    as responsible_display_name,

  opportunity.created_by_internal_user_id,

  creator.display_name::text
    as created_by_display_name,

  null::timestamptz
    as completed_at,

  null::timestamptz
    as cancelled_at,

  null::text
    as status_rationale,

  opportunity.created_at,
  opportunity.updated_at

from mp25m.opportunities opportunity

left join mp25m.internal_users responsible
  on responsible.id =
    opportunity.assigned_to_internal_user_id

join mp25m.internal_users creator
  on creator.id =
    opportunity.created_by_internal_user_id

where opportunity.due_date is not null

  and opportunity.status not in (
    'resolved',
    'discarded'
  )


union all


-- ===========================================================================
-- Fechas objetivo derivadas de Entregables
-- ===========================================================================

select
  'project_deliverable:' || deliverable.id::text
    as item_key,

  'project_deliverable'::text
    as item_kind,

  'derived'::text
    as item_origin,

  null::uuid
    as agenda_entry_id,

  'project'::text
    as source_type,

  project.id
    as source_id,

  deliverable.id
    as source_record_id,

  project.title::text
    as source_title,

  'deadline'::text
    as entry_type,

  deliverable.title::text
    as title,

  deliverable.description::text
    as detail,

  deliverable.target_date
    as scheduled_date,

  null::time without time zone
    as scheduled_time,

  'America/Argentina/Buenos_Aires'::text
    as time_zone,

  null::text
    as meeting_mode,

  null::text
    as location_text,

  null::text
    as meeting_provider,

  null::text
    as meeting_url,

  'scheduled'::text
    as agenda_status,

  deliverable.responsible_internal_user_id
    as responsible_internal_user_id,

  responsible.display_name::text
    as responsible_display_name,

  deliverable.created_by_internal_user_id,

  creator.display_name::text
    as created_by_display_name,

  null::timestamptz
    as completed_at,

  null::timestamptz
    as cancelled_at,

  null::text
    as status_rationale,

  deliverable.created_at,
  deliverable.updated_at

from mp25m.project_deliverables deliverable

join mp25m.projects project
  on project.id =
    deliverable.project_id

left join mp25m.internal_users responsible
  on responsible.id =
    deliverable.responsible_internal_user_id

join mp25m.internal_users creator
  on creator.id =
    deliverable.created_by_internal_user_id

where deliverable.target_date is not null

  and deliverable.status in (
    'planned',
    'in_progress'
  )

  and project.status not in (
    'completed',
    'cancelled'
  )


union all


-- ===========================================================================
-- Próximo vencimiento vigente de Temas
-- ===========================================================================

select
  'theme_next_due:' || latest_followup.id::text
    as item_key,

  'theme_next_due'::text
    as item_kind,

  'derived'::text
    as item_origin,

  null::uuid
    as agenda_entry_id,

  'theme'::text
    as source_type,

  theme.id
    as source_id,

  latest_followup.id
    as source_record_id,

  theme.name::text
    as source_title,

  'follow_up'::text
    as entry_type,

  theme.name::text
    as title,

  latest_followup.detail::text
    as detail,

  (
    latest_followup.next_due_at
      at time zone
        'America/Argentina/Buenos_Aires'
  )::date
    as scheduled_date,

  (
    latest_followup.next_due_at
      at time zone
        'America/Argentina/Buenos_Aires'
  )::time without time zone
    as scheduled_time,

  'America/Argentina/Buenos_Aires'::text
    as time_zone,

  null::text
    as meeting_mode,

  null::text
    as location_text,

  null::text
    as meeting_provider,

  null::text
    as meeting_url,

  'scheduled'::text
    as agenda_status,

  latest_followup.responsible_internal_user_id
    as responsible_internal_user_id,

  responsible.display_name::text
    as responsible_display_name,

  latest_followup.created_by_internal_user_id,

  creator.display_name::text
    as created_by_display_name,

  null::timestamptz
    as completed_at,

  null::timestamptz
    as cancelled_at,

  null::text
    as status_rationale,

  latest_followup.created_at,
  latest_followup.created_at
    as updated_at

from mp25m.themes theme

join lateral (
  select
    followup.id,
    followup.detail,
    followup.occurred_at,
    followup.responsible_internal_user_id,
    followup.next_due_at,
    followup.created_by_internal_user_id,
    followup.created_at

  from mp25m.theme_followups followup

  where followup.theme_id =
    theme.id

  order by
    followup.occurred_at desc,
    followup.id desc

  limit 1
) latest_followup
  on true

left join mp25m.internal_users responsible
  on responsible.id =
    latest_followup.responsible_internal_user_id

join mp25m.internal_users creator
  on creator.id =
    latest_followup.created_by_internal_user_id

where theme.status <> 'closed'

  and latest_followup.next_due_at
      is not null
;


revoke all
on mp25m_api.agenda_item_list
from
  public,
  anon,
  authenticated,
  service_role;

grant select
on mp25m_api.agenda_item_list
to service_role;


-- ---------------------------------------------------------------------------
-- 12. LECTURA PAGINADA
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.agenda_item_page(
  p_from_date date default null,
  p_to_date date default null,
  p_item_kinds text[] default null,
  p_entry_types text[] default null,
  p_source_types text[] default null,
  p_responsible_internal_user_id uuid default null,
  p_unassigned_only boolean default false,
  p_statuses text[] default null,
  p_query text default null,
  p_after_date date default null,
  p_after_time time without time zone default null,
  p_after_title text default null,
  p_after_item_key text default null,
  p_limit integer default 25
)
returns table (
  item_key text,
  item_kind text,
  item_origin text,

  agenda_entry_id uuid,

  source_type text,
  source_id uuid,
  source_record_id uuid,
  source_title text,

  entry_type text,
  title text,
  detail text,

  scheduled_date date,
  scheduled_time time without time zone,
  time_zone text,

  meeting_mode text,
  location_text text,
  meeting_provider text,
  meeting_url text,

  agenda_status text,

  responsible_internal_user_id uuid,
  responsible_display_name text,

  created_by_internal_user_id uuid,
  created_by_display_name text,

  completed_at timestamptz,
  cancelled_at timestamptz,
  status_rationale text,

  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
begin
  if p_limit is null
     or p_limit < 1
     or p_limit > 100
  then
    raise exception
      'Invalid agenda page limit'
      using errcode = '22023';
  end if;


  if p_from_date is not null
     and p_to_date is not null
     and p_from_date > p_to_date
  then
    raise exception
      'Invalid agenda date range'
      using errcode = '22023';
  end if;


  if p_responsible_internal_user_id
       is not null
     and coalesce(
       p_unassigned_only,
       false
     )
  then
    raise exception
      'Agenda responsible and unassigned filters are mutually exclusive'
      using errcode = '22023';
  end if;


  if (
       p_after_date is null
       and (
         p_after_time is not null
         or p_after_title is not null
         or p_after_item_key is not null
       )
     )
     or (
       p_after_date is not null
       and (
         p_after_title is null
         or p_after_item_key is null
       )
     )
  then
    raise exception
      'Incomplete agenda cursor'
      using errcode = '22023';
  end if;


  if char_length(
       coalesce(
         p_query,
         ''
       )
     ) > 100
  then
    raise exception
      'Invalid agenda search query'
      using errcode = '22023';
  end if;


  if p_item_kinds is not null
     and exists (
       select 1
       from unnest(p_item_kinds)
         as filter_value(value)
       where filter_value.value not in (
         'manual',
         'opportunity_due',
         'project_deliverable',
         'theme_next_due'
       )
     )
  then
    raise exception
      'Invalid agenda item kind filter'
      using errcode = '22023';
  end if;


  if p_entry_types is not null
     and exists (
       select 1
       from unnest(p_entry_types)
         as filter_value(value)
       where filter_value.value not in (
         'meeting',
         'visit',
         'training',
         'demonstration',
         'call',
         'follow_up',
         'deadline',
         'other'
       )
     )
  then
    raise exception
      'Invalid agenda entry type filter'
      using errcode = '22023';
  end if;


  if p_source_types is not null
     and exists (
       select 1
       from unnest(p_source_types)
         as filter_value(value)
       where filter_value.value not in (
         'opportunity',
         'articulation',
         'project',
         'theme',
         'need_offer'
       )
     )
  then
    raise exception
      'Invalid agenda source type filter'
      using errcode = '22023';
  end if;


  if p_statuses is not null
     and exists (
       select 1
       from unnest(p_statuses)
         as filter_value(value)
       where filter_value.value not in (
         'scheduled',
         'completed',
         'cancelled'
       )
     )
  then
    raise exception
      'Invalid agenda status filter'
      using errcode = '22023';
  end if;


  return query

  select
    agenda.item_key,
    agenda.item_kind,
    agenda.item_origin,

    agenda.agenda_entry_id,

    agenda.source_type,
    agenda.source_id,
    agenda.source_record_id,
    agenda.source_title,

    agenda.entry_type,
    agenda.title,
    agenda.detail,

    agenda.scheduled_date,
    agenda.scheduled_time,
    agenda.time_zone,

    agenda.meeting_mode,
    agenda.location_text,
    agenda.meeting_provider,
    agenda.meeting_url,

    agenda.agenda_status,

    agenda.responsible_internal_user_id,
    agenda.responsible_display_name,

    agenda.created_by_internal_user_id,
    agenda.created_by_display_name,

    agenda.completed_at,
    agenda.cancelled_at,
    agenda.status_rationale,

    agenda.created_at,
    agenda.updated_at

  from mp25m_api.agenda_item_list agenda

  where (
    p_from_date is null
    or agenda.scheduled_date >=
       p_from_date
  )

  and (
    p_to_date is null
    or agenda.scheduled_date <=
       p_to_date
  )

  and (
    p_item_kinds is null
    or agenda.item_kind =
       any(p_item_kinds)
  )

  and (
    p_entry_types is null
    or agenda.entry_type =
       any(p_entry_types)
  )

  and (
    p_source_types is null
    or agenda.source_type =
       any(p_source_types)
  )

  and (
    p_responsible_internal_user_id
      is null

    or agenda.responsible_internal_user_id =
       p_responsible_internal_user_id
  )

  and (
    not coalesce(
      p_unassigned_only,
      false
    )

    or agenda.responsible_internal_user_id
       is null
  )

  and (
    p_statuses is null
    or agenda.agenda_status =
       any(p_statuses)
  )

  and (
    nullif(
      btrim(
        coalesce(
          p_query,
          ''
        )
      ),
      ''
    ) is null

    or translate(
         lower(
           concat_ws(
             ' ',
             agenda.title,
             agenda.detail,
             agenda.source_title
           )
         ),
         'áéíóúüñ',
         'aeiouun'
       )
       like
       '%' ||
       translate(
         lower(
           btrim(p_query)
         ),
         'áéíóúüñ',
         'aeiouun'
       ) ||
       '%'
  )

  and (
    p_after_date is null

    or (
      agenda.scheduled_date,
      agenda.scheduled_time is null,
      coalesce(
        agenda.scheduled_time,
        time '00:00'
      ),
      translate(
        lower(agenda.title),
        'áéíóúüñ',
        'aeiouun'
      ),
      agenda.item_key
    ) > (
      p_after_date,
      p_after_time is null,
      coalesce(
        p_after_time,
        time '00:00'
      ),
      translate(
        lower(p_after_title),
        'áéíóúüñ',
        'aeiouun'
      ),
      p_after_item_key
    )
  )

  order by
    agenda.scheduled_date asc,
    (
      agenda.scheduled_time
        is null
    ) asc,
    agenda.scheduled_time asc,
    translate(
      lower(agenda.title),
      'áéíóúüñ',
      'aeiouun'
    ) asc,
    agenda.item_key asc

  limit p_limit + 1;
end;
$function$;


revoke all
on function mp25m_api.agenda_item_page(
  date,
  date,
  text[],
  text[],
  text[],
  uuid,
  boolean,
  text[],
  text,
  date,
  time without time zone,
  text,
  text,
  integer
)
from
  public,
  anon,
  authenticated,
  service_role;

grant execute
on function mp25m_api.agenda_item_page(
  date,
  date,
  text[],
  text[],
  text[],
  uuid,
  boolean,
  text[],
  text,
  date,
  time without time zone,
  text,
  text,
  integer
)
to service_role;


-- ---------------------------------------------------------------------------
-- 13. COMENTARIOS DE CONTRATO
-- ---------------------------------------------------------------------------

comment on table mp25m.agenda_entries is
  '12A manual Agenda entries. Derived opportunity, deliverable and theme dates are not copied into this table.';

comment on table mp25m.agenda_entry_status_history is
  'Append-oriented lifecycle history for manual Agenda entries.';

comment on column mp25m.agenda_entries.meeting_url is
  'Optional meeting access URL. 12A stores it but does not generate external meeting rooms.';

comment on column mp25m.agenda_entries.time_zone is
  'IANA time-zone identifier. Runtime RPC validation is required before writes.';

commit;
