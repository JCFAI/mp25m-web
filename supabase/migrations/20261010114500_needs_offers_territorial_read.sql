-- Territorial read authorization for Needs / Offers.

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
      and (
        exists (
          select 1
          from mp25m.access_role_assignments assignment
          join mp25m.access_scopes scope
            on scope.id = assignment.access_scope_id
          where assignment.internal_user_id = p_actor_internal_user_id
            and assignment.status = 'active'
            and assignment.revoked_at is null
            and assignment.valid_from <= now()
            and (
              assignment.valid_until is null
              or assignment.valid_until > now()
            )
            and scope.scope_type = 'global'
            and scope.is_active = true
            and scope.deleted_at is null
        )
        or exists (
          select 1
          from mp25m.needs_offers need_offer
          where need_offer.id = p_need_offer_id
            and need_offer.responsible_internal_user_id =
                p_actor_internal_user_id
        )
        or exists (
          select 1
          from mp25m.needs_offers need_offer
          join mp25m.access_role_assignments assignment
            on assignment.internal_user_id = p_actor_internal_user_id
          join mp25m.access_scopes scope
            on scope.id = assignment.access_scope_id
          where need_offer.id = p_need_offer_id
            and need_offer.node_id is not null
            and assignment.status = 'active'
            and assignment.revoked_at is null
            and assignment.valid_from <= now()
            and (
              assignment.valid_until is null
              or assignment.valid_until > now()
            )
            and scope.scope_type = 'node'
            and scope.scope_entity_id = need_offer.node_id
            and scope.is_active = true
            and scope.deleted_at is null
        )
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

drop function if exists mp25m_api.need_offer_page(
  text,
  text[],
  text[],
  uuid,
  uuid,
  text,
  uuid,
  integer
);

create function mp25m_api.need_offer_page(
  p_actor_internal_user_id uuid,
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
    select nullif(
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
    mp25m_api.can_operate_need_offer(
      p_actor_internal_user_id,
      need_offer.need_offer_id,
      'read'
    )
    and (
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
  uuid,
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
  uuid,
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
-- Territorial guard for node changes performed by responsible users.
-- Global administration remains unrestricted.
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

  if p_node_id is distinct from v_before.node_id then

    if not mp25m_api.can_operate_need_offer(
      p_actor_internal_user_id,
      p_need_offer_id,
      'govern'
    ) then

      if p_node_id is null
         or not exists (
           select 1
           from mp25m.access_role_assignments assignment
           join mp25m.access_scopes scope
             on scope.id = assignment.access_scope_id
           where assignment.internal_user_id =
                 p_actor_internal_user_id
             and assignment.status = 'active'
             and assignment.revoked_at is null
             and assignment.valid_from <= now()
             and (
               assignment.valid_until is null
               or assignment.valid_until > now()
             )
             and scope.scope_type = 'node'
             and scope.scope_entity_id = p_node_id
             and scope.is_active = true
             and scope.deleted_at is null
         ) then
        raise exception
          'Internal user cannot move this need or offer outside the authorized territorial scope'
          using errcode = '42501';
      end if;

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
