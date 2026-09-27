begin;

-- ============================================================
-- PROYECTOS AUTÓNOMOS
--
-- Un proyecto puede existir por sí mismo.
-- Oportunidades y articulaciones pasan a ser vínculos opcionales.
--
-- Las columnas opportunity_id y source_articulation_id se
-- conservan temporalmente como referencias primarias/legacy
-- para no romper consumidores existentes durante la transición.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Relaciones N:M
-- ------------------------------------------------------------

create table mp25m.project_opportunities (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references mp25m.projects(id)
    on delete cascade,

  opportunity_id uuid not null
    references mp25m.opportunities(id)
    on delete restrict,

  relation_type text not null default 'related'
    check (
      relation_type in (
        'origin',
        'context',
        'resource',
        'dependency',
        'related'
      )
    ),

  relationship_note text,

  added_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  added_at timestamptz not null default now(),

  unique (project_id, opportunity_id)
);


create table mp25m.project_articulations (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null
    references mp25m.projects(id)
    on delete cascade,

  articulation_id uuid not null
    references mp25m.opportunity_articulations(id)
    on delete restrict,

  relation_type text not null default 'related'
    check (
      relation_type in (
        'origin',
        'context',
        'coordination',
        'resource',
        'related'
      )
    ),

  relationship_note text,

  added_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,

  added_at timestamptz not null default now(),

  unique (project_id, articulation_id)
);


create index project_opportunities_project_idx
  on mp25m.project_opportunities(
    project_id,
    added_at desc
  );

create index project_opportunities_opportunity_idx
  on mp25m.project_opportunities(
    opportunity_id,
    added_at desc
  );

create index project_articulations_project_idx
  on mp25m.project_articulations(
    project_id,
    added_at desc
  );

create index project_articulations_articulation_idx
  on mp25m.project_articulations(
    articulation_id,
    added_at desc
  );


alter table mp25m.project_opportunities
  enable row level security;

alter table mp25m.project_articulations
  enable row level security;


revoke all
  on mp25m.project_opportunities,
     mp25m.project_articulations
  from public, anon, authenticated;

grant
  select, insert, update, delete
  on mp25m.project_opportunities,
     mp25m.project_articulations
  to service_role;


-- ------------------------------------------------------------
-- 2. Preservar cualquier vínculo existente
-- ------------------------------------------------------------

insert into mp25m.project_opportunities (
  project_id,
  opportunity_id,
  relation_type,
  relationship_note,
  added_by_internal_user_id,
  added_at
)
select
  project.id,
  project.opportunity_id,
  'origin',
  'Vínculo migrado desde la referencia original del proyecto.',
  project.created_by_internal_user_id,
  project.created_at
from mp25m.projects project
where project.opportunity_id is not null
on conflict (project_id, opportunity_id)
do nothing;


insert into mp25m.project_articulations (
  project_id,
  articulation_id,
  relation_type,
  relationship_note,
  added_by_internal_user_id,
  added_at
)
select
  project.id,
  project.source_articulation_id,
  'origin',
  'Vínculo migrado desde la articulación de origen del proyecto.',
  project.created_by_internal_user_id,
  project.created_at
from mp25m.projects project
where project.source_articulation_id is not null
on conflict (project_id, articulation_id)
do nothing;


-- ------------------------------------------------------------
-- 3. Las referencias anteriores dejan de ser obligatorias
-- ------------------------------------------------------------

alter table mp25m.projects
  alter column opportunity_id drop not null;

alter table mp25m.projects
  alter column source_articulation_id drop not null;

alter table mp25m.projects
  drop constraint if exists
    projects_source_articulation_id_key;


comment on column mp25m.projects.opportunity_id is
  'Referencia primaria legacy opcional. Los vínculos completos se registran en project_opportunities.';

comment on column mp25m.projects.source_articulation_id is
  'Referencia primaria legacy opcional. Los vínculos completos se registran en project_articulations.';


-- ------------------------------------------------------------
-- 4. Permisos propios de proyectos
-- ------------------------------------------------------------

