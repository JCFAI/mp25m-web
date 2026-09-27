begin;

-- ============================================================
-- Articulaciones autónomas
-- ============================================================

create table mp25m.articulation_opportunities (
  id uuid primary key default gen_random_uuid(),

  articulation_id uuid not null
    references mp25m.opportunity_articulations(id)
    on delete cascade,

  opportunity_id uuid not null
    references mp25m.opportunities(id)
    on delete restrict,

  relation_type text not null default 'related'
    check (
      relation_type in (
        'origin',
        'context',
        'related'
      )
    ),

  relationship_note text null
    check (
      relationship_note is null
      or char_length(btrim(relationship_note))
        between 1 and 10000
    ),

  added_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  added_at timestamptz not null default now(),

  unique (articulation_id, opportunity_id)
);

create index articulation_opportunities_articulation_idx
  on mp25m.articulation_opportunities (
    articulation_id,
    added_at
  );

create index articulation_opportunities_opportunity_idx
  on mp25m.articulation_opportunities (
    opportunity_id,
    added_at
  );

alter table mp25m.articulation_opportunities
  enable row level security;

revoke all
  on table mp25m.articulation_opportunities
  from public, anon, authenticated, service_role;

grant select, insert, update, delete
  on table mp25m.articulation_opportunities
  to service_role;


-- ============================================================
-- Migrar relaciones legacy existentes
-- ============================================================

insert into mp25m.articulation_opportunities (
  articulation_id,
  opportunity_id,
  relation_type,
  relationship_note,
  added_by_internal_user_id,
  added_at
)
select
  articulation.id,
  articulation.opportunity_id,
  'origin',
  'Vínculo migrado desde el modelo anterior de articulaciones.',
  articulation.created_by_internal_user_id,
  articulation.created_at
from mp25m.opportunity_articulations articulation
where articulation.opportunity_id is not null
on conflict (articulation_id, opportunity_id)
do nothing;


-- ============================================================
-- La oportunidad deja de ser obligatoria
-- ============================================================

alter table mp25m.opportunity_articulations
  alter column opportunity_id drop not null;

comment on column
  mp25m.opportunity_articulations.opportunity_id
is
  'Referencia legacy nullable. Las relaciones actuales con oportunidades se modelan mediante mp25m.articulation_opportunities.';


-- ============================================================
-- Permisos de articulación
-- ============================================================

create or replace function
mp25m_api.can_create_articulation(
  p_actor_internal_user_id uuid
)
returns boolean
language sql
stable
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
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

        and (
          role.is_administrative = true

          or (
            role.code in (
              'validator',
              'articulator'
            )

            and scope.scope_type = 'global'
          )
        )
    );
$function$;


create or replace function
mp25m_api.can_manage_articulation(
  p_actor_internal_user_id uuid,
  p_articulation_id uuid
)
returns boolean
language sql
stable
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
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
      from mp25m.opportunity_articulations articulation
      where articulation.id = p_articulation_id
    )

    and (
      exists (
        select 1
        from mp25m.opportunity_articulations articulation
        where articulation.id = p_articulation_id
          and articulation.responsible_internal_user_id =
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

          and role.is_active = true
          and role.deleted_at is null

          and scope.is_active = true
          and scope.deleted_at is null

          and (
            role.is_administrative = true

            or (
              role.code in (
                'validator',
                'articulator'
              )

              and (
                scope.scope_type = 'global'

                or (
                  scope.scope_type = 'node'

                  and exists (
                    select 1
                    from mp25m.articulation_opportunities
                      articulation_opportunity

                    join mp25m.opportunity_nodes
                      opportunity_node
                      on opportunity_node.opportunity_id =
                        articulation_opportunity.opportunity_id

                    where
                      articulation_opportunity.articulation_id =
                        p_articulation_id

                      and opportunity_node.node_id =
                        scope.scope_entity_id
                  )
                )
              )
            )
          )
      )
    );
$function$;


-- ============================================================
-- Crear articulación autónoma
-- ============================================================

create or replace function
mp25m_api.create_articulation(
  p_actor_internal_user_id uuid,
  p_title text,
  p_objective text,
  p_responsible_internal_user_id uuid default null
)
returns table (
  articulation_id uuid,
  created_at timestamptz
)
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
declare
  v_articulation_id uuid;
  v_created_at timestamptz;
