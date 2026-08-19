create or replace function mp25m_private.profile_submit_by_token(
  p_token_hash text,
  p_payload jsonb,
  p_form_version text default '1.0'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token mp25m_private.profile_access_tokens%rowtype;
  v_person mp25m.persons%rowtype;
  v_source_id uuid;
  v_submission_id uuid := gen_random_uuid();
  v_ingestion_id bigint;
  v_item jsonb;
  v_role_item jsonb;
  v_node_id uuid;
  v_removed_node_id uuid;
  v_skill_id uuid;
  v_vector_id uuid;
  v_vector_node_id uuid;
  v_relation_type text;
  v_role_code text;
  v_part mp25m.node_participations%rowtype;
  v_part_role mp25m.node_participation_roles%rowtype;
  v_ps mp25m.person_skills%rowtype;
  v_pv mp25m.person_vectors%rowtype;
  v_contact mp25m.person_contacts%rowtype;
  v_first_name text := nullif(trim(p_payload #>> '{personal,firstName}'), '');
  v_last_name text := nullif(trim(p_payload #>> '{personal,lastName}'), '');
  v_phone_original text := nullif(trim(p_payload #>> '{contacts,phone,value}'), '');
  v_phone_normalized text;
  v_email_original text := nullif(trim(p_payload #>> '{contacts,email,value}'), '');
  v_email_normalized text;
  v_internal_consent boolean := coalesce((p_payload #>> '{consents,internalDirectory}')::boolean, false);
  v_public_consent boolean := coalesce((p_payload #>> '{consents,publicProfile}')::boolean, false);
  v_communications_consent boolean := coalesce((p_payload #>> '{consents,communications}')::boolean, false);
  v_data_processing boolean := coalesce((p_payload #>> '{consents,dataProcessing}')::boolean, false);
  v_phone_internal boolean := coalesce((p_payload #>> '{contacts,phone,visibleInternal}')::boolean, false);
  v_email_internal boolean := coalesce((p_payload #>> '{contacts,email,visibleInternal}')::boolean, false);
  v_review_count integer := 0;
  v_suggestion_count integer := 0;
  v_now timestamptz := now();
  v_existing_count integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid_payload');
  end if;

  select * into v_token
  from mp25m_private.profile_access_tokens
  where token_hash = p_token_hash
    and status = 'active'
    and expires_at > v_now
    and used_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_expired_or_used_token');
  end if;

  select * into v_person
  from mp25m.persons
  where id = v_token.person_id
    and record_status = 'active';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_available');
  end if;

  if v_first_name is null or length(v_first_name) > 150
     or v_last_name is null or length(v_last_name) > 150 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;

  v_phone_normalized := mp25m_private.normalize_ar_mobile(v_phone_original);
  if v_phone_normalized is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_mobile_phone');
  end if;

  if v_email_original is not null then
    v_email_normalized := lower(v_email_original);
    if v_email_normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_email');
    end if;
  end if;

  if not v_data_processing then
    return jsonb_build_object('ok', false, 'error', 'data_processing_consent_required');
  end if;

  if p_payload ? 'nodes' and jsonb_typeof(p_payload->'nodes') <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'nodes_must_be_array');
  end if;
  if p_payload ? 'removedNodeIds' and jsonb_typeof(p_payload->'removedNodeIds') <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'removed_nodes_must_be_array');
  end if;
  if p_payload ? 'skills' and jsonb_typeof(p_payload->'skills') <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'skills_must_be_array');
  end if;
  if p_payload ? 'skillSuggestions' and jsonb_typeof(p_payload->'skillSuggestions') <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'skill_suggestions_must_be_array');
  end if;
  if p_payload ? 'vectors' and jsonb_typeof(p_payload->'vectors') <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'vectors_must_be_array');
  end if;

  -- Validate node and role references before making changes.
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'nodes','[]'::jsonb)) loop
    v_node_id := (v_item->>'nodeId')::uuid;
    if not exists (select 1 from mp25m.nodes n where n.id = v_node_id and n.status in ('forming','active')) then
      return jsonb_build_object('ok', false, 'error', 'unknown_node', 'nodeId', v_item->>'nodeId');
    end if;
    if v_item ? 'roles' and jsonb_typeof(v_item->'roles') <> 'array' then
      return jsonb_build_object('ok', false, 'error', 'roles_must_be_array');
    end if;
    for v_role_item in select value from jsonb_array_elements(coalesce(v_item->'roles','[]'::jsonb)) loop
      v_role_code := trim(both '"' from v_role_item::text);
      if not exists (select 1 from mp25m.roles r where r.code = v_role_code and r.active = true) then
        return jsonb_build_object('ok', false, 'error', 'unknown_role', 'role', v_role_code);
      end if;
    end loop;
  end loop;

  for v_role_item in select value from jsonb_array_elements(coalesce(p_payload->'removedNodeIds','[]'::jsonb)) loop
    v_removed_node_id := trim(both '"' from v_role_item::text)::uuid;
    if not exists (select 1 from mp25m.nodes n where n.id = v_removed_node_id) then
      return jsonb_build_object('ok', false, 'error', 'unknown_removed_node');
    end if;
    if exists (
      select 1 from jsonb_array_elements(coalesce(p_payload->'nodes','[]'::jsonb)) x
      where x->>'nodeId' = v_removed_node_id::text
    ) then
      return jsonb_build_object('ok', false, 'error', 'node_cannot_be_selected_and_removed', 'nodeId', v_removed_node_id);
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'skills','[]'::jsonb)) loop
    v_skill_id := (v_item->>'skillId')::uuid;
    if not exists (select 1 from mp25m.skills s where s.id = v_skill_id and s.active = true) then
      return jsonb_build_object('ok', false, 'error', 'unknown_skill', 'skillId', v_item->>'skillId');
    end if;
    if (v_item->>'level') is null or (v_item->>'level')::integer not between 1 and 5 then
      return jsonb_build_object('ok', false, 'error', 'invalid_skill_level', 'skillId', v_item->>'skillId');
    end if;
    if v_item ? 'experienceRange'
       and nullif(v_item->>'experienceRange','') is not null
       and (v_item->>'experienceRange') not in ('lt_1','1_3','4_7','8_15','gt_15','unspecified') then
      return jsonb_build_object('ok', false, 'error', 'invalid_experience_range');
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'skillSuggestions','[]'::jsonb)) loop
    if nullif(trim(v_item->>'name'),'') is null or length(trim(v_item->>'name')) > 180 then
      return jsonb_build_object('ok', false, 'error', 'invalid_skill_suggestion_name');
    end if;
    if v_item ? 'level' and nullif(v_item->>'level','') is not null
       and (v_item->>'level')::integer not between 1 and 5 then
      return jsonb_build_object('ok', false, 'error', 'invalid_skill_suggestion_level');
    end if;
    if v_item ? 'categoryCode' and nullif(v_item->>'categoryCode','') is not null
       and not exists (select 1 from mp25m.skill_categories sc where sc.code=v_item->>'categoryCode' and sc.active=true) then
      return jsonb_build_object('ok', false, 'error', 'unknown_skill_category');
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'vectors','[]'::jsonb)) loop
    v_vector_id := (v_item->>'vectorId')::uuid;
    v_relation_type := v_item->>'relationType';
    if not exists (select 1 from mp25m.vectors v where v.id = v_vector_id and v.active = true) then
      return jsonb_build_object('ok', false, 'error', 'unknown_vector', 'vectorId', v_item->>'vectorId');
    end if;
    if v_relation_type not in ('participates','interested') then
      return jsonb_build_object('ok', false, 'error', 'invalid_vector_relation');
    end if;
    if nullif(v_item->>'nodeId','') is not null then
      v_vector_node_id := (v_item->>'nodeId')::uuid;
      if not exists (
        select 1 from jsonb_array_elements(coalesce(p_payload->'nodes','[]'::jsonb)) x
        where x->>'nodeId' = v_vector_node_id::text
      ) then
        return jsonb_build_object('ok', false, 'error', 'vector_node_must_be_selected_node');
      end if;
    end if;
  end loop;

  select ds.id into v_source_id
  from mp25m.data_sources ds
  where ds.external_reference = 'profile-update-v1' and ds.active = true
  order by ds.created_at desc
  limit 1;
  if v_source_id is null then
    raise exception 'profile-update-v1 data source is missing';
  end if;

  insert into mp25m.ingestion_records(
    source_id, external_record_id, submitted_at, raw_data, metadata, processing_status
  ) values (
    v_source_id, v_submission_id::text, v_now, p_payload,
    jsonb_build_object('form_version', p_form_version, 'access_token_id', v_token.id),
    'pending'
  ) returning id into v_ingestion_id;

  insert into mp25m_private.profile_submissions(
    id, person_id, access_token_id, ingestion_record_id, form_version, status, submitted_at
  ) values (
    v_submission_id, v_person.id, v_token.id, v_ingestion_id, p_form_version, 'received', v_now
  );

  -- Personal data: direct update, source preserved in ingestion_records.
  update mp25m.persons
  set first_name = v_first_name,
      last_name = v_last_name,
      display_name = trim(v_first_name || ' ' || v_last_name),
      normalized_name = mp25m_private.normalize_text(trim(v_first_name || ' ' || v_last_name)),
      residence_province_text = nullif(trim(p_payload #>> '{personal,residenceProvince}'),''),
      residence_locality_text = nullif(trim(p_payload #>> '{personal,residenceLocality}'),''),
      primary_activity_text = nullif(trim(p_payload #>> '{personal,primaryActivity}'),''),
      profession_text = nullif(trim(p_payload #>> '{personal,profession}'),''),
      experience_text = nullif(trim(p_payload #>> '{personal,experience}'),''),
      updated_at = v_now
  where id = v_person.id;

  -- Current mobile / WhatsApp. Preserve historical contacts.
  select * into v_contact
  from mp25m.person_contacts c
  where c.person_id = v_person.id
    and c.active = true
    and c.is_primary = true
    and c.contact_type in ('phone','whatsapp')
  order by case when c.contact_type='whatsapp' then 0 else 1 end, c.updated_at desc
  limit 1;

  if found and v_contact.value_normalized is distinct from v_phone_normalized then
    update mp25m.person_contacts
    set is_primary=false, active=false, ended_at=v_now, updated_at=v_now
    where id=v_contact.id;
  else
    update mp25m.person_contacts
    set is_primary=false, updated_at=v_now
    where person_id=v_person.id and active=true and contact_type in ('phone','whatsapp') and is_primary=true;
  end if;

  select * into v_contact
  from mp25m.person_contacts c
  where c.person_id=v_person.id and c.value_normalized=v_phone_normalized
    and c.contact_type in ('phone','whatsapp')
  order by c.active desc, c.updated_at desc
  limit 1;

  if found then
    update mp25m.person_contacts
    set value_original=v_phone_original,
        active=true,
        ended_at=null,
        is_primary=true,
        visibility=case when v_internal_consent and v_phone_internal then 'internal' else 'private' end,
        last_self_reported_at=v_now,
        updated_at=v_now
    where id=v_contact.id;
  else
    insert into mp25m.person_contacts(
      person_id, contact_type, value_original, value_normalized, is_primary, visibility,
      active, last_self_reported_at, created_at, updated_at
    ) values (
      v_person.id, 'phone', v_phone_original, v_phone_normalized, true,
      case when v_internal_consent and v_phone_internal then 'internal' else 'private' end,
      true, v_now, v_now, v_now
    );
  end if;

  -- Email is optional. If omitted, current primary email is retained but not made visible.
  if v_email_normalized is not null then
    update mp25m.person_contacts
    set is_primary=false, updated_at=v_now
    where person_id=v_person.id and active=true and contact_type='email' and is_primary=true;

    select * into v_contact
    from mp25m.person_contacts c
    where c.person_id=v_person.id and c.contact_type='email' and c.value_normalized=v_email_normalized
    order by c.active desc, c.updated_at desc
    limit 1;

    if found then
      update mp25m.person_contacts
      set value_original=v_email_original, active=true, ended_at=null, is_primary=true,
          visibility=case when v_internal_consent and v_email_internal then 'internal' else 'private' end,
          last_self_reported_at=v_now, updated_at=v_now
      where id=v_contact.id;
    else
      insert into mp25m.person_contacts(
        person_id, contact_type, value_original, value_normalized, is_primary, visibility,
        active, last_self_reported_at, created_at, updated_at
      ) values (
        v_person.id, 'email', v_email_original, v_email_normalized, true,
        case when v_internal_consent and v_email_internal then 'internal' else 'private' end,
        true, v_now, v_now, v_now
      );
    end if;
  else
    update mp25m.person_contacts
    set visibility='private', updated_at=v_now
    where person_id=v_person.id and active=true and contact_type='email';
  end if;

  -- Selected nodes and requested roles.
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'nodes','[]'::jsonb)) loop
    v_node_id := (v_item->>'nodeId')::uuid;

    select * into v_part
    from mp25m.node_participations np
    where np.person_id=v_person.id and np.node_id=v_node_id
      and np.status='active' and np.ended_on is null
    limit 1;

    if not found then
      insert into mp25m.node_participations(person_id,node_id,status,verification_status,notes,created_at,updated_at)
      values(v_person.id,v_node_id,'active','pending','Autodeclarado en formulario de actualización de perfil v1.',v_now,v_now)
      returning * into v_part;
      insert into mp25m_private.profile_review_items(submission_id,person_id,item_type,current_data,proposed_data)
      values(v_submission_id,v_person.id,'node_add','{}'::jsonb,jsonb_build_object('nodeId',v_node_id,'source','self_reported'));
      v_review_count := v_review_count + 1;
    elsif v_part.verification_status='pending' then
      insert into mp25m_private.profile_review_items(submission_id,person_id,item_type,current_data,proposed_data)
      values(v_submission_id,v_person.id,'node_add',jsonb_build_object('verificationStatus','pending'),jsonb_build_object('nodeId',v_node_id,'selfConfirmed',true));
      v_review_count := v_review_count + 1;
    end if;

    for v_role_item in select value from jsonb_array_elements(coalesce(v_item->'roles','[]'::jsonb)) loop
      v_role_code := trim(both '"' from v_role_item::text);
      select * into v_part_role
      from mp25m.node_participation_roles npr
      where npr.participation_id=v_part.id and npr.role_code=v_role_code and npr.ended_on is null
      limit 1;

      if not found then
        insert into mp25m.node_participation_roles(participation_id,role_code,verification_status,notes,created_at)
        values(v_part.id,v_role_code,'pending','Autodeclarado en formulario de actualización de perfil v1.',v_now)
        returning * into v_part_role;
        insert into mp25m_private.profile_review_items(submission_id,person_id,item_type,current_data,proposed_data)
        values(v_submission_id,v_person.id,'role_add','{}'::jsonb,jsonb_build_object('nodeId',v_node_id,'roleCode',v_role_code));
        v_review_count := v_review_count + 1;
      elsif v_part_role.verification_status='pending' then
        insert into mp25m_private.profile_review_items(submission_id,person_id,item_type,current_data,proposed_data)
        values(v_submission_id,v_person.id,'role_add',jsonb_build_object('verificationStatus','pending'),jsonb_build_object('nodeId',v_node_id,'roleCode',v_role_code,'selfConfirmed',true));
        v_review_count := v_review_count + 1;
      end if;
    end loop;

    -- Roles that the person explicitly removed from this selected node.
    for v_part_role in
      select npr.* from mp25m.node_participation_roles npr
      where npr.participation_id=v_part.id and npr.ended_on is null
        and not exists (
          select 1 from jsonb_array_elements(coalesce(v_item->'roles','[]'::jsonb)) rr
          where trim(both '"' from rr::text)=npr.role_code
        )
    loop
      if v_part_role.verification_status='confirmed' then
        insert into mp25m_private.profile_review_items(submission_id,person_id,item_type,current_data,proposed_data)
        values(v_submission_id,v_person.id,'role_remove',jsonb_build_object('nodeId',v_node_id,'roleCode',v_part_role.role_code,'verificationStatus','confirmed'),jsonb_build_object('remove',true));
        v_review_count := v_review_count + 1;
      else
        update mp25m.node_participation_roles
        set ended_on=current_date, verification_status='rejected', notes=coalesce(notes,'') || ' Retirado por la persona en formulario v1.'
        where id=v_part_role.id;
      end if;
    end loop;
  end loop;

  -- Explicit node removals.
  for v_role_item in select value from jsonb_array_elements(coalesce(p_payload->'removedNodeIds','[]'::jsonb)) loop
    v_removed_node_id := trim(both '"' from v_role_item::text)::uuid;
    select * into v_part
    from mp25m.node_participations np
    where np.person_id=v_person.id and np.node_id=v_removed_node_id
      and np.status='active' and np.ended_on is null
    limit 1;

    if found then
      if v_part.verification_status='confirmed' then
        insert into mp25m_private.profile_review_items(submission_id,person_id,item_type,current_data,proposed_data)
        values(v_submission_id,v_person.id,'node_remove',jsonb_build_object('nodeId',v_removed_node_id,'verificationStatus','confirmed'),jsonb_build_object('remove',true));
        v_review_count := v_review_count + 1;
      else
        update mp25m.node_participations
        set status='inactive', verification_status='rejected', ended_on=current_date,
            notes=coalesce(notes,'') || ' Retirado por la persona en formulario v1.', updated_at=v_now
        where id=v_part.id;
        update mp25m.node_participation_roles
        set ended_on=coalesce(ended_on,current_date),
            verification_status=case when verification_status='pending' then 'rejected' else verification_status end
        where participation_id=v_part.id and ended_on is null;
      end if;
    end if;
  end loop;

  -- Skills omitted from the submitted list are removed only if they were not confirmed.
  for v_ps in
    select ps.* from mp25m.person_skills ps
    where ps.person_id=v_person.id and ps.active=true
      and not exists (
        select 1 from jsonb_array_elements(coalesce(p_payload->'skills','[]'::jsonb)) ss
        where (ss->>'skillId')::uuid = ps.skill_id
      )
  loop
    if v_ps.verification_status='confirmed' then
      insert into mp25m_private.profile_review_items(submission_id,person_id,item_type,current_data,proposed_data)
      values(v_submission_id,v_person.id,'skill_remove',jsonb_build_object('skillId',v_ps.skill_id,'verificationStatus','confirmed'),jsonb_build_object('active',false));
      v_review_count := v_review_count + 1;
    else
      update mp25m.person_skills set active=false, updated_at=v_now where id=v_ps.id;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'skills','[]'::jsonb)) loop
    v_skill_id := (v_item->>'skillId')::uuid;
    select * into v_ps from mp25m.person_skills ps
    where ps.person_id=v_person.id and ps.skill_id=v_skill_id;
    if found then
      update mp25m.person_skills
      set proficiency_level=(v_item->>'level')::smallint,
          experience_range=nullif(v_item->>'experienceRange',''),
          experience_notes=nullif(trim(v_item->>'experienceNotes'),''),
          last_self_reported_at=v_now,
          active=true,
          verification_status=case when v_ps.verification_status='confirmed' then 'confirmed' else 'self_reported' end,
          updated_at=v_now
      where id=v_ps.id;
    else
      insert into mp25m.person_skills(
        person_id,skill_id,proficiency_level,verification_status,experience_range,experience_notes,last_self_reported_at,active,created_at,updated_at
      ) values (
        v_person.id,v_skill_id,(v_item->>'level')::smallint,'self_reported',nullif(v_item->>'experienceRange',''),
        nullif(trim(v_item->>'experienceNotes'),''),v_now,true,v_now,v_now
      );
    end if;
  end loop;

  -- Suggestions never enter the controlled skill catalog automatically.
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'skillSuggestions','[]'::jsonb)) loop
    insert into mp25m_private.skill_suggestions(
      submission_id,person_id,proposed_name,normalized_name,proposed_category_code,proposed_level,
      experience_range,description,status,created_at
    ) values (
      v_submission_id,v_person.id,trim(v_item->>'name'),mp25m_private.normalize_text(v_item->>'name'),
      nullif(v_item->>'categoryCode',''),nullif(v_item->>'level','')::smallint,
      nullif(v_item->>'experienceRange',''),nullif(trim(v_item->>'description'),''),'pending',v_now
    );
    v_suggestion_count := v_suggestion_count + 1;
  end loop;
  v_review_count := v_review_count + v_suggestion_count;

  -- Existing explicit vector relations omitted by the person are deactivated unless confirmed.
  for v_pv in
    select pv.* from mp25m.person_vectors pv
    where pv.person_id=v_person.id and pv.active=true and pv.relation_type in ('participates','interested')
      and not exists (
        select 1 from jsonb_array_elements(coalesce(p_payload->'vectors','[]'::jsonb)) vv
        where (vv->>'vectorId')::uuid=pv.vector_id
          and vv->>'relationType'=pv.relation_type
          and ((nullif(vv->>'nodeId',''))::uuid is not distinct from pv.node_id)
      )
  loop
    if v_pv.verification_status='confirmed' then
      insert into mp25m_private.profile_review_items(submission_id,person_id,item_type,current_data,proposed_data)
      values(v_submission_id,v_person.id,'vector_change',jsonb_build_object('vectorId',v_pv.vector_id,'relationType',v_pv.relation_type,'nodeId',v_pv.node_id,'verificationStatus','confirmed'),jsonb_build_object('active',false));
      v_review_count := v_review_count + 1;
    else
      update mp25m.person_vectors set active=false, updated_at=v_now where id=v_pv.id;
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'vectors','[]'::jsonb)) loop
    v_vector_id := (v_item->>'vectorId')::uuid;
    v_relation_type := v_item->>'relationType';
    v_vector_node_id := nullif(v_item->>'nodeId','')::uuid;

    -- Resolve a legacy ambiguous self-report when the person now classifies it explicitly.
    update mp25m.person_vectors
    set active=false, updated_at=v_now
    where person_id=v_person.id and vector_id=v_vector_id
      and node_id is not distinct from v_vector_node_id
      and relation_type='participates_or_interested'
      and verification_status <> 'confirmed';

    select * into v_pv from mp25m.person_vectors pv
    where pv.person_id=v_person.id and pv.vector_id=v_vector_id
      and pv.node_id is not distinct from v_vector_node_id
      and pv.relation_type=v_relation_type
    limit 1;

    if found then
      update mp25m.person_vectors
      set active=true,last_self_reported_at=v_now,
          verification_status=case when v_pv.verification_status='confirmed' then 'confirmed' else 'self_reported' end,
          evidence_text='Autodeclarado en formulario de actualización de perfil v1.',
          ingestion_record_id=v_ingestion_id,updated_at=v_now
      where id=v_pv.id;
    else
      insert into mp25m.person_vectors(
        person_id,vector_id,node_id,relation_type,verification_status,evidence_text,ingestion_record_id,active,last_self_reported_at,created_at,updated_at
      ) values (
        v_person.id,v_vector_id,v_vector_node_id,v_relation_type,'self_reported',
        'Autodeclarado en formulario de actualización de perfil v1.',v_ingestion_id,true,v_now,v_now,v_now
      );
    end if;
  end loop;

  -- Consent history: append one state per type for this submission.
  insert into mp25m.person_consents(person_id,consent_type,status,policy_version,granted_at,withdrawn_at,evidence_ingestion_record_id,notes)
  values
    (v_person.id,'data_processing','granted','profile-v1-2026-08',v_now,null,v_ingestion_id,'Formulario de actualización de perfil v1.'),
    (v_person.id,'communications',case when v_communications_consent then 'granted' else 'withdrawn' end,'profile-v1-2026-08',case when v_communications_consent then v_now else null end,case when v_communications_consent then null else v_now end,v_ingestion_id,'Formulario de actualización de perfil v1.'),
    (v_person.id,'internal_directory',case when v_internal_consent then 'granted' else 'withdrawn' end,'profile-v1-2026-08',case when v_internal_consent then v_now else null end,case when v_internal_consent then null else v_now end,v_ingestion_id,'Formulario de actualización de perfil v1.'),
    (v_person.id,'public_profile',case when v_public_consent then 'granted' else 'withdrawn' end,'profile-v1-2026-08',case when v_public_consent then v_now else null end,case when v_public_consent then null else v_now end,v_ingestion_id,'Formulario de actualización de perfil v1.');

  update mp25m.ingestion_records
  set processing_status=case when v_review_count>0 then 'needs_review' else 'accepted' end,
      metadata=metadata || jsonb_build_object('submission_id',v_submission_id,'review_count',v_review_count,'skill_suggestions',v_suggestion_count)
  where id=v_ingestion_id;

  update mp25m_private.profile_submissions
  set status=case when v_review_count>0 then 'needs_review' else 'processed' end,
      processed_at=v_now,
      diff_summary=jsonb_build_object(
        'nodesSubmitted',jsonb_array_length(coalesce(p_payload->'nodes','[]'::jsonb)),
        'nodesRemoved',jsonb_array_length(coalesce(p_payload->'removedNodeIds','[]'::jsonb)),
        'skillsSubmitted',jsonb_array_length(coalesce(p_payload->'skills','[]'::jsonb)),
        'vectorsSubmitted',jsonb_array_length(coalesce(p_payload->'vectors','[]'::jsonb)),
        'skillSuggestions',v_suggestion_count
      ),
      review_summary=jsonb_build_object('pendingItems',v_review_count,'skillSuggestions',v_suggestion_count)
  where id=v_submission_id;

  update mp25m_private.profile_access_tokens
  set status='used', used_at=v_now, last_used_at=v_now, use_count=use_count+1
  where id=v_token.id;

  return jsonb_build_object(
    'ok',true,
    'submissionId',v_submission_id,
    'status',case when v_review_count>0 then 'needs_review' else 'processed' end,
    'reviewItems',v_review_count,
    'skillSuggestions',v_suggestion_count
  );
end;
$$;

revoke all on function mp25m_private.profile_submit_by_token(text,jsonb,text) from public, anon, authenticated;
grant execute on function mp25m_private.profile_submit_by_token(text,jsonb,text) to service_role;;
