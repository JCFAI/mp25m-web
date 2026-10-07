begin;

-- ============================================================================
-- Incremento 12B.A — Comunicaciones y convocatorias
-- Núcleo de preparación, audiencia, resolución y confirmación de destinatarios.
-- No realiza envíos externos.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. COMUNICACIONES
-- ---------------------------------------------------------------------------

create table mp25m.communications (
  id uuid primary key default gen_random_uuid(),

  communication_type text not null default 'general'
    check (
      communication_type in (
        'general',
        'convocation',
        'reminder',
        'follow_up',
        'request_information',
        'update'
      )
    ),

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'audience_resolved',
        'recipients_confirmed',
        'cancelled'
      )
    ),

  planned_channels text[] not null default '{}'::text[],

  audience_revision integer not null default 0
    check (audience_revision >= 0),

  subject text,
  body text,

  generation_mode text not null default 'manual'
    check (
      generation_mode in (
        'manual',
        'assisted'
      )
    ),

  generation_metadata jsonb not null default '{}'::jsonb,

  person_id uuid
    references mp25m.persons(id)
    on delete restrict,

  node_id uuid
    references mp25m.nodes(id)
    on delete restrict,

  organization_id uuid
    references mp25m.organizations(id)
    on delete restrict,

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

  agenda_entry_id uuid
    references mp25m.agenda_entries(id)
    on delete restrict,

  -- La FK a audience_resolutions se agrega después de crear esa tabla.
  current_resolution_id uuid,

  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  cancelled_at timestamptz,

  cancelled_by_internal_user_id uuid
    references mp25m.internal_users(id)
    on delete restrict,

  cancellation_rationale text,

  constraint communications_exact_context_check
    check (
      (person_id is not null)::integer
      + (node_id is not null)::integer
      + (organization_id is not null)::integer
      + (opportunity_id is not null)::integer
      + (articulation_id is not null)::integer
      + (project_id is not null)::integer
      + (theme_id is not null)::integer
      + (need_offer_id is not null)::integer
      + (agenda_entry_id is not null)::integer
      <= 1
    ),

  constraint communications_planned_channels_check
    check (
      planned_channels
        <@ array['email', 'whatsapp']::text[]

      and cardinality(planned_channels) <= 2

      and cardinality(planned_channels) =
        (
          case
            when 'email' = any(planned_channels)
              then 1
            else 0
          end
          +
          case
            when 'whatsapp' = any(planned_channels)
              then 1
            else 0
          end
        )
    ),

  constraint communications_cancellation_check
    check (
      (
        status = 'cancelled'
        and cancelled_at is not null
        and cancelled_by_internal_user_id is not null
        and char_length(
          btrim(
            coalesce(
              cancellation_rationale,
              ''
            )
          )
        ) between 3 and 2000
      )
      or
      (
        status <> 'cancelled'
        and cancelled_at is null
        and cancelled_by_internal_user_id is null
        and cancellation_rationale is null
      )
    )
);


create index communications_status_updated_idx
  on mp25m.communications(
    status,
    updated_at desc,
    id
  );


create index communications_creator_idx
  on mp25m.communications(
    created_by_internal_user_id,
    created_at desc,
    id
  );


comment on table mp25m.communications is
  '12B.A: comunicaciones preparadas y trazables. No implica autorización ni envío externo.';

comment on column mp25m.communications.planned_channels is
  'Canales previstos. No representan consentimiento ni autorización de envío.';

comment on column mp25m.communications.audience_revision is
  'Versión vigente de la definición explícita de audiencia.';

comment on column mp25m.communications.current_resolution_id is
  'Resolución vigente de audiencia; su FK compuesta se agrega después de crear audience_resolutions.';


-- ---------------------------------------------------------------------------
-- 2. CRITERIOS DE AUDIENCIA
-- ---------------------------------------------------------------------------

create table mp25m.communication_audience_criteria (
  id uuid primary key default gen_random_uuid(),

  communication_id uuid not null
    references mp25m.communications(id)
    on delete restrict,

  audience_revision integer not null
    check (audience_revision > 0),

  group_no integer not null
    check (group_no > 0),

  criterion_type text not null
    check (
      criterion_type in (
        'person',
        'node_participants',
        'articulation_participants',
        'project_participants',
        'person_skill',
        'organization_capability',
        'theme_responsibles'
      )
    ),

  criterion_operation text not null
    check (
      criterion_operation in (
        'include',
        'exclude'
      )
    ),

  person_id uuid
    references mp25m.persons(id)
    on delete restrict,

  node_id uuid
    references mp25m.nodes(id)
    on delete restrict,

  articulation_id uuid
    references mp25m.opportunity_articulations(id)
    on delete restrict,

  project_id uuid
    references mp25m.projects(id)
    on delete restrict,

  skill_id uuid
    references mp25m.skills(id)
    on delete restrict,

  theme_id uuid
    references mp25m.themes(id)
    on delete restrict,

  verification_statuses text[],

  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  created_at timestamptz not null default now(),

  constraint communication_audience_criteria_shape_check
    check (
      (
        criterion_type = 'person'
        and person_id is not null
        and node_id is null
        and articulation_id is null
        and project_id is null
        and skill_id is null
        and theme_id is null
        and verification_statuses is null
      )
      or
      (
        criterion_type = 'node_participants'
        and person_id is null
        and node_id is not null
        and articulation_id is null
        and project_id is null
        and skill_id is null
        and theme_id is null
        and verification_statuses is null
      )
      or
      (
        criterion_type = 'articulation_participants'
        and person_id is null
        and node_id is null
        and articulation_id is not null
        and project_id is null
        and skill_id is null
        and theme_id is null
        and verification_statuses is null
      )
      or
      (
        criterion_type = 'project_participants'
        and person_id is null
        and node_id is null
        and articulation_id is null
        and project_id is not null
        and skill_id is null
        and theme_id is null
        and verification_statuses is null
      )
      or
      (
        criterion_type = 'person_skill'
        and person_id is null
        and node_id is null
        and articulation_id is null
        and project_id is null
        and skill_id is not null
        and theme_id is null
        and verification_statuses is not null
      )
      or
      (
        criterion_type = 'organization_capability'
        and person_id is null
        and articulation_id is null
        and project_id is null
        and skill_id is not null
        and theme_id is null
        and verification_statuses is not null
      )
      or
      (
        criterion_type = 'theme_responsibles'
        and person_id is null
        and node_id is null
        and articulation_id is null
        and project_id is null
        and skill_id is null
        and theme_id is not null
        and verification_statuses is null
      )
    ),

  constraint communication_audience_criteria_verification_check
    check (
      verification_statuses is null
      or (
        cardinality(verification_statuses) between 1 and 3
        and verification_statuses
          <@ array[
            'confirmed',
            'candidate',
            'self_reported'
          ]::text[]
        and cardinality(verification_statuses) =
          (
            case
              when 'confirmed' = any(verification_statuses)
                then 1
              else 0
            end
            +
            case
              when 'candidate' = any(verification_statuses)
                then 1
              else 0
            end
            +
            case
              when 'self_reported' = any(verification_statuses)
                then 1
              else 0
            end
          )
      )
    )
);


create index communication_audience_criteria_revision_idx
  on mp25m.communication_audience_criteria(
    communication_id,
    audience_revision,
    group_no,
    id
  );


comment on table mp25m.communication_audience_criteria is
  'Definiciones históricas y explícitas de audiencia, versionadas por communication y audience_revision.';

comment on column mp25m.communication_audience_criteria.verification_statuses is
  'Estados explícitamente admitidos para person_skill u organization_capability; nunca incluye rejected.';


-- ---------------------------------------------------------------------------
-- 3. RESOLUCIONES DE AUDIENCIA
-- ---------------------------------------------------------------------------

create table mp25m.communication_audience_resolutions (
  id uuid primary key default gen_random_uuid(),

  communication_id uuid not null
    references mp25m.communications(id)
    on delete restrict,

  resolution_no integer not null
    check (resolution_no > 0),

  audience_revision integer not null
    check (audience_revision > 0),

  criteria_snapshot jsonb not null,

  resolved_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  resolved_at timestamptz not null default now(),

  confirmed_by_internal_user_id uuid
    references mp25m.internal_users(id)
    on delete restrict,

  confirmed_at timestamptz,

  constraint communication_audience_resolutions_resolution_unique
    unique (
      communication_id,
      resolution_no
    ),

  constraint communication_audience_resolutions_identity_revision_unique
    unique (
      id,
      communication_id,
      audience_revision
    ),

  constraint communication_audience_resolutions_snapshot_check
    check (
      jsonb_typeof(criteria_snapshot) = 'array'
    ),

  constraint communication_audience_resolutions_confirmation_check
    check (
      (
        confirmed_at is null
        and confirmed_by_internal_user_id is null
      )
      or
      (
        confirmed_at is not null
        and confirmed_by_internal_user_id is not null
      )
    )
);


create index communication_audience_resolutions_revision_idx
  on mp25m.communication_audience_resolutions(
    communication_id,
    audience_revision,
    resolution_no desc
  );


comment on table mp25m.communication_audience_resolutions is
  'Snapshots históricos de resolución de audiencia para una revisión concreta.';

comment on column mp25m.communication_audience_resolutions.criteria_snapshot is
  'Snapshot de los criterios utilizados al resolver la audiencia.';

comment on column mp25m.communication_audience_resolutions.confirmed_at is
  'Confirmación humana de destinatarios; no equivale a autorización ni envío.';


-- ---------------------------------------------------------------------------
-- 4. RESOLUCIÓN VIGENTE DE LA COMUNICACIÓN
-- ---------------------------------------------------------------------------

alter table mp25m.communications
  add constraint communications_current_resolution_fk
  foreign key (
    current_resolution_id,
    id,
    audience_revision
  )
  references mp25m.communication_audience_resolutions (
    id,
    communication_id,
    audience_revision
  )
  on delete restrict;


create index communications_current_resolution_idx
  on mp25m.communications(current_resolution_id)
  where current_resolution_id is not null;


-- ---------------------------------------------------------------------------
-- 5. DESTINATARIOS RESUELTOS
-- ---------------------------------------------------------------------------

create table mp25m.communication_resolution_recipients (
  id uuid primary key default gen_random_uuid(),

  resolution_id uuid not null
    references mp25m.communication_audience_resolutions(id)
    on delete restrict,

  recipient_kind text not null
    check (
      recipient_kind in (
        'person',
        'organization',
        'internal_user'
      )
    ),

  person_id uuid
    references mp25m.persons(id)
    on delete restrict,

  organization_id uuid
    references mp25m.organizations(id)
    on delete restrict,

  internal_user_id uuid
    references mp25m.internal_users(id)
    on delete restrict,

  display_name_snapshot text not null
    check (
      char_length(
        btrim(display_name_snapshot)
      ) > 0
    ),

  manually_added boolean not null default false,

  included boolean not null default true,
  exclusion_reason text,

  email_availability_status text not null
    check (
      email_availability_status in (
        'available_unverified',
        'available_verified',
        'missing',
        'restricted',
        'unsupported_recipient'
      )
    ),

  whatsapp_availability_status text not null
    check (
      whatsapp_availability_status in (
        'available_unverified',
        'available_verified',
        'missing',
        'restricted',
        'unsupported_recipient'
      )
    ),

  duplicate_status text not null default 'none'
    check (
      duplicate_status in (
        'none',
        'email_duplicate',
        'whatsapp_duplicate',
        'email_and_whatsapp_duplicate'
      )
    ),

  diagnostic_detail jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(diagnostic_detail) = 'object'
    ),

  created_at timestamptz not null default now(),

  constraint communication_resolution_recipients_identity_check
    check (
      (
        recipient_kind = 'person'
        and person_id is not null
        and organization_id is null
        and internal_user_id is null
      )
      or
      (
        recipient_kind = 'organization'
        and person_id is null
        and organization_id is not null
        and internal_user_id is null
      )
      or
      (
        recipient_kind = 'internal_user'
        and person_id is null
        and organization_id is null
        and internal_user_id is not null
      )
    ),

  constraint communication_resolution_recipients_manual_check
    check (
      not manually_added
      or recipient_kind = 'person'
    ),

  constraint communication_resolution_recipients_exclusion_check
    check (
      not included
      or exclusion_reason is null
    )
);


create unique index communication_resolution_recipients_person_unique
  on mp25m.communication_resolution_recipients(
    resolution_id,
    person_id
  )
  where recipient_kind = 'person';


create unique index communication_resolution_recipients_organization_unique
  on mp25m.communication_resolution_recipients(
    resolution_id,
    organization_id
  )
  where recipient_kind = 'organization';


create unique index communication_resolution_recipients_internal_user_unique
  on mp25m.communication_resolution_recipients(
    resolution_id,
    internal_user_id
  )
  where recipient_kind = 'internal_user';


create index communication_resolution_recipients_resolution_idx
  on mp25m.communication_resolution_recipients(
    resolution_id,
    included,
    recipient_kind,
    id
  );


comment on table mp25m.communication_resolution_recipients is
  'Actor efectivo resuelto dentro de una audiencia. Una fila por identidad tipada y resolución.';

comment on column mp25m.communication_resolution_recipients.manually_added is
  'En 12B.A una incorporación manual solo puede referenciar una Persona canónica existente.';

comment on column mp25m.communication_resolution_recipients.email_availability_status is
  'Diagnóstico técnico histórico de Email. No representa consentimiento ni autorización.';

comment on column mp25m.communication_resolution_recipients.whatsapp_availability_status is
  'Diagnóstico técnico histórico de WhatsApp. No representa consentimiento ni autorización.';

comment on column mp25m.communication_resolution_recipients.duplicate_status is
  'Diagnóstico de posible duplicación de canal entre actores distintos; la deduplicación por identidad se garantiza separadamente.';


-- ---------------------------------------------------------------------------
-- 6. PROCEDENCIAS DE DESTINATARIOS
-- ---------------------------------------------------------------------------

alter table mp25m.communication_audience_criteria
  add constraint communication_audience_criteria_id_type_unique
  unique (
    id,
    criterion_type
  );


create table mp25m.communication_recipient_sources (
  id uuid primary key default gen_random_uuid(),

  recipient_id uuid not null
    references mp25m.communication_resolution_recipients(id)
    on delete restrict,

  criterion_id uuid,

  criterion_type text not null
    check (
      criterion_type in (
        'person',
        'node_participants',
        'articulation_participants',
        'project_participants',
        'person_skill',
        'organization_capability',
        'theme_responsibles',
        'manual'
      )
    ),

  source_detail jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(source_detail) = 'object'
    ),

  created_at timestamptz not null default now(),

  constraint communication_recipient_sources_kind_check
    check (
      (
        criterion_type = 'manual'
        and criterion_id is null
      )
      or
      (
        criterion_type <> 'manual'
        and criterion_id is not null
      )
    ),

  constraint communication_recipient_sources_criterion_fk
    foreign key (
      criterion_id,
      criterion_type
    )
    references mp25m.communication_audience_criteria (
      id,
      criterion_type
    )
    on delete restrict
);


create unique index communication_recipient_sources_criterion_unique
  on mp25m.communication_recipient_sources(
    recipient_id,
    criterion_id
  )
  where criterion_id is not null;


create unique index communication_recipient_sources_manual_unique
  on mp25m.communication_recipient_sources(recipient_id)
  where criterion_type = 'manual';


create index communication_recipient_sources_recipient_idx
  on mp25m.communication_recipient_sources(
    recipient_id,
    created_at,
    id
  );


comment on table mp25m.communication_recipient_sources is
  'Procedencias explícitas que explican por qué un actor integra una resolución de audiencia.';

comment on column mp25m.communication_recipient_sources.criterion_type is
  'Tipo del criterio de origen o manual para una Persona incorporada explícitamente.';

comment on column mp25m.communication_recipient_sources.source_detail is
  'Detalle histórico complementario de la procedencia; no debe contener contactos privados innecesarios.';


-- ---------------------------------------------------------------------------
-- 7. HISTORIAL DE CONTENIDO
-- ---------------------------------------------------------------------------

create table mp25m.communication_content_history (
  id uuid primary key default gen_random_uuid(),

  communication_id uuid not null
    references mp25m.communications(id)
    on delete restrict,

  revision_no integer not null
    check (revision_no > 0),

  subject text,
  body text,

  generation_mode text not null
    check (
      generation_mode in (
        'manual',
        'assisted'
      )
    ),

  generation_metadata jsonb not null default '{}'::jsonb,

  changed_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  change_rationale text,

  created_at timestamptz not null default now(),

  constraint communication_content_history_revision_unique
    unique (
      communication_id,
      revision_no
    )
);


create index communication_content_history_communication_idx
  on mp25m.communication_content_history(
    communication_id,
    revision_no desc
  );


comment on table mp25m.communication_content_history is
  'Historial inmutable de revisiones de contenido de una comunicación.';

comment on column mp25m.communication_content_history.revision_no is
  'Número creciente de revisión dentro de cada comunicación; comienza en 1.';

comment on column mp25m.communication_content_history.generation_mode is
  'Procedencia manual o asistida del contenido; assisted no implica aprobación ni envío.';


-- ---------------------------------------------------------------------------
-- 8. HISTORIAL DE ESTADO
-- ---------------------------------------------------------------------------