begin
  if
    char_length(
      btrim(coalesce(p_title, ''))
    ) not between 3 and 200

    or char_length(
      btrim(coalesce(p_objective, ''))
    ) not between 3 and 10000
  then
    raise exception
      'Invalid articulation title or objective'
      using errcode = '22023';
  end if;

  if not mp25m_api.can_create_articulation(
    p_actor_internal_user_id
  ) then
    raise exception
      'Internal user cannot create articulations'
      using errcode = '42501';
  end if;

  insert into mp25m.opportunity_articulations (
    opportunity_id,
    title,
    objective,
    status,
    responsible_internal_user_id,
    created_by_internal_user_id
  )
  values (
    null,
    btrim(p_title),
    btrim(p_objective),
    'draft',
    p_responsible_internal_user_id,
    p_actor_internal_user_id
  )
  returning
    id,
    mp25m.opportunity_articulations.created_at
  into
    v_articulation_id,
    v_created_at;

  insert into mp25m.opportunity_articulation_status_history (
    articulation_id,
    transition_no,
    status,
    rationale,
    responsible_internal_user_id,
    changed_by_internal_user_id,
    changed_at
  )
  values (
    v_articulation_id,
    1,
    'draft',
    btrim(p_objective),
    p_responsible_internal_user_id,
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
    'opportunity.articulation.create',
    'mp25m',
    'opportunity_articulations',
    v_articulation_id,
    btrim(p_objective),

    jsonb_build_object(
      'title',
      btrim(p_title),
      'status',
      'draft',
      'responsible_internal_user_id',
      p_responsible_internal_user_id
    ),

    'allowed',

    jsonb_build_object(
      'autonomous',
      true
    )
  );

  articulation_id := v_articulation_id;
  created_at := v_created_at;

  return next;
end;
$function$;


-- ============================================================
-- Crear articulación desde una oportunidad
-- ============================================================

create or replace function
mp25m_api.create_opportunity_articulation(
  p_actor_internal_user_id uuid,
  p_opportunity_id uuid,
  p_title text,
  p_objective text,
  p_responsible_internal_user_id uuid default null
)
returns table (
  articulation_id uuid,
  created_at timestamptz
)
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
declare
  v_articulation_id uuid;
  v_created_at timestamptz;
begin
  if
    char_length(
      btrim(coalesce(p_title, ''))
    ) not between 3 and 200

    or char_length(
      btrim(coalesce(p_objective, ''))
    ) not between 3 and 10000
  then
    raise exception
      'Invalid opportunity articulation title or objective'
      using errcode = '22023';
  end if;

  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    p_opportunity_id,
    'formulate'
  ) then
    raise exception
      'Internal user cannot create this opportunity articulation'
      using errcode = '42501';
  end if;

  insert into mp25m.opportunity_articulations (
    opportunity_id,
    title,
    objective,
    status,
    responsible_internal_user_id,
    created_by_internal_user_id
  )
  values (
    p_opportunity_id,
    btrim(p_title),
    btrim(p_objective),
    'draft',
    p_responsible_internal_user_id,
    p_actor_internal_user_id
  )
  returning
    id,
    mp25m.opportunity_articulations.created_at
  into
    v_articulation_id,
    v_created_at;

  insert into mp25m.articulation_opportunities (
    articulation_id,
    opportunity_id,
    relation_type,
    relationship_note,
    added_by_internal_user_id,
    added_at
  )
  values (
    v_articulation_id,
    p_opportunity_id,
    'origin',
    'Articulación creada desde esta oportunidad.',
    p_actor_internal_user_id,
    v_created_at
  );

  insert into mp25m.opportunity_articulation_status_history (
    articulation_id,
    transition_no,
    status,
    rationale,
    responsible_internal_user_id,
    changed_by_internal_user_id,
    changed_at
  )
  values (
    v_articulation_id,
    1,
    'draft',
    btrim(p_objective),
    p_responsible_internal_user_id,
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
    'opportunity.articulation.create',
    'mp25m',
    'opportunity_articulations',
    v_articulation_id,
    btrim(p_objective),

    jsonb_build_object(
      'title',
      btrim(p_title),
      'status',
      'draft',
      'responsible_internal_user_id',
      p_responsible_internal_user_id
    ),

    'allowed',

    jsonb_build_object(
      'opportunity_id',
      p_opportunity_id,
      'created_from_opportunity',
      true
    )
  );

  articulation_id := v_articulation_id;
  created_at := v_created_at;

  return next;
end;
$function$;


-- ============================================================
-- Vincular articulación con oportunidad
-- ============================================================

