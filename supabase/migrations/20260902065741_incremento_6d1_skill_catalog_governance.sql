-- Incremento 6D.1 - Gobernanza del catalogo de habilidades.
--
-- Agrega propuestas del catalogo canonico y administracion auditada
-- de aliases. Resolver una propuesta no asigna habilidades a personas
-- ni capacidades a organizaciones.

begin;


-- ---------------------------------------------------------------------------
-- 1. MODELO DE PROPUESTAS DEL CATALOGO
-- ---------------------------------------------------------------------------

create table if not exists mp25m.skill_proposals (
  id uuid primary key default gen_random_uuid(),

  proposed_name text not null,

  normalized_name text not null,

  proposed_description text,

  suggested_category_code varchar(40)
    references mp25m.skill_categories(code)
    on delete set null,

  suggested_applies_to_person boolean,

  suggested_applies_to_organization boolean,

  status text not null default 'pending',

  resolved_skill_id uuid
    references mp25m.skills(id)
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

  constraint skill_proposals_name_length_check
    check (
      char_length(btrim(proposed_name))
        between 2 and 200
    ),

  constraint skill_proposals_normalized_name_check
    check (
      mp25m_private.normalize_text(proposed_name) is not null
      and normalized_name =
        mp25m_private.normalize_text(proposed_name)
    ),

  constraint skill_proposals_description_length_check
    check (
      proposed_description is null
      or char_length(btrim(proposed_description)) <= 2000
    ),

  constraint skill_proposals_status_check
    check (
      status in (
        'pending',
        'mapped',
        'created',
        'rejected'
      )
    ),

  constraint skill_proposals_reason_length_check
    check (
      resolution_reason is null
      or char_length(btrim(resolution_reason))
        between 3 and 2000
    ),

  constraint skill_proposals_resolution_check
    check (
      (
        status = 'pending'
        and resolved_skill_id is null
        and resolved_by_internal_user_id is null
        and resolution_reason is null
        and resolved_at is null
      )
      or (
        status in ('mapped', 'created')
        and resolved_skill_id is not null
        and resolved_by_internal_user_id is not null
        and resolution_reason is not null
        and resolved_at is not null
      )
      or (
        status = 'rejected'
        and resolved_skill_id is null
        and resolved_by_internal_user_id is not null
        and resolution_reason is not null
        and resolved_at is not null
      )
    )
);


create unique index if not exists
skill_proposals_one_pending_normalized_name_idx
on mp25m.skill_proposals(normalized_name)
where status = 'pending';


create index if not exists
skill_proposals_status_created_at_idx
on mp25m.skill_proposals(status, created_at desc);


create index if not exists
skill_proposals_resolved_skill_idx
on mp25m.skill_proposals(resolved_skill_id)
where resolved_skill_id is not null;

-- El catalogo usa un namespace global para aliases.
-- Antes de imponer la unicidad, abortar la migracion si
-- aparecieron incompatibilidades desde la ultima revision.

do $block$
begin
  if exists (
    select 1
    from mp25m.skill_aliases sa
    group by sa.normalized_alias
    having count(*) > 1
  ) then
    raise exception
      'Cannot enforce global skill alias uniqueness: duplicate normalized aliases exist';
  end if;

  if exists (
    select 1
    from mp25m.skill_aliases sa

    join mp25m.skills s
      on s.normalized_name::text =
        sa.normalized_alias::text
  ) then
    raise exception
      'Cannot enforce skill catalog namespace: alias conflicts with canonical skill name';
  end if;
end;
$block$;


create unique index if not exists
skill_aliases_normalized_alias_global_idx
on mp25m.skill_aliases(normalized_alias);

alter table mp25m.skill_proposals
  enable row level security;


revoke all
on table mp25m.skill_proposals
from public, anon, authenticated, service_role;


grant select, insert, update
on table mp25m.skill_proposals
to service_role;


grant select
on table mp25m.skill_categories
to service_role;


grant select, insert
on table
  mp25m.skills,
  mp25m.skill_aliases
to service_role;


-- ---------------------------------------------------------------------------
-- 2. READ MODEL SERVER-ONLY
-- ---------------------------------------------------------------------------