create table mp25m.communication_status_history (
  id uuid primary key default gen_random_uuid(),

  communication_id uuid not null
    references mp25m.communications(id)
    on delete restrict,

  transition_no integer not null
    check (transition_no > 0),

  status text not null
    check (
      status in (
        'draft',
        'audience_resolved',
        'recipients_confirmed',
        'cancelled'
      )
    ),

  rationale text,

  changed_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  changed_at timestamptz not null default now(),

  constraint communication_status_history_transition_unique
    unique (
      communication_id,
      transition_no
    )
);


create index communication_status_history_communication_idx
  on mp25m.communication_status_history(
    communication_id,
    transition_no desc
  );


comment on table mp25m.communication_status_history is
  'Historial inmutable de estados de una comunicación. Las transiciones válidas son gobernadas por RPC.';

comment on column mp25m.communication_status_history.transition_no is
  'Número creciente de transición dentro de cada comunicación; comienza en 1.';


-- ---------------------------------------------------------------------------
-- 9. AUDITORÍA
-- ---------------------------------------------------------------------------

-- Las operaciones gobernadas de 12B.A reutilizarán mp25m.audit_events.
-- No se crea un segundo mecanismo de auditoría.
--
-- Acciones previstas:
--   communication.create
--   communication.update
--   communication.cancel
--   communication.audience.criteria_replace
--   communication.audience.resolve
--   communication.recipient.exclude
--   communication.recipient.include
--   communication.recipient.add
--   communication.recipients.confirm
--
-- Los RPC no deberán duplicar innecesariamente emails, números de WhatsApp
-- u otros datos privados dentro de audit_events.


-- ---------------------------------------------------------------------------
-- 10. INTEGRIDAD ENTRE DESTINATARIOS, RESOLUCIONES Y CRITERIOS
-- ---------------------------------------------------------------------------

create or replace function mp25m.enforce_communication_recipient_source_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, mp25m
as $$
declare
  v_recipient_kind text;
  v_resolution_communication_id uuid;
  v_resolution_audience_revision integer;

  v_criterion_communication_id uuid;
  v_criterion_audience_revision integer;
  v_criterion_type text;
begin
  select
    recipient.recipient_kind,
    resolution.communication_id,
    resolution.audience_revision
  into
    v_recipient_kind,
    v_resolution_communication_id,
    v_resolution_audience_revision
  from mp25m.communication_resolution_recipients as recipient
  join mp25m.communication_audience_resolutions as resolution
    on resolution.id = recipient.resolution_id
  where recipient.id = new.recipient_id;

  if not found then
    raise exception
      'Recipient % does not belong to a valid audience resolution',
      new.recipient_id;
  end if;


  if new.criterion_type = 'manual' then
    if new.criterion_id is not null then
      raise exception
        'Manual recipient source cannot reference a criterion';
    end if;

    if v_recipient_kind <> 'person' then
      raise exception
        'Manual recipient source is only allowed for person recipients';
    end if;

    return new;
  end if;


  select
    criterion.communication_id,
    criterion.audience_revision,
    criterion.criterion_type
  into
    v_criterion_communication_id,
    v_criterion_audience_revision,
    v_criterion_type
  from mp25m.communication_audience_criteria as criterion
  where criterion.id = new.criterion_id;

  if not found then
    raise exception
      'Audience criterion % does not exist',
      new.criterion_id;
  end if;


  if v_criterion_type <> new.criterion_type then
    raise exception
      'Recipient source criterion type does not match referenced criterion';
  end if;


  if v_criterion_communication_id <> v_resolution_communication_id then
    raise exception
      'Recipient source criterion belongs to a different communication';
  end if;


  if v_criterion_audience_revision <> v_resolution_audience_revision then
    raise exception
      'Recipient source criterion belongs to a different audience revision';
  end if;


  return new;
end;
$$;


create trigger communication_recipient_sources_integrity_trigger
before insert or update
on mp25m.communication_recipient_sources
for each row
execute function mp25m.enforce_communication_recipient_source_integrity();


comment on function mp25m.enforce_communication_recipient_source_integrity() is
  'Impide vincular una procedencia automática con criterios de otra comunicación o revisión de audiencia.';


-- ---------------------------------------------------------------------------
-- 11. INMUTABILIDAD E HISTORIA
-- ---------------------------------------------------------------------------

create or replace function mp25m.reject_communication_history_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, mp25m
as $$
begin
  raise exception
    'Historical communication record in % is immutable',
    tg_table_name;
end;
$$;


-- Los criterios pertenecen a una revisión histórica concreta.
-- Nunca se reescriben ni eliminan.
create trigger communication_audience_criteria_immutable_trigger
before update or delete
on mp25m.communication_audience_criteria
for each row
execute function mp25m.reject_communication_history_mutation();


-- Los historiales son estrictamente append-only.
create trigger communication_content_history_immutable_trigger
before update or delete
on mp25m.communication_content_history
for each row
execute function mp25m.reject_communication_history_mutation();


create trigger communication_status_history_immutable_trigger
before update or delete
on mp25m.communication_status_history
for each row
execute function mp25m.reject_communication_history_mutation();


-- Las procedencias explican históricamente por qué un actor integró
-- una resolución. No se reescriben ni eliminan.
create trigger communication_recipient_sources_immutable_trigger
before update or delete
on mp25m.communication_recipient_sources
for each row
execute function mp25m.reject_communication_history_mutation();


-- ---------------------------------------------------------------------------
-- 11.1. RESOLUCIONES: SOLO PUEDEN PASAR DE NO CONFIRMADA A CONFIRMADA
-- ---------------------------------------------------------------------------

create or replace function mp25m.enforce_communication_resolution_immutability()
returns trigger
language plpgsql
set search_path = pg_catalog, mp25m
as $$
declare
  v_current_resolution_id uuid;
  v_current_audience_revision integer;
begin
  if tg_op = 'DELETE' then
    raise exception
      'Audience resolutions are historical and cannot be deleted';
  end if;


  -- Ninguna parte estructural de la resolución puede cambiar.
  if new.id is distinct from old.id
     or new.communication_id is distinct from old.communication_id
     or new.resolution_no is distinct from old.resolution_no
     or new.audience_revision is distinct from old.audience_revision
     or new.criteria_snapshot is distinct from old.criteria_snapshot
     or new.resolved_by_internal_user_id
          is distinct from old.resolved_by_internal_user_id
     or new.resolved_at is distinct from old.resolved_at then
    raise exception
      'Audience resolution historical data is immutable';
  end if;


  -- Una resolución ya confirmada queda completamente congelada.
  if old.confirmed_at is not null then
    if new is distinct from old then
      raise exception
        'Confirmed audience resolution is immutable';
    end if;

    return new;
  end if;


  -- Antes de confirmar tampoco pueden modificarse parcialmente
  -- los campos de confirmación.
  if (
    new.confirmed_at is null
    and new.confirmed_by_internal_user_id is not null
  )
  or (
    new.confirmed_at is not null
    and new.confirmed_by_internal_user_id is null
  ) then
    raise exception
      'Audience resolution confirmation requires actor and timestamp together';
  end if;


  -- Si todavía permanece sin confirmar, no hay nada que modificar.
  if new.confirmed_at is null then
    if new is distinct from old then
      raise exception
        'Unconfirmed audience resolution cannot be modified except to confirm it';
    end if;

    return new;
  end if;


  -- Protección adicional contra confirmar una resolución obsoleta.
  select
    communication.current_resolution_id,
    communication.audience_revision
  into
    v_current_resolution_id,
    v_current_audience_revision
  from mp25m.communications as communication
  where communication.id = old.communication_id;

  if not found then
    raise exception
      'Communication % does not exist',
      old.communication_id;
  end if;


  if v_current_resolution_id is distinct from old.id
     or v_current_audience_revision <> old.audience_revision then
    raise exception
      'Obsolete audience resolution cannot be confirmed';
  end if;


  return new;
end;
$$;


create trigger communication_audience_resolutions_immutability_trigger
before update or delete
on mp25m.communication_audience_resolutions
for each row
execute function mp25m.enforce_communication_resolution_immutability();


-- ---------------------------------------------------------------------------
-- 11.2. DESTINATARIOS: IDENTIDAD FIJA Y CONGELAMIENTO AL CONFIRMAR
-- ---------------------------------------------------------------------------

create or replace function mp25m.enforce_communication_recipient_immutability()
returns trigger
language plpgsql
set search_path = pg_catalog, mp25m
as $$
declare
  v_confirmed_at timestamptz;
begin
  select resolution.confirmed_at
  into v_confirmed_at
  from mp25m.communication_audience_resolutions as resolution
  where resolution.id = old.resolution_id;

  if not found then
    raise exception
      'Audience resolution % does not exist',
      old.resolution_id;
  end if;


  if tg_op = 'DELETE' then
    raise exception
      'Communication recipients are historical and cannot be deleted';
  end if;


  if v_confirmed_at is not null then
    if new is distinct from old then
      raise exception
        'Recipients of a confirmed audience resolution are immutable';
    end if;

    return new;
  end if;


  -- Antes de confirmar puede revisarse inclusión y diagnóstico,
  -- pero nunca cambiar la identidad histórica del destinatario.
  if new.id is distinct from old.id
     or new.resolution_id is distinct from old.resolution_id
     or new.recipient_kind is distinct from old.recipient_kind
     or new.person_id is distinct from old.person_id
     or new.organization_id is distinct from old.organization_id
     or new.internal_user_id is distinct from old.internal_user_id
     or new.display_name_snapshot is distinct from old.display_name_snapshot
     or new.manually_added is distinct from old.manually_added
     or new.created_at is distinct from old.created_at then
    raise exception
      'Recipient identity and historical snapshot are immutable';
  end if;


  return new;
end;
$$;


create trigger communication_resolution_recipients_immutability_trigger
before update or delete
on mp25m.communication_resolution_recipients
for each row
execute function mp25m.enforce_communication_recipient_immutability();


comment on function mp25m.reject_communication_history_mutation() is
  'Protege registros históricos append-only de Comunicaciones 12B.A.';

comment on function mp25m.enforce_communication_resolution_immutability() is
  'Permite únicamente confirmar una resolución vigente; una vez confirmada queda completamente inmutable.';

comment on function mp25m.enforce_communication_recipient_immutability() is
  'Mantiene fija la identidad de destinatarios y congela todos sus datos cuando la resolución queda confirmada.';


-- ---------------------------------------------------------------------------
-- 11.3. PROTECCIÓN DE INSERTS SOBRE HISTORIA YA FIJADA
-- ---------------------------------------------------------------------------

create or replace function mp25m.enforce_communication_criterion_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, mp25m
as $$
declare
  v_audience_revision integer;
  v_status text;
  v_current_resolution_id uuid;
begin
  select
    communication.audience_revision,
    communication.status,
    communication.current_resolution_id
  into
    v_audience_revision,
    v_status,
    v_current_resolution_id
  from mp25m.communications as communication
  where communication.id = new.communication_id;

  if not found then
    raise exception
      'Communication % does not exist',
      new.communication_id;
  end if;

  if new.audience_revision <> v_audience_revision then
    raise exception
      'Audience criteria can only be inserted into the current audience revision';
  end if;

  if v_status <> 'draft'
     or v_current_resolution_id is not null then
    raise exception
      'Audience criteria cannot be added after the current revision has been resolved';
  end if;

  return new;
end;
$$;


create trigger communication_audience_criteria_insert_guard_trigger
before insert
on mp25m.communication_audience_criteria
for each row
execute function mp25m.enforce_communication_criterion_insert();


create or replace function mp25m.enforce_communication_resolution_insert()
returns trigger
language plpgsql
set search_path = pg_catalog, mp25m
as $$
declare
  v_audience_revision integer;
  v_status text;
begin
  select
    communication.audience_revision,
    communication.status
  into
    v_audience_revision,
    v_status
  from mp25m.communications as communication
  where communication.id = new.communication_id;

  if not found then
    raise exception
      'Communication % does not exist',
      new.communication_id;
  end if;

  if new.audience_revision <> v_audience_revision then
    raise exception
      'Audience resolution must use the current audience revision';
  end if;

  if v_status not in (
    'draft',
    'audience_resolved'
  ) then
    raise exception
      'Communication status does not allow a new audience resolution';
  end if;

  return new;
end;
$$;


create trigger communication_audience_resolutions_insert_guard_trigger
before insert
on mp25m.communication_audience_resolutions
for each row
execute function mp25m.enforce_communication_resolution_insert();


create or replace function mp25m.reject_recipient_insert_into_confirmed_resolution()
returns trigger
language plpgsql
set search_path = pg_catalog, mp25m
as $$
declare
  v_confirmed_at timestamptz;
begin
  select resolution.confirmed_at
  into v_confirmed_at
  from mp25m.communication_audience_resolutions as resolution
  where resolution.id = new.resolution_id;

  if not found then
    raise exception
      'Audience resolution % does not exist',
      new.resolution_id;
  end if;

  if v_confirmed_at is not null then
    raise exception
      'Cannot add recipients to a confirmed audience resolution';
  end if;

  return new;
end;
$$;


create trigger communication_resolution_recipients_insert_guard_trigger
before insert
on mp25m.communication_resolution_recipients
for each row
execute function mp25m.reject_recipient_insert_into_confirmed_resolution();


create or replace function mp25m.reject_source_insert_into_confirmed_resolution()
returns trigger
language plpgsql
set search_path = pg_catalog, mp25m
as $$
declare
  v_confirmed_at timestamptz;
begin
  select resolution.confirmed_at
  into v_confirmed_at
  from mp25m.communication_resolution_recipients as recipient
  join mp25m.communication_audience_resolutions as resolution
    on resolution.id = recipient.resolution_id
  where recipient.id = new.recipient_id;

  if not found then
    raise exception
      'Recipient % does not belong to a valid audience resolution',
      new.recipient_id;
  end if;

  if v_confirmed_at is not null then
    raise exception
      'Cannot add recipient sources to a confirmed audience resolution';
  end if;

  return new;
end;
$$;


create trigger communication_recipient_sources_insert_guard_trigger
before insert
on mp25m.communication_recipient_sources
for each row
execute function mp25m.reject_source_insert_into_confirmed_resolution();


comment on function mp25m.enforce_communication_criterion_insert() is
  'Impide alterar semánticamente una revisión histórica agregándole criterios posteriores.';

comment on function mp25m.enforce_communication_resolution_insert() is
  'Impide crear resoluciones para una revisión de audiencia que ya no sea la vigente.';

comment on function mp25m.reject_recipient_insert_into_confirmed_resolution() is
  'Impide agregar destinatarios después de confirmar una resolución.';

comment on function mp25m.reject_source_insert_into_confirmed_resolution() is
  'Impide agregar procedencias después de confirmar una resolución.';