create or replace function
mp25m_api.link_articulation_opportunity(
  p_actor_internal_user_id uuid,
  p_articulation_id uuid,
  p_opportunity_id uuid,
  p_relation_type text default 'related',
  p_relationship_note text default null
)
returns void
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
begin
  if p_relation_type not in (
    'origin',
    'context',
    'related'
  ) then
    raise exception
      'Invalid articulation opportunity relation type'
      using errcode = '22023';
  end if;

  if not mp25m_api.can_manage_articulation(
    p_actor_internal_user_id,
    p_articulation_id
  ) then
    raise exception
      'Internal user cannot update this articulation'
      using errcode = '42501';
  end if;

  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    p_opportunity_id,
    'formulate'
  ) then
    raise exception
      'Internal user cannot link this opportunity'
      using errcode = '42501';
  end if;

  insert into mp25m.articulation_opportunities (
    articulation_id,
    opportunity_id,
    relation_type,
    relationship_note,
    added_by_internal_user_id
  )
  values (
    p_articulation_id,
    p_opportunity_id,
    p_relation_type,

    nullif(
      btrim(
        coalesce(
          p_relationship_note,
          ''
        )
      ),
      ''
    ),

    p_actor_internal_user_id
  )
  on conflict (
    articulation_id,
    opportunity_id
  )
  do update
  set
    relation_type =
      excluded.relation_type,

    relationship_note =
      excluded.relationship_note;

  update mp25m.opportunity_articulations
  set
    opportunity_id =
      coalesce(
        opportunity_id,
        p_opportunity_id
      ),

    updated_at =
      now()

  where id =
    p_articulation_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'articulation.opportunity.link',
    'mp25m',
    'opportunity_articulations',
    p_articulation_id,

    nullif(
      btrim(
        coalesce(
          p_relationship_note,
          ''
        )
      ),
      ''
    ),

    'allowed',

    jsonb_build_object(
      'opportunity_id',
      p_opportunity_id,
      'relation_type',
      p_relation_type
    )
  );
end;
$function$;


-- ============================================================
-- Desvincular articulación de oportunidad
-- ============================================================

create or replace function
mp25m_api.unlink_articulation_opportunity(
  p_actor_internal_user_id uuid,
  p_articulation_id uuid,
  p_opportunity_id uuid,
  p_rationale text
)
returns void
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
begin
  if char_length(
    btrim(
      coalesce(
        p_rationale,
        ''
      )
    )
  ) not between 3 and 10000 then
    raise exception
      'Invalid unlink rationale'
      using errcode = '22023';
  end if;

  if not mp25m_api.can_manage_articulation(
    p_actor_internal_user_id,
    p_articulation_id
  ) then
    raise exception
      'Internal user cannot update this articulation'
      using errcode = '42501';
  end if;

  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    p_opportunity_id,
    'formulate'
  ) then
    raise exception
      'Internal user cannot unlink this opportunity'
      using errcode = '42501';
  end if;

  delete from mp25m.articulation_opportunities
  where articulation_id =
      p_articulation_id
    and opportunity_id =
      p_opportunity_id;

  if not found then
    raise exception
      'Articulation opportunity link not found'
      using errcode = 'P0002';
  end if;

  update mp25m.opportunity_articulations
  set
    opportunity_id = (
      select link.opportunity_id
      from mp25m.articulation_opportunities link

      where link.articulation_id =
        p_articulation_id

      order by
        link.added_at,
        link.id

      limit 1
    ),

    updated_at =
      now()

  where id =
    p_articulation_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'articulation.opportunity.unlink',
    'mp25m',
    'opportunity_articulations',
    p_articulation_id,
    btrim(p_rationale),
    'allowed',

    jsonb_build_object(
      'opportunity_id',
      p_opportunity_id
    )
  );
end;
$function$;


-- ============================================================
-- Ciclo de vida propio de articulación
-- ============================================================

create or replace function
mp25m_api.transition_opportunity_articulation(
  p_actor_internal_user_id uuid,
  p_articulation_id uuid,
  p_status text,
  p_rationale text,
  p_responsible_internal_user_id uuid default null,
  p_closing_summary text default null
)
returns table (
  articulation_id uuid,
  transition_no integer,
  changed_at timestamptz
)
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
declare
  v_articulation
    mp25m.opportunity_articulations%rowtype;

  v_transition_no integer;
  v_changed_at timestamptz;
