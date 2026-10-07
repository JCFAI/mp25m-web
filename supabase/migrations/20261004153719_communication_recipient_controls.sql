-- Comunicaciones 12B:
-- 1. excluir/reincorporar destinatarios sin exigir motivo manual;
-- 2. obtener resumen de procedencia por criterio sin cargar toda
--    la lista paginada de destinatarios en el cliente.

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

  if v_reason is not null
     and char_length(v_reason)
        not between 3 and 2000
  then
    raise exception
      'Recipient inclusion reason must contain between 3 and 2000 characters when supplied'
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
  'Permite excluir o volver a incluir un destinatario en la resolución vigente y no confirmada; el motivo manual es opcional.';


create or replace function mp25m_api.communication_recipient_source_summary(
  p_actor_internal_user_id uuid,
  p_resolution_id uuid
)
returns table (
  criterion_id uuid,
  recipient_count integer,
  multi_criterion_recipient_count integer
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
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
  ) then
    raise exception
      'Internal user cannot read communication recipient summary'
      using errcode = '42501';
  end if;

  return query

  with source_rows as (
    select
      source.recipient_id,
      source.criterion_id
    from mp25m.communication_recipient_sources source

    join mp25m.communication_resolution_recipients recipient
      on recipient.id =
         source.recipient_id

    where recipient.resolution_id =
        p_resolution_id

      and source.criterion_id
          is not null
  ),

  multi_criterion as (
    select
      row.recipient_id
    from source_rows row
    group by
      row.recipient_id
    having
      count(
        distinct row.criterion_id
      ) > 1
  ),

  multi_total as (
    select
      count(*)::integer
        as recipient_count
    from multi_criterion
  )

  select
    row.criterion_id,

    count(
      distinct row.recipient_id
    )::integer
      as recipient_count,

    total.recipient_count
      as multi_criterion_recipient_count

  from source_rows row

  cross join multi_total total

  group by
    row.criterion_id,
    total.recipient_count

  order by
    row.criterion_id;
end;
$function$;


comment on function mp25m_api.communication_recipient_source_summary(
  uuid,
  uuid
) is
  'Resume cuántos destinatarios aporta cada criterio y cuántos destinatarios fueron alcanzados por más de un criterio.';


revoke all
on function mp25m_api.set_communication_recipient_included(
  uuid,
  uuid,
  boolean,
  text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.set_communication_recipient_included(
  uuid,
  uuid,
  boolean,
  text
)
to service_role;


revoke all
on function mp25m_api.communication_recipient_source_summary(
  uuid,
  uuid
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.communication_recipient_source_summary(
  uuid,
  uuid
)
to service_role;