-- ---------------------------------------------------------------------------
-- 12. AUTORIZACIÓN BASE
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.is_active_internal_user(
  p_actor_internal_user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
  select exists (
    select 1
    from mp25m.internal_users internal_user
    where internal_user.id =
        p_actor_internal_user_id
      and internal_user.status = 'active'
      and internal_user.deleted_at is null
  );
$function$;


create or replace function mp25m_api.has_current_internal_access(
  p_actor_internal_user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
  select
    mp25m_api.is_active_internal_user(
      p_actor_internal_user_id
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
    );
$function$;


create or replace function mp25m_api.is_global_administrator(
  p_actor_internal_user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
  select
    mp25m_api.is_active_internal_user(
      p_actor_internal_user_id
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
    );
$function$;


-- ---------------------------------------------------------------------------
-- 13. CREACIÓN DE COMUNICACIONES
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.can_create_communication(
  p_actor_internal_user_id uuid,

  p_person_id uuid,
  p_node_id uuid,
  p_organization_id uuid,
  p_opportunity_id uuid,
  p_articulation_id uuid,
  p_project_id uuid,
  p_theme_id uuid,
  p_need_offer_id uuid,
  p_agenda_entry_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
  select
    (
      (p_person_id is not null)::integer
      + (p_node_id is not null)::integer
      + (p_organization_id is not null)::integer
      + (p_opportunity_id is not null)::integer
      + (p_articulation_id is not null)::integer
      + (p_project_id is not null)::integer
      + (p_theme_id is not null)::integer
      + (p_need_offer_id is not null)::integer
      + (p_agenda_entry_id is not null)::integer
      <= 1
    )

    and mp25m_api.has_current_internal_access(
      p_actor_internal_user_id
    )

    and case
      when p_person_id is not null then
        exists (
          select 1
          from mp25m.persons person
          where person.id = p_person_id
        )

      when p_node_id is not null then
        exists (
          select 1
          from mp25m.nodes node
          where node.id = p_node_id
        )

      when p_organization_id is not null then
        exists (
          select 1
          from mp25m.organizations organization
          where organization.id =
            p_organization_id
        )

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

      when p_agenda_entry_id is not null then
        mp25m_api.can_manage_agenda_entry(
          p_actor_internal_user_id,
          p_agenda_entry_id
        )

      else
        true
    end;
$function$;


comment on function mp25m_api.can_create_communication(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid
) is
  'Autoriza preparar una comunicación 12B.A con cero o un contexto exacto; no autoriza envío ni amplía acceso al contexto.';


-- ---------------------------------------------------------------------------
-- 14. ADMINISTRACIÓN DE COMUNICACIONES
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.can_manage_communication(
  p_actor_internal_user_id uuid,
  p_communication_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
  select
    mp25m_api.is_active_internal_user(
      p_actor_internal_user_id
    )

    and exists (
      select 1
      from mp25m.communications communication
      where communication.id =
          p_communication_id

        and case
          when communication.opportunity_id is not null then
            mp25m_api.can_operate_opportunity_requirement(
              p_actor_internal_user_id,
              communication.opportunity_id,
              'formulate'
            )

          when communication.articulation_id is not null then
            mp25m_api.can_manage_articulation(
              p_actor_internal_user_id,
              communication.articulation_id
            )

          when communication.project_id is not null then
            mp25m_api.can_manage_project(
              p_actor_internal_user_id,
              communication.project_id
            )

          when communication.theme_id is not null then
            mp25m_api.can_operate_theme(
              p_actor_internal_user_id,
              communication.theme_id,
              'manage'
            )

          when communication.need_offer_id is not null then
            mp25m_api.can_operate_need_offer(
              p_actor_internal_user_id,
              communication.need_offer_id,
              'manage'
            )

          when communication.agenda_entry_id is not null then
            mp25m_api.can_manage_agenda_entry(
              p_actor_internal_user_id,
              communication.agenda_entry_id
            )

          else
            (
              communication.created_by_internal_user_id =
                p_actor_internal_user_id
            )

            or mp25m_api.is_global_administrator(
              p_actor_internal_user_id
            )
        end
    );
$function$;


comment on function mp25m_api.can_manage_communication(
  uuid,
  uuid
) is
  'Autoriza administrar una comunicación 12B.A revalidando el contexto actual cuando existe.';


-- ---------------------------------------------------------------------------
-- 15. CREAR COMUNICACIÓN
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.create_communication(
  p_actor_internal_user_id uuid,
  p_communication_type text,
  p_planned_channels text[],
  p_subject text,
  p_body text,
  p_generation_mode text,
  p_generation_metadata jsonb,
  p_person_id uuid,
  p_node_id uuid,
  p_organization_id uuid,
  p_opportunity_id uuid,
  p_articulation_id uuid,
  p_project_id uuid,
  p_theme_id uuid,
  p_need_offer_id uuid,
  p_agenda_entry_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_communication_id uuid;
  v_context_type text;
  v_context_id uuid;
begin
  if not mp25m_api.can_create_communication(
    p_actor_internal_user_id,
    p_person_id,
    p_node_id,
    p_organization_id,
    p_opportunity_id,
    p_articulation_id,
    p_project_id,
    p_theme_id,
    p_need_offer_id,
    p_agenda_entry_id
  ) then
    raise exception
      'Internal user cannot create this communication'
      using errcode = '42501';
  end if;

  if p_generation_mode not in (
    'manual',
    'assisted'
  ) then
    raise exception
      'Invalid communication generation mode'
      using errcode = '22023';
  end if;

  if p_generation_metadata is null
     or jsonb_typeof(p_generation_metadata) <> 'object' then
    raise exception
      'Communication generation metadata must be a JSON object'
      using errcode = '22023';
  end if;

  insert into mp25m.communications (
    communication_type,
    status,
    planned_channels,
    audience_revision,
    subject,
    body,
    generation_mode,
    generation_metadata,
    person_id,
    node_id,
    organization_id,
    opportunity_id,
    articulation_id,
    project_id,
    theme_id,
    need_offer_id,
    agenda_entry_id,
    created_by_internal_user_id
  )
  values (
    p_communication_type,
    'draft',
    p_planned_channels,
    0,
    p_subject,
    p_body,
    p_generation_mode,
    p_generation_metadata,
    p_person_id,
    p_node_id,
    p_organization_id,
    p_opportunity_id,
    p_articulation_id,
    p_project_id,
    p_theme_id,
    p_need_offer_id,
    p_agenda_entry_id,
    p_actor_internal_user_id
  )
  returning id
  into v_communication_id;

  insert into mp25m.communication_content_history (
    communication_id,
    revision_no,
    subject,
    body,
    generation_mode,
    generation_metadata,
    changed_by_internal_user_id,
    change_rationale
  )
  values (
    v_communication_id,
    1,
    p_subject,
    p_body,
    p_generation_mode,
    p_generation_metadata,
    p_actor_internal_user_id,
    'Creación inicial'
  );

  insert into mp25m.communication_status_history (
    communication_id,
    transition_no,
    status,
    rationale,
    changed_by_internal_user_id
  )
  values (
    v_communication_id,
    1,
    'draft',
    'Creación inicial',
    p_actor_internal_user_id
  );

  v_context_type :=
    case
      when p_person_id is not null then 'person'
      when p_node_id is not null then 'node'
      when p_organization_id is not null then 'organization'
      when p_opportunity_id is not null then 'opportunity'
      when p_articulation_id is not null then 'articulation'
      when p_project_id is not null then 'project'
      when p_theme_id is not null then 'theme'
      when p_need_offer_id is not null then 'need_offer'
      when p_agenda_entry_id is not null then 'agenda_entry'
      else 'independent'
    end;

  v_context_id :=
    coalesce(
      p_person_id,
      p_node_id,
      p_organization_id,
      p_opportunity_id,
      p_articulation_id,
      p_project_id,
      p_theme_id,
      p_need_offer_id,
      p_agenda_entry_id
    );

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    new_data,
    metadata,
    result
  )
  values (
    p_actor_internal_user_id,
    'communication.create',
    'mp25m',
    'communications',
    v_communication_id,
    'Creación de borrador de comunicación',
    jsonb_build_object(
      'communication_type', p_communication_type,
      'status', 'draft',
      'planned_channels', p_planned_channels,
      'generation_mode', p_generation_mode,
      'audience_revision', 0
    ),
    jsonb_strip_nulls(
      jsonb_build_object(
        'communication_id', v_communication_id,
        'context_type', v_context_type,
        'context_id', v_context_id
      )
    ),
    'allowed'
  );

  return v_communication_id;
end;
$function$;

comment on function mp25m_api.create_communication(
  uuid,
  text,
  text[],
  text,
  text,
  text,
  jsonb,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  uuid
) is
  'Crea un borrador de comunicación 12B.A, registra revisión 1, estado draft y auditoría. No resuelve audiencia ni envía.';


-- ---------------------------------------------------------------------------
-- 16. ACTUALIZAR COMUNICACIÓN
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.update_communication(
  p_actor_internal_user_id uuid,
  p_communication_id uuid,
  p_planned_channels text[],
  p_subject text,
  p_body text,
  p_generation_mode text,
  p_generation_metadata jsonb,
  p_change_rationale text
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.communications%rowtype;

  v_content_changed boolean;
  v_channels_changed boolean;

  v_revision_no integer;
begin
  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  ) then
    raise exception
      'Internal user cannot manage this communication'
      using errcode = '42501';
  end if;


  select *
  into v_before
  from mp25m.communications communication
  where communication.id =
      p_communication_id
  for update;

  if not found then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if v_before.status = 'cancelled' then
    raise exception
      'Cancelled communication cannot be edited'
      using errcode = '22023';
  end if;


  if p_generation_mode not in (
    'manual',
    'assisted'
  ) then
    raise exception
      'Invalid communication generation mode'
      using errcode = '22023';
  end if;


  if p_generation_metadata is null
     or jsonb_typeof(p_generation_metadata) <> 'object' then
    raise exception
      'Communication generation metadata must be a JSON object'
      using errcode = '22023';
  end if;


  v_content_changed :=
    p_subject is distinct from v_before.subject
    or p_body is distinct from v_before.body
    or p_generation_mode
         is distinct from v_before.generation_mode
    or p_generation_metadata
         is distinct from v_before.generation_metadata;


  v_channels_changed :=
    p_planned_channels
      is distinct from v_before.planned_channels;


  if not v_content_changed
     and not v_channels_changed then
    select coalesce(
      max(history.revision_no),
      0
    )
    into v_revision_no
    from mp25m.communication_content_history history
    where history.communication_id =
        p_communication_id;

    return v_revision_no;
  end if;


  update mp25m.communications communication
  set
    planned_channels =
      p_planned_channels,

    subject =
      p_subject,

    body =
      p_body,

    generation_mode =
      p_generation_mode,

    generation_metadata =
      p_generation_metadata,

    updated_at =
      now()

  where communication.id =
      p_communication_id;


  select coalesce(
    max(history.revision_no),
    0
  )
  into v_revision_no
  from mp25m.communication_content_history history
  where history.communication_id =
      p_communication_id;


  if v_content_changed then
    v_revision_no :=
      v_revision_no + 1;

    insert into mp25m.communication_content_history (
      communication_id,
      revision_no,
      subject,
      body,
      generation_mode,
      generation_metadata,
      changed_by_internal_user_id,
      change_rationale
    )
    values (
      p_communication_id,
      v_revision_no,
      p_subject,
      p_body,
      p_generation_mode,
      p_generation_metadata,
      p_actor_internal_user_id,
      nullif(
        btrim(
          coalesce(
            p_change_rationale,
            ''
          )
        ),
        ''
      )
    );
  end if;


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    new_data,
    metadata,
    result
  )
  values (
    p_actor_internal_user_id,
    'communication.update',
    'mp25m',
    'communications',
    p_communication_id,
    nullif(
      btrim(
        coalesce(
          p_change_rationale,
          ''
        )
      ),
      ''
    ),

    jsonb_build_object(
      'planned_channels',
      v_before.planned_channels,
      'generation_mode',
      v_before.generation_mode
    ),

    jsonb_build_object(
      'planned_channels',
      p_planned_channels,
      'generation_mode',
      p_generation_mode
    ),

    jsonb_build_object(
      'communication_id',
      p_communication_id,
      'content_changed',
      v_content_changed,
      'channels_changed',
      v_channels_changed,
      'content_revision',
      v_revision_no,
      'audience_revision',
      v_before.audience_revision,
      'current_resolution_id',
      v_before.current_resolution_id
    ),

    'allowed'
  );


  return v_revision_no;
end;
$function$;


comment on function mp25m_api.update_communication(
  uuid,
  uuid,
  text[],
  text,
  text,
  text,
  jsonb,
  text
) is
  'Actualiza contenido y canales previstos. Crea una revisión histórica solo cuando cambia el contenido; nunca invalida por sí sola la audiencia confirmada.';


-- ---------------------------------------------------------------------------
-- 17. CANCELAR COMUNICACIÓN
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.cancel_communication(
  p_actor_internal_user_id uuid,
  p_communication_id uuid,
  p_rationale text
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.communications%rowtype;
  v_rationale text;
  v_transition_no integer;
  v_cancelled_at timestamptz;
begin
  v_rationale :=
    nullif(
      btrim(
        coalesce(
          p_rationale,
          ''
        )
      ),
      ''
    );


  if v_rationale is null
     or char_length(v_rationale)
        not between 3 and 2000
  then
    raise exception
      'Invalid communication cancellation rationale'
      using errcode = '22023';
  end if;


  select *
  into v_before
  from mp25m.communications communication
  where communication.id =
      p_communication_id
  for update;

  if not found then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  ) then
    raise exception
      'Internal user cannot manage this communication'
      using errcode = '42501';
  end if;


  if v_before.status = 'cancelled' then
    raise exception
      'Communication is already cancelled'
      using errcode = '22023';
  end if;


  if v_before.status not in (
    'draft',
    'audience_resolved',
    'recipients_confirmed'
  ) then
    raise exception
      'Communication cannot be cancelled from its current status'
      using errcode = '22023';
  end if;


  select
    coalesce(
      max(history.transition_no),
      0
    ) + 1
  into
    v_transition_no
  from mp25m.communication_status_history history
  where history.communication_id =
      p_communication_id;


  v_cancelled_at :=
    now();


  update mp25m.communications communication
  set
    status =
      'cancelled',

    cancelled_at =
      v_cancelled_at,

    cancelled_by_internal_user_id =
      p_actor_internal_user_id,

    cancellation_rationale =
      v_rationale,

    updated_at =
      v_cancelled_at

  where communication.id =
      p_communication_id;


  insert into mp25m.communication_status_history (
    communication_id,
    transition_no,
    status,
    rationale,
    changed_by_internal_user_id,
    changed_at
  )
  values (
    p_communication_id,
    v_transition_no,
    'cancelled',
    v_rationale,
    p_actor_internal_user_id,
    v_cancelled_at
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
    metadata,
    result
  )
  values (
    p_actor_internal_user_id,
    'communication.cancel',
    'mp25m',
    'communications',
    p_communication_id,
    v_rationale,

    jsonb_build_object(
      'status',
      v_before.status,
      'current_resolution_id',
      v_before.current_resolution_id,
      'audience_revision',
      v_before.audience_revision
    ),

    jsonb_build_object(
      'status',
      'cancelled',
      'cancelled_at',
      v_cancelled_at
    ),

    jsonb_build_object(
      'communication_id',
      p_communication_id,
      'transition_no',
      v_transition_no
    ),

    'allowed'
  );


  return v_transition_no;
end;
$function$;


comment on function mp25m_api.cancel_communication(
  uuid,
  uuid,
  text
) is
  'Cancela una comunicación 12B.A de forma terminal, preservando audiencia, resoluciones e historial previos.';


-- ---------------------------------------------------------------------------
-- 18. REEMPLAZAR DEFINICIÓN DE AUDIENCIA
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.replace_communication_audience_criteria(
  p_actor_internal_user_id uuid,
  p_communication_id uuid,
  p_criteria jsonb,
  p_rationale text
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.communications%rowtype;

  v_item jsonb;

  v_group_no integer;
  v_criterion_type text;
  v_criterion_operation text;

  v_person_id uuid;
  v_node_id uuid;
  v_articulation_id uuid;
  v_project_id uuid;
  v_skill_id uuid;
  v_theme_id uuid;

  v_verification_statuses text[];

  v_new_revision integer;
  v_transition_no integer;

  v_rationale text;

  v_has_include boolean;
begin
  v_rationale :=
    nullif(
      btrim(
        coalesce(
          p_rationale,
          ''
        )
      ),
      ''
    );


  if p_criteria is null
     or jsonb_typeof(p_criteria) <> 'array'
     or jsonb_array_length(p_criteria) = 0
  then
    raise exception
      'Audience criteria must be a non-empty JSON array'
      using errcode = '22023';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  ) then
    raise exception
      'Internal user cannot manage this communication'
      using errcode = '42501';
  end if;


  select *
  into v_before
  from mp25m.communications communication
  where communication.id =
      p_communication_id
  for update;

  if not found then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if v_before.status = 'cancelled' then
    raise exception
      'Cancelled communication audience cannot be modified'
      using errcode = '22023';
  end if;


  -- -----------------------------------------------------------------------
  -- Validación completa antes de alterar communications.
  -- -----------------------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(p_criteria)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception
        'Every audience criterion must be a JSON object'
        using errcode = '22023';
    end if;


    begin
      v_group_no :=
        (v_item ->> 'group_no')::integer;
    exception
      when others then
        raise exception
          'Invalid audience criterion group_no'
          using errcode = '22023';
    end;


    if v_group_no is null
       or v_group_no <= 0 then
      raise exception
        'Audience criterion group_no must be positive'
        using errcode = '22023';
    end if;


    v_criterion_type :=
      nullif(
        btrim(
          coalesce(
            v_item ->> 'criterion_type',
            ''
          )
        ),
        ''
      );


    if v_criterion_type not in (
      'person',
      'node_participants',
      'articulation_participants',
      'project_participants',
      'person_skill',
      'organization_capability',
      'theme_responsibles'
    ) then
      raise exception
        'Invalid audience criterion type'
        using errcode = '22023';
    end if;


    v_criterion_operation :=
      nullif(
        btrim(
          coalesce(
            v_item ->> 'criterion_operation',
            ''
          )
        ),
        ''
      );


    if v_criterion_operation not in (
      'include',
      'exclude'
    ) then
      raise exception
        'Invalid audience criterion operation'
        using errcode = '22023';
    end if;


    begin
      v_person_id :=
        nullif(
          v_item ->> 'person_id',
          ''
        )::uuid;

      v_node_id :=
        nullif(
          v_item ->> 'node_id',
          ''
        )::uuid;

      v_articulation_id :=
        nullif(
          v_item ->> 'articulation_id',
          ''
        )::uuid;

      v_project_id :=
        nullif(
          v_item ->> 'project_id',
          ''
        )::uuid;

      v_skill_id :=
        nullif(
          v_item ->> 'skill_id',
          ''
        )::uuid;

      v_theme_id :=
        nullif(
          v_item ->> 'theme_id',
          ''
        )::uuid;

    exception
      when invalid_text_representation then
        raise exception
          'Audience criterion contains an invalid UUID'
          using errcode = '22023';
    end;


    v_verification_statuses :=
      null;


    if v_criterion_type in (
      'person_skill',
      'organization_capability'
    ) then

      if not (v_item ? 'verification_statuses')
         or v_item -> 'verification_statuses' is null
         or jsonb_typeof(
              v_item -> 'verification_statuses'
            ) = 'null'
      then
        v_verification_statuses :=
          array['confirmed']::text[];

      else
        if jsonb_typeof(
          v_item -> 'verification_statuses'
        ) <> 'array' then
          raise exception
            'verification_statuses must be an array'
            using errcode = '22023';
        end if;


        select
          array_agg(
            value
            order by value
          )
        into
          v_verification_statuses
        from (
          select distinct
            jsonb_array_elements_text(
              v_item -> 'verification_statuses'
            ) as value
        ) statuses;


        if coalesce(
          cardinality(v_verification_statuses),
          0
        ) = 0 then
          raise exception
            'verification_statuses cannot be empty'
            using errcode = '22023';
        end if;


        if exists (
          select 1
          from unnest(
            v_verification_statuses
          ) status
          where status not in (
            'confirmed',
            'candidate',
            'self_reported'
          )
        ) then
          raise exception
            'Invalid verification status'
            using errcode = '22023';
        end if;
      end if;

    elsif v_item ? 'verification_statuses'
          and v_item -> 'verification_statuses'
              is not null
          and jsonb_typeof(
                v_item -> 'verification_statuses'
              ) <> 'null'
    then
      raise exception
        'verification_statuses is not valid for this criterion type'
        using errcode = '22023';
    end if;


    -- ---------------------------------------------------------------------
    -- Forma exacta por tipo + existencia de la entidad fuente.
    -- ---------------------------------------------------------------------

    case v_criterion_type

      when 'person' then
        if v_person_id is null
           or v_node_id is not null
           or v_articulation_id is not null
           or v_project_id is not null
           or v_skill_id is not null
           or v_theme_id is not null
        then
          raise exception
            'Invalid person audience criterion'
            using errcode = '22023';
        end if;

        if not exists (
          select 1
          from mp25m.persons person
          where person.id = v_person_id
        ) then
          raise exception
            'Audience criterion person does not exist'
            using errcode = '22023';
        end if;


      when 'node_participants' then
        if v_node_id is null
           or v_person_id is not null
           or v_articulation_id is not null
           or v_project_id is not null
           or v_skill_id is not null
           or v_theme_id is not null
        then
          raise exception
            'Invalid node participant audience criterion'
            using errcode = '22023';
        end if;

        if not exists (
          select 1
          from mp25m.nodes node
          where node.id = v_node_id
        ) then
          raise exception
            'Audience criterion node does not exist'
            using errcode = '22023';
        end if;


      when 'articulation_participants' then
        if v_articulation_id is null
           or v_person_id is not null
           or v_node_id is not null
           or v_project_id is not null
           or v_skill_id is not null
           or v_theme_id is not null
        then
          raise exception
            'Invalid articulation participant audience criterion'
            using errcode = '22023';
        end if;

        if not exists (
          select 1
          from mp25m.opportunity_articulations articulation
          where articulation.id =
              v_articulation_id
        ) then
          raise exception
            'Audience criterion articulation does not exist'
            using errcode = '22023';
        end if;


      when 'project_participants' then
        if v_project_id is null
           or v_person_id is not null
           or v_node_id is not null
           or v_articulation_id is not null
           or v_skill_id is not null
           or v_theme_id is not null
        then
          raise exception
            'Invalid project participant audience criterion'
            using errcode = '22023';
        end if;

        if not exists (
          select 1
          from mp25m.projects project
          where project.id =
              v_project_id
        ) then
          raise exception
            'Audience criterion project does not exist'
            using errcode = '22023';
        end if;


      when 'person_skill' then
        if v_skill_id is null
           or v_person_id is not null
           or v_node_id is not null
           or v_articulation_id is not null
           or v_project_id is not null
           or v_theme_id is not null
        then
          raise exception
            'Invalid person skill audience criterion'
            using errcode = '22023';
        end if;

        if not exists (
          select 1
          from mp25m.skills skill
          where skill.id = v_skill_id
            and skill.active = true
            and skill.applies_to_person = true
        ) then
          raise exception
            'Audience criterion person skill is not active or applicable'
            using errcode = '22023';
        end if;


      when 'organization_capability' then
        if v_skill_id is null
           or v_person_id is not null
           or v_articulation_id is not null
           or v_project_id is not null
           or v_theme_id is not null
        then
          raise exception
            'Invalid organization capability audience criterion'
            using errcode = '22023';
        end if;

        if not exists (
          select 1
          from mp25m.skills skill
          where skill.id = v_skill_id
            and skill.active = true
            and skill.applies_to_organization = true
        ) then
          raise exception
            'Audience criterion organization capability is not active or applicable'
            using errcode = '22023';
        end if;

        if v_node_id is not null
           and not exists (
             select 1
             from mp25m.nodes node
             where node.id = v_node_id
           )
        then
          raise exception
            'Audience criterion capability node does not exist'
            using errcode = '22023';
        end if;


      when 'theme_responsibles' then
        if v_theme_id is null
           or v_person_id is not null
           or v_node_id is not null
           or v_articulation_id is not null
           or v_project_id is not null
           or v_skill_id is not null
        then
          raise exception
            'Invalid theme responsible audience criterion'
            using errcode = '22023';
        end if;

        if not exists (
          select 1
          from mp25m.themes theme
          where theme.id = v_theme_id
        ) then
          raise exception
            'Audience criterion theme does not exist'
            using errcode = '22023';
        end if;

    end case;

  end loop;


  -- -----------------------------------------------------------------------
  -- Cada grupo debe contener al menos un INCLUDE.
  -- -----------------------------------------------------------------------

  for v_group_no in
    select distinct
      (value ->> 'group_no')::integer
    from jsonb_array_elements(p_criteria)
  loop
    select exists (
      select 1
      from jsonb_array_elements(p_criteria) criterion
      where
        (criterion ->> 'group_no')::integer =
          v_group_no
        and criterion ->> 'criterion_operation' =
          'include'
    )
    into v_has_include;

    if not v_has_include then
      raise exception
        'Every audience group must contain at least one include criterion'
        using errcode = '22023';
    end if;
  end loop;


  -- -----------------------------------------------------------------------
  -- Nueva revisión.
  -- Primero se invalida la resolución vigente para que el trigger de
  -- criterios permita insertar exclusivamente la nueva revisión draft.
  -- -----------------------------------------------------------------------

  v_new_revision :=
    v_before.audience_revision + 1;


  update mp25m.communications communication
  set
    audience_revision =
      v_new_revision,

    current_resolution_id =
      null,

    status =
      'draft',

    updated_at =
      now()

  where communication.id =
      p_communication_id;


  -- -----------------------------------------------------------------------
  -- Inserción de la definición completa ya validada.
  -- -----------------------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(p_criteria)
  loop
    v_group_no :=
      (v_item ->> 'group_no')::integer;

    v_criterion_type :=
      v_item ->> 'criterion_type';

    v_criterion_operation :=
      v_item ->> 'criterion_operation';


    v_person_id :=
      nullif(
        v_item ->> 'person_id',
        ''
      )::uuid;

    v_node_id :=
      nullif(
        v_item ->> 'node_id',
        ''
      )::uuid;

    v_articulation_id :=
      nullif(
        v_item ->> 'articulation_id',
        ''
      )::uuid;

    v_project_id :=
      nullif(
        v_item ->> 'project_id',
        ''
      )::uuid;

    v_skill_id :=
      nullif(
        v_item ->> 'skill_id',
        ''
      )::uuid;

    v_theme_id :=
      nullif(
        v_item ->> 'theme_id',
        ''
      )::uuid;


    if v_criterion_type in (
      'person_skill',
      'organization_capability'
    ) then

      if not (v_item ? 'verification_statuses')
         or v_item -> 'verification_statuses' is null
         or jsonb_typeof(
              v_item -> 'verification_statuses'
            ) = 'null'
      then
        v_verification_statuses :=
          array['confirmed']::text[];

      else
        select
          array_agg(
            value
            order by value
          )
        into
          v_verification_statuses
        from (
          select distinct
            jsonb_array_elements_text(
              v_item -> 'verification_statuses'
            ) as value
        ) statuses;
      end if;

    else
      v_verification_statuses :=
        null;
    end if;


    insert into mp25m.communication_audience_criteria (
      communication_id,
      audience_revision,
      group_no,
      criterion_type,
      criterion_operation,

      person_id,
      node_id,
      articulation_id,
      project_id,
      skill_id,
      theme_id,
      verification_statuses,

      created_by_internal_user_id
    )
    values (
      p_communication_id,
      v_new_revision,
      v_group_no,
      v_criterion_type,
      v_criterion_operation,

      v_person_id,
      v_node_id,
      v_articulation_id,
      v_project_id,
      v_skill_id,
      v_theme_id,
      v_verification_statuses,

      p_actor_internal_user_id
    );
  end loop;


  -- -----------------------------------------------------------------------
  -- Si estaba resuelta o confirmada, volver a draft es una transición.
  -- Si ya estaba draft, solo cambia la revisión de audiencia.
  -- -----------------------------------------------------------------------

  if v_before.status in (
    'audience_resolved',
    'recipients_confirmed'
  ) then

    select
      coalesce(
        max(history.transition_no),
        0
      ) + 1
    into
      v_transition_no
    from mp25m.communication_status_history history
    where history.communication_id =
        p_communication_id;


    insert into mp25m.communication_status_history (
      communication_id,
      transition_no,
      status,
      rationale,
      changed_by_internal_user_id
    )
    values (
      p_communication_id,
      v_transition_no,
      'draft',
      coalesce(
        v_rationale,
        'Modificación de criterios de audiencia'
      ),
      p_actor_internal_user_id
    );
  end if;


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    new_data,
    metadata,
    result
  )
  values (
    p_actor_internal_user_id,
    'communication.audience.criteria_replace',
    'mp25m',
    'communications',
    p_communication_id,
    v_rationale,

    jsonb_build_object(
      'audience_revision',
      v_before.audience_revision,
      'status',
      v_before.status,
      'current_resolution_id',
      v_before.current_resolution_id
    ),

    jsonb_build_object(
      'audience_revision',
      v_new_revision,
      'status',
      'draft',
      'current_resolution_id',
      null,
      'criterion_count',
      jsonb_array_length(p_criteria)
    ),

    jsonb_build_object(
      'communication_id',
      p_communication_id
    ),

    'allowed'
  );


  return v_new_revision;
end;
$function$;


comment on function mp25m_api.replace_communication_audience_criteria(
  uuid,
  uuid,
  jsonb,
  text
) is
  'Reemplaza atómicamente la definición vigente de audiencia, crea una nueva audience_revision y conserva todas las revisiones históricas.';


-- ---------------------------------------------------------------------------
-- 19. RESOLUCIÓN DE CADA CRITERIO
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.communication_criterion_actor_list(
  p_actor_internal_user_id uuid,
  p_communication_id uuid,
  p_criterion_id uuid
)
returns table (
  recipient_kind text,
  actor_id uuid,
  display_name text
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_audience_revision integer;
  v_criterion mp25m.communication_audience_criteria%rowtype;
begin
  select communication.audience_revision
  into v_audience_revision
  from mp25m.communications communication
  where communication.id =
      p_communication_id;

  if not found then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  ) then
    raise exception
      'Internal user cannot resolve this communication'
      using errcode = '42501';
  end if;


  select criterion.*
  into v_criterion
  from mp25m.communication_audience_criteria criterion
  where criterion.id =
      p_criterion_id

    and criterion.communication_id =
      p_communication_id

    and criterion.audience_revision =
      v_audience_revision;

  if not found then
    raise exception
      'Audience criterion is not part of the current audience revision'
      using errcode = '22023';
  end if;


  case v_criterion.criterion_type

    when 'person' then
      return query
      select
        'person'::text,
        person.id,
        coalesce(
          nullif(
            btrim(person.display_name),
            ''
          ),
          'Persona ' ||
            left(
              person.id::text,
              8
            )
        )::text
      from mp25m.persons person
      where person.id =
          v_criterion.person_id;


    when 'node_participants' then
      return query
      select distinct
        'person'::text,
        person.id,
        coalesce(
          nullif(
            btrim(person.display_name),
            ''
          ),
          'Persona ' ||
            left(
              person.id::text,
              8
            )
        )::text

      from mp25m.node_participations participation

      join mp25m.persons person
        on person.id =
          participation.person_id

      where participation.node_id =
          v_criterion.node_id

        and participation.status =
          'active'

        and participation.verification_status =
          'confirmed'

        and (
          participation.started_on is null
          or participation.started_on <= current_date
        )

        and (
          participation.ended_on is null
          or participation.ended_on >= current_date
        );


    when 'articulation_participants' then
      return query
      select distinct
        case
          when participant.person_id is not null
            then 'person'
          else 'organization'
        end::text,

        coalesce(
          participant.person_id,
          participant.organization_id
        ),

        coalesce(
          nullif(
            btrim(person.display_name),
            ''
          ),
          nullif(
            btrim(organization.name),
            ''
          ),
          case
            when participant.person_id is not null
              then
                'Persona ' ||
                left(
                  participant.person_id::text,
                  8
                )
            else
                'Organización ' ||
                left(
                  participant.organization_id::text,
                  8
                )
          end
        )::text

      from mp25m.opportunity_articulation_participants participant

      left join mp25m.persons person
        on person.id =
          participant.person_id

      left join mp25m.organizations organization
        on organization.id =
          participant.organization_id

      where participant.articulation_id =
          v_criterion.articulation_id

        and participant.removed_at is null;


    when 'project_participants' then
      return query
      select distinct
        case
          when participant.person_id is not null
            then 'person'
          else 'organization'
        end::text,

        coalesce(
          participant.person_id,
          participant.organization_id
        ),

        coalesce(
          nullif(
            btrim(person.display_name),
            ''
          ),
          nullif(
            btrim(organization.name),
            ''
          ),
          case
            when participant.person_id is not null
              then
                'Persona ' ||
                left(
                  participant.person_id::text,
                  8
                )
            else
                'Organización ' ||
                left(
                  participant.organization_id::text,
                  8
                )
          end
        )::text

      from mp25m.project_participants participant

      left join mp25m.persons person
        on person.id =
          participant.person_id

      left join mp25m.organizations organization
        on organization.id =
          participant.organization_id

      where participant.project_id =
          v_criterion.project_id

        and participant.removed_at is null;


    when 'person_skill' then
      return query
      select distinct
        'person'::text,
        person.id,

        coalesce(
          nullif(
            btrim(person.display_name),
            ''
          ),
          'Persona ' ||
            left(
              person.id::text,
              8
            )
        )::text

      from mp25m.person_skills person_skill

      join mp25m.skills skill
        on skill.id =
          person_skill.skill_id

      join mp25m.persons person
        on person.id =
          person_skill.person_id

      where person_skill.skill_id =
          v_criterion.skill_id

        and person_skill.active = true

        and person_skill.verification_status =
          any(
            v_criterion.verification_statuses
          )

        and skill.active = true
        and skill.applies_to_person = true;


    when 'organization_capability' then
      return query
      select distinct
        'organization'::text,
        organization.id,

        coalesce(
          nullif(
            btrim(organization.name),
            ''
          ),
          'Organización ' ||
            left(
              organization.id::text,
              8
            )
        )::text

      from mp25m.organization_capabilities capability

      join mp25m.skills skill
        on skill.id =
          capability.skill_id

      join mp25m.organizations organization
        on organization.id =
          capability.organization_id

      where capability.skill_id =
          v_criterion.skill_id

        and capability.active = true

        and capability.verification_status =
          any(
            v_criterion.verification_statuses
          )

        and skill.active = true
        and skill.applies_to_organization = true

        and (
          v_criterion.node_id is null
          or capability.node_id is null
          or capability.node_id =
             v_criterion.node_id
        );


    when 'theme_responsibles' then
      return query
      select distinct
        'internal_user'::text,
        internal_user.id,

        coalesce(
          nullif(
            btrim(
              internal_user.display_name
            ),
            ''
          ),
          'Usuario interno ' ||
            left(
              internal_user.id::text,
              8
            )
        )::text

      from mp25m.theme_responsibilities responsibility

      join mp25m.internal_users internal_user
        on internal_user.id =
          responsibility.internal_user_id

      where responsibility.theme_id =
          v_criterion.theme_id

        and responsibility.ended_at is null;

  end case;
end;
$function$;


comment on function mp25m_api.communication_criterion_actor_list(
  uuid,
  uuid,
  uuid
) is
  'Resuelve un criterio de la revisión vigente de audiencia sin crear relaciones ni inferir actores transitivos.';


-- ---------------------------------------------------------------------------
-- 20. RESOLVER AUDIENCIA
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.resolve_communication_audience(
  p_actor_internal_user_id uuid,
  p_communication_id uuid,
  p_rationale text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.communications%rowtype;

  v_resolution_id uuid;
  v_resolution_no integer;

  v_criteria_snapshot jsonb;

  v_transition_no integer;
  v_resolved_at timestamptz;

  v_rationale text;

  v_recipient_count integer;
  v_duplicate_count integer;
begin
  v_rationale :=
    nullif(
      btrim(
        coalesce(
          p_rationale,
          ''
        )
      ),
      ''
    );


  if v_rationale is not null
     and char_length(v_rationale)
         not between 3 and 10000
  then
    raise exception
      'Invalid audience resolution rationale'
      using errcode = '22023';
  end if;


  select *
  into v_before
  from mp25m.communications communication
  where communication.id =
      p_communication_id
  for update;

  if not found then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  ) then
    raise exception
      'Internal user cannot resolve this communication'
      using errcode = '42501';
  end if;


  if v_before.status not in (
    'draft',
    'audience_resolved'
  ) then
    raise exception
      'Communication status does not allow audience resolution'
      using errcode = '22023';
  end if;


  if v_before.audience_revision <= 0
     or not exists (
       select 1
       from mp25m.communication_audience_criteria criterion
       where criterion.communication_id =
           p_communication_id
         and criterion.audience_revision =
           v_before.audience_revision
     )
  then
    raise exception
      'Communication has no current audience definition'
      using errcode = '22023';
  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_strip_nulls(
          jsonb_build_object(
            'criterion_id',
            criterion.id,

            'audience_revision',
            criterion.audience_revision,

            'group_no',
            criterion.group_no,

            'criterion_type',
            criterion.criterion_type,

            'criterion_operation',
            criterion.criterion_operation,

            'person_id',
            criterion.person_id,

            'node_id',
            criterion.node_id,

            'articulation_id',
            criterion.articulation_id,

            'project_id',
            criterion.project_id,

            'skill_id',
            criterion.skill_id,

            'theme_id',
            criterion.theme_id,

            'verification_statuses',
            criterion.verification_statuses
          )
        )
        order by
          criterion.group_no,
          criterion.id
      ),
      '[]'::jsonb
    )
  into
    v_criteria_snapshot
  from mp25m.communication_audience_criteria criterion
  where criterion.communication_id =
      p_communication_id

    and criterion.audience_revision =
      v_before.audience_revision;


  -- -----------------------------------------------------------------------
  -- Hits por criterio.
  -- -----------------------------------------------------------------------

  create temporary table if not exists
    communication_criterion_hits_tmp (
      criterion_id uuid not null,
      group_no integer not null,
      criterion_operation text not null,
      criterion_type text not null,

      recipient_kind text not null,
      actor_id uuid not null,
      display_name text not null
    )
  on commit drop;


  truncate table
    pg_temp.communication_criterion_hits_tmp;


  insert into pg_temp.communication_criterion_hits_tmp (
    criterion_id,
    group_no,
    criterion_operation,
    criterion_type,
    recipient_kind,
    actor_id,
    display_name
  )
  select distinct
    criterion.id,
    criterion.group_no,
    criterion.criterion_operation,
    criterion.criterion_type,

    actor.recipient_kind,
    actor.actor_id,
    actor.display_name

  from mp25m.communication_audience_criteria criterion

  cross join lateral
    mp25m_api.communication_criterion_actor_list(
      p_actor_internal_user_id,
      p_communication_id,
      criterion.id
    ) actor

  where criterion.communication_id =
      p_communication_id

    and criterion.audience_revision =
      v_before.audience_revision;


  -- -----------------------------------------------------------------------
  -- Algebra:
  --
  --   grupo =
  --     INTERSECCIÓN de todos sus INCLUDE
  --     menos UNIÓN de sus EXCLUDE
  --
  --   audiencia final =
  --     UNIÓN de todos los grupos
  -- -----------------------------------------------------------------------

  create temporary table if not exists
    communication_group_actor_tmp (
      group_no integer not null,
      recipient_kind text not null,
      actor_id uuid not null,
      display_name text not null,

      primary key (
        group_no,
        recipient_kind,
        actor_id
      )
    )
  on commit drop;


  truncate table
    pg_temp.communication_group_actor_tmp;


  insert into pg_temp.communication_group_actor_tmp (
    group_no,
    recipient_kind,
    actor_id,
    display_name
  )
  select
    hit.group_no,
    hit.recipient_kind,
    hit.actor_id,
    max(hit.display_name)

  from pg_temp.communication_criterion_hits_tmp hit

  where hit.criterion_operation =
      'include'

    and not exists (
      select 1
      from pg_temp.communication_criterion_hits_tmp excluded
      where excluded.group_no =
          hit.group_no

        and excluded.criterion_operation =
          'exclude'

        and excluded.recipient_kind =
          hit.recipient_kind

        and excluded.actor_id =
          hit.actor_id
    )

  group by
    hit.group_no,
    hit.recipient_kind,
    hit.actor_id

  having count(
    distinct hit.criterion_id
  ) = (
    select count(*)
    from mp25m.communication_audience_criteria criterion
    where criterion.communication_id =
        p_communication_id

      and criterion.audience_revision =
        v_before.audience_revision

      and criterion.group_no =
        hit.group_no

      and criterion.criterion_operation =
        'include'
  );


  -- -----------------------------------------------------------------------
  -- Crear resolución histórica.
  -- -----------------------------------------------------------------------

  select
    coalesce(
      max(resolution.resolution_no),
      0
    ) + 1
  into
    v_resolution_no
  from mp25m.communication_audience_resolutions resolution
  where resolution.communication_id =
      p_communication_id;


  v_resolved_at :=
    now();


  insert into mp25m.communication_audience_resolutions (
    communication_id,
    resolution_no,
    audience_revision,
    criteria_snapshot,
    resolved_by_internal_user_id,
    resolved_at
  )
  values (
    p_communication_id,
    v_resolution_no,
    v_before.audience_revision,
    v_criteria_snapshot,
    p_actor_internal_user_id,
    v_resolved_at
  )
  returning id
  into v_resolution_id;


  -- -----------------------------------------------------------------------
  -- Snapshot de identidad + diagnóstico de canales.
  --
  -- En 12B.A:
  --   internal/public -> contacto utilizable para diagnóstico
  --   private         -> restricted
  --
  -- Esto NO constituye consentimiento ni autorización de envío.
  -- -----------------------------------------------------------------------

  insert into mp25m.communication_resolution_recipients (
    resolution_id,

    recipient_kind,
    person_id,
    organization_id,
    internal_user_id,

    display_name_snapshot,

    manually_added,
    included,
    exclusion_reason,

    email_availability_status,
    whatsapp_availability_status,

    duplicate_status,
    diagnostic_detail
  )
  select
    v_resolution_id,

    actor.recipient_kind,

    case
      when actor.recipient_kind = 'person'
        then actor.actor_id
      else null
    end,

    case
      when actor.recipient_kind = 'organization'
        then actor.actor_id
      else null
    end,

    case
      when actor.recipient_kind = 'internal_user'
        then actor.actor_id
      else null
    end,

    actor.display_name,

    false,
    true,
    null,

    case
      when actor.recipient_kind <> 'person'
        then 'unsupported_recipient'

      when exists (
        select 1
        from mp25m.person_contacts contact
        where contact.person_id =
            actor.actor_id

          and contact.active = true
          and contact.contact_type =
              'email'

          and contact.visibility in (
            'internal',
            'public'
          )

          and nullif(
                btrim(
                  contact.value_original
                ),
                ''
              ) is not null

          and contact.verified_at is not null
      )
        then 'available_verified'

      when exists (
        select 1
        from mp25m.person_contacts contact
        where contact.person_id =
            actor.actor_id

          and contact.active = true
          and contact.contact_type =
              'email'

          and contact.visibility in (
            'internal',
            'public'
          )

          and nullif(
                btrim(
                  contact.value_original
                ),
                ''
              ) is not null
      )
        then 'available_unverified'

      when exists (
        select 1
        from mp25m.person_contacts contact
        where contact.person_id =
            actor.actor_id

          and contact.active = true
          and contact.contact_type =
              'email'

          and contact.visibility =
              'private'

          and nullif(
                btrim(
                  contact.value_original
                ),
                ''
              ) is not null
      )
        then 'restricted'

      else 'missing'
    end,

    case
      when actor.recipient_kind <> 'person'
        then 'unsupported_recipient'

      when exists (
        select 1
        from mp25m.person_contacts contact
        where contact.person_id =
            actor.actor_id

          and contact.active = true
          and contact.contact_type =
              'whatsapp'

          and contact.visibility in (
            'internal',
            'public'
          )

          and nullif(
                btrim(
                  contact.value_original
                ),
                ''
              ) is not null

          and contact.verified_at is not null
      )
        then 'available_verified'

      when exists (
        select 1
        from mp25m.person_contacts contact
        where contact.person_id =
            actor.actor_id

          and contact.active = true
          and contact.contact_type =
              'whatsapp'

          and contact.visibility in (
            'internal',
            'public'
          )

          and nullif(
                btrim(
                  contact.value_original
                ),
                ''
              ) is not null
      )
        then 'available_unverified'

      when exists (
        select 1
        from mp25m.person_contacts contact
        where contact.person_id =
            actor.actor_id

          and contact.active = true
          and contact.contact_type =
              'whatsapp'

          and contact.visibility =
              'private'

          and nullif(
                btrim(
                  contact.value_original
                ),
                ''
              ) is not null
      )
        then 'restricted'

      else 'missing'
    end,

    'none',

    case
      when actor.recipient_kind = 'person'
        then jsonb_build_object(
          'channel_consent',
          'unknown',

          'visible_contact_levels',
          jsonb_build_array(
            'internal',
            'public'
          )
        )

      when actor.recipient_kind = 'organization'
        then jsonb_build_object(
          'channel_consent',
          'unknown',
          'contact_model',
          'unsupported_recipient'
        )

      else jsonb_build_object(
        'channel_consent',
        'unknown',
        'contact_model',
        'unsupported_recipient',
        'auth_email_used',
        false
      )
    end

  from (
    select
      grouped.recipient_kind,
      grouped.actor_id,
      max(grouped.display_name)
        as display_name

    from pg_temp.communication_group_actor_tmp grouped

    group by
      grouped.recipient_kind,
      grouped.actor_id
  ) actor;


  -- -----------------------------------------------------------------------
  -- Procedencias.
  --
  -- Solo se registran INCLUDE que realmente contribuyeron a un grupo
  -- sobreviviente. Un EXCLUDE que quitó al actor no se convierte en
  -- procedencia positiva.
  -- -----------------------------------------------------------------------

  insert into mp25m.communication_recipient_sources (
    recipient_id,
    criterion_id,
    criterion_type,
    source_detail
  )
  select distinct
    recipient.id,
    hit.criterion_id,
    hit.criterion_type,

    jsonb_build_object(
      'group_no',
      grouped.group_no,
      'criterion_operation',
      'include'
    )

  from pg_temp.communication_group_actor_tmp grouped

  join mp25m.communication_resolution_recipients recipient
    on recipient.resolution_id =
       v_resolution_id

   and (
     (
       grouped.recipient_kind = 'person'
       and recipient.recipient_kind = 'person'
       and recipient.person_id =
           grouped.actor_id
     )
     or
     (
       grouped.recipient_kind = 'organization'
       and recipient.recipient_kind = 'organization'
       and recipient.organization_id =
           grouped.actor_id
     )
     or
     (
       grouped.recipient_kind = 'internal_user'
       and recipient.recipient_kind = 'internal_user'
       and recipient.internal_user_id =
           grouped.actor_id
     )
   )

  join pg_temp.communication_criterion_hits_tmp hit
    on hit.group_no =
       grouped.group_no

   and hit.criterion_operation =
       'include'

   and hit.recipient_kind =
       grouped.recipient_kind

   and hit.actor_id =
       grouped.actor_id;


  -- -----------------------------------------------------------------------
  -- Duplicados de canal entre Personas.
  --
  -- Se compara únicamente dato normalizado visible para uso interno.
  -- No se fusionan actores ni se elige automáticamente un destinatario.
  -- -----------------------------------------------------------------------

  with duplicate_flags as (
    select
      recipient.id,

      exists (
        select 1

        from mp25m.person_contacts own_contact

        join mp25m.communication_resolution_recipients other_recipient
          on other_recipient.resolution_id =
             v_resolution_id

         and other_recipient.recipient_kind =
             'person'

         and other_recipient.id <>
             recipient.id

        join mp25m.person_contacts other_contact
          on other_contact.person_id =
             other_recipient.person_id

        where own_contact.person_id =
            recipient.person_id

          and own_contact.active = true
          and other_contact.active = true

          and own_contact.contact_type =
              'email'

          and other_contact.contact_type =
              'email'

          and own_contact.visibility in (
            'internal',
            'public'
          )

          and other_contact.visibility in (
            'internal',
            'public'
          )

          and nullif(
                btrim(
                  own_contact.value_normalized
                ),
                ''
              ) is not null

          and own_contact.value_normalized =
              other_contact.value_normalized
      ) as email_duplicate,


      exists (
        select 1

        from mp25m.person_contacts own_contact

        join mp25m.communication_resolution_recipients other_recipient
          on other_recipient.resolution_id =
             v_resolution_id

         and other_recipient.recipient_kind =
             'person'

         and other_recipient.id <>
             recipient.id

        join mp25m.person_contacts other_contact
          on other_contact.person_id =
             other_recipient.person_id

        where own_contact.person_id =
            recipient.person_id

          and own_contact.active = true
          and other_contact.active = true

          and own_contact.contact_type =
              'whatsapp'

          and other_contact.contact_type =
              'whatsapp'

          and own_contact.visibility in (
            'internal',
            'public'
          )

          and other_contact.visibility in (
            'internal',
            'public'
          )

          and nullif(
                btrim(
                  own_contact.value_normalized
                ),
                ''
              ) is not null

          and own_contact.value_normalized =
              other_contact.value_normalized
      ) as whatsapp_duplicate

    from mp25m.communication_resolution_recipients recipient
    where recipient.resolution_id =
        v_resolution_id

      and recipient.recipient_kind =
          'person'
  )

  update mp25m.communication_resolution_recipients recipient
  set
    duplicate_status =
      case
        when duplicate.email_duplicate
             and duplicate.whatsapp_duplicate
          then 'email_and_whatsapp_duplicate'

        when duplicate.email_duplicate
          then 'email_duplicate'

        when duplicate.whatsapp_duplicate
          then 'whatsapp_duplicate'

        else 'none'
      end,

    diagnostic_detail =
      recipient.diagnostic_detail
      ||
      jsonb_build_object(
        'email_duplicate',
        duplicate.email_duplicate,

        'whatsapp_duplicate',
        duplicate.whatsapp_duplicate
      )

  from duplicate_flags duplicate

  where recipient.id =
      duplicate.id;


  -- -----------------------------------------------------------------------
  -- La nueva resolución pasa a ser la vigente.
  -- -----------------------------------------------------------------------

  update mp25m.communications communication
  set
    current_resolution_id =
      v_resolution_id,

    status =
      'audience_resolved',

    updated_at =
      v_resolved_at

  where communication.id =
      p_communication_id;


  -- Cada resolución es una transición, incluso:
  --
  -- audience_resolved -> audience_resolved
  --
  -- porque representa una nueva foto resuelta.
  select
    coalesce(
      max(history.transition_no),
      0
    ) + 1
  into
    v_transition_no
  from mp25m.communication_status_history history
  where history.communication_id =
      p_communication_id;


  insert into mp25m.communication_status_history (
    communication_id,
    transition_no,
    status,
    rationale,
    changed_by_internal_user_id,
    changed_at
  )
  values (
    p_communication_id,
    v_transition_no,
    'audience_resolved',
    coalesce(
      v_rationale,
      'Resolución de audiencia'
    ),
    p_actor_internal_user_id,
    v_resolved_at
  );


  select count(*)
  into v_recipient_count
  from mp25m.communication_resolution_recipients recipient
  where recipient.resolution_id =
      v_resolution_id;


  select count(*)
  into v_duplicate_count
  from mp25m.communication_resolution_recipients recipient
  where recipient.resolution_id =
      v_resolution_id

    and recipient.duplicate_status <>
        'none';


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    new_data,
    metadata,
    result
  )
  values (
    p_actor_internal_user_id,
    'communication.audience.resolve',
    'mp25m',
    'communications',
    p_communication_id,
    v_rationale,

    jsonb_build_object(
      'status',
      v_before.status,
      'current_resolution_id',
      v_before.current_resolution_id,
      'audience_revision',
      v_before.audience_revision
    ),

    jsonb_build_object(
      'status',
      'audience_resolved',
      'current_resolution_id',
      v_resolution_id,
      'audience_revision',
      v_before.audience_revision
    ),

    jsonb_build_object(
      'communication_id',
      p_communication_id,

      'resolution_id',
      v_resolution_id,

      'resolution_no',
      v_resolution_no,

      'recipient_count',
      v_recipient_count,

      'duplicate_recipient_count',
      v_duplicate_count,

      'group_count',
      (
        select count(distinct criterion.group_no)
        from mp25m.communication_audience_criteria criterion
        where criterion.communication_id =
            p_communication_id

          and criterion.audience_revision =
            v_before.audience_revision
      )
    ),

    'allowed'
  );


  return v_resolution_id;