create or replace view
mp25m_api.skill_proposal_list
with (security_invoker = true)
as
select
  proposal.id as proposal_id,

  proposal.proposed_name,

  proposal.normalized_name,

  proposal.proposed_description as description,

  proposal.suggested_category_code,

  suggested_category.name::text
    as suggested_category_name,

  proposal.suggested_applies_to_person,

  proposal.suggested_applies_to_organization,

  proposal.status,

  proposal.resolved_skill_id,

  resolved_skill.name::text
    as resolved_skill_name,

  exact_skill.id as exact_skill_id,

  exact_skill.name::text as exact_skill_name,

  exact_alias.skill_id as exact_alias_skill_id,

  exact_alias.skill_name
    as exact_alias_skill_name,

  exact_alias.alias
    as exact_alias,

  proposal.created_by_internal_user_id,

  coalesce(
    created_profile.display_name,
    proposal.created_by_internal_user_id::text
  )::text as created_by,

  proposal.created_at,

  proposal.resolved_by_internal_user_id,

  coalesce(
    resolved_profile.display_name,
    proposal.resolved_by_internal_user_id::text
  )::text as resolved_by,

  proposal.resolved_at,

  proposal.resolution_reason

from mp25m.skill_proposals proposal

left join mp25m.skill_categories suggested_category
  on suggested_category.code =
    proposal.suggested_category_code

left join mp25m.skills resolved_skill
  on resolved_skill.id =
    proposal.resolved_skill_id

left join lateral (
  select
    s.id,

    s.name

  from mp25m.skills s

  where s.normalized_name::text =
    proposal.normalized_name

  order by s.active desc, s.name

  limit 1
) exact_skill on true

left join lateral (
  select
    s.id as skill_id,

    s.name::text as skill_name,

    sa.alias::text as alias

  from mp25m.skill_aliases sa

  join mp25m.skills s
    on s.id = sa.skill_id

  where sa.normalized_alias::text =
    proposal.normalized_name

  order by s.active desc, s.name, sa.alias

  limit 1
) exact_alias on true

left join mp25m_api.internal_user_profile created_profile
  on created_profile.id =
    proposal.created_by_internal_user_id

left join mp25m_api.internal_user_profile resolved_profile
  on resolved_profile.id =
    proposal.resolved_by_internal_user_id;


revoke all privileges
on table mp25m_api.skill_proposal_list
from public, anon, authenticated, service_role;


grant select
on table mp25m_api.skill_proposal_list
to service_role;