begin
  if
    p_status not in (
      'draft',
      'active',
      'follow_up',
      'paused',
      'closed_with_result',
      'closed_without_result',
      'cancelled'
    )

    or char_length(
      btrim(
        coalesce(
          p_rationale,
          ''
        )
      )
    ) not between 3 and 10000
  then
    raise exception
      'Invalid opportunity articulation transition'
      using errcode = '22023';
  end if;

  select *
  into v_articulation
  from mp25m.opportunity_articulations
  where id =
    p_articulation_id
  for update;

  if not found then
    raise exception
      'Opportunity articulation not found'
      using errcode = 'P0002';
  end if;

  if not mp25m_api.can_manage_articulation(
    p_actor_internal_user_id,
    p_articulation_id
  ) then
    raise exception
      'Internal user cannot update this opportunity articulation'
      using errcode = '42501';
  end if;

  if
    p_status = 'active'
    and p_responsible_internal_user_id
      is null
  then
    raise exception
      'Activating an opportunity articulation requires a responsible user'
      using errcode = '22023';
  end if;

  if
    p_status in (
      'closed_with_result',
      'closed_without_result'
    )

    and (
      p_responsible_internal_user_id
        is null

      or char_length(
        btrim(
          coalesce(
            p_closing_summary,
            ''
          )
        )
      ) not between 3 and 10000
    )
  then
    raise exception
      'Closing an opportunity articulation requires a responsible user and summary'
      using errcode = '22023';
  end if;

  select
    coalesce(
      max(history.transition_no),
      0
    ) + 1
  into
    v_transition_no

  from mp25m.opportunity_articulation_status_history history

  where history.articulation_id =
    p_articulation_id;

  update mp25m.opportunity_articulations
  set
    status =
      p_status,

    responsible_internal_user_id =
      p_responsible_internal_user_id,

    closing_summary =
      case
        when p_status in (
          'closed_with_result',
          'closed_without_result'
        )
        then btrim(p_closing_summary)
        else null
      end,

    closed_at =
      case
        when p_status in (
          'closed_with_result',
          'closed_without_result'
        )
        then now()
        else null
      end,

    updated_at =
      now()

  where id =
    p_articulation_id

  returning
    updated_at
  into
    v_changed_at;

  insert into mp25m.opportunity_articulation_status_history (
    articulation_id,
    transition_no,
    status,
    rationale,
    responsible_internal_user_id,
    changed_by_internal_user_id,
    changed_at
  )
  values (
    p_articulation_id,
    v_transition_no,
    p_status,
    btrim(p_rationale),
    p_responsible_internal_user_id,
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
    'opportunity.articulation.transition',
    'mp25m',
    'opportunity_articulations',
    p_articulation_id,
    btrim(p_rationale),

    jsonb_build_object(
      'status',
      v_articulation.status,

      'responsible_internal_user_id',
      v_articulation.responsible_internal_user_id
    ),

    jsonb_build_object(
      'status',
      p_status,

      'responsible_internal_user_id',
      p_responsible_internal_user_id
    ),

    'allowed',

    jsonb_build_object(
      'transition_no',
      v_transition_no
    )
  );

  articulation_id :=
    p_articulation_id;

  transition_no :=
    v_transition_no;

  changed_at :=
    v_changed_at;

  return next;
end;
$function$;


-- ============================================================
-- Participantes propios de articulación
-- ============================================================

create or replace function
mp25m_api.add_opportunity_articulation_participant(
  p_actor_internal_user_id uuid,
  p_articulation_id uuid,
  p_person_id uuid default null,
  p_organization_id uuid default null,
  p_rationale text default null
)
returns uuid
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
declare
  v_participant_id uuid;
begin
  if
    (
      p_person_id is not null
    )::integer

    +

    (
      p_organization_id is not null
    )::integer

    <> 1

    or char_length(
      btrim(
        coalesce(
          p_rationale,
          ''
        )
      )
    ) not between 3 and 10000
  then
    raise exception
      'Invalid opportunity articulation participant'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from mp25m.opportunity_articulations articulation
    where articulation.id =
      p_articulation_id
  ) then
    raise exception
      'Opportunity articulation not found'
      using errcode = 'P0002';
  end if;

  if not mp25m_api.can_manage_articulation(
    p_actor_internal_user_id,
    p_articulation_id
  ) then
    raise exception
      'Internal user cannot add this opportunity articulation participant'
      using errcode = '42501';
  end if;

  if
    p_person_id is not null

    and not exists (
      select 1
      from mp25m.persons person
      where person.id =
          p_person_id

        and person.record_status =
          'active'
    )
  then
    raise exception
      'Invalid or inactive articulation person participant'
      using errcode = '23503';
  end if;

  if
    p_organization_id is not null

    and not exists (
      select 1
      from mp25m.organizations organization
      where organization.id =
          p_organization_id

        and organization.record_status =
          'active'
    )
  then
    raise exception
      'Invalid or inactive articulation organization participant'
      using errcode = '23503';
  end if;

  insert into mp25m.opportunity_articulation_participants (
    articulation_id,
    person_id,
    organization_id,
    rationale,
    added_by_internal_user_id
  )
  values (
    p_articulation_id,
    p_person_id,
    p_organization_id,
    btrim(p_rationale),
    p_actor_internal_user_id
  )
  returning
    id
  into
    v_participant_id;

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
    'opportunity.articulation.participant.add',
    'mp25m',
    'opportunity_articulation_participants',
    v_participant_id,
    btrim(p_rationale),

    jsonb_build_object(
      'person_id',
      p_person_id,

      'organization_id',
      p_organization_id
    ),

    'allowed',

    jsonb_build_object(
      'articulation_id',
      p_articulation_id
    )
  );

  return
    v_participant_id;