end;
$function$;


comment on function mp25m_api.resolve_communication_audience(
  uuid,
  uuid,
  text
) is
  'Resuelve transaccionalmente la audiencia 12B.A: AND dentro del grupo, EXCLUDE dentro del grupo y OR entre grupos; crea snapshot de destinatarios y diagnósticos, sin enviar.';


-- ---------------------------------------------------------------------------
-- 21. INCLUIR / EXCLUIR DESTINATARIO
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.set_communication_recipient_included(
  p_actor_internal_user_id uuid,
  p_recipient_id uuid,
  p_included boolean,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_recipient mp25m.communication_resolution_recipients%rowtype;

  v_communication_id uuid;
  v_resolution_id uuid;
  v_confirmed_at timestamptz;

  v_current_resolution_id uuid;
  v_status text;

  v_reason text;
begin
  v_reason :=
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    );


  if p_included is null then
    raise exception
      'Recipient inclusion value is required'
      using errcode = '22023';
  end if;


  if v_reason is null
     or char_length(v_reason)
        not between 3 and 2000
  then
    raise exception
      'Recipient inclusion change requires a reason between 3 and 2000 characters'
      using errcode = '22023';
  end if;


  select recipient.*
  into v_recipient
  from mp25m.communication_resolution_recipients recipient
  where recipient.id =
      p_recipient_id
  for update;

  if not found then
    raise exception
      'Communication recipient % does not exist',
      p_recipient_id
      using errcode = 'P0002';
  end if;


  v_resolution_id :=
    v_recipient.resolution_id;


  select
    resolution.communication_id,
    resolution.confirmed_at
  into
    v_communication_id,
    v_confirmed_at
  from mp25m.communication_audience_resolutions resolution
  where resolution.id =
      v_resolution_id
  for update;

  if not found then
    raise exception
      'Audience resolution % does not exist',
      v_resolution_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    v_communication_id
  ) then
    raise exception
      'Internal user cannot manage this communication'
      using errcode = '42501';
  end if;


  select
    communication.current_resolution_id,
    communication.status
  into
    v_current_resolution_id,
    v_status
  from mp25m.communications communication
  where communication.id =
      v_communication_id
  for update;


  if v_current_resolution_id
       is distinct from v_resolution_id
  then
    raise exception
      'Only recipients of the current audience resolution can be changed'
      using errcode = '22023';
  end if;


  if v_confirmed_at is not null
     or v_status <> 'audience_resolved'
  then
    raise exception
      'Confirmed or inactive audience recipients cannot be changed'
      using errcode = '22023';
  end if;


  if v_recipient.included =
      p_included then
    return;
  end if;


  update mp25m.communication_resolution_recipients recipient
  set
    included =
      p_included,

    exclusion_reason =
      case
        when p_included
          then null
        else v_reason
      end

  where recipient.id =
      p_recipient_id;


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    new_data,
    metadata,
    result
  )
  values (
    p_actor_internal_user_id,

    case
      when p_included
        then 'communication.recipient.include'
      else 'communication.recipient.exclude'
    end,

    'mp25m',
    'communication_resolution_recipients',
    p_recipient_id,
    v_reason,

    jsonb_build_object(
      'included',
      v_recipient.included,
      'exclusion_reason',
      v_recipient.exclusion_reason
    ),

    jsonb_build_object(
      'included',
      p_included,
      'exclusion_reason',
      case
        when p_included
          then null
        else v_reason
      end
    ),

    jsonb_build_object(
      'communication_id',
      v_communication_id,
      'resolution_id',
      v_resolution_id,
      'recipient_kind',
      v_recipient.recipient_kind
    ),

    'allowed'
  );
