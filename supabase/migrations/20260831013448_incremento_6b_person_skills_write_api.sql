-- Incremento 6B - Gestion de habilidades de personas.
--
-- Agrega una write API server-only para administrar la relacion
-- persona <-> habilidad usando mp25m.person_skills y
-- mp25m.person_skill_evidence.
--
-- No crea skills, aliases, categorias ni modelos paralelos.
-- No borra fisicamente person_skills.

begin;


-- ---------------------------------------------------------------------------
-- 1. ALTA O REACTIVACION DE HABILIDAD DE PERSONA
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.add_person_skill(
    p_actor_internal_user_id uuid,
    p_person_id uuid,
    p_skill_id uuid,
    p_proficiency_level smallint default null,
    p_experience_range text default null,
    p_experience_notes text default null,
    p_notes text default null,
    p_evidence_text text default null
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
    v_existing mp25m.person_skills%rowtype;
    v_person_skill mp25m.person_skills%rowtype;
    v_skill_name text;
    v_experience_range text;
    v_experience_notes text;
    v_notes text;
    v_evidence_text text;
    v_action text;
    v_evidence_added boolean;
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
            'Internal user cannot manage person skills'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from mp25m.persons p
        where p.id = p_person_id
          and p.record_status = 'active'
    ) then
        raise exception
            'Person not found or inactive'
            using errcode = 'P0002';
    end if;

    select s.name::text
    into v_skill_name
    from mp25m.skills s
    where s.id = p_skill_id
      and s.active = true
      and s.applies_to_person = true;

    if not found then
        raise exception
            'Skill not found or unavailable for people'
            using errcode = 'P0002';
    end if;

    if p_proficiency_level is not null
       and (
           p_proficiency_level < 1
           or p_proficiency_level > 5
       )
    then
        raise exception
            'Person skill proficiency must be between 1 and 5'
            using errcode = '22023';
    end if;

    v_experience_range :=
        nullif(
            btrim(
                coalesce(
                    p_experience_range,
                    ''
                )
            ),
            ''
        );

    if v_experience_range is not null
       and v_experience_range not in (
           'lt_1',
           '1_3',
           '4_7',
           '8_15',
           'gt_15',
           'unspecified'
       )
    then
        raise exception
            'Invalid person skill experience range'
            using errcode = '22023';
    end if;

    v_experience_notes :=
        nullif(
            btrim(
                coalesce(
                    p_experience_notes,
                    ''
                )
            ),
            ''
        );

    if v_experience_notes is not null
       and char_length(v_experience_notes) > 2000
    then
        raise exception
            'Person skill experience notes cannot exceed 2000 characters'
            using errcode = '22023';
    end if;

    v_notes :=
        nullif(
            btrim(
                coalesce(
                    p_notes,
                    ''
                )
            ),
            ''
        );

    if v_notes is not null
       and char_length(v_notes) > 2000
    then
        raise exception
            'Person skill notes cannot exceed 2000 characters'
            using errcode = '22023';
    end if;

    v_evidence_text :=
        nullif(
            btrim(
                coalesce(
                    p_evidence_text,
                    ''
                )
            ),
            ''
        );

    if v_evidence_text is not null
       and char_length(v_evidence_text) > 2000
    then
        raise exception
            'Person skill evidence cannot exceed 2000 characters'
            using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(
        hashtextextended(
            'mp25m.person_skill.add:' ||
            p_person_id::text ||
            ':' ||
            p_skill_id::text,
            0
        )
    );

    select ps.*
    into v_existing
    from mp25m.person_skills ps
    where ps.person_id = p_person_id
      and ps.skill_id = p_skill_id
    for update;

    if found then
        if v_existing.active = true then
            raise exception
                'Person already has this skill registered'
                using errcode = '23505';
        end if;

        update mp25m.person_skills
        set active = true,
            verification_status =
                case
                    when v_existing.verification_status =
                        'rejected'
                    then 'candidate'
                    else v_existing.verification_status
                end,
            proficiency_level = p_proficiency_level,
            experience_range = v_experience_range,
            experience_notes = v_experience_notes,
            notes = v_notes
        where id = v_existing.id
        returning *
        into v_person_skill;

        v_action := 'person.skill.reactivate';
    else
        insert into mp25m.person_skills (
            person_id,
            skill_id,
            proficiency_level,
            verification_status,
            experience_range,
            experience_notes,
            notes,
            active
        )
        values (
            p_person_id,
            p_skill_id,
            p_proficiency_level,
            'candidate',
            v_experience_range,
            v_experience_notes,
            v_notes,
            true
        )
        returning *
        into v_person_skill;

        v_action := 'person.skill.add';
    end if;

    v_evidence_added :=
        v_evidence_text is not null;

    if v_evidence_added then
        insert into mp25m.person_skill_evidence (
            person_skill_id,
            evidence_type,
            evidence_text,
            confidence
        )
        values (
            v_person_skill.id,
            'other',
            v_evidence_text,
            null
        );
    end if;

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
        v_action,
        'mp25m',
        'person_skills',
        v_person_skill.id,
        case
            when v_existing.id is null
              then null
            else jsonb_build_object(
                'person_skill_id',
                    v_existing.id,
                'person_id',
                    v_existing.person_id,
                'skill_id',
                    v_existing.skill_id,
                'proficiency_level',
                    v_existing.proficiency_level,
                'verification_status',
                    v_existing.verification_status,
                'experience_range',
                    v_existing.experience_range,
                'experience_notes',
                    v_existing.experience_notes,
                'notes',
                    v_existing.notes,
                'active',
                    v_existing.active
            )
        end,
        jsonb_build_object(
            'person_skill_id',
                v_person_skill.id,
            'person_id',
                v_person_skill.person_id,
            'skill_id',
                v_person_skill.skill_id,
            'proficiency_level',
                v_person_skill.proficiency_level,
            'verification_status',
                v_person_skill.verification_status,
            'experience_range',
                v_person_skill.experience_range,
            'experience_notes',
                v_person_skill.experience_notes,
            'notes',
                v_person_skill.notes,
            'active',
                v_person_skill.active
        ),
        'allowed',
        jsonb_build_object(
            'person_id',
                p_person_id,
            'skill_id',
                p_skill_id,
            'skill_name',
                v_skill_name,
            'operation',
                case
                    when v_action =
                        'person.skill.reactivate'
                    then 'reactivate'
                    else 'add'
                end,
            'evidence_added',
                v_evidence_added
        )
    );

    return v_person_skill.id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 2. EDICION DE DATOS DE UNA HABILIDAD DE PERSONA
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.update_person_skill(
    p_actor_internal_user_id uuid,
    p_person_id uuid,
    p_person_skill_id uuid,
    p_proficiency_level smallint default null,
    p_experience_range text default null,
    p_experience_notes text default null,
    p_notes text default null,
    p_evidence_text text default null
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
    v_existing mp25m.person_skills%rowtype;
    v_person_skill mp25m.person_skills%rowtype;
    v_skill_name text;
    v_experience_range text;
    v_experience_notes text;
    v_notes text;
    v_evidence_text text;
    v_evidence_added boolean;
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
            'Internal user cannot manage person skills'
            using errcode = '42501';
    end if;

    select ps.*
    into v_existing
    from mp25m.person_skills ps
    where ps.id = p_person_skill_id
      and ps.person_id = p_person_id
    for update;

    if not found then
        raise exception
            'Person skill not found'
            using errcode = 'P0002';
    end if;

    if v_existing.active is distinct from true then
        raise exception
            'Person skill is not active'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.persons p
        where p.id = v_existing.person_id
          and p.record_status = 'active'
    ) then
        raise exception
            'Person not found or inactive'
            using errcode = 'P0002';
    end if;

    select s.name::text
    into v_skill_name
    from mp25m.skills s
    where s.id = v_existing.skill_id
      and s.active = true
      and s.applies_to_person = true;

    if not found then
        raise exception
            'Skill not found or unavailable for people'
            using errcode = 'P0002';
    end if;

    if p_proficiency_level is not null
       and (
           p_proficiency_level < 1
           or p_proficiency_level > 5
       )
    then
        raise exception
            'Person skill proficiency must be between 1 and 5'
            using errcode = '22023';
    end if;

    v_experience_range :=
        nullif(
            btrim(
                coalesce(
                    p_experience_range,
                    ''
                )
            ),
            ''
        );

    if v_experience_range is not null
       and v_experience_range not in (
           'lt_1',
           '1_3',
           '4_7',
           '8_15',
           'gt_15',
           'unspecified'
       )
    then
        raise exception
            'Invalid person skill experience range'
            using errcode = '22023';
    end if;

    v_experience_notes :=
        nullif(
            btrim(
                coalesce(
                    p_experience_notes,
                    ''
                )
            ),
            ''
        );

    if v_experience_notes is not null
       and char_length(v_experience_notes) > 2000
    then
        raise exception
            'Person skill experience notes cannot exceed 2000 characters'
            using errcode = '22023';
    end if;

    v_notes :=
        nullif(
            btrim(
                coalesce(
                    p_notes,
                    ''
                )
            ),
            ''
        );

    if v_notes is not null
       and char_length(v_notes) > 2000
    then
        raise exception
            'Person skill notes cannot exceed 2000 characters'
            using errcode = '22023';
    end if;

    v_evidence_text :=
        nullif(
            btrim(
                coalesce(
                    p_evidence_text,
                    ''
                )
            ),
            ''
        );

    if v_evidence_text is not null
       and char_length(v_evidence_text) > 2000
    then
        raise exception
            'Person skill evidence cannot exceed 2000 characters'
            using errcode = '22023';
    end if;

    update mp25m.person_skills
    set proficiency_level = p_proficiency_level,
        experience_range = v_experience_range,
        experience_notes = v_experience_notes,
        notes = v_notes
    where id = v_existing.id
    returning *
    into v_person_skill;

    v_evidence_added :=
        v_evidence_text is not null;

    if v_evidence_added then
        insert into mp25m.person_skill_evidence (
            person_skill_id,
            evidence_type,
            evidence_text,
            confidence
        )
        values (
            v_person_skill.id,
            'other',
            v_evidence_text,
            null
        );
    end if;

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
        'person.skill.update',
        'mp25m',
        'person_skills',
        v_person_skill.id,
        jsonb_build_object(
            'person_skill_id',
                v_existing.id,
            'person_id',
                v_existing.person_id,
            'skill_id',
                v_existing.skill_id,
            'proficiency_level',
                v_existing.proficiency_level,
            'verification_status',
                v_existing.verification_status,
            'experience_range',
                v_existing.experience_range,
            'experience_notes',
                v_existing.experience_notes,
            'notes',
                v_existing.notes,
            'active',
                v_existing.active
        ),
        jsonb_build_object(
            'person_skill_id',
                v_person_skill.id,
            'person_id',
                v_person_skill.person_id,
            'skill_id',
                v_person_skill.skill_id,
            'proficiency_level',
                v_person_skill.proficiency_level,
            'verification_status',
                v_person_skill.verification_status,
            'experience_range',
                v_person_skill.experience_range,
            'experience_notes',
                v_person_skill.experience_notes,
            'notes',
                v_person_skill.notes,
            'active',
                v_person_skill.active
        ),
        'allowed',
        jsonb_build_object(
            'person_id',
                v_person_skill.person_id,
            'skill_id',
                v_person_skill.skill_id,
            'skill_name',
                v_skill_name,
            'operation',
                'update',
            'evidence_added',
                v_evidence_added
        )
    );
