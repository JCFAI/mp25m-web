-- Incremento 7A.2 - Escritura gobernada de requerimientos de oportunidad.
--
-- Agrega operaciones server-only para crear, revisar, enviar a validacion,
-- validar/rechazar, retirar y reactivar requerimientos.
--
-- 7A.1 permanece inmutable. No se crean coincidencias, cobertura ni brechas.

begin;


-- ---------------------------------------------------------------------------
-- 1. PRIVILEGIOS SERVER-ONLY
-- ---------------------------------------------------------------------------

revoke all
on table
  mp25m.opportunity_requirements,
  mp25m.opportunity_requirement_revisions
from public, anon, authenticated, service_role;

grant select, insert, update
on table
  mp25m.opportunity_requirements,
  mp25m.opportunity_requirement_revisions
to service_role;

-- DELETE queda deliberadamente sin conceder.


-- ---------------------------------------------------------------------------
-- 2. AUTORIZACION COMUN
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.can_operate_opportunity_requirement(
  p_actor_internal_user_id uuid,
  p_opportunity_id uuid,
  p_operation text
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
    p_operation is not null
    and p_operation in (
      'formulate',
      'validate',
      'lifecycle'
    )

    and exists (
      select 1
      from mp25m.internal_users iu
      where iu.id = p_actor_internal_user_id
        and iu.status = 'active'
        and iu.deleted_at is null
    )

    and exists (
      select 1
      from mp25m.opportunities o
      where o.id = p_opportunity_id
    )

    and (
      -- El responsable explicito puede formular y administrar
      -- retiro/reactivacion, pero nunca validar por ese solo hecho.
      (
        p_operation in (
          'formulate',
          'lifecycle'
        )

        and exists (
          select 1
          from mp25m.opportunities o
          where o.id = p_opportunity_id
            and o.assigned_to_internal_user_id =
              p_actor_internal_user_id
        )

      )

      or

      -- Permisos derivados de roles vigentes.
      exists (
        select 1
        from mp25m.access_role_assignments ara

        join mp25m.access_roles ar
          on ar.code = ara.access_role_code

        join mp25m.access_scopes scope
          on scope.id = ara.access_scope_id

        where ara.internal_user_id =
            p_actor_internal_user_id

          and ara.status = 'active'
          and ara.revoked_at is null
          and ara.valid_from <= now()
          and (
            ara.valid_until is null
            or ara.valid_until > now()
          )

          and ar.is_active = true
          and ar.deleted_at is null

          and scope.is_active = true
          and scope.deleted_at is null

          and (
            -- Un rol administrativo valido conserva autoridad
            -- administrativa independientemente del scope nominal.
            ar.is_administrative = true

            or

            (
              (
                (
                  p_operation = 'formulate'
                  and ar.code in (
                    'validator',
                    'articulator'
                  )
                )

                or (
                  p_operation = 'validate'
                  and ar.code = 'validator'
                )

                or (
                  p_operation = 'lifecycle'
                  and ar.code = 'validator'
                )
              )

              and (
                scope.scope_type = 'global'

                or (
                  scope.scope_type = 'node'

                  and exists (
                    select 1
                    from mp25m.opportunity_nodes opportunity_node
                    where opportunity_node.opportunity_id =
                        p_opportunity_id
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


revoke all
on function mp25m_api.can_operate_opportunity_requirement(
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.can_operate_opportunity_requirement(
  uuid,
  uuid,
  text
)
to service_role;


comment on function
mp25m_api.can_operate_opportunity_requirement(
  uuid,
  uuid,
  text
)
is
  'Server-only authorization helper for governed opportunity requirement operations. Territorial scopes are deliberately not treated as global because no authoritative territorial-to-opportunity resolver exists yet.';


-- ---------------------------------------------------------------------------
-- 3. CREAR REQUERIMIENTO
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.create_opportunity_requirement(
  p_actor_internal_user_id uuid,
  p_opportunity_id uuid,
  p_name text,
  p_description text,
  p_requirement_type text,
  p_is_mandatory boolean,
  p_weight smallint,
  p_satisfaction_criteria text,
  p_skill_id uuid,
  p_activity_id uuid,
  p_conditions jsonb,
  p_provenance_kind text,
  p_source_id uuid,
  p_ingestion_record_id bigint,
  p_source_locator text,
  p_source_excerpt text
)
returns table (
  requirement_id uuid,
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
  v_requirement_id uuid;
  v_revision_id uuid;

  v_name text;
  v_description text;
  v_satisfaction_criteria text;
  v_source_locator text;
  v_source_excerpt text;
  v_conditions jsonb;
begin
  -- La existencia se comprueba por separado de la autorización
  -- para mantener errores de dominio claros en el backoffice.
  if not exists (
    select 1
    from mp25m.opportunities opportunity
    where opportunity.id = p_opportunity_id
  ) then
    raise exception
      'Opportunity not found'
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    p_opportunity_id,
    'formulate'
  ) then
    raise exception
      'Internal user cannot formulate opportunity requirements'
      using errcode = '42501';
  end if;


  v_name :=
    nullif(
      btrim(
        coalesce(
          p_name,
          ''
        )
      ),
      ''
    );

  if v_name is null
     or char_length(v_name) < 3
     or char_length(v_name) > 300
  then
    raise exception
      'Requirement name must contain between 3 and 300 characters'
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
     and char_length(v_description) > 10000
  then
    raise exception
      'Requirement description cannot exceed 10000 characters'
      using errcode = '22023';
  end if;


  if p_requirement_type is null
     or p_requirement_type not in (
    'skill_knowledge',
    'productive_capacity',
    'activity_service',
    'resource_equipment',
    'certification_authorization',
    'scale_volume',
    'location_territory',
    'availability_deadline',
    'language',
    'logistics',
    'financial',
    'administrative_legal',
    'institutional_access',
    'other'
  ) then
    raise exception
      'Invalid opportunity requirement type'
      using errcode = '22023';
  end if;


  if p_is_mandatory is null then
    raise exception
      'Requirement mandatory flag is required'
      using errcode = '22023';
  end if;


  if p_weight is null
     or p_weight < 1
     or p_weight > 5
  then
    raise exception
      'Requirement weight must be between 1 and 5'
      using errcode = '22023';
  end if;


  v_satisfaction_criteria :=
    nullif(
      btrim(
        coalesce(
          p_satisfaction_criteria,
          ''
        )
      ),
      ''
    );

  if v_satisfaction_criteria is not null
     and char_length(v_satisfaction_criteria) > 10000
  then
    raise exception
      'Requirement satisfaction criteria cannot exceed 10000 characters'
      using errcode = '22023';
  end if;


  v_conditions :=
    coalesce(
      p_conditions,
      '{}'::jsonb
    );

  if jsonb_typeof(v_conditions) <> 'object' then
    raise exception
      'Requirement conditions must be a JSON object'
      using errcode = '22023';
  end if;


  -- En 7A.2 estas operaciones representan formulación humana.
  -- system_suggestion queda reservado para un flujo futuro gobernado.
  if p_provenance_kind is null
     or p_provenance_kind not in (
    'human_entry',
    'source_explicit',
    'human_inference'
  ) then
    raise exception
      'Invalid requirement provenance for human formulation'
      using errcode = '22023';
  end if;


  -- Como máximo una referencia canónica por revisión.
  if num_nonnulls(
    p_skill_id,
    p_activity_id
  ) > 1 then
    raise exception
      'A requirement revision may reference at most one canonical item'
      using errcode = '22023';
  end if;


  if p_skill_id is not null then
    if p_requirement_type not in (
      'skill_knowledge',
      'productive_capacity'
    ) then
      raise exception
        'A skill reference is not valid for this requirement type'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from mp25m.skills skill
      where skill.id = p_skill_id
        and skill.active = true
    ) then
      raise exception
        'Skill reference is invalid or inactive'
        using errcode = '23503';
    end if;
  end if;


  if p_activity_id is not null then
    if p_requirement_type <> 'activity_service' then
      raise exception
        'An activity reference is not valid for this requirement type'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from mp25m.activities activity
      where activity.id = p_activity_id
        and activity.active = true
    ) then
      raise exception
        'Activity reference is invalid or inactive'
        using errcode = '23503';
    end if;
  end if;


  if p_source_id is not null
     and not exists (
       select 1
       from mp25m.data_sources source
       where source.id = p_source_id
     )
  then
    raise exception
      'Requirement source does not exist'
      using errcode = '23503';
  end if;


  if p_ingestion_record_id is not null
     and not exists (
       select 1
       from mp25m.ingestion_records ingestion
       where ingestion.id = p_ingestion_record_id
     )
  then
    raise exception
      'Requirement ingestion record does not exist'
      using errcode = '23503';
  end if;


  v_source_locator :=
    nullif(
      btrim(
        coalesce(
          p_source_locator,
          ''
        )
      ),
      ''
    );

  if v_source_locator is not null
     and char_length(v_source_locator) > 2000
  then
    raise exception
      'Requirement source locator cannot exceed 2000 characters'
      using errcode = '22023';
  end if;


  v_source_excerpt :=
    nullif(
      btrim(
        coalesce(
          p_source_excerpt,
          ''
        )
      ),
      ''
    );

  if v_source_excerpt is not null
     and char_length(v_source_excerpt) > 10000
  then
    raise exception
      'Requirement source excerpt cannot exceed 10000 characters'
      using errcode = '22023';
  end if;


  -- Identidad estable.
  insert into mp25m.opportunity_requirements (
    opportunity_id,
    record_status,
    created_by_internal_user_id
  )
  values (
    p_opportunity_id,
    'active',
    p_actor_internal_user_id
  )
  returning id
  into v_requirement_id;


  -- Primera revisión semántica.
  insert into mp25m.opportunity_requirement_revisions (
    requirement_id,
    revision_no,
    name,
    description,
    requirement_type,
    is_mandatory,
    weight,
    satisfaction_criteria,
    skill_id,
    activity_id,
    conditions,
    provenance_kind,
    source_id,
    ingestion_record_id,
    source_locator,
    source_excerpt,
    validation_status,
    submitted_by_internal_user_id,
    submitted_at,
    reviewed_by_internal_user_id,
    reviewed_at,
    review_reason,
    created_by_internal_user_id
  )
  values (
    v_requirement_id,
    1,
    v_name,
    v_description,
    p_requirement_type,
    p_is_mandatory,
    p_weight,
    v_satisfaction_criteria,
    p_skill_id,
    p_activity_id,
    v_conditions,
    p_provenance_kind,
    p_source_id,
    p_ingestion_record_id,
    v_source_locator,
    v_source_excerpt,
    'declared',
    null,
    null,
    null,
    null,
    null,
    p_actor_internal_user_id
  )
  returning id
  into v_revision_id;


  -- Auditoría. El target es la identidad estable.
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
    'opportunity.requirement.create',
    'mp25m',
    'opportunity_requirements',
    v_requirement_id,
    jsonb_build_object(
      'record_status',
        'active',
      'revision_no',
        1,
      'name',
        v_name,
      'requirement_type',
        p_requirement_type,
      'is_mandatory',
        p_is_mandatory,
      'weight',
        p_weight,
      'validation_status',
        'declared'
    ),
    'allowed',
    jsonb_build_object(
      'opportunity_id',
        p_opportunity_id,
      'requirement_id',
        v_requirement_id,
      'revision_id',
        v_revision_id,
      'revision_no',
        1
    )
  );


  requirement_id := v_requirement_id;
  revision_id := v_revision_id;
  revision_no := 1;

  return next;
end;
$function$;


revoke all
on function mp25m_api.create_opportunity_requirement(
  uuid,
  uuid,
  text,
  text,
  text,
  boolean,
  smallint,
  text,
  uuid,
  uuid,
  jsonb,
  text,
  uuid,
  bigint,
  text,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.create_opportunity_requirement(
  uuid,
  uuid,
  text,
  text,
  text,
  boolean,
  smallint,
  text,
  uuid,
  uuid,
  jsonb,
  text,
  uuid,
  bigint,
  text,
  text
)
to service_role;


comment on function
mp25m_api.create_opportunity_requirement(
  uuid,
  uuid,
  text,
  text,
  text,
  boolean,
  smallint,
  text,
  uuid,
  uuid,
  jsonb,
  text,
  uuid,
  bigint,
  text,
  text
)
is
  'Creates one stable opportunity requirement and revision 1 in declared state, with governed authorization and audit history.';


-- ---------------------------------------------------------------------------
-- 4. CREAR NUEVA REVISION
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.revise_opportunity_requirement(
  p_actor_internal_user_id uuid,
  p_requirement_id uuid,
  p_expected_revision_id uuid,
  p_name text,
  p_description text,
  p_requirement_type text,
  p_is_mandatory boolean,
  p_weight smallint,
  p_satisfaction_criteria text,
  p_skill_id uuid,
  p_activity_id uuid,
  p_conditions jsonb,
  p_provenance_kind text,
  p_source_id uuid,
  p_ingestion_record_id bigint,
  p_source_locator text,
  p_source_excerpt text,
  p_reason text
)
returns table (
  requirement_id uuid,
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
  v_requirement
    mp25m.opportunity_requirements%rowtype;

  v_current_revision
    mp25m.opportunity_requirement_revisions%rowtype;

  v_opportunity_id uuid;
  v_revision_id uuid;
  v_revision_no integer;

  v_name text;
  v_description text;
  v_satisfaction_criteria text;
  v_source_locator text;
  v_source_excerpt text;
  v_conditions jsonb;
  v_reason text;
begin
  -- Primero resolvemos la oportunidad para poder autorizar.
  select requirement.opportunity_id
  into v_opportunity_id
  from mp25m.opportunity_requirements requirement
  where requirement.id = p_requirement_id;

  if not found then
    raise exception
      'Opportunity requirement not found'
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    v_opportunity_id,
    'formulate'
  ) then
    raise exception
      'Internal user cannot formulate opportunity requirements'
      using errcode = '42501';
  end if;


  -- La identidad estable serializa revisiones, submit,
  -- resolución y cambios de lifecycle.
  select requirement.*
  into v_requirement
  from mp25m.opportunity_requirements requirement
  where requirement.id = p_requirement_id
  for update;

  if not found then
    raise exception
      'Opportunity requirement not found'
      using errcode = 'P0002';
  end if;


  if v_requirement.record_status <> 'active' then
    raise exception
      'Withdrawn opportunity requirement cannot be revised'
      using errcode = '55000';
  end if;


  -- La revisión corriente siempre es la de mayor revision_no.
  select revision.*
  into v_current_revision
  from mp25m.opportunity_requirement_revisions revision
  where revision.requirement_id = p_requirement_id
  order by revision.revision_no desc
  limit 1;

  if not found then
    raise exception
      'Opportunity requirement has no current revision'
      using errcode = 'P0002';
  end if;


  -- Optimistic concurrency:
  -- el usuario debe estar editando exactamente la revisión corriente.
  if p_expected_revision_id is null
     or v_current_revision.id <> p_expected_revision_id
  then
    raise exception
      'Opportunity requirement revision is stale'
      using errcode = '40001';
  end if;


  -- Una revisión pendiente debe resolverse antes de ser reemplazada.
  if v_current_revision.validation_status = 'pending' then
    raise exception
      'Pending opportunity requirement revision must be resolved before creating a new revision'
      using errcode = '55000';
  end if;


  if v_current_revision.validation_status not in (
    'declared',
    'validated',
    'rejected'
  ) then
    raise exception
      'Current opportunity requirement revision cannot be revised'
      using errcode = '55000';
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
      'Revision reason must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;


  v_name :=
    nullif(
      btrim(
        coalesce(
          p_name,
          ''
        )
      ),
      ''
    );

  if v_name is null
     or char_length(v_name) < 3
     or char_length(v_name) > 300
  then
    raise exception
      'Requirement name must contain between 3 and 300 characters'
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
     and char_length(v_description) > 10000
  then
    raise exception
      'Requirement description cannot exceed 10000 characters'
      using errcode = '22023';
  end if;


  if p_requirement_type is null
     or p_requirement_type not in (
    'skill_knowledge',
    'productive_capacity',
    'activity_service',
    'resource_equipment',
    'certification_authorization',
    'scale_volume',
    'location_territory',
    'availability_deadline',
    'language',
    'logistics',
    'financial',
    'administrative_legal',
    'institutional_access',
    'other'
  ) then
    raise exception
      'Invalid opportunity requirement type'
      using errcode = '22023';
  end if;


  if p_is_mandatory is null then
    raise exception
      'Requirement mandatory flag is required'
      using errcode = '22023';
  end if;


  if p_weight is null
     or p_weight < 1
     or p_weight > 5
  then
    raise exception
      'Requirement weight must be between 1 and 5'
      using errcode = '22023';
  end if;


  v_satisfaction_criteria :=
    nullif(
      btrim(
        coalesce(
          p_satisfaction_criteria,
          ''
        )
      ),
      ''
    );

  if v_satisfaction_criteria is not null
     and char_length(v_satisfaction_criteria) > 10000
  then
    raise exception
      'Requirement satisfaction criteria cannot exceed 10000 characters'
      using errcode = '22023';
  end if;


  v_conditions :=
    coalesce(
      p_conditions,
      '{}'::jsonb
    );

  if jsonb_typeof(v_conditions) <> 'object' then
    raise exception
      'Requirement conditions must be a JSON object'
      using errcode = '22023';
  end if;


  if p_provenance_kind is null
     or p_provenance_kind not in (
    'human_entry',
    'source_explicit',
    'human_inference'
  ) then
    raise exception
      'Invalid requirement provenance for human formulation'
      using errcode = '22023';
  end if;


  if num_nonnulls(
    p_skill_id,
    p_activity_id
  ) > 1 then
    raise exception
      'A requirement revision may reference at most one canonical item'
      using errcode = '22023';
  end if;


  if p_skill_id is not null then
    if p_requirement_type not in (
      'skill_knowledge',
      'productive_capacity'
    ) then
      raise exception
        'A skill reference is not valid for this requirement type'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from mp25m.skills skill
      where skill.id = p_skill_id
        and skill.active = true
    ) then
      raise exception
        'Skill reference is invalid or inactive'
        using errcode = '23503';
    end if;
  end if;


  if p_activity_id is not null then
    if p_requirement_type <> 'activity_service' then
      raise exception
        'An activity reference is not valid for this requirement type'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from mp25m.activities activity
      where activity.id = p_activity_id
        and activity.active = true
    ) then
      raise exception
        'Activity reference is invalid or inactive'
        using errcode = '23503';
    end if;
  end if;


  if p_source_id is not null
     and not exists (
       select 1
       from mp25m.data_sources source
       where source.id = p_source_id
     )
  then
    raise exception
      'Requirement source does not exist'
      using errcode = '23503';
  end if;


  if p_ingestion_record_id is not null
     and not exists (
       select 1
       from mp25m.ingestion_records ingestion
       where ingestion.id = p_ingestion_record_id
     )
  then
    raise exception
      'Requirement ingestion record does not exist'
      using errcode = '23503';
  end if;


  v_source_locator :=
    nullif(
      btrim(
        coalesce(
          p_source_locator,
          ''
        )
      ),
      ''
    );

  if v_source_locator is not null
     and char_length(v_source_locator) > 2000
  then
    raise exception
      'Requirement source locator cannot exceed 2000 characters'
      using errcode = '22023';
  end if;


  v_source_excerpt :=
    nullif(
      btrim(
        coalesce(
          p_source_excerpt,
          ''
        )
      ),
      ''
    );

  if v_source_excerpt is not null
     and char_length(v_source_excerpt) > 10000
  then
    raise exception
      'Requirement source excerpt cannot exceed 10000 characters'
      using errcode = '22023';
  end if;


  -- Se calcula bajo el lock de la identidad estable.
  select
    coalesce(
      max(revision.revision_no),
      0
    ) + 1
  into v_revision_no
  from mp25m.opportunity_requirement_revisions revision
  where revision.requirement_id = p_requirement_id;


  insert into mp25m.opportunity_requirement_revisions (
    requirement_id,
    revision_no,
    name,
    description,
    requirement_type,
    is_mandatory,
    weight,
    satisfaction_criteria,
    skill_id,
    activity_id,
    conditions,
    provenance_kind,
    source_id,
    ingestion_record_id,
    source_locator,
    source_excerpt,
    validation_status,
    submitted_by_internal_user_id,
    submitted_at,
    reviewed_by_internal_user_id,
    reviewed_at,
    review_reason,
    created_by_internal_user_id
  )
  values (
    p_requirement_id,
    v_revision_no,
    v_name,
    v_description,
    p_requirement_type,
    p_is_mandatory,
    p_weight,
    v_satisfaction_criteria,
    p_skill_id,
    p_activity_id,
    v_conditions,
    p_provenance_kind,
    p_source_id,
    p_ingestion_record_id,
    v_source_locator,
    v_source_excerpt,
    'declared',
    null,
    null,
    null,
    null,
    null,
    p_actor_internal_user_id
  )
  returning id
  into v_revision_id;


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
    'opportunity.requirement.update',
    'mp25m',
    'opportunity_requirements',
    p_requirement_id,
    v_reason,
    jsonb_build_object(
      'revision_id',
        v_current_revision.id,
      'revision_no',
        v_current_revision.revision_no,
      'name',
        v_current_revision.name,
      'requirement_type',
        v_current_revision.requirement_type,
      'is_mandatory',
        v_current_revision.is_mandatory,
      'weight',
        v_current_revision.weight,
      'validation_status',
        v_current_revision.validation_status
    ),
    jsonb_build_object(
      'revision_id',
        v_revision_id,
      'revision_no',
        v_revision_no,
      'name',
        v_name,
      'requirement_type',
        p_requirement_type,
      'is_mandatory',
        p_is_mandatory,
      'weight',
        p_weight,
      'validation_status',
        'declared'
    ),
    'allowed',
    jsonb_build_object(
      'opportunity_id',
        v_opportunity_id,
      'requirement_id',
        p_requirement_id,
      'revision_id',
        v_revision_id,
      'revision_no',
        v_revision_no,
      'old_revision_id',
        v_current_revision.id,
      'new_revision_id',
        v_revision_id,
      'old_revision_no',
        v_current_revision.revision_no,
      'new_revision_no',
        v_revision_no
    )
  );


  requirement_id := p_requirement_id;
  revision_id := v_revision_id;
  revision_no := v_revision_no;

  return next;
end;
$function$;


revoke all
on function mp25m_api.revise_opportunity_requirement(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  boolean,
  smallint,
  text,
  uuid,
  uuid,
  jsonb,
  text,
  uuid,
  bigint,
  text,
  text,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.revise_opportunity_requirement(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  boolean,
  smallint,
  text,
  uuid,
  uuid,
  jsonb,
  text,
  uuid,
  bigint,
  text,
  text,
  text
)
to service_role;


comment on function
mp25m_api.revise_opportunity_requirement(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  boolean,
  smallint,
  text,
  uuid,
  uuid,
  jsonb,
  text,
  uuid,
  bigint,
  text,
  text,
  text
)
is
  'Creates a new immutable semantic revision after locking the stable requirement identity and checking the expected current revision.';


-- ---------------------------------------------------------------------------
-- 5. ENVIAR REVISION A VALIDACION
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.submit_opportunity_requirement_validation(
  p_actor_internal_user_id uuid,
  p_requirement_id uuid,
  p_expected_revision_id uuid
)
returns void
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_requirement
    mp25m.opportunity_requirements%rowtype;

  v_current_revision
    mp25m.opportunity_requirement_revisions%rowtype;

  v_opportunity_id uuid;
  v_submitted_at timestamptz;
begin
  -- Resolver oportunidad antes de autorizar.
  select requirement.opportunity_id
  into v_opportunity_id
  from mp25m.opportunity_requirements requirement
  where requirement.id = p_requirement_id;

  if not found then
    raise exception
      'Opportunity requirement not found'
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    v_opportunity_id,
    'formulate'
  ) then
    raise exception
      'Internal user cannot submit opportunity requirement validation'
      using errcode = '42501';
  end if;


  -- Serializa submit, resolve, revise y lifecycle.
  select requirement.*
  into v_requirement
  from mp25m.opportunity_requirements requirement
  where requirement.id = p_requirement_id
  for update;

  if not found then
    raise exception
      'Opportunity requirement not found'
      using errcode = 'P0002';
  end if;


  if v_requirement.record_status <> 'active' then
    raise exception
      'Withdrawn opportunity requirement cannot be submitted'
      using errcode = '55000';
  end if;


  select revision.*
  into v_current_revision
  from mp25m.opportunity_requirement_revisions revision
  where revision.requirement_id = p_requirement_id
  order by revision.revision_no desc
  limit 1;

  if not found then
    raise exception
      'Opportunity requirement has no current revision'
      using errcode = 'P0002';
  end if;


  if p_expected_revision_id is null
     or v_current_revision.id <> p_expected_revision_id
  then
    raise exception
      'Opportunity requirement revision is stale'
      using errcode = '40001';
  end if;


  if v_current_revision.validation_status <> 'declared' then
    raise exception
      'Only a declared opportunity requirement revision can be submitted'
      using errcode = '55000';
  end if;


  -- El criterio debe estar definido antes de iniciar la validación.
  if v_current_revision.satisfaction_criteria is null
     or char_length(
       btrim(
         v_current_revision.satisfaction_criteria
       )
     ) = 0
  then
    raise exception
      'Satisfaction criteria are required before validation'
      using errcode = '22023';
  end if;


  v_submitted_at := now();


  update mp25m.opportunity_requirement_revisions
  set
    validation_status = 'pending',
    submitted_by_internal_user_id =
      p_actor_internal_user_id,
    submitted_at = v_submitted_at,

    -- Deben permanecer vacíos hasta la resolución.
    reviewed_by_internal_user_id = null,
    reviewed_at = null,
    review_reason = null

  where id = v_current_revision.id;


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    old_data,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'opportunity.requirement.submit_validation',
    'mp25m',
    'opportunity_requirements',
    p_requirement_id,

    jsonb_build_object(
      'revision_id',
        v_current_revision.id,
      'revision_no',
        v_current_revision.revision_no,
      'validation_status',
        'declared'
    ),

    jsonb_build_object(
      'revision_id',
        v_current_revision.id,
      'revision_no',
        v_current_revision.revision_no,
      'validation_status',
        'pending',
      'submitted_by_internal_user_id',
        p_actor_internal_user_id,
      'submitted_at',
        v_submitted_at
    ),

    'allowed',

    jsonb_build_object(
      'opportunity_id',
        v_opportunity_id,
      'requirement_id',
        p_requirement_id,
      'revision_id',
        v_current_revision.id,
      'revision_no',
        v_current_revision.revision_no
    )
  );
end;
$function$;


revoke all
on function mp25m_api.submit_opportunity_requirement_validation(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.submit_opportunity_requirement_validation(
  uuid,
  uuid,
  uuid
)
to service_role;


comment on function
mp25m_api.submit_opportunity_requirement_validation(
  uuid,
  uuid,
  uuid
)
is
  'Moves the current active requirement revision from declared to pending validation after checking concurrency and satisfaction criteria.';


-- ---------------------------------------------------------------------------
-- 6. RESOLVER VALIDACION
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.resolve_opportunity_requirement_validation(
  p_actor_internal_user_id uuid,
  p_requirement_id uuid,
  p_expected_revision_id uuid,
  p_resolution text,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_requirement
    mp25m.opportunity_requirements%rowtype;

  v_current_revision
    mp25m.opportunity_requirement_revisions%rowtype;

  v_opportunity_id uuid;
  v_reason text;
  v_reviewed_at timestamptz;
  v_action text;
begin
  select requirement.opportunity_id
  into v_opportunity_id
  from mp25m.opportunity_requirements requirement
  where requirement.id = p_requirement_id;

  if not found then
    raise exception
      'Opportunity requirement not found'
      using errcode = 'P0002';
  end if;


  -- Sólo administrator / validator según la matriz común.
  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    v_opportunity_id,
    'validate'
  ) then
    raise exception
      'Internal user cannot validate opportunity requirements'
      using errcode = '42501';
  end if;


  -- Serializa contra revise, submit y lifecycle.
  select requirement.*
  into v_requirement
  from mp25m.opportunity_requirements requirement
  where requirement.id = p_requirement_id
  for update;

  if not found then
    raise exception
      'Opportunity requirement not found'
      using errcode = 'P0002';
  end if;


  if v_requirement.record_status <> 'active' then
    raise exception
      'Withdrawn opportunity requirement cannot be validated'
      using errcode = '55000';
  end if;


  select revision.*
  into v_current_revision
  from mp25m.opportunity_requirement_revisions revision
  where revision.requirement_id = p_requirement_id
  order by revision.revision_no desc
  limit 1;

  if not found then
    raise exception
      'Opportunity requirement has no current revision'
      using errcode = 'P0002';
  end if;


  if p_expected_revision_id is null
     or v_current_revision.id <> p_expected_revision_id
  then
    raise exception
      'Opportunity requirement revision is stale'
      using errcode = '40001';
  end if;


  if v_current_revision.validation_status <> 'pending' then
    raise exception
      'Only a pending opportunity requirement revision can be resolved'
      using errcode = '55000';
  end if;


  if p_resolution is null
     or p_resolution not in (
    'validated',
    'rejected'
  ) then
    raise exception
      'Validation resolution must be validated or rejected'
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


  if p_resolution = 'rejected' then
    if v_reason is null
       or char_length(v_reason) < 3
       or char_length(v_reason) > 2000
    then
      raise exception
        'Rejection reason must contain between 3 and 2000 characters'
        using errcode = '22023';
    end if;
  else
    -- En validación el motivo es opcional, pero si existe debe ser útil.
    if v_reason is not null
       and (
         char_length(v_reason) < 3
         or char_length(v_reason) > 2000
       )
    then
      raise exception
        'Validation observation must contain between 3 and 2000 characters'
        using errcode = '22023';
    end if;
  end if;


  v_reviewed_at := now();

  v_action :=
    case p_resolution
      when 'validated'
        then 'opportunity.requirement.validate'
      when 'rejected'
        then 'opportunity.requirement.reject'
    end;


  update mp25m.opportunity_requirement_revisions
  set
    validation_status = p_resolution,
    reviewed_by_internal_user_id =
      p_actor_internal_user_id,
    reviewed_at = v_reviewed_at,
    review_reason = v_reason
  where id = v_current_revision.id;


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
    'opportunity_requirements',
    p_requirement_id,
    v_reason,

    jsonb_build_object(
      'revision_id',
        v_current_revision.id,
      'revision_no',
        v_current_revision.revision_no,
      'validation_status',
        'pending',
      'submitted_by_internal_user_id',
        v_current_revision.submitted_by_internal_user_id,
      'submitted_at',
        v_current_revision.submitted_at
    ),

    jsonb_build_object(
      'revision_id',
        v_current_revision.id,
      'revision_no',
        v_current_revision.revision_no,
      'validation_status',
        p_resolution,
      'reviewed_by_internal_user_id',
        p_actor_internal_user_id,
      'reviewed_at',
        v_reviewed_at,
      'review_reason',
        v_reason
    ),

    -- Rechazar el requerimiento es una decisión permitida,
    -- no una operación de autorización rechazada.
    'allowed',

    jsonb_build_object(
      'opportunity_id',
        v_opportunity_id,
      'requirement_id',
        p_requirement_id,
      'revision_id',
        v_current_revision.id,
      'revision_no',
        v_current_revision.revision_no
    )
  );
end;
$function$;


revoke all
on function mp25m_api.resolve_opportunity_requirement_validation(
  uuid,
  uuid,
  uuid,
  text,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.resolve_opportunity_requirement_validation(
  uuid,
  uuid,
  uuid,
  text,
  text
)
to service_role;


comment on function
mp25m_api.resolve_opportunity_requirement_validation(
  uuid,
  uuid,
  uuid,
  text,
  text
)
is
  'Resolves the current pending active requirement revision as validated or rejected, preserving review attribution and audit history.';


-- ---------------------------------------------------------------------------
-- 7. RETIRAR REQUERIMIENTO
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.withdraw_opportunity_requirement(
  p_actor_internal_user_id uuid,
  p_requirement_id uuid,
  p_expected_revision_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_requirement
    mp25m.opportunity_requirements%rowtype;

  v_current_revision
    mp25m.opportunity_requirement_revisions%rowtype;

  v_opportunity_id uuid;
  v_reason text;
begin
  select requirement.opportunity_id
  into v_opportunity_id
  from mp25m.opportunity_requirements requirement
  where requirement.id = p_requirement_id;

  if not found then
    raise exception
      'Opportunity requirement not found'
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    v_opportunity_id,
    'lifecycle'
  ) then
    raise exception
      'Internal user cannot withdraw opportunity requirements'
      using errcode = '42501';
  end if;


  -- Serializa lifecycle contra revise, submit y resolve.
  select requirement.*
  into v_requirement
  from mp25m.opportunity_requirements requirement
  where requirement.id = p_requirement_id
  for update;

  if not found then
    raise exception
      'Opportunity requirement not found'
      using errcode = 'P0002';
  end if;


  if v_requirement.record_status <> 'active' then
    raise exception
      'Only an active opportunity requirement can be withdrawn'
      using errcode = '55000';
  end if;


  select revision.*
  into v_current_revision
  from mp25m.opportunity_requirement_revisions revision
  where revision.requirement_id = p_requirement_id
  order by revision.revision_no desc
  limit 1;

  if not found then
    raise exception
      'Opportunity requirement has no current revision'
      using errcode = 'P0002';
  end if;


  if p_expected_revision_id is null
     or v_current_revision.id <> p_expected_revision_id
  then
    raise exception
      'Opportunity requirement revision is stale'
      using errcode = '40001';
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
      'Withdrawal reason must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;


  -- No toca la revisión ni su estado de validación.
  update mp25m.opportunity_requirements
  set record_status = 'withdrawn'
  where id = p_requirement_id;


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
    'opportunity.requirement.withdraw',
    'mp25m',
    'opportunity_requirements',
    p_requirement_id,
    v_reason,

    jsonb_build_object(
      'record_status',
        'active'
    ),

    jsonb_build_object(
      'record_status',
        'withdrawn'
    ),

    'allowed',

    jsonb_build_object(
      'opportunity_id',
        v_opportunity_id,
      'requirement_id',
        p_requirement_id,
      'revision_id',
        v_current_revision.id,
      'revision_no',
        v_current_revision.revision_no,
      'validation_status',
        v_current_revision.validation_status
    )
  );
end;
$function$;


revoke all
on function mp25m_api.withdraw_opportunity_requirement(
  uuid,
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.withdraw_opportunity_requirement(
  uuid,
  uuid,
  uuid,
  text
)
to service_role;


comment on function
mp25m_api.withdraw_opportunity_requirement(
  uuid,
  uuid,
  uuid,
  text
)
is
  'Withdraws an active opportunity requirement without changing or deleting its current semantic revision.';


-- ---------------------------------------------------------------------------
-- 8. REACTIVAR REQUERIMIENTO
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.reactivate_opportunity_requirement(
  p_actor_internal_user_id uuid,
  p_requirement_id uuid,
  p_expected_revision_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_requirement
    mp25m.opportunity_requirements%rowtype;

  v_current_revision
    mp25m.opportunity_requirement_revisions%rowtype;

  v_opportunity_id uuid;
  v_reason text;
begin
  select requirement.opportunity_id
  into v_opportunity_id
  from mp25m.opportunity_requirements requirement
  where requirement.id = p_requirement_id;

  if not found then
    raise exception
      'Opportunity requirement not found'
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_operate_opportunity_requirement(
    p_actor_internal_user_id,
    v_opportunity_id,
    'lifecycle'
  ) then
    raise exception
      'Internal user cannot reactivate opportunity requirements'
      using errcode = '42501';
  end if;


  select requirement.*
  into v_requirement
  from mp25m.opportunity_requirements requirement
  where requirement.id = p_requirement_id
  for update;

  if not found then
    raise exception
      'Opportunity requirement not found'
      using errcode = 'P0002';
  end if;


  if v_requirement.record_status <> 'withdrawn' then
    raise exception
      'Only a withdrawn opportunity requirement can be reactivated'
      using errcode = '55000';
  end if;


  select revision.*
  into v_current_revision
  from mp25m.opportunity_requirement_revisions revision
  where revision.requirement_id = p_requirement_id
  order by revision.revision_no desc
  limit 1;

  if not found then
    raise exception
      'Opportunity requirement has no current revision'
      using errcode = 'P0002';
  end if;


  if p_expected_revision_id is null
     or v_current_revision.id <> p_expected_revision_id
  then
    raise exception
      'Opportunity requirement revision is stale'
      using errcode = '40001';
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
      'Reactivation reason must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;


  -- Tampoco altera la revisión corriente.
  -- Si estaba pending al retirarse, continúa pending.
  update mp25m.opportunity_requirements
  set record_status = 'active'
  where id = p_requirement_id;


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
    'opportunity.requirement.reactivate',
    'mp25m',
    'opportunity_requirements',
    p_requirement_id,
    v_reason,

    jsonb_build_object(
      'record_status',
        'withdrawn'
    ),

    jsonb_build_object(
      'record_status',
        'active'
    ),

    'allowed',

    jsonb_build_object(
      'opportunity_id',
        v_opportunity_id,
      'requirement_id',
        p_requirement_id,
      'revision_id',
        v_current_revision.id,
      'revision_no',
        v_current_revision.revision_no,
      'validation_status',
        v_current_revision.validation_status
    )
  );
end;
$function$;


revoke all
on function mp25m_api.reactivate_opportunity_requirement(
  uuid,
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;


grant execute
on function mp25m_api.reactivate_opportunity_requirement(
  uuid,
  uuid,
  uuid,
  text
)
to service_role;


comment on function
mp25m_api.reactivate_opportunity_requirement(
  uuid,
  uuid,
  uuid,
  text
)
is
  'Reactivates a withdrawn opportunity requirement without changing its current semantic revision or validation state.';


-- ---------------------------------------------------------------------------
-- 9. FIN DE MIGRACION
-- ---------------------------------------------------------------------------

commit;