end;
$function$;


comment on function mp25m_api.set_communication_recipient_included(
  uuid,
  uuid,
  boolean,
  text
) is
  'Permite excluir o volver a incluir un destinatario únicamente en la resolución vigente y no confirmada.';


-- ---------------------------------------------------------------------------
-- 22. AGREGAR PERSONA MANUALMENTE A LA RESOLUCIÓN
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.add_communication_person_recipient(
  p_actor_internal_user_id uuid,
  p_resolution_id uuid,
  p_person_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_communication_id uuid;
  v_confirmed_at timestamptz;

  v_current_resolution_id uuid;
  v_status text;

  v_display_name text;
  v_reason text;

  v_email_status text;
  v_whatsapp_status text;

  v_recipient_id uuid;
begin
  v_reason :=
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    );


  if p_person_id is null then
    raise exception
      'Person is required'
      using errcode = '22023';
  end if;


  if v_reason is null
     or char_length(v_reason)
        not between 3 and 2000
  then
    raise exception
      'Manual recipient addition requires a reason between 3 and 2000 characters'
      using errcode = '22023';
  end if;


  select
    resolution.communication_id,
    resolution.confirmed_at
  into
    v_communication_id,
    v_confirmed_at
  from mp25m.communication_audience_resolutions resolution
  where resolution.id =
      p_resolution_id
  for update;

  if not found then
    raise exception
      'Audience resolution % does not exist',
      p_resolution_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    v_communication_id
  ) then
    raise exception
      'Internal user cannot manage this communication'
      using errcode = '42501';
  end if;


  select
    communication.current_resolution_id,
    communication.status
  into
    v_current_resolution_id,
    v_status
  from mp25m.communications communication
  where communication.id =
      v_communication_id
  for update;


  if v_current_resolution_id
       is distinct from p_resolution_id
  then
    raise exception
      'Manual recipients can only be added to the current audience resolution'
      using errcode = '22023';
  end if;


  if v_confirmed_at is not null
     or v_status <> 'audience_resolved'
  then
    raise exception
      'Manual recipients cannot be added to a confirmed or inactive audience resolution'
      using errcode = '22023';
  end if;


  select
    coalesce(
      nullif(
        btrim(person.display_name),
        ''
      ),
      'Persona ' ||
        left(
          person.id::text,
          8
        )
    )
  into
    v_display_name
  from mp25m.persons person
  where person.id =
      p_person_id;

  if not found then
    raise exception
      'Person % does not exist',
      p_person_id
      using errcode = 'P0002';
  end if;


  if exists (
    select 1
    from mp25m.communication_resolution_recipients recipient
    where recipient.resolution_id =
        p_resolution_id

      and recipient.recipient_kind =
        'person'

      and recipient.person_id =
        p_person_id
  ) then
    raise exception
      'Person is already part of this audience resolution'
      using errcode = '22023';
  end if;


  -- -----------------------------------------------------------------------
  -- Diagnóstico Email.
  -- -----------------------------------------------------------------------

  if exists (
    select 1
    from mp25m.person_contacts contact
    where contact.person_id =
        p_person_id

      and contact.active = true
      and contact.contact_type =
        'email'

      and contact.visibility in (
        'internal',
        'public'
      )

      and nullif(
            btrim(
              contact.value_original
            ),
            ''
          ) is not null

      and contact.verified_at is not null
  ) then

    v_email_status :=
      'available_verified';

  elsif exists (
    select 1
    from mp25m.person_contacts contact
    where contact.person_id =
        p_person_id

      and contact.active = true
      and contact.contact_type =
        'email'

      and contact.visibility in (
        'internal',
        'public'
      )

      and nullif(
            btrim(
              contact.value_original
            ),
            ''
          ) is not null
  ) then

    v_email_status :=
      'available_unverified';

  elsif exists (
    select 1
    from mp25m.person_contacts contact
    where contact.person_id =
        p_person_id

      and contact.active = true
      and contact.contact_type =
        'email'

      and contact.visibility =
        'private'

      and nullif(
            btrim(
              contact.value_original
            ),
            ''
          ) is not null
  ) then

    v_email_status :=
      'restricted';

  else
    v_email_status :=
      'missing';
  end if;


  -- -----------------------------------------------------------------------
  -- Diagnóstico WhatsApp.
  -- phone no se convierte implícitamente en WhatsApp.
  -- -----------------------------------------------------------------------

  if exists (
    select 1
    from mp25m.person_contacts contact
    where contact.person_id =
        p_person_id

      and contact.active = true
      and contact.contact_type =
        'whatsapp'

      and contact.visibility in (
        'internal',
        'public'
      )

      and nullif(
            btrim(
              contact.value_original
            ),
            ''
          ) is not null

      and contact.verified_at is not null
  ) then

    v_whatsapp_status :=
      'available_verified';

  elsif exists (
    select 1
    from mp25m.person_contacts contact
    where contact.person_id =
        p_person_id

      and contact.active = true
      and contact.contact_type =
        'whatsapp'

      and contact.visibility in (
        'internal',
        'public'
      )

      and nullif(
            btrim(
              contact.value_original
            ),
            ''
          ) is not null
  ) then

    v_whatsapp_status :=
      'available_unverified';

  elsif exists (
    select 1
    from mp25m.person_contacts contact
    where contact.person_id =
        p_person_id

      and contact.active = true
      and contact.contact_type =
        'whatsapp'

      and contact.visibility =
        'private'

      and nullif(
            btrim(
              contact.value_original
            ),
            ''
          ) is not null
  ) then

    v_whatsapp_status :=
      'restricted';

  else
    v_whatsapp_status :=
      'missing';
  end if;


  insert into mp25m.communication_resolution_recipients (
    resolution_id,

    recipient_kind,
    person_id,
    organization_id,
    internal_user_id,

    display_name_snapshot,

    manually_added,
    included,
    exclusion_reason,

    email_availability_status,
    whatsapp_availability_status,

    duplicate_status,
    diagnostic_detail
  )
  values (
    p_resolution_id,

    'person',
    p_person_id,
    null,
    null,

    v_display_name,

    true,
    true,
    null,

    v_email_status,
    v_whatsapp_status,

    'none',

    jsonb_build_object(
      'channel_consent',
      'unknown',

      'visible_contact_levels',
      jsonb_build_array(
        'internal',
        'public'
      ),

      'manual_addition',
      true
    )
  )
  returning id
  into v_recipient_id;


  -- -----------------------------------------------------------------------
  -- Procedencia manual.
  -- No crea criterio, relación, participación ni responsabilidad.
  -- -----------------------------------------------------------------------

  insert into mp25m.communication_recipient_sources (
    recipient_id,
    criterion_id,
    criterion_type,
    source_detail
  )
  values (
    v_recipient_id,
    null,
    'manual',

    jsonb_build_object(
      'reason',
      v_reason,

      'added_by_internal_user_id',
      p_actor_internal_user_id
    )
  );


  -- -----------------------------------------------------------------------
  -- Recalcular duplicados de canal para todas las Personas de esta
  -- resolución. La nueva Persona puede convertir también a otra ya
  -- existente en duplicada.
  -- -----------------------------------------------------------------------

  with duplicate_flags as (
    select
      recipient.id,

      exists (
        select 1

        from mp25m.person_contacts own_contact

        join mp25m.communication_resolution_recipients other_recipient
          on other_recipient.resolution_id =
             p_resolution_id

         and other_recipient.recipient_kind =
             'person'

         and other_recipient.id <>
             recipient.id

        join mp25m.person_contacts other_contact
          on other_contact.person_id =
             other_recipient.person_id

        where own_contact.person_id =
            recipient.person_id

          and own_contact.active = true
          and other_contact.active = true

          and own_contact.contact_type =
            'email'

          and other_contact.contact_type =
            'email'

          and own_contact.visibility in (
            'internal',
            'public'
          )

          and other_contact.visibility in (
            'internal',
            'public'
          )

          and nullif(
                btrim(
                  own_contact.value_normalized
                ),
                ''
              ) is not null

          and own_contact.value_normalized =
              other_contact.value_normalized
      ) as email_duplicate,


      exists (
        select 1

        from mp25m.person_contacts own_contact

        join mp25m.communication_resolution_recipients other_recipient
          on other_recipient.resolution_id =
             p_resolution_id

         and other_recipient.recipient_kind =
             'person'

         and other_recipient.id <>
             recipient.id

        join mp25m.person_contacts other_contact
          on other_contact.person_id =
             other_recipient.person_id

        where own_contact.person_id =
            recipient.person_id

          and own_contact.active = true
          and other_contact.active = true

          and own_contact.contact_type =
            'whatsapp'

          and other_contact.contact_type =
            'whatsapp'

          and own_contact.visibility in (
            'internal',
            'public'
          )

          and other_contact.visibility in (
            'internal',
            'public'
          )

          and nullif(
                btrim(
                  own_contact.value_normalized
                ),
                ''
              ) is not null

          and own_contact.value_normalized =
              other_contact.value_normalized
      ) as whatsapp_duplicate

    from mp25m.communication_resolution_recipients recipient

    where recipient.resolution_id =
        p_resolution_id

      and recipient.recipient_kind =
        'person'
  )

  update mp25m.communication_resolution_recipients recipient
  set
    duplicate_status =
      case
        when duplicate.email_duplicate
             and duplicate.whatsapp_duplicate
          then 'email_and_whatsapp_duplicate'

        when duplicate.email_duplicate
          then 'email_duplicate'

        when duplicate.whatsapp_duplicate
          then 'whatsapp_duplicate'

        else 'none'
      end,

    diagnostic_detail =
      recipient.diagnostic_detail
      ||
      jsonb_build_object(
        'email_duplicate',
        duplicate.email_duplicate,

        'whatsapp_duplicate',
        duplicate.whatsapp_duplicate
      )

  from duplicate_flags duplicate

  where recipient.id =
      duplicate.id;


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    new_data,
    metadata,
    result
  )
  values (
    p_actor_internal_user_id,
    'communication.recipient.add',
    'mp25m',
    'communication_resolution_recipients',
    v_recipient_id,
    v_reason,

    jsonb_build_object(
      'recipient_kind',
      'person',

      'person_id',
      p_person_id,

      'included',
      true,

      'manually_added',
      true,

      'email_availability_status',
      v_email_status,

      'whatsapp_availability_status',
      v_whatsapp_status
    ),

    jsonb_build_object(
      'communication_id',
      v_communication_id,

      'resolution_id',
      p_resolution_id
    ),

    'allowed'
  );


  return v_recipient_id;
