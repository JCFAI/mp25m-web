-- Incremento 6D.2A: governance only; never assigns activities or capabilities.
begin;

create or replace view mp25m_api.organization_activity_proposal_list
with (security_invoker = true) as
select
  proposal.organization_id,
  proposal.id as proposal_id,
  proposal.proposed_name::text as proposed_name,
  proposal.normalized_name::text as normalized_name,
  proposal.status::text as status,
  proposal.resolved_activity_id,
  resolved_activity.name::text as resolved_activity_name,
  proposal.created_by_internal_user_id,
  proposal.resolved_by_internal_user_id,
  proposal.resolution_reason,
  proposal.created_at,
  proposal.resolved_at,
  o.name::text as organization_name,
  coalesce(author.display_name, proposal.created_by_internal_user_id::text)::text as created_by
from mp25m.organization_activity_proposals proposal
join mp25m.organizations o on o.id = proposal.organization_id
left join mp25m.activities resolved_activity on resolved_activity.id = proposal.resolved_activity_id
left join mp25m_api.internal_user_profile author on author.id = proposal.created_by_internal_user_id
where o.record_status = 'active';

revoke all on mp25m_api.organization_activity_proposal_list from public, anon, authenticated;
grant select on mp25m_api.organization_activity_proposal_list to service_role;
grant insert on mp25m.activities to service_role;
-- SELECT FOR SHARE requires an UPDATE privilege, restricted to the identifier.
grant update (id) on mp25m.activities to service_role;
grant update on mp25m.organization_activity_proposals to service_role;

create function mp25m_api.resolve_organization_activity_proposal(
  p_actor_internal_user_id uuid,
  p_proposal_id uuid,
  p_resolution_action text,
  p_target_activity_id uuid default null,
  p_canonical_name text default null,
  p_description text default null,
  -- PostgreSQL requires defaults after the first defaulted argument.
  -- NULL is rejected below: the reason remains functionally mandatory.
  p_reason text default null
)
returns table (
  proposal_id uuid,
  organization_id uuid,
  organization_name text,
  proposed_name text,
  resolved_activity_id uuid,
  resolved_activity_name text,
  status text,
  resolution_action text
)
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_before mp25m.organization_activity_proposals%rowtype;
  v_after mp25m.organization_activity_proposals%rowtype;
  v_activity mp25m.activities%rowtype;
  v_organization_name text;
  v_name text := nullif(btrim(p_canonical_name), '');
  v_normalized_name text;
  v_description text := nullif(btrim(p_description), '');
  v_reason text := nullif(btrim(p_reason), '');
  v_metadata jsonb;
