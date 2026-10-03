
begin;

-- ---------------------------------------------------------------------------
-- 12B.A - ampliación de audiencia
-- ---------------------------------------------------------------------------

alter table mp25m.communication_audience_criteria
  add column organization_id uuid
    references mp25m.organizations(id)
    on delete restrict;


alter table mp25m.communication_audience_criteria
  drop constraint communication_audience_criteria_shape_check;


alter table mp25m.communication_audience_criteria
  add constraint communication_audience_criteria_shape_check
  check (
    (
      criterion_type = 'person'
      and person_id is not null
      and organization_id is null
      and node_id is null
      and articulation_id is null
      and project_id is null
      and skill_id is null
      and theme_id is null
      and verification_statuses is null
    )
    or
    (
      criterion_type = 'organization'
      and person_id is null
      and organization_id is not null
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
      and organization_id is null
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
      and organization_id is null
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
      and organization_id is null
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
      and organization_id is null
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
      and organization_id is null
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
      and organization_id is null
      and node_id is null
      and articulation_id is null
      and project_id is null
      and skill_id is null
      and theme_id is not null
      and verification_statuses is null
    )
  );


alter table mp25m.communication_audience_criteria
  drop constraint communication_audience_criteria_criterion_type_check;


alter table mp25m.communication_audience_criteria
  add constraint communication_audience_criteria_criterion_type_check
  check (
    criterion_type in (
      'person',
      'organization',
      'node_participants',
      'articulation_participants',
      'project_participants',
      'person_skill',
      'organization_capability',
      'theme_responsibles'
    )
  );


alter table mp25m.communication_recipient_sources
  drop constraint communication_recipient_sources_criterion_type_check;


alter table mp25m.communication_recipient_sources
  add constraint communication_recipient_sources_criterion_type_check
  check (
    criterion_type in (
      'person',
      'organization',
      'node_participants',
      'articulation_participants',
      'project_participants',
      'person_skill',
      'organization_capability',
      'theme_responsibles',
      'manual'
    )
  );


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
  v_organization_id uuid;
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
      'organization',
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

      v_organization_id :=
        nullif(
          v_item ->> 'organization_id',
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
           or v_organization_id is not null
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


      when 'organization' then
        if v_organization_id is null
           or v_person_id is not null
           or v_node_id is not null
           or v_articulation_id is not null
           or v_project_id is not null
           or v_skill_id is not null
           or v_theme_id is not null
        then
          raise exception
            'Invalid organization audience criterion'
            using errcode = '22023';
        end if;

        if not exists (
          select 1
          from mp25m.organizations organization
          where organization.id = v_organization_id
        ) then
          raise exception
            'Audience criterion organization does not exist'
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
           or v_organization_id is not null
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

        if v_node_id is not null
           and not exists (
             select 1
             from mp25m.nodes node
             where node.id = v_node_id
           )
        then
          raise exception
            'Audience criterion person skill node does not exist'
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

    v_organization_id :=
      nullif(
        v_item ->> 'organization_id',
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
      organization_id,
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
      v_organization_id,
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


    when 'organization' then
      return query
      select
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
      from mp25m.organizations organization
      where organization.id =
          v_criterion.organization_id;


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
        and skill.applies_to_person = true

        and (
          v_criterion.node_id is null
          or exists (
            select 1
            from mp25m.node_participations participation
            where participation.person_id =
                person.id

              and participation.node_id =
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
              )
          )
        );


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

            'organization_id',
            criterion.organization_id,

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


drop function mp25m_api.communication_criteria_list(
  uuid,
  uuid,
  integer
);

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
  organization_id uuid,
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
    criterion.organization_id,
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


revoke all
on function mp25m_api.replace_communication_audience_criteria(
  uuid,
  uuid,
  jsonb,
  text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.replace_communication_audience_criteria(
  uuid,
  uuid,
  jsonb,
  text
)
to service_role;


revoke all
on function mp25m_api.communication_criterion_actor_list(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.communication_criterion_actor_list(
  uuid,
  uuid,
  uuid
)
to service_role;


revoke all
on function mp25m_api.resolve_communication_audience(
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.resolve_communication_audience(
  uuid,
  uuid,
  text
)
to service_role;


revoke all
on function mp25m_api.communication_criteria_list(
  uuid,
  uuid,
  integer
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.communication_criteria_list(
  uuid,
  uuid,
  integer
)
to service_role;


comment on column mp25m.communication_audience_criteria.organization_id is
  'Organización canónica seleccionada explícitamente como criterio de audiencia.';

comment on table mp25m.communication_audience_criteria is
  'Definiciones históricas y explícitas de audiencia. Admite Personas y Organizaciones explícitas, pertenencia directa y filtros por habilidad/capacidad, opcionalmente acotados por Nodo.';

commit;