end;
$function$;


comment on function mp25m_api.add_communication_person_recipient(
  uuid,
  uuid,
  uuid,
  text
) is
  'Agrega manualmente una Persona a la resolución vigente y no confirmada, con diagnóstico de canales y trazabilidad, sin crear relaciones de dominio.';


-- ---------------------------------------------------------------------------
-- 23. CONFIRMAR DESTINATARIOS
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.confirm_communication_recipients(
  p_actor_internal_user_id uuid,
  p_communication_id uuid,
  p_resolution_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_communication mp25m.communications%rowtype;
  v_resolution mp25m.communication_audience_resolutions%rowtype;

  v_reason text;
  v_confirmed_at timestamptz;
  v_transition_no integer;

  v_total_count integer;
  v_included_count integer;
  v_excluded_count integer;
  v_duplicate_count integer;

  v_person_without_email integer;
  v_person_without_whatsapp integer;
  v_unsupported_count integer;
begin
  v_reason :=
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    );


  if v_reason is not null
     and char_length(v_reason)
         not between 3 and 10000
  then
    raise exception
      'Invalid recipient confirmation reason'
      using errcode = '22023';
  end if;


  select communication.*
  into v_communication
  from mp25m.communications communication
  where communication.id =
      p_communication_id
  for update;

  if not found then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  ) then
    raise exception
      'Internal user cannot manage this communication'
      using errcode = '42501';
  end if;


  if v_communication.status <>
      'audience_resolved'
  then
    raise exception
      'Communication recipients can only be confirmed from audience_resolved status'
      using errcode = '22023';
  end if;


  if v_communication.current_resolution_id
       is distinct from p_resolution_id
  then
    raise exception
      'Only the current audience resolution can be confirmed'
      using errcode = '22023';
  end if;


  select resolution.*
  into v_resolution
  from mp25m.communication_audience_resolutions resolution
  where resolution.id =
      p_resolution_id
    and resolution.communication_id =
      p_communication_id
  for update;

  if not found then
    raise exception
      'Audience resolution does not belong to this communication'
      using errcode = '22023';
  end if;


  if v_resolution.audience_revision <>
      v_communication.audience_revision
  then
    raise exception
      'Obsolete audience resolution cannot be confirmed'
      using errcode = '22023';
  end if;


  if v_resolution.confirmed_at is not null then
    raise exception
      'Audience resolution is already confirmed'
      using errcode = '22023';
  end if;


  select
    count(*)::integer,

    count(*) filter (
      where recipient.included = true
    )::integer,

    count(*) filter (
      where recipient.included = false
    )::integer,

    count(*) filter (
      where recipient.duplicate_status <> 'none'
    )::integer,

    count(*) filter (
      where recipient.recipient_kind = 'person'
        and recipient.included = true
        and recipient.email_availability_status
            in (
              'missing',
              'restricted'
            )
    )::integer,

    count(*) filter (
      where recipient.recipient_kind = 'person'
        and recipient.included = true
        and recipient.whatsapp_availability_status
            in (
              'missing',
              'restricted'
            )
    )::integer,

    count(*) filter (
      where recipient.included = true
        and (
          recipient.email_availability_status =
            'unsupported_recipient'
          or recipient.whatsapp_availability_status =
            'unsupported_recipient'
        )
    )::integer

  into
    v_total_count,
    v_included_count,
    v_excluded_count,
    v_duplicate_count,
    v_person_without_email,
    v_person_without_whatsapp,
    v_unsupported_count

  from mp25m.communication_resolution_recipients recipient
  where recipient.resolution_id =
      p_resolution_id;


  v_confirmed_at :=
    now();


  -- -----------------------------------------------------------------------
  -- Primero se confirma la resolución.
  --
  -- El trigger de inmutabilidad verifica que siga siendo la resolución
  -- vigente de la revisión de audiencia actual.
  -- -----------------------------------------------------------------------

  update mp25m.communication_audience_resolutions resolution
  set
    confirmed_by_internal_user_id =
      p_actor_internal_user_id,

    confirmed_at =
      v_confirmed_at

  where resolution.id =
      p_resolution_id;


  -- Desde este punto los destinatarios de la resolución quedan congelados
  -- por el trigger de inmutabilidad ya definido.


  update mp25m.communications communication
  set
    status =
      'recipients_confirmed',

    updated_at =
      v_confirmed_at

  where communication.id =
      p_communication_id;


  select
    coalesce(
      max(history.transition_no),
      0
    ) + 1
  into
    v_transition_no
  from mp25m.communication_status_history history
  where history.communication_id =
      p_communication_id;


  insert into mp25m.communication_status_history (
    communication_id,
    transition_no,
    status,
    rationale,
    changed_by_internal_user_id,
    changed_at
  )
  values (
    p_communication_id,
    v_transition_no,
    'recipients_confirmed',

    coalesce(
      v_reason,
      'Confirmación de destinatarios'
    ),

    p_actor_internal_user_id,
    v_confirmed_at
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
    metadata,
    result
  )
  values (
    p_actor_internal_user_id,
    'communication.recipients.confirm',
    'mp25m',
    'communications',
    p_communication_id,
    v_reason,

    jsonb_build_object(
      'status',
      v_communication.status,

      'current_resolution_id',
      v_communication.current_resolution_id,

      'audience_revision',
      v_communication.audience_revision
    ),

    jsonb_build_object(
      'status',
      'recipients_confirmed',

      'current_resolution_id',
      p_resolution_id,

      'audience_revision',
      v_communication.audience_revision,

      'confirmed_at',
      v_confirmed_at
    ),

    jsonb_build_object(
      'communication_id',
      p_communication_id,

      'resolution_id',
      p_resolution_id,

      'total_recipient_count',
      v_total_count,

      'included_recipient_count',
      v_included_count,

      'excluded_recipient_count',
      v_excluded_count,

      'duplicate_recipient_count',
      v_duplicate_count,

      'included_person_without_usable_email_count',
      v_person_without_email,

      'included_person_without_usable_whatsapp_count',
      v_person_without_whatsapp,

      'included_unsupported_recipient_count',
      v_unsupported_count,

      'external_send_authorized',
      false
    ),

    'allowed'
  );