end;
$function$;


create or replace function
mp25m_api.remove_opportunity_articulation_participant(
  p_actor_internal_user_id uuid,
  p_participant_id uuid,
  p_rationale text
)
returns uuid
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
declare
  v_participant
    mp25m.opportunity_articulation_participants%rowtype;
begin
  if char_length(
    btrim(
      coalesce(
        p_rationale,
        ''
      )
    )
  ) not between 3 and 10000 then
    raise exception
      'Invalid opportunity articulation participant removal'
      using errcode = '22023';
  end if;

  select
    participant.*
  into
    v_participant
  from mp25m.opportunity_articulation_participants participant
  where participant.id =
      p_participant_id
    and participant.removed_at
      is null
  for update of participant;

  if not found then
    raise exception
      'Active opportunity articulation participant not found'
      using errcode = 'P0002';
  end if;

  if not mp25m_api.can_manage_articulation(
    p_actor_internal_user_id,
    v_participant.articulation_id
  ) then
    raise exception
      'Internal user cannot remove this opportunity articulation participant'
      using errcode = '42501';
  end if;

  update mp25m.opportunity_articulation_participants
  set
    removed_at =
      now(),

    removed_by_internal_user_id =
      p_actor_internal_user_id,

    removal_rationale =
      btrim(p_rationale)

  where id =
    p_participant_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'opportunity.articulation.participant.remove',
    'mp25m',
    'opportunity_articulation_participants',
    p_participant_id,
    btrim(p_rationale),

    jsonb_build_object(
      'person_id',
      v_participant.person_id,

      'organization_id',
      v_participant.organization_id
    ),

    'allowed',

    jsonb_build_object(
      'articulation_id',
      v_participant.articulation_id
    )
  );

  return
    p_participant_id;
end;
$function$;


-- ============================================================
-- Seguimiento propio de articulación
-- ============================================================

create or replace function
mp25m_api.create_opportunity_articulation_followup(
  p_actor_internal_user_id uuid,
  p_articulation_id uuid,
  p_followup_type text,
  p_detail text
)
returns uuid
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
declare
  v_followup_id uuid;
begin
  if
    p_followup_type not in (
      'general',
      'meeting',
      'commitment',
      'contact',
      'result'
    )

    or char_length(
      btrim(
        coalesce(
          p_detail,
          ''
        )
      )
    ) not between 3 and 10000
  then
    raise exception
      'Invalid opportunity articulation followup'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from mp25m.opportunity_articulations articulation
    where articulation.id =
      p_articulation_id
  ) then
    raise exception
      'Opportunity articulation not found'
      using errcode = 'P0002';
  end if;

  if not mp25m_api.can_manage_articulation(
    p_actor_internal_user_id,
    p_articulation_id
  ) then
    raise exception
      'Internal user cannot create this opportunity articulation followup'
      using errcode = '42501';
  end if;

  insert into mp25m.opportunity_articulation_followups (
    articulation_id,
    followup_type,
    detail,
    created_by_internal_user_id
  )
  values (
    p_articulation_id,
    p_followup_type,
    btrim(p_detail),
    p_actor_internal_user_id
  )
  returning
    id
  into
    v_followup_id;

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
    'opportunity.articulation.followup.create',
    'mp25m',
    'opportunity_articulation_followups',
    v_followup_id,
    btrim(p_detail),

    jsonb_build_object(
      'followup_type',
      p_followup_type
    ),

    'allowed',

    jsonb_build_object(
      'articulation_id',
      p_articulation_id
    )
  );

  return
    v_followup_id;