-- ---------------------------------------------------------------------------
-- 3. WRITE API SERVER-ONLY
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.propose_skill(
  p_actor_internal_user_id uuid,
  p_proposed_name text,
  p_description text default null,
  p_suggested_category_code text default null,
  p_suggested_applies_to_person boolean default null,
  p_suggested_applies_to_organization boolean default null,
  p_origin_kind text default null,
  p_origin_id uuid default null
)
returns table (
  proposal_id uuid,
  proposed_name text
)
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_proposed_name text;
  v_normalized_name text;
  v_description text;
  v_suggested_category_code text;
  v_origin_kind text;
  v_existing_skill_name text;
  v_existing_proposal_id uuid;
  v_proposal mp25m.skill_proposals%rowtype;
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
      'Internal user cannot manage skill catalog'
      using errcode = '42501';
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
      'Skill proposal name must contain between 2 and 200 characters'
      using errcode = '22023';
  end if;

  v_normalized_name :=
    mp25m_private.normalize_text(
      v_proposed_name
    );

  if v_normalized_name is null then
    raise exception
      'Skill proposal name is invalid'
      using errcode = '22023';
  end if;

  v_description :=
    nullif(
      btrim(
        coalesce(
          p_description,
          ''
        )
      ),
      ''
    );

  if v_description is not null
     and char_length(v_description) > 2000
  then
    raise exception
      'Skill proposal description cannot exceed 2000 characters'
      using errcode = '22023';
  end if;

  v_suggested_category_code :=
    nullif(
      btrim(
        coalesce(
          p_suggested_category_code,
          ''
        )
      ),
      ''
    );

  if v_suggested_category_code is not null
     and not exists (
       select 1
       from mp25m.skill_categories sc
       where sc.code = v_suggested_category_code
         and sc.active = true
     )
  then
    raise exception
      'Skill proposal suggested category is invalid'
      using errcode = '22023';
  end if;

  v_origin_kind :=
    nullif(
      btrim(
        coalesce(
          p_origin_kind,
          ''
        )
      ),
      ''
    );

  if v_origin_kind is not null
     and v_origin_kind not in (
       'person',
       'organization',
       'skill_directory'
     )
  then
    raise exception
      'Skill proposal origin kind is invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'mp25m.skill_catalog.normalized:' ||
      v_normalized_name,
      0
    )
  );

  select s.name::text
  into v_existing_skill_name
  from mp25m.skills s
  where s.normalized_name::text =
    v_normalized_name
  limit 1;

  if found then
    raise exception
      'Equivalent skill already exists: %',
      v_existing_skill_name
      using errcode = '23505';
  end if;

  select s.name::text
  into v_existing_skill_name
  from mp25m.skill_aliases sa

  join mp25m.skills s
    on s.id = sa.skill_id

  where sa.normalized_alias::text =
    v_normalized_name
  limit 1;

  if found then
    raise exception
      'Equivalent skill already exists: %',
      v_existing_skill_name
      using errcode = '23505';
  end if;

  select proposal.id
  into v_existing_proposal_id
  from mp25m.skill_proposals proposal
  where proposal.normalized_name =
    v_normalized_name
    and proposal.status = 'pending'
  limit 1;

  if found then
    raise exception
      'Pending skill proposal already exists'
      using errcode = '23505';
  end if;

  insert into mp25m.skill_proposals (
    proposed_name,
    normalized_name,
    proposed_description,
    suggested_category_code,
    suggested_applies_to_person,
    suggested_applies_to_organization,
    status,
    created_by_internal_user_id
  )
  values (
    v_proposed_name,
    v_normalized_name,
    v_description,
    v_suggested_category_code,
    p_suggested_applies_to_person,
    p_suggested_applies_to_organization,
    'pending',
    p_actor_internal_user_id
  )
  returning *
  into v_proposal;

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
    'skill.proposal.create',
    'mp25m',
    'skill_proposals',
    v_proposal.id,
    to_jsonb(v_proposal),
    'allowed',
    jsonb_build_object(
      'proposal_id',
        v_proposal.id,
      'proposed_name',
        v_proposal.proposed_name,
      'normalized_name',
        v_proposal.normalized_name,
      'operation',
        'propose',
      'origin_kind',
        v_origin_kind,
      'origin_id',
        p_origin_id
    )
  );

  return query
  select
    v_proposal.id,
    v_proposal.proposed_name;
end;
$function$;