end;
$function$;


comment on function mp25m_api.confirm_communication_recipients(
  uuid,
  uuid,
  uuid,
  text
) is
  'Confirma y congela explícitamente la resolución vigente de destinatarios. No autoriza ni ejecuta un envío externo.';


-- ---------------------------------------------------------------------------
-- 24. RLS Y PRIVILEGIOS DE TABLAS
-- ---------------------------------------------------------------------------

alter table mp25m.communications
enable row level security;

alter table mp25m.communication_audience_criteria
enable row level security;

alter table mp25m.communication_audience_resolutions
enable row level security;

alter table mp25m.communication_resolution_recipients
enable row level security;

alter table mp25m.communication_recipient_sources
enable row level security;

alter table mp25m.communication_content_history
enable row level security;

alter table mp25m.communication_status_history
enable row level security;


revoke all
on table
  mp25m.communications,
  mp25m.communication_audience_criteria,
  mp25m.communication_audience_resolutions,
  mp25m.communication_resolution_recipients,
  mp25m.communication_recipient_sources,
  mp25m.communication_content_history,
  mp25m.communication_status_history
from
  public,
  anon,
  authenticated,
  service_role;


grant
  select,
  insert,
  update
on table mp25m.communications
to service_role;


grant
  select,
  insert
on table mp25m.communication_audience_criteria
to service_role;


grant
  select,
  insert,
  update
on table mp25m.communication_audience_resolutions
to service_role;


grant
  select,
  insert,
  update
on table mp25m.communication_resolution_recipients
to service_role;


grant
  select,
  insert
on table mp25m.communication_recipient_sources
to service_role;


grant
  select,
  insert
on table mp25m.communication_content_history
to service_role;


grant
  select,
  insert
on table mp25m.communication_status_history
to service_role;


comment on table mp25m.communications is
  '12B.A communications core. External delivery is not implemented by this increment.';

comment on table mp25m.communication_audience_criteria is
  'Immutable historical audience criteria grouped by explicit audience revision.';

comment on table mp25m.communication_audience_resolutions is
  'Historical audience resolutions; confirmation freezes the selected resolution.';

comment on table mp25m.communication_resolution_recipients is
  'Recipient identity and channel diagnostics for one audience resolution; confirmed snapshots are immutable.';

comment on table mp25m.communication_recipient_sources is
  'Append-only provenance explaining why a recipient belongs to an audience resolution.';

comment on table mp25m.communication_content_history is
  'Append-only content revision history for communications.';

comment on table mp25m.communication_status_history is
  'Append-only lifecycle history for communications.';


-- ---------------------------------------------------------------------------
-- 25.1. VISTA BASE DE LECTURA DE COMUNICACIONES
-- ---------------------------------------------------------------------------

create view mp25m_api.communication_list
with (security_invoker = true)
as
select
  communication.id as communication_id,

  communication.communication_type,
  communication.status,
  communication.planned_channels,
  communication.audience_revision,

  communication.subject,
  communication.body,
  communication.generation_mode,
  communication.generation_metadata,

  case
    when communication.person_id is not null
      then 'person'
    when communication.node_id is not null
      then 'node'
    when communication.organization_id is not null
      then 'organization'
    when communication.opportunity_id is not null
      then 'opportunity'
    when communication.articulation_id is not null
      then 'articulation'
    when communication.project_id is not null
      then 'project'
    when communication.theme_id is not null
      then 'theme'
    when communication.need_offer_id is not null
      then 'need_offer'
    when communication.agenda_entry_id is not null
      then 'agenda'
    else
      'independent'
  end::text
    as context_type,

  coalesce(
    communication.person_id,
    communication.node_id,
    communication.organization_id,
    communication.opportunity_id,
    communication.articulation_id,
    communication.project_id,
    communication.theme_id,
    communication.need_offer_id,
    communication.agenda_entry_id
  )
    as context_id,

  coalesce(
    nullif(
      btrim(person.display_name),
      ''
    ),

    nullif(
      btrim(node.name),
      ''
    ),

    nullif(
      btrim(organization.name),
      ''
    ),

    nullif(
      btrim(opportunity.title),
      ''
    ),

    nullif(
      btrim(articulation.title),
      ''
    ),

    nullif(
      btrim(project.title),
      ''
    ),

    nullif(
      btrim(theme.name),
      ''
    ),

    nullif(
      btrim(need_offer.title),
      ''
    ),

    nullif(
      btrim(agenda_entry.title),
      ''
    )
  )::text
    as context_title,

  communication.person_id,
  communication.node_id,
  communication.organization_id,
  communication.opportunity_id,
  communication.articulation_id,
  communication.project_id,
  communication.theme_id,
  communication.need_offer_id,
  communication.agenda_entry_id,

  communication.current_resolution_id,

  resolution.resolution_no
    as current_resolution_no,

  resolution.resolved_at
    as current_resolution_resolved_at,

  resolution.confirmed_at
    as current_resolution_confirmed_at,

  communication.created_by_internal_user_id,

  creator.display_name::text
    as created_by_display_name,

  communication.created_at,
  communication.updated_at,

  communication.cancelled_at,
  communication.cancelled_by_internal_user_id,

  canceller.display_name::text
    as cancelled_by_display_name,

  communication.cancellation_rationale,

  coalesce(
    recipient_counts.total_count,
    0
  )::integer
    as recipient_count,

  coalesce(
    recipient_counts.included_count,
    0
  )::integer
    as included_recipient_count,

  coalesce(
    recipient_counts.excluded_count,
    0
  )::integer
    as excluded_recipient_count,

  coalesce(
    recipient_counts.duplicate_count,
    0
  )::integer
    as duplicate_recipient_count

from mp25m.communications communication

left join mp25m.persons person
  on person.id =
    communication.person_id

left join mp25m.nodes node
  on node.id =
    communication.node_id

left join mp25m.organizations organization
  on organization.id =
    communication.organization_id

left join mp25m.opportunities opportunity
  on opportunity.id =
    communication.opportunity_id

left join mp25m.opportunity_articulations articulation
  on articulation.id =
    communication.articulation_id

left join mp25m.projects project
  on project.id =
    communication.project_id

left join mp25m.themes theme
  on theme.id =
    communication.theme_id

left join mp25m.needs_offers need_offer
  on need_offer.id =
    communication.need_offer_id

left join mp25m.agenda_entries agenda_entry
  on agenda_entry.id =
    communication.agenda_entry_id

join mp25m.internal_users creator
  on creator.id =
    communication.created_by_internal_user_id

left join mp25m.internal_users canceller
  on canceller.id =
    communication.cancelled_by_internal_user_id

left join mp25m.communication_audience_resolutions resolution
  on resolution.id =
    communication.current_resolution_id

left join lateral (
  select
    count(*)::integer
      as total_count,

    count(*) filter (
      where recipient.included = true
    )::integer
      as included_count,

    count(*) filter (
      where recipient.included = false
    )::integer
      as excluded_count,

    count(*) filter (
      where recipient.duplicate_status <> 'none'
    )::integer
      as duplicate_count

  from mp25m.communication_resolution_recipients recipient

  where recipient.resolution_id =
    communication.current_resolution_id
) recipient_counts
  on true;


comment on view mp25m_api.communication_list is
  'Vista server-only de Comunicaciones 12B.A con contexto exacto, resolución vigente y resumen de destinatarios; no representa envío externo.';


-- ---------------------------------------------------------------------------
-- 25.2. DIRECTORIO PAGINADO DE COMUNICACIONES
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.communication_page(
  p_actor_internal_user_id uuid,
  p_query text default null,
  p_statuses text[] default null,
  p_communication_types text[] default null,
  p_context_types text[] default null,
  p_created_by_internal_user_id uuid default null,
  p_after_updated_at timestamptz default null,
  p_after_communication_id uuid default null,
  p_limit integer default 25
)
returns table (
  communication_id uuid,

  communication_type text,
  status text,
  planned_channels text[],
  audience_revision integer,

  subject text,
  body text,

  context_type text,
  context_id uuid,
  context_title text,

  current_resolution_id uuid,
  current_resolution_no integer,
  current_resolution_resolved_at timestamptz,
  current_resolution_confirmed_at timestamptz,

  created_by_internal_user_id uuid,
  created_by_display_name text,

  created_at timestamptz,
  updated_at timestamptz,

  cancelled_at timestamptz,

  recipient_count integer,
  included_recipient_count integer,
  excluded_recipient_count integer,
  duplicate_recipient_count integer
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
  if not mp25m_api.is_active_internal_user(
    p_actor_internal_user_id
  )
  or not mp25m_api.has_current_internal_access(
    p_actor_internal_user_id
  )
  then
    raise exception
      'Internal user cannot read communications'
      using errcode = '42501';
  end if;


  if p_limit is null
     or p_limit < 1
     or p_limit > 100
  then
    raise exception
      'Invalid communication page limit'
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
      'Invalid communication search query'
      using errcode = '22023';
  end if;


  if (
       p_after_updated_at is null
       and p_after_communication_id is not null
     )
     or (
       p_after_updated_at is not null
       and p_after_communication_id is null
     )
  then
    raise exception
      'Incomplete communication cursor'
      using errcode = '22023';
  end if;


  if p_statuses is not null
     and (
       cardinality(p_statuses) = 0
       or exists (
         select 1
         from unnest(p_statuses)
           as filter_value(value)
         where filter_value.value not in (
           'draft',
           'audience_resolved',
           'recipients_confirmed',
           'cancelled'
         )
       )
     )
  then
    raise exception
      'Invalid communication status filter'
      using errcode = '22023';
  end if;


  if p_communication_types is not null
     and (
       cardinality(p_communication_types) = 0
       or exists (
         select 1
         from unnest(p_communication_types)
           as filter_value(value)
         where filter_value.value not in (
           'general',
           'convocation',
           'reminder',
           'follow_up',
           'request_information',
           'update'
         )
       )
     )
  then
    raise exception
      'Invalid communication type filter'
      using errcode = '22023';
  end if;


  if p_context_types is not null
     and (
       cardinality(p_context_types) = 0
       or exists (
         select 1
         from unnest(p_context_types)
           as filter_value(value)
         where filter_value.value not in (
           'independent',
           'person',
           'node',
           'organization',
           'opportunity',
           'articulation',
           'project',
           'theme',
           'need_offer',
           'agenda'
         )
       )
     )
  then
    raise exception
      'Invalid communication context filter'
      using errcode = '22023';
  end if;


  return query

  select
    communication.communication_id,

    communication.communication_type,
    communication.status,
    communication.planned_channels,
    communication.audience_revision,

    communication.subject,
    communication.body,

    communication.context_type,
    communication.context_id,
    communication.context_title,

    communication.current_resolution_id,
    communication.current_resolution_no,
    communication.current_resolution_resolved_at,
    communication.current_resolution_confirmed_at,

    communication.created_by_internal_user_id,
    communication.created_by_display_name,

    communication.created_at,
    communication.updated_at,

    communication.cancelled_at,

    communication.recipient_count,
    communication.included_recipient_count,
    communication.excluded_recipient_count,
    communication.duplicate_recipient_count

  from mp25m_api.communication_list communication

  where mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    communication.communication_id
  )


  and (
    p_statuses is null
    or communication.status =
       any(p_statuses)
  )


  and (
    p_communication_types is null
    or communication.communication_type =
       any(p_communication_types)
  )


  and (
    p_context_types is null
    or communication.context_type =
       any(p_context_types)
  )


  and (
    p_created_by_internal_user_id is null
    or communication.created_by_internal_user_id =
       p_created_by_internal_user_id
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
             communication.subject,
             communication.body
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
    p_after_updated_at is null

    or (
      communication.updated_at,
      communication.communication_id
    ) < (
      p_after_updated_at,
      p_after_communication_id
    )
  )


  order by
    communication.updated_at desc,
    communication.communication_id desc

  limit p_limit + 1;
end;
$function$;


comment on function mp25m_api.communication_page(
  uuid,
  text,
  text[],
  text[],
  text[],
  uuid,
  timestamptz,
  uuid,
  integer
) is
  'Directorio paginado server-only de Comunicaciones 12B.A, con búsqueda tolerante a mayúsculas y acentos y autorización funcional por comunicación.';


-- ---------------------------------------------------------------------------
-- 25.3. DETALLE DE COMUNICACIÓN
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.communication_detail(
  p_actor_internal_user_id uuid,
  p_communication_id uuid
)
returns table (
  communication_id uuid,

  communication_type text,
  status text,
  planned_channels text[],
  audience_revision integer,

  subject text,
  body text,
  generation_mode text,
  generation_metadata jsonb,

  context_type text,
  context_id uuid,
  context_title text,

  person_id uuid,
  node_id uuid,
  organization_id uuid,
  opportunity_id uuid,
  articulation_id uuid,
  project_id uuid,
  theme_id uuid,
  need_offer_id uuid,
  agenda_entry_id uuid,

  current_resolution_id uuid,
  current_resolution_no integer,
  current_resolution_resolved_at timestamptz,
  current_resolution_confirmed_at timestamptz,

  created_by_internal_user_id uuid,
  created_by_display_name text,

  created_at timestamptz,
  updated_at timestamptz,

  cancelled_at timestamptz,
  cancelled_by_internal_user_id uuid,
  cancelled_by_display_name text,
  cancellation_rationale text,

  recipient_count integer,
  included_recipient_count integer,
  excluded_recipient_count integer,
  duplicate_recipient_count integer
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
  if not exists (
    select 1
    from mp25m.communications communication
    where communication.id =
      p_communication_id
  )
  then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  )
  then
    raise exception
      'Internal user cannot read this communication'
      using errcode = '42501';
  end if;


  return query

  select
    communication.communication_id,

    communication.communication_type,
    communication.status,
    communication.planned_channels,
    communication.audience_revision,

    communication.subject,
    communication.body,
    communication.generation_mode,
    communication.generation_metadata,

    communication.context_type,
    communication.context_id,
    communication.context_title,

    communication.person_id,
    communication.node_id,
    communication.organization_id,
    communication.opportunity_id,
    communication.articulation_id,
    communication.project_id,
    communication.theme_id,
    communication.need_offer_id,
    communication.agenda_entry_id,

    communication.current_resolution_id,
    communication.current_resolution_no,
    communication.current_resolution_resolved_at,
    communication.current_resolution_confirmed_at,

    communication.created_by_internal_user_id,
    communication.created_by_display_name,

    communication.created_at,
    communication.updated_at,

    communication.cancelled_at,
    communication.cancelled_by_internal_user_id,
    communication.cancelled_by_display_name,
    communication.cancellation_rationale,

    communication.recipient_count,
    communication.included_recipient_count,
    communication.excluded_recipient_count,
    communication.duplicate_recipient_count

  from mp25m_api.communication_list communication

  where communication.communication_id =
    p_communication_id;
end;
$function$;


comment on function mp25m_api.communication_detail(
  uuid,
  uuid
) is
  'Detalle server-only de una Comunicación 12B.A autorizada funcionalmente.';