end;
$function$;


-- ============================================================
-- Vista Articulación <-> Oportunidad
-- ============================================================

create or replace view
mp25m_api.articulation_opportunity_link_list
as
select
  link.id
    as link_id,

  link.articulation_id,
  link.opportunity_id,

  opportunity.title
    as opportunity_title,

  opportunity.status
    as opportunity_status,

  link.relation_type,
  link.relationship_note,
  link.added_at,

  added_by.display_name
    as added_by_display_name

from mp25m.articulation_opportunities link

join mp25m.opportunities opportunity
  on opportunity.id =
    link.opportunity_id

join mp25m.internal_users added_by
  on added_by.id =
    link.added_by_internal_user_id;


-- ============================================================
-- Proyecto <-> Articulación
-- ============================================================

create or replace function
mp25m_api.can_manage_project(
  p_actor_internal_user_id uuid,
  p_project_id uuid
)
returns boolean
language sql
stable
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
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
      from mp25m.projects project
      where project.id = p_project_id
    )

    and (
      exists (
        select 1
        from mp25m.projects project
        where project.id = p_project_id
          and project.responsible_internal_user_id =
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

          and role.is_active = true
          and role.deleted_at is null

          and scope.is_active = true
          and scope.deleted_at is null

          and (
            role.is_administrative = true

            or (
              role.code in (
                'validator',
                'articulator'
              )

              and (
                scope.scope_type = 'global'

                or (
                  scope.scope_type = 'node'

                  and (
                    exists (
                      select 1
                      from mp25m.project_opportunities
                        project_opportunity

                      join mp25m.opportunity_nodes
                        opportunity_node
                        on opportunity_node.opportunity_id =
                          project_opportunity.opportunity_id

                      where project_opportunity.project_id =
                          p_project_id

                        and opportunity_node.node_id =
                          scope.scope_entity_id
                    )

                    or exists (
                      select 1
                      from mp25m.project_articulations
                        project_articulation

                      join mp25m.articulation_opportunities
                        articulation_opportunity
                        on articulation_opportunity.articulation_id =
                          project_articulation.articulation_id

                      join mp25m.opportunity_nodes
                        opportunity_node
                        on opportunity_node.opportunity_id =
                          articulation_opportunity.opportunity_id

                      where project_articulation.project_id =
                          p_project_id

                        and opportunity_node.node_id =
                          scope.scope_entity_id
                    )
                  )
                )
              )
            )
          )
      )
    );
$function$;


create or replace function
mp25m_api.link_project_articulation(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_articulation_id uuid,
  p_relation_type text default 'related',
  p_relationship_note text default null
)
returns void
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
begin
  if p_relation_type not in (
    'origin',
    'context',
    'coordination',
    'resource',
    'related'
  ) then
    raise exception
      'Invalid project articulation relation type'
      using errcode = '22023';
  end if;

  if not mp25m_api.can_manage_project(
    p_actor_internal_user_id,
    p_project_id
  ) then
    raise exception
      'Internal user cannot update this project'
      using errcode = '42501';
  end if;

  if not mp25m_api.can_manage_articulation(
    p_actor_internal_user_id,
    p_articulation_id
  ) then
    raise exception
      'Internal user cannot link this articulation'
      using errcode = '42501';
  end if;

  insert into mp25m.project_articulations (
    project_id,
    articulation_id,
    relation_type,
    relationship_note,
    added_by_internal_user_id
  )
  values (
    p_project_id,
    p_articulation_id,
    p_relation_type,

    nullif(
      btrim(
        coalesce(
          p_relationship_note,
          ''
        )
      ),
      ''
    ),

    p_actor_internal_user_id
  )
  on conflict (
    project_id,
    articulation_id
  )
  do update
  set
    relation_type =
      excluded.relation_type,

    relationship_note =
      excluded.relationship_note;

  update mp25m.projects
  set
    source_articulation_id =
      coalesce(
        source_articulation_id,
        p_articulation_id
      ),

    updated_at =
      now()

  where id =
    p_project_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'project.articulation.link',
    'mp25m',
    'projects',
    p_project_id,

    nullif(
      btrim(
        coalesce(
          p_relationship_note,
          ''
        )
      ),
      ''
    ),

    'allowed',

    jsonb_build_object(
      'articulation_id',
      p_articulation_id,

      'relation_type',
      p_relation_type
    )
  );
end;
$function$;


