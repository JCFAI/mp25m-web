begin;

-- ============================================================================
-- MP25M — Incremento 10A
-- Necesidades y ofertas
--
-- Registro operativo y trazable de necesidades y ofertas.
-- No crea oportunidades, articulaciones, proyectos, contactos, compromisos
-- ni cruces automáticos.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENTIDAD PRINCIPAL
-- ---------------------------------------------------------------------------

create table mp25m.needs_offers (
  id uuid primary key default gen_random_uuid(),

  record_type text not null
    check (record_type in ('need', 'offer')),

  title text not null
    check (char_length(btrim(title)) between 3 and 200),

  normalized_title text not null
    check (char_length(btrim(normalized_title)) between 3 and 200),

  description text not null
    check (char_length(btrim(description)) between 10 and 10000),

  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'closed', 'cancelled')),

  responsible_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  node_id uuid
    references mp25m.nodes(id)
    on delete restrict,

  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  ended_at timestamptz,

  constraint needs_offers_terminal_state_check check (
    (
      status in ('closed', 'cancelled')
      and ended_at is not null
    )
    or
    (
      status not in ('closed', 'cancelled')
      and ended_at is null
    )
  )
);

-- ---------------------------------------------------------------------------
-- 2. HISTORIAL DE ESTADOS
-- ---------------------------------------------------------------------------

create table mp25m.need_offer_status_history (
  id uuid primary key default gen_random_uuid(),

  need_offer_id uuid not null
    references mp25m.needs_offers(id)
    on delete restrict,

  transition_no integer not null
    check (transition_no > 0),

  status text not null
    check (status in ('draft', 'active', 'paused', 'closed', 'cancelled')),

  responsible_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  node_id uuid
    references mp25m.nodes(id)
    on delete restrict,

  rationale text not null
    check (char_length(btrim(rationale)) between 3 and 10000),

  changed_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  changed_at timestamptz not null default now(),

  unique (need_offer_id, transition_no)
);

-- ---------------------------------------------------------------------------
-- 3. NOVEDADES / SEGUIMIENTOS
-- ---------------------------------------------------------------------------