create or replace function mp25m_api.can_create_project(
  p_actor_internal_user_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
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


create or replace function mp25m_api.can_manage_project(
  p_actor_internal_user_id uuid,
  p_project_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
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

                      join mp25m.opportunity_articulations
                        articulation
                        on articulation.id =
                          project_articulation.articulation_id

                      join mp25m.opportunity_nodes
                        opportunity_node
                        on opportunity_node.opportunity_id =
                          articulation.opportunity_id

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


revoke all
  on function mp25m_api.can_create_project(uuid),
     mp25m_api.can_manage_project(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.can_create_project(uuid),
     mp25m_api.can_manage_project(uuid, uuid)
  to service_role;


-- ------------------------------------------------------------
-- 5. Crear un proyecto autónomo
-- ------------------------------------------------------------

create or replace function mp25m_api.create_project(
  p_actor_internal_user_id uuid,
  p_title text,
  p_objective text,
  p_responsible_internal_user_id uuid default null
)
returns table (
  project_id uuid,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_project_id uuid;
  v_created_at timestamptz;
begin
  if
    char_length(btrim(coalesce(p_title, '')))
      not between 3 and 200

    or char_length(
      btrim(coalesce(p_objective, ''))
    ) not between 3 and 10000
  then
    raise exception
      'Invalid project title or objective'
      using errcode = '22023';
  end if;

  if not mp25m_api.can_create_project(
    p_actor_internal_user_id
  ) then
    raise exception
      'Internal user cannot create projects'
      using errcode = '42501';
  end if;

  insert into mp25m.projects (
    title,
    objective,
    responsible_internal_user_id,
    created_by_internal_user_id
  )
  values (
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
    result
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
    'allowed'
  );

  project_id := v_project_id;
  created_at := v_created_at;

  return next;
end;
$function$;


revoke all
  on function mp25m_api.create_project(
    uuid,
    text,
    text,
    uuid
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.create_project(
    uuid,
    text,
    text,
    uuid
  )
  to service_role;


-- ------------------------------------------------------------
-- 6. Compatibilidad: crear desde cualquier articulación
--
-- Ya NO se exige closed_with_result.
-- Además se crean los vínculos N:M correspondientes.
-- ------------------------------------------------------------

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
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_opportunity_id uuid;
  v_project_id uuid;
  v_created_at timestamptz;
begin
  if
    char_length(btrim(coalesce(p_title, '')))
      not between 3 and 200

    or char_length(
      btrim(coalesce(p_objective, ''))
    ) not between 3 and 10000
  then
    raise exception
      'Invalid project title or objective'
      using errcode = '22023';
  end if;

  select articulation.opportunity_id
  into v_opportunity_id
  from mp25m.opportunity_articulations articulation
  where articulation.id =
    p_source_articulation_id;

  if not found then
    raise exception
      'Articulation not found'
      using errcode = 'P0002';
  end if;

  if not (
    mp25m_api.can_create_project(
      p_actor_internal_user_id
    )

    or mp25m_api.can_operate_opportunity_requirement(
      p_actor_internal_user_id,
      v_opportunity_id,
      'formulate'
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
    v_opportunity_id,
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

  insert into mp25m.project_opportunities (
    project_id,
    opportunity_id,
    relation_type,
    relationship_note,
    added_by_internal_user_id,
    added_at
  )
  values (
    v_project_id,
    v_opportunity_id,
    'origin',
    'Proyecto creado desde una articulación vinculada a esta oportunidad.',
    p_actor_internal_user_id,
    v_created_at
  )
  on conflict (project_id, opportunity_id)
  do nothing;

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
  )
  on conflict (project_id, articulation_id)
  do nothing;

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
      'opportunity_id',
      v_opportunity_id,
      'source_articulation_id',
      p_source_articulation_id
    )
  );

  project_id := v_project_id;
  created_at := v_created_at;

  return next;
end;
$function$;


-- ------------------------------------------------------------
-- 7. Vincular / desvincular oportunidades
-- ------------------------------------------------------------

create or replace function
mp25m_api.link_project_opportunity(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_opportunity_id uuid,
  p_relation_type text default 'related',
  p_relationship_note text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
begin
  if p_relation_type not in (
    'origin',
    'context',
    'resource',
    'dependency',
    'related'
  ) then
    raise exception
      'Invalid project opportunity relation type'
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

  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    p_opportunity_id,
    'formulate'
  ) then
    raise exception
      'Internal user cannot link this opportunity'
      using errcode = '42501';
  end if;

  insert into mp25m.project_opportunities (
    project_id,
    opportunity_id,
    relation_type,
    relationship_note,
    added_by_internal_user_id
  )
  values (
    p_project_id,
    p_opportunity_id,
    p_relation_type,
    nullif(
      btrim(coalesce(p_relationship_note, '')),
      ''
    ),
    p_actor_internal_user_id
  )
  on conflict (project_id, opportunity_id)
  do update
  set
    relation_type = excluded.relation_type,
    relationship_note =
      excluded.relationship_note;

  update mp25m.projects
  set
    opportunity_id =
      coalesce(
        opportunity_id,
        p_opportunity_id
      ),
    updated_at = now()
  where id = p_project_id;

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
    'project.opportunity.link',
    'mp25m',
    'projects',
    p_project_id,
    nullif(
      btrim(coalesce(p_relationship_note, '')),
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


create or replace function
mp25m_api.unlink_project_opportunity(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_opportunity_id uuid,
  p_rationale text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
begin
  if char_length(
    btrim(coalesce(p_rationale, ''))
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

  delete from mp25m.project_opportunities
  where project_id = p_project_id
    and opportunity_id = p_opportunity_id;

  if not found then
    raise exception
      'Project opportunity link not found'
      using errcode = 'P0002';
  end if;

  update mp25m.projects project
  set
    opportunity_id = coalesce(
      (
        select link.opportunity_id
        from mp25m.project_opportunities link
        where link.project_id =
          p_project_id
        order by link.added_at
        limit 1
      ),
      (
        select articulation.opportunity_id
        from mp25m.project_articulations link
        join mp25m.opportunity_articulations
          articulation
          on articulation.id =
            link.articulation_id
        where link.project_id =
          p_project_id
        order by link.added_at
        limit 1
      )
    ),
    updated_at = now()
  where project.id = p_project_id;

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
    'project.opportunity.unlink',
    'mp25m',
    'projects',
    p_project_id,
    btrim(p_rationale),
    'allowed',
    jsonb_build_object(
      'opportunity_id',
      p_opportunity_id
    )
  );
end;
$function$;


-- ------------------------------------------------------------
-- 8. Vincular / desvincular articulaciones
--
-- No hay restricción por estado de la articulación.
-- ------------------------------------------------------------

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
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_opportunity_id uuid;
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

  select articulation.opportunity_id
  into v_opportunity_id
  from mp25m.opportunity_articulations articulation
  where articulation.id =
    p_articulation_id;

  if not found then
    raise exception
      'Articulation not found'
      using errcode = 'P0002';
  end if;

  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    v_opportunity_id,
    'formulate'
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
      btrim(coalesce(p_relationship_note, '')),
      ''
    ),
    p_actor_internal_user_id
  )
  on conflict (project_id, articulation_id)
  do update
  set
    relation_type = excluded.relation_type,
    relationship_note =
      excluded.relationship_note;

  update mp25m.projects
  set
    source_articulation_id =
      coalesce(
        source_articulation_id,
        p_articulation_id
      ),

    opportunity_id =
      coalesce(
        opportunity_id,
        v_opportunity_id
      ),

    updated_at = now()
  where id = p_project_id;

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
      btrim(coalesce(p_relationship_note, '')),
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
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
begin
  if char_length(
    btrim(coalesce(p_rationale, ''))
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
  where project_id = p_project_id
    and articulation_id = p_articulation_id;

  if not found then
    raise exception
      'Project articulation link not found'
      using errcode = 'P0002';
  end if;

  update mp25m.projects project
  set
    source_articulation_id = (
      select link.articulation_id
      from mp25m.project_articulations link
      where link.project_id =
        p_project_id
      order by link.added_at
      limit 1
    ),

    opportunity_id = coalesce(
      (
        select link.opportunity_id
        from mp25m.project_opportunities link
        where link.project_id =
          p_project_id
        order by link.added_at
        limit 1
      ),
      (
        select articulation.opportunity_id
        from mp25m.project_articulations link
        join mp25m.opportunity_articulations
          articulation
          on articulation.id =
            link.articulation_id
        where link.project_id =
          p_project_id
        order by link.added_at
        limit 1
      )
    ),

    updated_at = now()
  where project.id = p_project_id;

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


-- ------------------------------------------------------------
-- 9. Vistas
-- ------------------------------------------------------------

create or replace view mp25m_api.project_list
with (security_invoker = true)
as
select
  project.id as project_id,

  project.opportunity_id,
  opportunity.title as opportunity_title,

  project.source_articulation_id,
  articulation.title as source_articulation_title,

  project.title,
  project.objective,
  project.status,

  project.responsible_internal_user_id,
  responsible.display_name
    as responsible_display_name,

  creator.display_name
    as created_by_display_name,

  project.completion_summary,
  project.created_at,
  project.updated_at,
  project.completed_at,

  latest_followup.detail
    as latest_followup_detail,

  latest_followup.created_at
    as latest_followup_at

from mp25m.projects project

left join mp25m.opportunities opportunity
  on opportunity.id =
    project.opportunity_id

left join mp25m.opportunity_articulations
  articulation
  on articulation.id =
    project.source_articulation_id

join mp25m.internal_users creator
  on creator.id =
    project.created_by_internal_user_id

left join mp25m.internal_users responsible
  on responsible.id =
    project.responsible_internal_user_id

left join lateral (
  select
    followup.detail,
    followup.created_at

  from mp25m.project_followups followup

  where followup.project_id =
    project.id

  order by followup.created_at desc

  limit 1
) latest_followup
  on true;


create or replace view
mp25m_api.project_source_articulation_list
with (security_invoker = true)
as
select
  articulation.id as articulation_id,
  articulation.opportunity_id,
  opportunity.title as opportunity_title,
  articulation.title as articulation_title,
  articulation.objective as articulation_objective,
  articulation.closing_summary,
  articulation.closed_at,

  first_project.project_id

from mp25m.opportunity_articulations articulation

join mp25m.opportunities opportunity
  on opportunity.id =
    articulation.opportunity_id

left join lateral (
  select link.project_id
  from mp25m.project_articulations link
  where link.articulation_id =
    articulation.id
  order by link.added_at
  limit 1
) first_project
  on true;


create or replace view
mp25m_api.project_opportunity_link_list
with (security_invoker = true)
as
select
  link.id as link_id,
  link.project_id,
  link.opportunity_id,
  opportunity.title as opportunity_title,
  opportunity.status as opportunity_status,
  link.relation_type,
  link.relationship_note,
  link.added_at,
  added_by.display_name
    as added_by_display_name

from mp25m.project_opportunities link

join mp25m.opportunities opportunity
  on opportunity.id =
    link.opportunity_id

join mp25m.internal_users added_by
  on added_by.id =
    link.added_by_internal_user_id;


create or replace view
mp25m_api.project_articulation_link_list
with (security_invoker = true)
as
select
  link.id as link_id,
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

join mp25m.opportunities opportunity
  on opportunity.id =
    articulation.opportunity_id

join mp25m.internal_users added_by
  on added_by.id =
    link.added_by_internal_user_id;


-- Los participantes sugeridos provienen ahora de todas las
-- articulaciones vinculadas, no de una única articulación origen.

create or replace view
mp25m_api.project_source_participant_list
with (security_invoker = true)
as
select distinct
  project_articulation.project_id,

  case
    when participant.person_id is not null
      then 'person'
    else 'organization'
  end as participant_type,

  coalesce(
    person.id,
    organization.id
  ) as actor_id,

  coalesce(
    person.display_name,
    organization.name
  ) as display_name

from mp25m.project_articulations
  project_articulation

join mp25m.opportunity_articulation_participants
  participant
  on participant.articulation_id =
    project_articulation.articulation_id
  and participant.removed_at is null

left join mp25m.persons person
  on person.id =
    participant.person_id

left join mp25m.organizations organization
  on organization.id =
    participant.organization_id;


revoke all
  on mp25m_api.project_opportunity_link_list,
     mp25m_api.project_articulation_link_list
  from public, anon, authenticated;

grant select
  on mp25m_api.project_opportunity_link_list,
     mp25m_api.project_articulation_link_list
  to service_role;


-- ------------------------------------------------------------
-- 10. Operaciones normales del proyecto ya no dependen
--     de opportunity_id.
-- ------------------------------------------------------------

create or replace function mp25m_api.transition_project(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_status text,
  p_rationale text,
  p_responsible_internal_user_id uuid default null,
  p_completion_summary text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_transition_no integer;
begin
  if
    p_status not in (
      'draft',
      'active',
      'paused',
      'completed',
      'cancelled'
    )

    or char_length(
      btrim(coalesce(p_rationale, ''))
    ) not between 3 and 10000
  then
    raise exception
      'Invalid project transition'
      using errcode = '22023';
  end if;

  if
    p_status = 'completed'

    and char_length(
      btrim(
        coalesce(
          p_completion_summary,
          ''
        )
      )
    ) not between 3 and 10000
  then
    raise exception
      'A completion summary is required'
      using errcode = '22023';
  end if;

  if
    p_status = 'active'
    and p_responsible_internal_user_id
      is null
  then
    raise exception
      'An active project requires a responsible internal user'
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

  update mp25m.projects
  set
    status = p_status,

    responsible_internal_user_id =
      p_responsible_internal_user_id,

    completion_summary =
      case
        when p_status = 'completed'
          then btrim(p_completion_summary)
        else null
      end,

    completed_at =
      case
        when p_status = 'completed'
          then now()
        else null
      end,

    updated_at = now()

  where id = p_project_id;

  select
    coalesce(max(history.transition_no), 0) + 1
  into v_transition_no
  from mp25m.project_status_history history
  where history.project_id =
    p_project_id;

  insert into mp25m.project_status_history (
    project_id,
    transition_no,
    status,
    rationale,
    responsible_internal_user_id,
    changed_by_internal_user_id
  )
  values (
    p_project_id,
    v_transition_no,
    p_status,
    btrim(p_rationale),
    p_responsible_internal_user_id,
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
    'project.transition',
    'mp25m',
    'projects',
    p_project_id,
    btrim(p_rationale),
    jsonb_build_object(
      'status',
      p_status,
      'responsible_internal_user_id',
      p_responsible_internal_user_id
    ),
    'allowed'
  );
end;
$function$;


create or replace function
mp25m_api.create_project_followup(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_followup_type text,
  p_detail text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
begin
  if
    p_followup_type not in (
      'general',
      'meeting',
      'commitment',
      'progress',
      'result'
    )

    or char_length(
      btrim(coalesce(p_detail, ''))
    ) not between 3 and 10000
  then
    raise exception
      'Invalid project followup'
      using errcode = '22023';
  end if;

  if not mp25m_api.can_manage_project(
    p_actor_internal_user_id,
    p_project_id
  ) then
    raise exception
      'Internal user cannot add this project followup'
      using errcode = '42501';
  end if;

  insert into mp25m.project_followups (
    project_id,
    followup_type,
    detail,
    created_by_internal_user_id
  )
  values (
    p_project_id,
    p_followup_type,
    btrim(p_detail),
    p_actor_internal_user_id
  );

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    result
  )
  values (
    p_actor_internal_user_id,
    'project.followup.create',
    'mp25m',
    'projects',
    p_project_id,
    btrim(p_detail),
    'allowed'
  );
end;
$function$;


create or replace function
mp25m_api.add_project_participant(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_person_id uuid default null,
  p_organization_id uuid default null,
  p_participation_role text default null,
  p_contribution_summary text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
begin
  if
    (
      (p_person_id is not null)::integer
      +
      (p_organization_id is not null)::integer
    ) <> 1

    or char_length(
      btrim(
        coalesce(
          p_participation_role,
          ''
        )
      )
    ) not between 3 and 200

    or char_length(
      btrim(
        coalesce(
          p_contribution_summary,
          ''
        )
      )
    ) not between 3 and 10000
  then
    raise exception
      'Invalid project participant'
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

  if exists (
    select 1
    from mp25m.project_participants participant
    where participant.project_id =
        p_project_id

      and coalesce(
        participant.person_id,
        '00000000-0000-0000-0000-000000000000'::uuid
      ) =
      coalesce(
        p_person_id,
        '00000000-0000-0000-0000-000000000000'::uuid
      )

      and coalesce(
        participant.organization_id,
        '00000000-0000-0000-0000-000000000000'::uuid
      ) =
      coalesce(
        p_organization_id,
        '00000000-0000-0000-0000-000000000000'::uuid
      )

      and participant.removed_at is null
  ) then
    raise exception
      'Participant is already active in this project'
      using errcode = '23505';
  end if;

  insert into mp25m.project_participants (
    project_id,
    person_id,
    organization_id,
    participation_role,
    contribution_summary,
    added_by_internal_user_id
  )
  values (
    p_project_id,
    p_person_id,
    p_organization_id,
    btrim(p_participation_role),
    btrim(p_contribution_summary),
    p_actor_internal_user_id
  );

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    result
  )
  values (
    p_actor_internal_user_id,
    'project.participant.add',
    'mp25m',
    'projects',
    p_project_id,
    btrim(p_contribution_summary),
    'allowed'
  );
end;
$function$;


create or replace function
mp25m_api.remove_project_participant(
  p_actor_internal_user_id uuid,
  p_participant_id uuid,
  p_rationale text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_project_id uuid;
begin
  if char_length(
    btrim(coalesce(p_rationale, ''))
  ) not between 3 and 10000 then
    raise exception
      'Invalid participant removal rationale'
      using errcode = '22023';
  end if;

  select participant.project_id
  into v_project_id
  from mp25m.project_participants participant
  where participant.id =
      p_participant_id
    and participant.removed_at is null
  for update;

  if not found then
    raise exception
      'Active project participant not found'
      using errcode = 'P0002';
  end if;

  if not mp25m_api.can_manage_project(
    p_actor_internal_user_id,
    v_project_id
  ) then
    raise exception
      'Internal user cannot update this project'
      using errcode = '42501';
  end if;

  update mp25m.project_participants
  set
    removed_at = now(),
    removed_by_internal_user_id =
      p_actor_internal_user_id,
    removal_rationale =
      btrim(p_rationale)
  where id = p_participant_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    result
  )
  values (
    p_actor_internal_user_id,
    'project.participant.remove',
    'mp25m',
    'projects',
    v_project_id,
    btrim(p_rationale),
    'allowed'
  );
end;
$function$;


create or replace function
mp25m_api.create_project_deliverable(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_title text,
  p_description text,
  p_responsible_internal_user_id uuid default null,
  p_target_date date default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
begin
  if
    char_length(
      btrim(coalesce(p_title, ''))
    ) not between 3 and 200

    or char_length(
      btrim(coalesce(p_description, ''))
    ) not between 3 and 10000
  then
    raise exception
      'Invalid project deliverable'
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

  insert into mp25m.project_deliverables (
    project_id,
    title,
    description,
    responsible_internal_user_id,
    target_date,
    created_by_internal_user_id
  )
  values (
    p_project_id,
    btrim(p_title),
    btrim(p_description),
    p_responsible_internal_user_id,
    p_target_date,
    p_actor_internal_user_id
  );

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    result
  )
  values (
    p_actor_internal_user_id,
    'project.deliverable.create',
    'mp25m',
    'projects',
    p_project_id,
    btrim(p_description),
    'allowed'
  );
end;
$function$;


create or replace function
mp25m_api.transition_project_deliverable(
  p_actor_internal_user_id uuid,
  p_deliverable_id uuid,
  p_status text,
  p_result_summary text default null,
  p_evidence_reference text default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_project_id uuid;
begin
  if p_status not in (
    'planned',
    'in_progress',
    'delivered',
    'accepted',
    'cancelled'
  ) then
    raise exception
      'Invalid deliverable status'
      using errcode = '22023';
  end if;

  if
    p_status in (
      'delivered',
      'accepted'
    )

    and (
      char_length(
        btrim(
          coalesce(
            p_result_summary,
            ''
          )
        )
      ) not between 3 and 10000

      or char_length(
        btrim(
          coalesce(
            p_evidence_reference,
            ''
          )
        )
      ) not between 3 and 2000
    )
  then
    raise exception
      'Delivered or accepted work requires a result and evidence reference'
      using errcode = '22023';
  end if;

  select deliverable.project_id
  into v_project_id
  from mp25m.project_deliverables deliverable
  where deliverable.id =
    p_deliverable_id
  for update;

  if not found then
    raise exception
      'Project deliverable not found'
      using errcode = 'P0002';
  end if;

  if not mp25m_api.can_manage_project(
    p_actor_internal_user_id,
    v_project_id
  ) then
    raise exception
      'Internal user cannot update this project'
      using errcode = '42501';
  end if;

  update mp25m.project_deliverables
  set
    status = p_status,

    result_summary =
      case
        when p_status in (
          'delivered',
          'accepted'
        )
          then btrim(p_result_summary)
        else null
      end,

    evidence_reference =
      case
        when p_status in (
          'delivered',
          'accepted'
        )
          then btrim(
            p_evidence_reference
          )
        else null
      end,

    completed_at =
      case
        when p_status in (
          'delivered',
          'accepted'
        )
          then now()
        else null
      end,

    updated_at = now()

  where id = p_deliverable_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    result
  )
  values (
    p_actor_internal_user_id,
    'project.deliverable.transition',
    'mp25m',
    'projects',
    v_project_id,
    coalesce(
      nullif(
        btrim(
          coalesce(
            p_result_summary,
            ''
          )
        ),
        ''
      ),
      p_status
    ),
    'allowed'
  );
end;
$function$;


-- ------------------------------------------------------------
-- 11. Permisos de las funciones
-- ------------------------------------------------------------

revoke all
  on function mp25m_api.link_project_opportunity(
       uuid, uuid, uuid, text, text
     ),
     mp25m_api.unlink_project_opportunity(
       uuid, uuid, uuid, text
     ),
     mp25m_api.link_project_articulation(
       uuid, uuid, uuid, text, text
     ),
     mp25m_api.unlink_project_articulation(
       uuid, uuid, uuid, text
     )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.link_project_opportunity(
       uuid, uuid, uuid, text, text
     ),
     mp25m_api.unlink_project_opportunity(
       uuid, uuid, uuid, text
     ),
     mp25m_api.link_project_articulation(
       uuid, uuid, uuid, text, text
     ),
     mp25m_api.unlink_project_articulation(
       uuid, uuid, uuid, text
     )
  to service_role;


-- Las funciones redefinidas conservan sus grants anteriores,
-- pero los explicitamos para dejar el contrato claro.

grant execute
  on function mp25m_api.create_project_from_articulation(
       uuid, uuid, text, text, uuid
     ),
     mp25m_api.transition_project(
       uuid, uuid, text, text, uuid, text
     ),
     mp25m_api.create_project_followup(
       uuid, uuid, text, text
     ),
     mp25m_api.add_project_participant(
       uuid, uuid, uuid, uuid, text, text
     ),
     mp25m_api.remove_project_participant(
       uuid, uuid, text
     ),
     mp25m_api.create_project_deliverable(
       uuid, uuid, text, text, uuid, date
     ),
     mp25m_api.transition_project_deliverable(
       uuid, uuid, text, text, text
     )
  to service_role;


commit;