-- ---------------------------------------------------------------------------
-- 25.4. CRITERIOS DE AUDIENCIA
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.communication_criteria_list(
  p_actor_internal_user_id uuid,
  p_communication_id uuid,
  p_audience_revision integer default null
)
returns table (
  criterion_id uuid,
  communication_id uuid,
  audience_revision integer,
  group_no integer,

  criterion_type text,
  criterion_operation text,

  person_id uuid,
  node_id uuid,
  articulation_id uuid,
  project_id uuid,
  skill_id uuid,
  theme_id uuid,

  verification_statuses text[],

  created_by_internal_user_id uuid,
  created_by_display_name text,
  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_current_revision integer;
  v_requested_revision integer;
begin
  select
    communication.audience_revision
  into
    v_current_revision
  from mp25m.communications communication
  where communication.id =
    p_communication_id;

  if not found then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  )
  then
    raise exception
      'Internal user cannot read communication audience criteria'
      using errcode = '42501';
  end if;


  if p_audience_revision is not null
     and p_audience_revision < 1
  then
    raise exception
      'Invalid communication audience revision'
      using errcode = '22023';
  end if;


  v_requested_revision :=
    coalesce(
      p_audience_revision,
      v_current_revision
    );


  if v_requested_revision = 0 then
    return;
  end if;


  return query

  select
    criterion.id,
    criterion.communication_id,
    criterion.audience_revision,
    criterion.group_no,

    criterion.criterion_type,
    criterion.criterion_operation,

    criterion.person_id,
    criterion.node_id,
    criterion.articulation_id,
    criterion.project_id,
    criterion.skill_id,
    criterion.theme_id,

    criterion.verification_statuses,

    criterion.created_by_internal_user_id,
    creator.display_name::text,
    criterion.created_at

  from mp25m.communication_audience_criteria criterion

  join mp25m.internal_users creator
    on creator.id =
      criterion.created_by_internal_user_id

  where criterion.communication_id =
      p_communication_id

    and criterion.audience_revision =
      v_requested_revision

  order by
    criterion.group_no asc,
    criterion.criterion_operation asc,
    criterion.criterion_type asc,
    criterion.id asc;
end;
$function$;


comment on function mp25m_api.communication_criteria_list(
  uuid,
  uuid,
  integer
) is
  'Lee los criterios históricos de una revisión explícita de audiencia; NULL usa la revisión vigente y no infiere relaciones adicionales.';


-- ---------------------------------------------------------------------------
-- 25.5. RESOLUCIONES DE AUDIENCIA
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.communication_resolution_list(
  p_actor_internal_user_id uuid,
  p_communication_id uuid
)
returns table (
  resolution_id uuid,
  communication_id uuid,
  resolution_no integer,
  audience_revision integer,
  criteria_snapshot jsonb,

  resolved_by_internal_user_id uuid,
  resolved_by_display_name text,
  resolved_at timestamptz,

  confirmed_by_internal_user_id uuid,
  confirmed_by_display_name text,
  confirmed_at timestamptz,

  is_current boolean,

  recipient_count integer,
  included_recipient_count integer,
  excluded_recipient_count integer,
  duplicate_recipient_count integer,

  person_email_unavailable_count integer,
  person_whatsapp_unavailable_count integer,
  unsupported_organization_count integer,
  unsupported_internal_user_count integer
)
language plpgsql
stable
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_current_resolution_id uuid;
begin
  select
    communication.current_resolution_id
  into
    v_current_resolution_id
  from mp25m.communications communication
  where communication.id =
    p_communication_id;

  if not found then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  )
  then
    raise exception
      'Internal user cannot read communication resolutions'
      using errcode = '42501';
  end if;


  return query

  select
    resolution.id,
    resolution.communication_id,
    resolution.resolution_no,
    resolution.audience_revision,
    resolution.criteria_snapshot,

    resolution.resolved_by_internal_user_id,
    resolver.display_name::text,
    resolution.resolved_at,

    resolution.confirmed_by_internal_user_id,
    confirmer.display_name::text,
    resolution.confirmed_at,

    (
      resolution.id =
      v_current_resolution_id
    )::boolean,

    coalesce(
      counts.recipient_count,
      0
    )::integer,

    coalesce(
      counts.included_count,
      0
    )::integer,

    coalesce(
      counts.excluded_count,
      0
    )::integer,

    coalesce(
      counts.duplicate_count,
      0
    )::integer,

    coalesce(
      counts.person_email_unavailable_count,
      0
    )::integer,

    coalesce(
      counts.person_whatsapp_unavailable_count,
      0
    )::integer,

    coalesce(
      counts.unsupported_organization_count,
      0
    )::integer,

    coalesce(
      counts.unsupported_internal_user_count,
      0
    )::integer

  from mp25m.communication_audience_resolutions resolution

  join mp25m.internal_users resolver
    on resolver.id =
      resolution.resolved_by_internal_user_id

  left join mp25m.internal_users confirmer
    on confirmer.id =
      resolution.confirmed_by_internal_user_id

  left join lateral (
    select
      count(*)::integer
        as recipient_count,

      count(*) filter (
        where recipient.included = true
      )::integer
        as included_count,

      count(*) filter (
        where recipient.included = false
      )::integer
        as excluded_count,

      count(*) filter (
        where recipient.duplicate_status <> 'none'
      )::integer
        as duplicate_count,

      count(*) filter (
        where recipient.included = true
          and recipient.recipient_kind = 'person'
          and recipient.email_availability_status in (
            'missing',
            'restricted'
          )
      )::integer
        as person_email_unavailable_count,

      count(*) filter (
        where recipient.included = true
          and recipient.recipient_kind = 'person'
          and recipient.whatsapp_availability_status in (
            'missing',
            'restricted'
          )
      )::integer
        as person_whatsapp_unavailable_count,

      count(*) filter (
        where recipient.included = true
          and recipient.recipient_kind = 'organization'
          and (
            recipient.email_availability_status =
              'unsupported_recipient'
            or recipient.whatsapp_availability_status =
              'unsupported_recipient'
          )
      )::integer
        as unsupported_organization_count,

      count(*) filter (
        where recipient.included = true
          and recipient.recipient_kind = 'internal_user'
          and (
            recipient.email_availability_status =
              'unsupported_recipient'
            or recipient.whatsapp_availability_status =
              'unsupported_recipient'
          )
      )::integer
        as unsupported_internal_user_count

    from mp25m.communication_resolution_recipients recipient

    where recipient.resolution_id =
      resolution.id
  ) counts
    on true

  where resolution.communication_id =
    p_communication_id

  order by
    resolution.resolution_no desc;
end;
$function$;


comment on function mp25m_api.communication_resolution_list(
  uuid,
  uuid
) is
  'Lista histórica de resoluciones de audiencia con diagnósticos agregados; confirmar destinatarios no equivale a autorizar envío.';


-- ---------------------------------------------------------------------------
-- 25.6. DESTINATARIOS PAGINADOS DE UNA RESOLUCIÓN
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.communication_recipient_page(
  p_actor_internal_user_id uuid,
  p_resolution_id uuid,
  p_query text default null,
  p_recipient_kinds text[] default null,
  p_included boolean default null,
  p_after_display_name text default null,
  p_after_recipient_id uuid default null,
  p_limit integer default 50
)
returns table (
  recipient_id uuid,
  resolution_id uuid,

  recipient_kind text,
  person_id uuid,
  organization_id uuid,
  internal_user_id uuid,

  display_name_snapshot text,

  manually_added boolean,
  included boolean,
  exclusion_reason text,

  email_availability_status text,
  whatsapp_availability_status text,
  duplicate_status text,
  diagnostic_detail jsonb,

  sources jsonb,

  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_communication_id uuid;
begin
  select
    resolution.communication_id
  into
    v_communication_id
  from mp25m.communication_audience_resolutions resolution
  where resolution.id =
    p_resolution_id;

  if not found then
    raise exception
      'Audience resolution % does not exist',
      p_resolution_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    v_communication_id
  )
  then
    raise exception
      'Internal user cannot read communication recipients'
      using errcode = '42501';
  end if;


  if p_limit is null
     or p_limit < 1
     or p_limit > 100
  then
    raise exception
      'Invalid communication recipient page limit'
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
      'Invalid communication recipient search query'
      using errcode = '22023';
  end if;


  if (
       p_after_display_name is null
       and p_after_recipient_id is not null
     )
     or (
       p_after_display_name is not null
       and p_after_recipient_id is null
     )
  then
    raise exception
      'Incomplete communication recipient cursor'
      using errcode = '22023';
  end if;


  if p_recipient_kinds is not null
     and (
       cardinality(p_recipient_kinds) = 0
       or exists (
         select 1
         from unnest(p_recipient_kinds)
           as filter_value(value)
         where filter_value.value not in (
           'person',
           'organization',
           'internal_user'
         )
       )
     )
  then
    raise exception
      'Invalid communication recipient kind filter'
      using errcode = '22023';
  end if;


  return query

  select
    recipient.id,
    recipient.resolution_id,

    recipient.recipient_kind,
    recipient.person_id,
    recipient.organization_id,
    recipient.internal_user_id,

    recipient.display_name_snapshot,

    recipient.manually_added,
    recipient.included,
    recipient.exclusion_reason,

    recipient.email_availability_status,
    recipient.whatsapp_availability_status,
    recipient.duplicate_status,
    recipient.diagnostic_detail,

    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'source_id',
            source.id,

            'criterion_id',
            source.criterion_id,

            'criterion_type',
            source.criterion_type,

            'source_detail',
            source.source_detail,

            'created_at',
            source.created_at
          )
          order by
            source.created_at,
            source.id
        )
        from mp25m.communication_recipient_sources source
        where source.recipient_id =
          recipient.id
      ),
      '[]'::jsonb
    ) as sources,

    recipient.created_at

  from mp25m.communication_resolution_recipients recipient

  where recipient.resolution_id =
    p_resolution_id


  and (
    p_recipient_kinds is null
    or recipient.recipient_kind =
       any(p_recipient_kinds)
  )


  and (
    p_included is null
    or recipient.included =
       p_included
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
           recipient.display_name_snapshot
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
    p_after_display_name is null

    or (
      translate(
        lower(
          recipient.display_name_snapshot
        ),
        'áéíóúüñ',
        'aeiouun'
      ),
      recipient.id
    ) > (
      translate(
        lower(
          p_after_display_name
        ),
        'áéíóúüñ',
        'aeiouun'
      ),
      p_after_recipient_id
    )
  )


  order by
    translate(
      lower(
        recipient.display_name_snapshot
      ),
      'áéíóúüñ',
      'aeiouun'
    ) asc,
    recipient.id asc

  limit p_limit + 1;
end;
$function$;


comment on function mp25m_api.communication_recipient_page(
  uuid,
  uuid,
  text,
  text[],
  boolean,
  text,
  uuid,
  integer
) is
  'Destinatarios paginados de una resolución con inclusión, diagnósticos y proveniencia; no expone valores completos de contacto ni consentimiento inexistente.';


-- ---------------------------------------------------------------------------
-- 25.7. HISTORIAL DE CONTENIDO
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.communication_content_history(
  p_actor_internal_user_id uuid,
  p_communication_id uuid
)
returns table (
  content_history_id uuid,
  communication_id uuid,
  revision_no integer,

  subject text,
  body text,

  generation_mode text,
  generation_metadata jsonb,

  changed_by_internal_user_id uuid,
  changed_by_display_name text,

  change_rationale text,
  created_at timestamptz
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
  if not exists (
    select 1
    from mp25m.communications communication
    where communication.id =
      p_communication_id
  )
  then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  )
  then
    raise exception
      'Internal user cannot read communication content history'
      using errcode = '42501';
  end if;


  return query

  select
    history.id,
    history.communication_id,
    history.revision_no,

    history.subject,
    history.body,

    history.generation_mode,
    history.generation_metadata,

    history.changed_by_internal_user_id,
    internal_user.display_name::text,

    history.change_rationale,
    history.created_at

  from mp25m.communication_content_history history

  join mp25m.internal_users internal_user
    on internal_user.id =
      history.changed_by_internal_user_id

  where history.communication_id =
    p_communication_id

  order by
    history.revision_no desc,
    history.id desc;
end;
$function$;


comment on function mp25m_api.communication_content_history(
  uuid,
  uuid
) is
  'Historial append-only de revisiones de contenido de una Comunicación 12B.A; no representa autorización ni envío.';


-- ---------------------------------------------------------------------------
-- 25.8. HISTORIAL DE ESTADOS
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.communication_status_history(
  p_actor_internal_user_id uuid,
  p_communication_id uuid
)
returns table (
  status_history_id uuid,
  communication_id uuid,
  transition_no integer,

  status text,
  rationale text,

  changed_by_internal_user_id uuid,
  changed_by_display_name text,

  changed_at timestamptz
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
  if not exists (
    select 1
    from mp25m.communications communication
    where communication.id =
      p_communication_id
  )
  then
    raise exception
      'Communication % does not exist',
      p_communication_id
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_communication(
    p_actor_internal_user_id,
    p_communication_id
  )
  then
    raise exception
      'Internal user cannot read communication status history'
      using errcode = '42501';
  end if;


  return query

  select
    history.id,
    history.communication_id,
    history.transition_no,

    history.status,
    history.rationale,

    history.changed_by_internal_user_id,
    internal_user.display_name::text,

    history.changed_at

  from mp25m.communication_status_history history

  join mp25m.internal_users internal_user
    on internal_user.id =
      history.changed_by_internal_user_id

  where history.communication_id =
    p_communication_id

  order by
    history.transition_no desc,
    history.id desc;
end;
$function$;


comment on function mp25m_api.communication_status_history(
  uuid,
  uuid
) is
  'Historial append-only del ciclo de vida de una Comunicación 12B.A.';


-- ---------------------------------------------------------------------------
-- 26. CIERRE DE SEGURIDAD Y TRANSACCIÓN
-- ---------------------------------------------------------------------------

-- Las funciones de PostgreSQL reciben EXECUTE para PUBLIC por defecto.
-- 12B.A conserva el patrón server-only:
--
-- cliente autenticado
-- -> servidor
-- -> service_role
-- -> RPC gobernado
--
-- Los helpers de trigger de mp25m no necesitan exposición directa.

do $security$
declare
  v_internal_names text[] := array[
    'enforce_communication_recipient_source_integrity',
    'reject_communication_history_mutation',
    'enforce_communication_resolution_immutability',
    'enforce_communication_recipient_immutability',
    'enforce_communication_criterion_insert',
    'enforce_communication_resolution_insert'
  ];

  v_api_names text[] := array[
    'is_active_internal_user',
    'has_current_internal_access',
    'is_global_administrator',
    'can_create_communication',
    'can_manage_communication',
    'create_communication',
    'update_communication',
    'cancel_communication',
    'replace_communication_audience_criteria',
    'communication_criterion_actor_list',
    'resolve_communication_audience',
    'set_communication_recipient_included',
    'add_communication_person_recipient',
    'confirm_communication_recipients',
    'communication_page',
    'communication_detail',
    'communication_criteria_list',
    'communication_resolution_list',
    'communication_recipient_page',
    'communication_content_history',
    'communication_status_history'
  ];

  v_count integer;
  v_function record;
  v_signature text;
begin
  select count(*)
  into v_count
  from pg_proc function_object
  join pg_namespace namespace
    on namespace.oid =
      function_object.pronamespace
  where namespace.nspname = 'mp25m'
    and function_object.proname =
      any(v_internal_names);

  if v_count <> 6 then
    raise exception
      'Expected 6 internal communication functions, found %',
      v_count;
  end if;


  select count(*)
  into v_count
  from pg_proc function_object
  join pg_namespace namespace
    on namespace.oid =
      function_object.pronamespace
  where namespace.nspname = 'mp25m_api'
    and function_object.proname =
      any(v_api_names);

  if v_count <> 21 then
    raise exception
      'Expected 21 communication API functions, found %',
      v_count;
  end if;


  for v_function in
    select
      namespace.nspname,
      function_object.proname,
      pg_get_function_identity_arguments(
        function_object.oid
      ) as identity_arguments
    from pg_proc function_object
    join pg_namespace namespace
      on namespace.oid =
        function_object.pronamespace
    where namespace.nspname = 'mp25m'
      and function_object.proname =
        any(v_internal_names)
  loop
    v_signature :=
      format(
        '%I.%I(%s)',
        v_function.nspname,
        v_function.proname,
        v_function.identity_arguments
      );

    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_signature
    );
  end loop;


  for v_function in
    select
      namespace.nspname,
      function_object.proname,
      pg_get_function_identity_arguments(
        function_object.oid
      ) as identity_arguments
    from pg_proc function_object
    join pg_namespace namespace
      on namespace.oid =
        function_object.pronamespace
    where namespace.nspname = 'mp25m_api'
      and function_object.proname =
        any(v_api_names)
  loop
    v_signature :=
      format(
        '%I.%I(%s)',
        v_function.nspname,
        v_function.proname,
        v_function.identity_arguments
      );

    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_signature
    );

    execute format(
      'grant execute on function %s to service_role',
      v_signature
    );
  end loop;
end;
$security$;


revoke all
on table mp25m_api.communication_list
from
  public,
  anon,
  authenticated,
  service_role;


grant select
on table mp25m_api.communication_list
to service_role;


comment on view mp25m_api.communication_list is
  'Vista server-only de Comunicaciones 12B.A. SELECT concedido exclusivamente a service_role; la autorización funcional se valida en los RPC.';


commit;