create or replace function
mp25m_api.resolve_skill_proposal(
  p_actor_internal_user_id uuid,
  p_proposal_id uuid,
  p_resolution_action text,
  p_target_skill_id uuid default null,
  p_canonical_name text default null,
  p_category_code text default null,
  p_description text default null,
  p_applies_to_person boolean default null,
  p_applies_to_organization boolean default null,
  p_reason text default null
)
returns table (
  proposal_id uuid,
  resolved_skill_id uuid,
  resolved_skill_name text,
  status text
)
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_action text;
  v_reason text;
  v_proposal_before mp25m.skill_proposals%rowtype;
  v_proposal_after mp25m.skill_proposals%rowtype;
  v_target_skill mp25m.skills%rowtype;
  v_new_skill mp25m.skills%rowtype;
  v_canonical_name text;
  v_normalized_name text;
  v_category_code text;
  v_description text;
  v_applies_to_person boolean;
  v_applies_to_organization boolean;
  v_existing_skill_name text;
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
      'Internal user cannot manage skill catalog'
      using errcode = '42501';
  end if;

  v_action :=
    nullif(
      btrim(
        coalesce(
          p_resolution_action,
          ''
        )
      ),
      ''
    );

  if v_action is null
     or v_action not in (
       'map',
       'create',
       'reject'
     )
  then
    raise exception
      'Invalid skill proposal resolution action'
      using errcode = '22023';
  end if;

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

  if v_reason is null
     or char_length(v_reason) < 3
     or char_length(v_reason) > 2000
  then
    raise exception
      'Skill proposal resolution reason must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;

  select proposal.*
  into v_proposal_before
  from mp25m.skill_proposals proposal
  where proposal.id = p_proposal_id
  for update;

  if not found then
    raise exception
      'Skill proposal not found'
      using errcode = 'P0002';
  end if;

  if v_proposal_before.status <> 'pending' then
    raise exception
      'Skill proposal is not pending'
      using errcode = '22023';
  end if;

  if v_action = 'map' then
    if p_target_skill_id is null then
      raise exception
        'Skill proposal map target is required'
        using errcode = '22023';
    end if;

    select s.*
    into v_target_skill
    from mp25m.skills s
    where s.id = p_target_skill_id
      and s.active = true;

    if not found then
      raise exception
        'Target skill not found or inactive'
        using errcode = 'P0002';
    end if;

    update mp25m.skill_proposals
    set status = 'mapped',
        resolved_skill_id = v_target_skill.id,
        resolved_by_internal_user_id =
          p_actor_internal_user_id,
        resolution_reason = v_reason,
        resolved_at = now()
    where id = v_proposal_before.id
    returning *
    into v_proposal_after;

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
      'skill.proposal.map',
      'mp25m',
      'skill_proposals',
      v_proposal_after.id,
      v_reason,
      to_jsonb(v_proposal_before),
      to_jsonb(v_proposal_after),
      'allowed',
      jsonb_build_object(
        'proposal_id',
          v_proposal_after.id,
        'proposed_name',
          v_proposal_after.proposed_name,
        'skill_id',
          v_target_skill.id,
        'skill_name',
          v_target_skill.name,
        'resolved_skill_id',
          v_target_skill.id,
        'resolved_skill_name',
          v_target_skill.name,
        'operation',
          'map'
      )
    );

    return query
    select
      v_proposal_after.id,
      v_target_skill.id,
      v_target_skill.name::text,
      v_proposal_after.status;

    return;
  end if;

  if v_action = 'create' then
    v_canonical_name :=
      nullif(
        btrim(
          coalesce(
            p_canonical_name,
            v_proposal_before.proposed_name,
            ''
          )
        ),
        ''
      );

    if v_canonical_name is null
       or char_length(v_canonical_name) < 2
       or char_length(v_canonical_name) > 160
    then
      raise exception
        'Canonical skill name must contain between 2 and 160 characters'
        using errcode = '22023';
    end if;

    v_normalized_name :=
      mp25m_private.normalize_text(
        v_canonical_name
      );

    if v_normalized_name is null then
      raise exception
        'Canonical skill name is invalid'
        using errcode = '22023';
    end if;

    v_category_code :=
      nullif(
        btrim(
          coalesce(
            p_category_code,
            ''
          )
        ),
        ''
      );

    if v_category_code is not null
       and not exists (
         select 1
         from mp25m.skill_categories sc
         where sc.code = v_category_code
           and sc.active = true
       )
    then
      raise exception
        'Skill category not found or inactive'
        using errcode = 'P0002';
    end if;

    v_description :=
      nullif(
        btrim(
          coalesce(
            p_description,
            v_proposal_before.proposed_description,
            ''
          )
        ),
        ''
      );

    if v_description is not null
       and char_length(v_description) > 2000
    then
      raise exception
        'Skill description cannot exceed 2000 characters'
        using errcode = '22023';
    end if;

    v_applies_to_person :=
      coalesce(
        p_applies_to_person,
        v_proposal_before.suggested_applies_to_person,
        false
      );

    v_applies_to_organization :=
      coalesce(
        p_applies_to_organization,
        v_proposal_before.suggested_applies_to_organization,
        false
      );

    if not (
      v_applies_to_person
      or v_applies_to_organization
    ) then
      raise exception
        'Skill must apply to people or organizations'
        using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(
        'mp25m.skill_catalog.normalized:' ||
        v_normalized_name,
        0
      )
    );

    select s.name::text
    into v_existing_skill_name
    from mp25m.skills s
    where s.normalized_name::text =
      v_normalized_name
    limit 1;

    if found then
      raise exception
        'Equivalent skill already exists: %',
        v_existing_skill_name
        using errcode = '23505';
    end if;

    select s.name::text
    into v_existing_skill_name
    from mp25m.skill_aliases sa

    join mp25m.skills s
      on s.id = sa.skill_id

    where sa.normalized_alias::text =
      v_normalized_name
    limit 1;

    if found then
      raise exception
        'Equivalent skill already exists: %',
        v_existing_skill_name
        using errcode = '23505';
    end if;

    insert into mp25m.skills (
      name,
      normalized_name,
      category_code,
      description,
      applies_to_person,
      applies_to_organization,
      active
    )
    values (
      v_canonical_name,
      v_normalized_name,
      v_category_code,
      v_description,
      v_applies_to_person,
      v_applies_to_organization,
      true
    )
    returning *
    into v_new_skill;

    update mp25m.skill_proposals
    set status = 'created',
        resolved_skill_id = v_new_skill.id,
        resolved_by_internal_user_id =
          p_actor_internal_user_id,
        resolution_reason = v_reason,
        resolved_at = now()
    where id = v_proposal_before.id
    returning *
    into v_proposal_after;

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
      'skill.create',
      'mp25m',
      'skills',
      v_new_skill.id,
      v_reason,
      jsonb_build_object(
        'skill_id',
          v_new_skill.id,
        'name',
          v_new_skill.name,
        'normalized_name',
          v_new_skill.normalized_name,
        'category_code',
          v_new_skill.category_code,
        'description',
          v_new_skill.description,
        'applies_to_person',
          v_new_skill.applies_to_person,
        'applies_to_organization',
          v_new_skill.applies_to_organization,
        'active',
          v_new_skill.active
      ),
      'allowed',
      jsonb_build_object(
        'proposal_id',
          v_proposal_after.id,
        'proposed_name',
          v_proposal_after.proposed_name,
        'skill_id',
          v_new_skill.id,
        'skill_name',
          v_new_skill.name,
        'operation',
          'create_skill'
      )
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
      'skill.proposal.create_skill',
      'mp25m',
      'skill_proposals',
      v_proposal_after.id,
      v_reason,
      to_jsonb(v_proposal_before),
      to_jsonb(v_proposal_after),
      'allowed',
      jsonb_build_object(
        'proposal_id',
          v_proposal_after.id,
        'proposed_name',
          v_proposal_after.proposed_name,
        'skill_id',
          v_new_skill.id,
        'skill_name',
          v_new_skill.name,
        'resolved_skill_id',
          v_new_skill.id,
        'resolved_skill_name',
          v_new_skill.name,
        'operation',
          'create_skill'
      )
    );

    return query
    select
      v_proposal_after.id,
      v_new_skill.id,
      v_new_skill.name::text,
      v_proposal_after.status;

    return;
  end if;

  update mp25m.skill_proposals
  set status = 'rejected',
      resolved_skill_id = null,
      resolved_by_internal_user_id =
        p_actor_internal_user_id,
      resolution_reason = v_reason,
      resolved_at = now()
  where id = v_proposal_before.id
  returning *
  into v_proposal_after;

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
    'skill.proposal.reject',
    'mp25m',
    'skill_proposals',
    v_proposal_after.id,
    v_reason,
    to_jsonb(v_proposal_before),
    to_jsonb(v_proposal_after),
    'allowed',
    jsonb_build_object(
      'proposal_id',
        v_proposal_after.id,
      'proposed_name',
        v_proposal_after.proposed_name,
      'operation',
        'reject'
    )
  );

  return query
  select
    v_proposal_after.id,
    null::uuid,
    null::text,
    v_proposal_after.status;