create or replace function
mp25m_api.unlink_project_articulation(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_articulation_id uuid,
  p_rationale text
)
returns void
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
begin
  if char_length(
    btrim(
      coalesce(
        p_rationale,
        ''
      )
    )
  ) not between 3 and 10000 then
    raise exception
      'Invalid unlink rationale'
      using errcode = '22023';
  end if;

  if not mp25m_api.can_manage_project(
    p_actor_internal_user_id,
    p_project_id
  ) then
    raise exception
      'Internal user cannot update this project'
      using errcode = '42501';
  end if;

  delete from mp25m.project_articulations
  where project_id =
      p_project_id
    and articulation_id =
      p_articulation_id;

  if not found then
    raise exception
      'Project articulation link not found'
      using errcode = 'P0002';
  end if;

  update mp25m.projects project
  set
    source_articulation_id = (
      select
        link.articulation_id
      from mp25m.project_articulations link
      where link.project_id =
        p_project_id
      order by
        link.added_at,
        link.id
      limit 1
    ),

    opportunity_id = (
      select
        link.opportunity_id
      from mp25m.project_opportunities link
      where link.project_id =
        p_project_id
      order by
        link.added_at,
        link.id
      limit 1
    ),

    updated_at =
      now()

  where project.id =
    p_project_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'project.articulation.unlink',
    'mp25m',
    'projects',
    p_project_id,
    btrim(p_rationale),
    'allowed',

    jsonb_build_object(
      'articulation_id',
      p_articulation_id
    )
  );
end;
$function$;


create or replace function
mp25m_api.create_project_from_articulation(
  p_actor_internal_user_id uuid,
  p_source_articulation_id uuid,
  p_title text,
  p_objective text,
  p_responsible_internal_user_id uuid default null
)
returns table (
  project_id uuid,
  created_at timestamptz
)
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
declare
  v_project_id uuid;
  v_created_at timestamptz;
begin
  if
    char_length(
      btrim(
        coalesce(
          p_title,
          ''
        )
      )
    ) not between 3 and 200

    or char_length(
      btrim(
        coalesce(
          p_objective,
          ''
        )
      )
    ) not between 3 and 10000
  then
    raise exception
      'Invalid project title or objective'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from mp25m.opportunity_articulations articulation
    where articulation.id =
      p_source_articulation_id
  ) then
    raise exception
      'Articulation not found'
      using errcode = 'P0002';
  end if;

  if not (
    mp25m_api.can_create_project(
      p_actor_internal_user_id
    )

    or mp25m_api.can_manage_articulation(
      p_actor_internal_user_id,
      p_source_articulation_id
    )
  ) then
    raise exception
      'Internal user cannot create this project'
      using errcode = '42501';
  end if;

  insert into mp25m.projects (
    opportunity_id,
    source_articulation_id,
    title,
    objective,
    responsible_internal_user_id,
    created_by_internal_user_id
  )
  values (
    null,
    p_source_articulation_id,
    btrim(p_title),
    btrim(p_objective),
    p_responsible_internal_user_id,
    p_actor_internal_user_id
  )
  returning
    id,
    mp25m.projects.created_at
  into
    v_project_id,
    v_created_at;

  insert into mp25m.project_articulations (
    project_id,
    articulation_id,
    relation_type,
    relationship_note,
    added_by_internal_user_id,
    added_at
  )
  values (
    v_project_id,
    p_source_articulation_id,
    'origin',
    'Articulación vinculada al crear el proyecto.',
    p_actor_internal_user_id,
    v_created_at
  );

  insert into mp25m.project_status_history (
    project_id,
    transition_no,
    status,
    rationale,
    responsible_internal_user_id,
    changed_by_internal_user_id,
    changed_at
  )
  values (
    v_project_id,
    1,
    'draft',
    btrim(p_objective),
    p_responsible_internal_user_id,
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
    'project.create',
    'mp25m',
    'projects',
    v_project_id,
    btrim(p_objective),

    jsonb_build_object(
      'title',
      btrim(p_title),

      'status',
      'draft'
    ),

    'allowed',

    jsonb_build_object(
      'source_articulation_id',
      p_source_articulation_id
    )
  );

  project_id :=
    v_project_id;

  created_at :=
    v_created_at;

  return next;
end;
$function$;


-- ============================================================
-- Vistas de proyecto compatibles con articulaciones autónomas
-- ============================================================

create or replace view
mp25m_api.project_articulation_link_list
as
select
  link.id
    as link_id,

  link.project_id,
  link.articulation_id,

  articulation.title
    as articulation_title,

  articulation.status
    as articulation_status,

  articulation.opportunity_id,

  opportunity.title
    as opportunity_title,

  link.relation_type,
  link.relationship_note,
  link.added_at,

  added_by.display_name
    as added_by_display_name