begin
  if not exists (
    select 1 from mp25m.internal_users iu
    join mp25m.access_role_assignments ara on ara.internal_user_id = iu.id
    join mp25m.access_roles ar on ar.code = ara.access_role_code
    join mp25m.access_scopes scope on scope.id = ara.access_scope_id
    where iu.id = p_actor_internal_user_id
      and iu.status = 'active' and iu.deleted_at is null
      and ara.status = 'active' and ara.revoked_at is null
      and ara.valid_from <= now()
      and (ara.valid_until is null or ara.valid_until > now())
      and ar.code in ('administrator', 'validator')
      and ar.is_active = true and ar.deleted_at is null
      and scope.scope_type = 'global'
      and scope.is_active = true and scope.deleted_at is null
  ) then
    raise exception 'Internal user cannot manage organization activities' using errcode = '42501';
  end if;

  if p_resolution_action is null or p_resolution_action not in ('map', 'create', 'reject') then
    raise exception 'Invalid resolution action' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) not between 3 and 2000 then
    raise exception 'Invalid resolution reason' using errcode = '22023';
  end if;

  select proposal.* into v_before
  from mp25m.organization_activity_proposals proposal
  where proposal.id = p_proposal_id for update;
  if not found then
    raise exception 'Activity proposal not found' using errcode = 'P0002';
  end if;
  if v_before.status <> 'pending' then
    raise exception 'Activity proposal is not pending' using errcode = '22023';
  end if;
  select o.name::text into v_organization_name
  from mp25m.organizations o
  where o.id = v_before.organization_id and o.record_status = 'active'
  for share;
  if not found then
    raise exception 'Organization not found or inactive' using errcode = 'P0002';
  end if;

  if p_resolution_action = 'map' then
    if p_target_activity_id is null then
      raise exception 'Invalid target activity' using errcode = '22023';
    end if;
    select a.* into v_activity from mp25m.activities a
    where a.id = p_target_activity_id and a.active = true for share;
    if not found then
      raise exception 'Target activity not found or inactive' using errcode = 'P0002';
    end if;
  elsif p_resolution_action = 'create' then
    if v_name is null or char_length(v_name) not between 2 and 200 then
      raise exception 'Invalid canonical activity name' using errcode = '22023';
    end if;
    v_normalized_name := mp25m_private.normalize_text(v_name);
    if v_normalized_name is null then
      raise exception 'Invalid canonical activity name' using errcode = '22023';
    end if;
    if char_length(v_description) > 2000 then
      raise exception 'Invalid activity description' using errcode = '22023';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('mp25m.activity.create:' || v_normalized_name, 0));
    select a.* into v_activity from mp25m.activities a
    where a.normalized_name = v_normalized_name;
    if found then
      raise exception 'Canonical activity already exists: %', v_activity.name using errcode = '23505';
    end if;
    insert into mp25m.activities (name, normalized_name, description, active)
    values (v_name, v_normalized_name, v_description, true)
    returning * into v_activity;
  end if;

  update mp25m.organization_activity_proposals proposal
  set status = case when p_resolution_action = 'reject' then 'rejected' else 'mapped' end,
      resolved_activity_id = v_activity.id,
      resolved_by_internal_user_id = p_actor_internal_user_id,
      resolution_reason = v_reason,
      resolved_at = now()
  where proposal.id = v_before.id
  returning proposal.* into v_after;

  v_metadata := jsonb_build_object(
    'organization_id', v_before.organization_id,
    'organization_name', v_organization_name,
    'proposal_id', v_before.id,
    'proposed_name', v_before.proposed_name,
    'target_activity_id', v_activity.id,
    'target_activity_name', v_activity.name,
    'resolution_action', p_resolution_action,
    'reason', v_reason
  );
  if p_resolution_action = 'create' then
    insert into mp25m.audit_events (
      actor_internal_user_id, action, target_schema, target_table, target_id,
      old_data, new_data, result, metadata
    ) values (
      p_actor_internal_user_id, 'activity.create', 'mp25m', 'activities', v_activity.id,
      null, to_jsonb(v_activity), 'allowed', v_metadata
    );
  end if;
  insert into mp25m.audit_events (
    actor_internal_user_id, action, target_schema, target_table, target_id,
    old_data, new_data, result, metadata
  ) values (
    p_actor_internal_user_id,
    case p_resolution_action
      when 'map' then 'organization.activity_proposal.map'
      when 'create' then 'organization.activity_proposal.create_activity'
      else 'organization.activity_proposal.reject'
    end,
    'mp25m', 'organization_activity_proposals', v_before.id,
    to_jsonb(v_before), to_jsonb(v_after), 'allowed', v_metadata
  );

  return query select v_after.id, v_after.organization_id, v_organization_name,
    v_after.proposed_name, v_activity.id, v_activity.name, v_after.status, p_resolution_action;
end;
$function$;

revoke all on function mp25m_api.resolve_organization_activity_proposal(uuid, uuid, text, uuid, text, text, text)
from public, anon, authenticated, service_role;
grant execute on function mp25m_api.resolve_organization_activity_proposal(uuid, uuid, text, uuid, text, text, text)
to service_role;

comment on function mp25m_api.resolve_organization_activity_proposal(uuid, uuid, text, uuid, text, text, text)
is 'Resolves catalog proposals with global administrator/validator access. Never assigns organization activities or capabilities.';

commit;