end;
$function$;


create or replace function
mp25m_api.add_skill_alias(
  p_actor_internal_user_id uuid,
  p_skill_id uuid,
  p_alias text
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
  v_skill mp25m.skills%rowtype;
  v_alias text;
  v_normalized_alias text;
  v_existing_skill_name text;
  v_existing_alias_skill_name text;
  v_alias_row mp25m.skill_aliases%rowtype;
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
      'Internal user cannot manage skill catalog'
      using errcode = '42501';
  end if;

  select s.*
  into v_skill
  from mp25m.skills s
  where s.id = p_skill_id
    and s.active = true;

  if not found then
    raise exception
      'Skill not found or inactive'
      using errcode = 'P0002';
  end if;

  v_alias :=
    nullif(
      btrim(
        coalesce(
          p_alias,
          ''
        )
      ),
      ''
    );

  if v_alias is null
     or char_length(v_alias) < 2
     or char_length(v_alias) > 180
  then
    raise exception
      'Skill alias must contain between 2 and 180 characters'
      using errcode = '22023';
  end if;

  v_normalized_alias :=
    mp25m_private.normalize_text(v_alias);

  if v_normalized_alias is null then
    raise exception
      'Skill alias is invalid'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'mp25m.skill_catalog.normalized:' ||
      v_normalized_alias,
      0
    )
  );

  select s.name::text
  into v_existing_skill_name
  from mp25m.skills s
  where s.normalized_name::text =
    v_normalized_alias
  limit 1;

  if found then
    raise exception
      'Skill alias conflicts with canonical skill: %',
      v_existing_skill_name
      using errcode = '23505';
  end if;

  select s.name::text
  into v_existing_alias_skill_name
  from mp25m.skill_aliases sa

  join mp25m.skills s
    on s.id = sa.skill_id

  where sa.normalized_alias::text =
    v_normalized_alias
  limit 1;

  if found then
    raise exception
      'Skill alias already exists for skill: %',
      v_existing_alias_skill_name
      using errcode = '23505';
  end if;

  insert into mp25m.skill_aliases (
    skill_id,
    alias,
    normalized_alias
  )
  values (
    v_skill.id,
    v_alias,
    v_normalized_alias
  )
  returning *
  into v_alias_row;

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
    'skill.alias.add',
    'mp25m',
    'skill_aliases',
    v_alias_row.id,
    jsonb_build_object(
      'alias_id',
        v_alias_row.id,
      'skill_id',
        v_alias_row.skill_id,
      'alias',
        v_alias_row.alias,
      'normalized_alias',
        v_alias_row.normalized_alias
    ),
    'allowed',
    jsonb_build_object(
      'skill_id',
        v_skill.id,
      'skill_name',
        v_skill.name,
      'alias',
        v_alias_row.alias,
      'normalized_alias',
        v_alias_row.normalized_alias,
      'operation',
        'add_alias'
    )
  );

  return v_alias_row.id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 4. PRIVILEGIOS DE RPC