end;
$function$;


-- ---------------------------------------------------------------------------
-- 3. CONFIRMACION O RECHAZO DE HABILIDAD DE PERSONA
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.resolve_person_skill(
    p_actor_internal_user_id uuid,
    p_person_id uuid,
    p_person_skill_id uuid,
    p_resolution_action text,
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
    v_existing mp25m.person_skills%rowtype;
    v_person_skill mp25m.person_skills%rowtype;
    v_skill_name text;
    v_resolution_action text;
    v_reason text;
begin
    v_resolution_action :=
        nullif(
            btrim(
                coalesce(
                    p_resolution_action,
                    ''
                )
            ),
            ''
        );

    if v_resolution_action not in (
        'confirmed',
        'rejected'
    ) then
        raise exception
            'Invalid person skill resolution action'
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
            'Person skill resolution reason must contain between 3 and 2000 characters'
            using errcode = '22023';
    end if;

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
            'Internal user cannot manage person skills'
            using errcode = '42501';
    end if;

    select ps.*
    into v_existing
    from mp25m.person_skills ps
    where ps.id = p_person_skill_id
      and ps.person_id = p_person_id
    for update;

    if not found then
        raise exception
            'Person skill not found'
            using errcode = 'P0002';
    end if;

    if v_existing.active is distinct from true then
        raise exception
            'Person skill is not active'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.persons p
        where p.id = v_existing.person_id
          and p.record_status = 'active'
    ) then
        raise exception
            'Person not found or inactive'
            using errcode = 'P0002';
    end if;

    select s.name::text
    into v_skill_name
    from mp25m.skills s
    where s.id = v_existing.skill_id
      and s.active = true
      and s.applies_to_person = true;

    if not found then
        raise exception
            'Skill not found or unavailable for people'
            using errcode = 'P0002';
    end if;

    if v_resolution_action = 'confirmed'
       and v_existing.verification_status =
           'confirmed'
    then
        raise exception
            'Person skill is already confirmed'
            using errcode = '22023';
    end if;

    if v_resolution_action = 'rejected'
       and v_existing.verification_status not in (
           'self_reported',
           'candidate'
       )
    then
        raise exception
            'Only self-reported or candidate person skills can be rejected'
            using errcode = '22023';
    end if;

    update mp25m.person_skills
    set verification_status =
            v_resolution_action,
        active =
            case
                when v_resolution_action =
                    'rejected'
                then false
                else true
            end
    where id = v_existing.id
    returning *
    into v_person_skill;

    insert into mp25m.person_skill_evidence (
        person_skill_id,
        evidence_type,
        evidence_text,
        confidence
    )
    values (
        v_person_skill.id,
        'admin_validation',
        v_reason,
        null
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
        case
            when v_resolution_action =
                'confirmed'
            then 'person.skill.confirm'
            else 'person.skill.reject'
        end,
        'mp25m',
        'person_skills',
        v_person_skill.id,
        v_reason,
        jsonb_build_object(
            'person_skill_id',
                v_existing.id,
            'person_id',
                v_existing.person_id,
            'skill_id',
                v_existing.skill_id,
            'proficiency_level',
                v_existing.proficiency_level,
            'verification_status',
                v_existing.verification_status,
            'experience_range',
                v_existing.experience_range,
            'experience_notes',
                v_existing.experience_notes,
            'notes',
                v_existing.notes,
            'active',
                v_existing.active
        ),
        jsonb_build_object(
            'person_skill_id',
                v_person_skill.id,
            'person_id',
                v_person_skill.person_id,
            'skill_id',
                v_person_skill.skill_id,
            'proficiency_level',
                v_person_skill.proficiency_level,
            'verification_status',
                v_person_skill.verification_status,
            'experience_range',
                v_person_skill.experience_range,
            'experience_notes',
                v_person_skill.experience_notes,
            'notes',
                v_person_skill.notes,
            'active',
                v_person_skill.active
        ),
        'allowed',
        jsonb_build_object(
            'person_id',
                v_person_skill.person_id,
            'skill_id',
                v_person_skill.skill_id,
            'skill_name',
                v_skill_name,
            'operation',
                case
                    when v_resolution_action =
                        'confirmed'
                    then 'confirm'
                    else 'reject'
                end,
            'evidence_added',
                true
        )
    );