from mp25m.project_articulations link

join mp25m.opportunity_articulations articulation
  on articulation.id =
    link.articulation_id

left join mp25m.opportunities opportunity
  on opportunity.id =
    articulation.opportunity_id

join mp25m.internal_users added_by
  on added_by.id =
    link.added_by_internal_user_id;


create or replace view
mp25m_api.project_source_articulation_list
as
select
  articulation.id
    as articulation_id,

  articulation.opportunity_id,

  opportunity.title
    as opportunity_title,

  articulation.title
    as articulation_title,

  articulation.objective
    as articulation_objective,

  articulation.closing_summary,
  articulation.closed_at,

  first_project.project_id

from mp25m.opportunity_articulations articulation

left join mp25m.opportunities opportunity
  on opportunity.id =
    articulation.opportunity_id

left join lateral (
  select
    link.project_id

  from mp25m.project_articulations link

  where link.articulation_id =
    articulation.id

  order by
    link.added_at,
    link.id

  limit 1
) first_project
  on true;


-- ============================================================
-- Permisos explícitos
-- ============================================================

revoke all
  on function mp25m_api.can_create_articulation(uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.can_create_articulation(uuid)
  to service_role;


revoke all
  on function mp25m_api.can_manage_articulation(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.can_manage_articulation(uuid, uuid)
  to service_role;


revoke all
  on function mp25m_api.create_articulation(
    uuid,
    text,
    text,
    uuid
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.create_articulation(
    uuid,
    text,
    text,
    uuid
  )
  to service_role;


revoke all
  on function mp25m_api.create_opportunity_articulation(
    uuid,
    uuid,
    text,
    text,
    uuid
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.create_opportunity_articulation(
    uuid,
    uuid,
    text,
    text,
    uuid
  )
  to service_role;


revoke all
  on function mp25m_api.link_articulation_opportunity(
    uuid,
    uuid,
    uuid,
    text,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.link_articulation_opportunity(
    uuid,
    uuid,
    uuid,
    text,
    text
  )
  to service_role;


revoke all
  on function mp25m_api.unlink_articulation_opportunity(
    uuid,
    uuid,
    uuid,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.unlink_articulation_opportunity(
    uuid,
    uuid,
    uuid,
    text
  )
  to service_role;


revoke all
  on function mp25m_api.transition_opportunity_articulation(
    uuid,
    uuid,
    text,
    text,
    uuid,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.transition_opportunity_articulation(
    uuid,
    uuid,
    text,
    text,
    uuid,
    text
  )
  to service_role;


revoke all
  on function mp25m_api.add_opportunity_articulation_participant(
    uuid,
    uuid,
    uuid,
    uuid,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.add_opportunity_articulation_participant(
    uuid,
    uuid,
    uuid,
    uuid,
    text
  )
  to service_role;


revoke all
  on function mp25m_api.remove_opportunity_articulation_participant(
    uuid,
    uuid,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.remove_opportunity_articulation_participant(
    uuid,
    uuid,
    text
  )
  to service_role;


revoke all
  on function mp25m_api.create_opportunity_articulation_followup(
    uuid,
    uuid,
    text,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.create_opportunity_articulation_followup(
    uuid,
    uuid,
    text,
    text
  )
  to service_role;


revoke all
  on function mp25m_api.can_manage_project(
    uuid,
    uuid
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.can_manage_project(
    uuid,
    uuid
  )
  to service_role;


revoke all
  on function mp25m_api.link_project_articulation(
    uuid,
    uuid,
    uuid,
    text,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.link_project_articulation(
    uuid,
    uuid,
    uuid,
    text,
    text
  )
  to service_role;


revoke all
  on function mp25m_api.unlink_project_articulation(
    uuid,
    uuid,
    uuid,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.unlink_project_articulation(
    uuid,
    uuid,
    uuid,
    text
  )
  to service_role;


revoke all
  on function mp25m_api.create_project_from_articulation(
    uuid,
    uuid,
    text,
    text,
    uuid
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.create_project_from_articulation(
    uuid,
    uuid,
    text,
    text,
    uuid
  )
  to service_role;


revoke all
  on table mp25m_api.articulation_opportunity_link_list
  from public, anon, authenticated, service_role;

grant select
  on table mp25m_api.articulation_opportunity_link_list
  to service_role;


commit;