create table mp25m.need_offer_followups (
  id uuid primary key default gen_random_uuid(),

  need_offer_id uuid not null
    references mp25m.needs_offers(id)
    on delete restrict,

  followup_type text not null default 'general'
    check (
      followup_type in (
        'general',
        'observation',
        'update',
        'next_step',
        'result'
      )
    ),

  detail text not null
    check (char_length(btrim(detail)) between 3 and 10000),

  occurred_at timestamptz not null default now(),

  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. ÍNDICES
-- ---------------------------------------------------------------------------

create index needs_offers_directory_idx
  on mp25m.needs_offers(normalized_title, id);

create index needs_offers_type_status_directory_idx
  on mp25m.needs_offers(record_type, status, normalized_title, id);

create index needs_offers_responsible_idx
  on mp25m.needs_offers(responsible_internal_user_id, normalized_title, id);

create index needs_offers_node_idx
  on mp25m.needs_offers(node_id, normalized_title, id)
  where node_id is not null;

create index needs_offers_updated_idx
  on mp25m.needs_offers(updated_at desc);

create index need_offer_status_history_item_idx
  on mp25m.need_offer_status_history(need_offer_id, transition_no desc);

create index need_offer_followups_item_idx
  on mp25m.need_offer_followups(need_offer_id, occurred_at desc, id desc);

-- ---------------------------------------------------------------------------
-- 5. UPDATED_AT
-- ---------------------------------------------------------------------------

create trigger trg_needs_offers_updated_at
before update on mp25m.needs_offers
for each row
execute function mp25m.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RLS Y ACCESO DIRECTO
-- ---------------------------------------------------------------------------

alter table mp25m.needs_offers enable row level security;
alter table mp25m.need_offer_status_history enable row level security;
alter table mp25m.need_offer_followups enable row level security;

revoke all
on
  mp25m.needs_offers,
  mp25m.need_offer_status_history,
  mp25m.need_offer_followups
from public, anon, authenticated, service_role;

grant select, insert, update
on mp25m.needs_offers
to service_role;

grant select, insert
on
  mp25m.need_offer_status_history,
  mp25m.need_offer_followups
to service_role;

-- ---------------------------------------------------------------------------
-- 7. PERMISOS FUNCIONALES
--
-- read:
--   cualquier usuario interno activo.
--
-- create / govern:
--   administración global activa.
--
-- manage / followup:
--   administración global o responsable actual del registro.
--
-- Las transiciones de estado quedan reservadas a govern.
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.can_operate_need_offer(
  p_actor_internal_user_id uuid,
  p_need_offer_id uuid,
  p_operation text
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
  select case

    when p_operation = 'read' then
      exists (
        select 1
        from mp25m.internal_users internal_user
        where internal_user.id = p_actor_internal_user_id
          and internal_user.status = 'active'
          and internal_user.deleted_at is null
      )

    when p_operation in ('create', 'govern') then
      exists (
        select 1
        from mp25m.internal_users internal_user
        join mp25m.access_role_assignments assignment
          on assignment.internal_user_id = internal_user.id
        join mp25m.access_roles access_role
          on access_role.code = assignment.access_role_code
        join mp25m.access_scopes scope
          on scope.id = assignment.access_scope_id
        where internal_user.id = p_actor_internal_user_id
          and internal_user.status = 'active'
          and internal_user.deleted_at is null
          and assignment.status = 'active'
          and assignment.revoked_at is null
          and assignment.valid_from <= now()
          and (
            assignment.valid_until is null
            or assignment.valid_until > now()
          )
          and access_role.is_administrative = true
          and access_role.is_active = true
          and access_role.deleted_at is null
          and scope.scope_type = 'global'
          and scope.is_active = true
          and scope.deleted_at is null
      )

    when p_operation in ('manage', 'followup') then
      mp25m_api.can_operate_need_offer(
        p_actor_internal_user_id,
        p_need_offer_id,
        'govern'
      )
      or exists (
        select 1
        from mp25m.needs_offers need_offer
        join mp25m.internal_users internal_user
          on internal_user.id = need_offer.responsible_internal_user_id
        where need_offer.id = p_need_offer_id
          and need_offer.responsible_internal_user_id =
              p_actor_internal_user_id
          and internal_user.status = 'active'
          and internal_user.deleted_at is null
      )

    else false

  end;
$function$;

revoke all
on function mp25m_api.can_operate_need_offer(uuid, uuid, text)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.can_operate_need_offer(uuid, uuid, text)
to service_role;

-- ---------------------------------------------------------------------------
-- 8. VISTA PRINCIPAL
-- ---------------------------------------------------------------------------

create view mp25m_api.need_offer_list
with (security_invoker = true)
as
select
  need_offer.id as need_offer_id,
  need_offer.record_type,
  need_offer.title,
  need_offer.normalized_title,
  need_offer.description,
  need_offer.status,

  need_offer.responsible_internal_user_id,
  responsible.display_name as responsible_display_name,

  need_offer.node_id,
  node_record.name as node_name,

  need_offer.created_by_internal_user_id,
  creator.display_name as created_by_display_name,

  need_offer.created_at,
  need_offer.updated_at,
  need_offer.ended_at,

  latest_followup.followup_type as latest_followup_type,
  latest_followup.detail as latest_followup_detail,
  latest_followup.occurred_at as latest_followup_at

from mp25m.needs_offers need_offer

join mp25m.internal_users responsible
  on responsible.id = need_offer.responsible_internal_user_id

join mp25m.internal_users creator
  on creator.id = need_offer.created_by_internal_user_id

left join mp25m.nodes node_record
  on node_record.id = need_offer.node_id

left join lateral (
  select
    followup.followup_type,
    followup.detail,
    followup.occurred_at
  from mp25m.need_offer_followups followup
  where followup.need_offer_id = need_offer.id
  order by
    followup.occurred_at desc,
    followup.id desc
  limit 1
) latest_followup on true;

-- ---------------------------------------------------------------------------
-- 9. VISTA DE HISTORIAL
-- ---------------------------------------------------------------------------

create view mp25m_api.need_offer_status_history_list
with (security_invoker = true)
as
select
  history.id as history_id,
  history.need_offer_id,
  history.transition_no,
  history.status,

  history.responsible_internal_user_id,
  responsible.display_name as responsible_display_name,

  history.node_id,
  node_record.name as node_name,

  history.rationale,

  history.changed_by_internal_user_id,
  changed_by.display_name as changed_by_display_name,

  history.changed_at

from mp25m.need_offer_status_history history

join mp25m.internal_users responsible
  on responsible.id = history.responsible_internal_user_id

join mp25m.internal_users changed_by
  on changed_by.id = history.changed_by_internal_user_id

left join mp25m.nodes node_record
  on node_record.id = history.node_id;

-- ---------------------------------------------------------------------------
-- 10. VISTA DE NOVEDADES
-- ---------------------------------------------------------------------------

create view mp25m_api.need_offer_followup_list
with (security_invoker = true)
as
select
  followup.id as followup_id,
  followup.need_offer_id,
  followup.followup_type,
  followup.detail,
  followup.occurred_at,

  followup.created_by_internal_user_id,
  creator.display_name as created_by_display_name,

  followup.created_at

from mp25m.need_offer_followups followup

join mp25m.internal_users creator
  on creator.id = followup.created_by_internal_user_id;

revoke all
on
  mp25m_api.need_offer_list,
  mp25m_api.need_offer_status_history_list,
  mp25m_api.need_offer_followup_list
from public, anon, authenticated, service_role;

grant select
on
  mp25m_api.need_offer_list,
  mp25m_api.need_offer_status_history_list,
  mp25m_api.need_offer_followup_list
to service_role;

-- ---------------------------------------------------------------------------
-- 11. DIRECTORIO PAGINADO
--
-- El cursor HTTP se resolverá en la aplicación.
-- SQL recibe las claves explícitas del cursor.
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.need_offer_page(
  p_query text default '',
  p_types text[] default null,
  p_statuses text[] default null,
  p_responsible_internal_user_id uuid default null,
  p_node_id uuid default null,
  p_after_title text default null,
  p_after_id uuid default null,
  p_limit integer default 25
)
returns table (
  need_offer_id uuid,
  record_type text,
  title text,
  description text,
  status text,
  responsible_internal_user_id uuid,
  responsible_display_name text,
  node_id uuid,
  node_name text,
  latest_followup_detail text,
  latest_followup_at timestamptz,
  updated_at timestamptz,
  cursor_title text
)
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
  with parameters as (
    select
      nullif(
        mp25m_private.normalize_text(
          btrim(coalesce(p_query, ''))
        ),
        ''
      ) as normalized_query
  )
  select
    need_offer.need_offer_id,
    need_offer.record_type,
    need_offer.title,
    need_offer.description,
    need_offer.status,
    need_offer.responsible_internal_user_id,
    need_offer.responsible_display_name,
    need_offer.node_id,
    need_offer.node_name,
    need_offer.latest_followup_detail,
    need_offer.latest_followup_at,
    need_offer.updated_at,
    need_offer.normalized_title as cursor_title

  from mp25m_api.need_offer_list need_offer
  cross join parameters

  where
    (
      p_types is null
      or need_offer.record_type = any(p_types)
    )

    and (
      p_statuses is null
      or need_offer.status = any(p_statuses)
    )

    and (
      p_responsible_internal_user_id is null
      or need_offer.responsible_internal_user_id =
          p_responsible_internal_user_id
    )

    and (
      p_node_id is null
      or need_offer.node_id = p_node_id
    )

    and (
      parameters.normalized_query is null
      or need_offer.normalized_title like
          '%' || parameters.normalized_query || '%'
      or mp25m_private.normalize_text(need_offer.description) like
          '%' || parameters.normalized_query || '%'
    )

    and (
      p_after_title is null
      or p_after_id is null
      or (
        need_offer.normalized_title,
        need_offer.need_offer_id
      ) > (
        p_after_title,
        p_after_id
      )
    )

  order by
    need_offer.normalized_title,
    need_offer.need_offer_id

  limit least(
    greatest(coalesce(p_limit, 25), 1),
    50
  ) + 1;
$function$;

revoke all
on function mp25m_api.need_offer_page(
  text,
  text[],
  text[],
  uuid,
  uuid,
  text,
  uuid,
  integer
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.need_offer_page(
  text,
  text[],
  text[],
  uuid,
  uuid,
  text,
  uuid,
  integer
)
to service_role;

-- ---------------------------------------------------------------------------
-- 12. CREAR NECESIDAD / OFERTA
--
-- Todo registro nace en borrador.
-- Responsable obligatorio.
-- Nodo opcional, pero al asignarlo debe estar formando o activo.
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.create_need_offer(
  p_actor_internal_user_id uuid,
  p_record_type text,
  p_title text,
  p_description text,
  p_responsible_internal_user_id uuid,
  p_node_id uuid default null,
  p_rationale text default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_need_offer_id uuid;
  v_rationale text := nullif(btrim(p_rationale), '');
begin

  if not mp25m_api.can_operate_need_offer(
    p_actor_internal_user_id,
    null,
    'create'
  ) then
    raise exception
      'Internal user cannot create needs or offers'
      using errcode = '42501';
  end if;

  if p_record_type not in ('need', 'offer')
     or char_length(btrim(coalesce(p_title, ''))) not between 3 and 200
     or char_length(btrim(coalesce(p_description, ''))) not between 10 and 10000
     or v_rationale is null
     or char_length(v_rationale) not between 3 and 10000 then
    raise exception
      'Invalid need or offer data'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from mp25m.internal_users internal_user
    where internal_user.id = p_responsible_internal_user_id
      and internal_user.status = 'active'
      and internal_user.deleted_at is null
  ) then
    raise exception
      'Responsible must be an active internal user'
      using errcode = '22023';
  end if;

  if p_node_id is not null
     and not exists (
       select 1
       from mp25m.nodes node_record
       where node_record.id = p_node_id
         and node_record.status in ('forming', 'active')
     ) then
    raise exception
      'Node must be forming or active'
      using errcode = '22023';
  end if;

  insert into mp25m.needs_offers (
    record_type,
    title,
    normalized_title,
    description,
    status,
    responsible_internal_user_id,
    node_id,
    created_by_internal_user_id
  )
  values (
    p_record_type,
    btrim(p_title),
    mp25m_private.normalize_text(p_title),
    btrim(p_description),
    'draft',
    p_responsible_internal_user_id,
    p_node_id,
    p_actor_internal_user_id
  )
  returning id into v_need_offer_id;

  insert into mp25m.need_offer_status_history (
    need_offer_id,
    transition_no,
    status,
    responsible_internal_user_id,
    node_id,
    rationale,
    changed_by_internal_user_id
  )
  values (
    v_need_offer_id,
    1,
    'draft',
    p_responsible_internal_user_id,
    p_node_id,
    v_rationale,
    p_actor_internal_user_id
  );

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    new_data,
    result
  )
  values (
    p_actor_internal_user_id,
    'need_offer.create',
    'mp25m',
    'needs_offers',
    v_need_offer_id,
    v_rationale,
    jsonb_build_object(
      'record_type', p_record_type,
      'title', btrim(p_title),
      'status', 'draft',
      'responsible_internal_user_id',
        p_responsible_internal_user_id,
      'node_id', p_node_id
    ),
    'allowed'
  );

  return v_need_offer_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 13. EDITAR
--
-- Responsable o administración global:
--   título, descripción y nodo.
--
-- Solo administración global:
--   cambiar responsable.
--
-- Cerrados/cancelados son históricos y no se editan.
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.update_need_offer(
  p_actor_internal_user_id uuid,
  p_need_offer_id uuid,
  p_title text,
  p_description text,
  p_responsible_internal_user_id uuid,
  p_node_id uuid default null,
  p_rationale text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.needs_offers%rowtype;
  v_rationale text := nullif(btrim(p_rationale), '');
begin

  if not mp25m_api.can_operate_need_offer(
    p_actor_internal_user_id,
    p_need_offer_id,
    'manage'
  ) then
    raise exception
      'Internal user cannot manage this need or offer'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 200
     or char_length(btrim(coalesce(p_description, ''))) not between 10 and 10000
     or v_rationale is null
     or char_length(v_rationale) not between 3 and 10000 then
    raise exception
      'Invalid need or offer data'
      using errcode = '22023';
  end if;

  select *
  into v_before
  from mp25m.needs_offers
  where id = p_need_offer_id
  for update;

  if not found then
    raise exception
      'Need or offer not found'
      using errcode = 'P0002';
  end if;

  if v_before.status in ('closed', 'cancelled') then
    raise exception
      'Closed or cancelled records are historical'
      using errcode = '22023';
  end if;

  if p_responsible_internal_user_id
       is distinct from v_before.responsible_internal_user_id then

    if not mp25m_api.can_operate_need_offer(
      p_actor_internal_user_id,
      p_need_offer_id,
      'govern'
    ) then
      raise exception
        'Only global administration can change the responsible user'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from mp25m.internal_users internal_user
      where internal_user.id = p_responsible_internal_user_id
        and internal_user.status = 'active'
        and internal_user.deleted_at is null
    ) then
      raise exception
        'Responsible must be an active internal user'
        using errcode = '22023';
    end if;

  end if;

  if p_node_id is distinct from v_before.node_id
     and p_node_id is not null
     and not exists (
       select 1
       from mp25m.nodes node_record
       where node_record.id = p_node_id
         and node_record.status in ('forming', 'active')
     ) then
    raise exception
      'Node must be forming or active'
      using errcode = '22023';
  end if;

  update mp25m.needs_offers
  set
    title = btrim(p_title),
    normalized_title = mp25m_private.normalize_text(p_title),
    description = btrim(p_description),
    responsible_internal_user_id =
      p_responsible_internal_user_id,
    node_id = p_node_id
  where id = p_need_offer_id;

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
    'need_offer.update',
    'mp25m',
    'needs_offers',
    p_need_offer_id,
    v_rationale,
    jsonb_build_object(
      'title', v_before.title,
      'responsible_internal_user_id',
        v_before.responsible_internal_user_id,
      'node_id', v_before.node_id
    ),
    jsonb_build_object(
      'title', btrim(p_title),
      'responsible_internal_user_id',
        p_responsible_internal_user_id,
      'node_id', p_node_id
    ),
    'allowed'
  );

end;
$function$;

-- ---------------------------------------------------------------------------
-- 14. CAMBIO DE ESTADO
--
-- Solo administración global.
-- Cerrado/cancelado puede reabrirse, pero únicamente a vigente.
-- Para pasar a vigente el responsable debe seguir activo y el nodo,
-- si existe, debe estar formando o activo.
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.transition_need_offer(
  p_actor_internal_user_id uuid,
  p_need_offer_id uuid,
  p_status text,
  p_rationale text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.needs_offers%rowtype;
  v_transition_no integer;
begin

  if not mp25m_api.can_operate_need_offer(
    p_actor_internal_user_id,
    p_need_offer_id,
    'govern'
  ) then
    raise exception
      'Internal user cannot govern this need or offer'
      using errcode = '42501';
  end if;

  if p_status not in (
       'draft',
       'active',
       'paused',
       'closed',
       'cancelled'
     )
     or char_length(btrim(coalesce(p_rationale, '')))
        not between 3 and 10000 then
    raise exception
      'Invalid need or offer transition'
      using errcode = '22023';
  end if;

  select *
  into v_before
  from mp25m.needs_offers
  where id = p_need_offer_id
  for update;

  if not found then
    raise exception
      'Need or offer not found'
      using errcode = 'P0002';
  end if;

  if v_before.status = p_status then
    raise exception
      'Need or offer already has this status'
      using errcode = '22023';
  end if;

  if v_before.status in ('closed', 'cancelled')
     and p_status <> 'active' then
    raise exception
      'A terminal record can only be reopened as active'
      using errcode = '22023';
  end if;

  if p_status = 'active' then

    if not exists (
      select 1
      from mp25m.internal_users internal_user
      where internal_user.id =
        v_before.responsible_internal_user_id
        and internal_user.status = 'active'
        and internal_user.deleted_at is null
    ) then
      raise exception
        'An active record requires an active responsible user'
        using errcode = '22023';
    end if;

    if v_before.node_id is not null
       and not exists (
         select 1
         from mp25m.nodes node_record
         where node_record.id = v_before.node_id
           and node_record.status in ('forming', 'active')
       ) then
      raise exception
        'An active record requires a forming or active node'
        using errcode = '22023';
    end if;

  end if;

  update mp25m.needs_offers
  set
    status = p_status,
    ended_at =
      case
        when p_status in ('closed', 'cancelled')
          then now()
        else null
      end
  where id = p_need_offer_id;

  select coalesce(max(history.transition_no), 0) + 1
  into v_transition_no
  from mp25m.need_offer_status_history history
  where history.need_offer_id = p_need_offer_id;

  insert into mp25m.need_offer_status_history (
    need_offer_id,
    transition_no,
    status,
    responsible_internal_user_id,
    node_id,
    rationale,
    changed_by_internal_user_id
  )
  values (
    p_need_offer_id,
    v_transition_no,
    p_status,
    v_before.responsible_internal_user_id,
    v_before.node_id,
    btrim(p_rationale),
    p_actor_internal_user_id
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
    result
  )
  values (
    p_actor_internal_user_id,
    'need_offer.transition',
    'mp25m',
    'needs_offers',
    p_need_offer_id,
    btrim(p_rationale),
    jsonb_build_object(
      'status', v_before.status
    ),
    jsonb_build_object(
      'status', p_status
    ),
    'allowed'
  );

end;
$function$;

-- ---------------------------------------------------------------------------
-- 15. REGISTRAR NOVEDAD
--
-- Responsable o administración global.
-- No se admiten novedades sobre registros cerrados/cancelados.
-- ---------------------------------------------------------------------------

create or replace function mp25m_api.create_need_offer_followup(
  p_actor_internal_user_id uuid,
  p_need_offer_id uuid,
  p_followup_type text,
  p_detail text,
  p_occurred_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_followup_id uuid;
  v_status text;
begin

  if not mp25m_api.can_operate_need_offer(
    p_actor_internal_user_id,
    p_need_offer_id,
    'followup'
  ) then
    raise exception
      'Internal user cannot follow up this need or offer'
      using errcode = '42501';
  end if;

  if p_followup_type not in (
       'general',
       'observation',
       'update',
       'next_step',
       'result'
     )
     or char_length(btrim(coalesce(p_detail, '')))
        not between 3 and 10000 then
    raise exception
      'Invalid need or offer follow-up'
      using errcode = '22023';
  end if;

  select status
  into v_status
  from mp25m.needs_offers
  where id = p_need_offer_id;

  if not found then
    raise exception
      'Need or offer not found'
      using errcode = 'P0002';
  end if;

  if v_status in ('closed', 'cancelled') then
    raise exception
      'Closed or cancelled records cannot receive follow-ups'
      using errcode = '22023';
  end if;

  insert into mp25m.need_offer_followups (
    need_offer_id,
    followup_type,
    detail,
    occurred_at,
    created_by_internal_user_id
  )
  values (
    p_need_offer_id,
    p_followup_type,
    btrim(p_detail),
    coalesce(p_occurred_at, now()),
    p_actor_internal_user_id
  )
  returning id into v_followup_id;

  update mp25m.needs_offers
  set updated_at = now()
  where id = p_need_offer_id;

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
    'need_offer.followup.create',
    'mp25m',
    'need_offer_followups',
    v_followup_id,
    btrim(p_detail),
    jsonb_build_object(
      'followup_type', p_followup_type,
      'occurred_at', coalesce(p_occurred_at, now())
    ),
    'allowed',
    jsonb_build_object(
      'need_offer_id', p_need_offer_id
    )
  );

  return v_followup_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 16. RPC: REVOCACIONES Y GRANTS
-- ---------------------------------------------------------------------------

revoke all
on function mp25m_api.create_need_offer(
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;

revoke all
on function mp25m_api.update_need_offer(
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;

revoke all
on function mp25m_api.transition_need_offer(
  uuid,
  uuid,
  text,
  text
)
from public, anon, authenticated, service_role;

revoke all
on function mp25m_api.create_need_offer_followup(
  uuid,
  uuid,
  text,
  text,
  timestamptz
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.create_need_offer(
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text
)
to service_role;

grant execute
on function mp25m_api.update_need_offer(
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid,
  text
)
to service_role;

grant execute
on function mp25m_api.transition_need_offer(
  uuid,
  uuid,
  text,
  text
)
to service_role;

grant execute
on function mp25m_api.create_need_offer_followup(
  uuid,
  uuid,
  text,
  text,
  timestamptz
)
to service_role;

-- ---------------------------------------------------------------------------
-- 17. DOCUMENTACIÓN DE ESQUEMA
-- ---------------------------------------------------------------------------

comment on table mp25m.needs_offers is
  'Increment 10A manual registry of needs and offers. Records are independent from opportunities, articulations and projects.';

comment on column mp25m.needs_offers.record_type is
  'need = necesidad; offer = oferta. The type describes the record and does not imply an opportunity or commitment.';

comment on column mp25m.needs_offers.node_id is
  'Optional territorial context. Assignment does not create any additional relationship or action.';

comment on table mp25m.need_offer_status_history is
  'Append-oriented lifecycle history for needs and offers, including responsible and node snapshot at each transition.';

comment on table mp25m.need_offer_followups is
  'Append-oriented manual follow-ups for needs and offers. Does not represent contact, availability, price, commitment or execution.';

commit;