end;
$function$;


-- ---------------------------------------------------------------------------
-- 4. DESACTIVACION SIN BORRADO DE HABILIDAD DE PERSONA
-- ---------------------------------------------------------------------------

create or replace function
mp25m_api.deactivate_person_skill(
    p_actor_internal_user_id uuid,
    p_person_id uuid,
    p_person_skill_id uuid,
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
    v_existing mp25m.person_skills%rowtype;
    v_person_skill mp25m.person_skills%rowtype;
    v_skill_name text;
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

    if v_reason is null
       or char_length(v_reason) < 3
       or char_length(v_reason) > 2000
    then
        raise exception
            'Person skill deactivation reason must contain between 3 and 2000 characters'
            using errcode = '22023';
    end if;

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
            'Internal user cannot manage person skills'
            using errcode = '42501';
    end if;

    select ps.*
    into v_existing
    from mp25m.person_skills ps
    where ps.id = p_person_skill_id
      and ps.person_id = p_person_id
    for update;

    if not found then
        raise exception
            'Person skill not found'
            using errcode = 'P0002';
    end if;

    if v_existing.active is distinct from true then
        raise exception
            'Person skill is not active'
            using errcode = '22023';
    end if;

    if not exists (
        select 1
        from mp25m.persons p
        where p.id = v_existing.person_id
          and p.record_status = 'active'
    ) then
        raise exception
            'Person not found or inactive'
            using errcode = 'P0002';
    end if;

    select s.name::text
    into v_skill_name
    from mp25m.skills s
    where s.id = v_existing.skill_id
      and s.active = true
      and s.applies_to_person = true;

    if not found then
        raise exception
            'Skill not found or unavailable for people'
            using errcode = 'P0002';
    end if;

    update mp25m.person_skills
    set active = false
    where id = v_existing.id
    returning *
    into v_person_skill;

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
        'person.skill.deactivate',
        'mp25m',
        'person_skills',
        v_person_skill.id,
        v_reason,
        jsonb_build_object(
            'person_skill_id',
                v_existing.id,
            'person_id',
                v_existing.person_id,
            'skill_id',
                v_existing.skill_id,
            'proficiency_level',
                v_existing.proficiency_level,
            'verification_status',
                v_existing.verification_status,
            'experience_range',
                v_existing.experience_range,
            'experience_notes',
                v_existing.experience_notes,
            'notes',
                v_existing.notes,
            'active',
                v_existing.active
        ),
        jsonb_build_object(
            'person_skill_id',
                v_person_skill.id,
            'person_id',
                v_person_skill.person_id,
            'skill_id',
                v_person_skill.skill_id,
            'proficiency_level',
                v_person_skill.proficiency_level,
            'verification_status',
                v_person_skill.verification_status,
            'experience_range',
                v_person_skill.experience_range,
            'experience_notes',
                v_person_skill.experience_notes,
            'notes',
                v_person_skill.notes,
            'active',
                v_person_skill.active
        ),
        'allowed',
        jsonb_build_object(
            'person_id',
                v_person_skill.person_id,
            'skill_id',
                v_person_skill.skill_id,
            'skill_name',
                v_skill_name,
            'operation',
                'deactivate',
            'evidence_added',
                false
        )
    );