-- ---------------------------------------------------------------------------

revoke all
on function mp25m_api.propose_skill(
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  uuid
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.propose_skill(
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  uuid
)
to service_role;


revoke all
on function mp25m_api.resolve_skill_proposal(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.resolve_skill_proposal(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  text
)
to service_role;


revoke all
on function mp25m_api.add_skill_alias(
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.add_skill_alias(
  uuid,
  uuid,
  text
)
to service_role;


comment on table mp25m.skill_proposals is
  'Propuestas pendientes o resueltas del catalogo canonico de habilidades/capacidades; no asignan habilidades a personas ni capacidades a organizaciones.';

comment on view mp25m_api.skill_proposal_list is
  'Read model server-only de propuestas del catalogo de habilidades con contexto de resolucion.';

comment on function mp25m_api.propose_skill(
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  text,
  uuid
) is
  'Records a pending skill catalog proposal without creating a canonical skill or actor relationship.';

comment on function mp25m_api.resolve_skill_proposal(
  uuid,
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  text
) is
  'Maps, creates, or rejects a pending skill catalog proposal with administrator or validator global access.';

comment on function mp25m_api.add_skill_alias(
  uuid,
  uuid,
  text
) is
  'Adds one audited alias to a canonical skill with administrator or validator global access.';


commit;