end;
$function$;


-- ---------------------------------------------------------------------------
-- 5. PRIVILEGIOS SERVER-ONLY
-- ---------------------------------------------------------------------------

revoke all
on function mp25m_api.add_person_skill(
    uuid,
    uuid,
    uuid,
    smallint,
    text,
    text,
    text,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.add_person_skill(
    uuid,
    uuid,
    uuid,
    smallint,
    text,
    text,
    text,
    text
)
to service_role;


revoke all
on function mp25m_api.update_person_skill(
    uuid,
    uuid,
    uuid,
    smallint,
    text,
    text,
    text,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.update_person_skill(
    uuid,
    uuid,
    uuid,
    smallint,
    text,
    text,
    text,
    text
)
to service_role;


revoke all
on function mp25m_api.resolve_person_skill(
    uuid,
    uuid,
    uuid,
    text,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.resolve_person_skill(
    uuid,
    uuid,
    uuid,
    text,
    text
)
to service_role;


revoke all
on function mp25m_api.deactivate_person_skill(
    uuid,
    uuid,
    uuid,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.deactivate_person_skill(
    uuid,
    uuid,
    uuid,
    text
)
to service_role;


comment on function mp25m_api.add_person_skill(
    uuid,
    uuid,
    uuid,
    smallint,
    text,
    text,
    text,
    text
) is
    'Creates or reactivates an active person-skill relation from the backoffice. New relations start as candidate and evidence is optional.';

comment on function mp25m_api.update_person_skill(
    uuid,
    uuid,
    uuid,
    smallint,
    text,
    text,
    text,
    text
) is
    'Updates editable details of an active person-skill relation without changing verification status.';

comment on function mp25m_api.resolve_person_skill(
    uuid,
    uuid,
    uuid,
    text,
    text
) is
    'Explicitly confirms or rejects an active person-skill relation with required reason, evidence and audit.';

comment on function mp25m_api.deactivate_person_skill(
    uuid,
    uuid,
    uuid,
    text
) is
    'Deactivates an active person-skill relation without deleting it and without changing verification status.';


commit;
