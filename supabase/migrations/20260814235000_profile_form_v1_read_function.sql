create or replace function mp25m_private.profile_get_by_token(p_token_hash text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token mp25m_private.profile_access_tokens%rowtype;
  v_person mp25m.persons%rowtype;
  v_result jsonb;
begin
  select * into v_token
  from mp25m_private.profile_access_tokens
  where token_hash = p_token_hash
    and status = 'active'
    and expires_at > now()
    and used_at is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_token');
  end if;

  select * into v_person
  from mp25m.persons
  where id = v_token.person_id
    and record_status = 'active';

  if not found then
    return jsonb_build_object('ok', false, 'error', 'person_not_available');
  end if;

  update mp25m_private.profile_access_tokens
  set first_used_at = coalesce(first_used_at, now()),
      last_used_at = now(),
      use_count = use_count + 1
  where id = v_token.id;

  select jsonb_build_object(
    'ok', true,
    'formVersion', '1.0',
    'profile', jsonb_build_object(
      'displayName', v_person.display_name,
      'firstName', v_person.first_name,
      'lastName', v_person.last_name,
      'residenceProvince', v_person.residence_province_text,
      'residenceLocality', v_person.residence_locality_text,
      'primaryActivity', v_person.primary_activity_text,
      'profession', v_person.profession_text,
      'experience', v_person.experience_text,
      'contacts', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', c.id,
          'type', c.contact_type,
          'value', c.value_original,
          'normalized', c.value_normalized,
          'isPrimary', c.is_primary,
          'visibility', c.visibility
        ) order by c.is_primary desc, c.created_at)
        from mp25m.person_contacts c
        where c.person_id = v_person.id and c.active = true
      ), '[]'::jsonb),
      'nodes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'participationId', np.id,
          'nodeId', n.id,
          'nodeNumber', n.node_number,
          'nodeName', n.name,
          'verificationStatus', np.verification_status,
          'roles', coalesce((
            select jsonb_agg(jsonb_build_object(
              'code', r.code,
              'name', r.name,
              'verificationStatus', npr.verification_status
            ) order by r.name)
            from mp25m.node_participation_roles npr
            join mp25m.roles r on r.code = npr.role_code
            where npr.participation_id = np.id and npr.ended_on is null
          ), '[]'::jsonb)
        ) order by n.node_number nulls last, n.name)
        from mp25m.node_participations np
        join mp25m.nodes n on n.id = np.node_id
        where np.person_id = v_person.id
          and np.status = 'active'
          and np.ended_on is null
      ), '[]'::jsonb),
      'skills', coalesce((
        select jsonb_agg(jsonb_build_object(
          'personSkillId', ps.id,
          'skillId', s.id,
          'name', s.name,
          'categoryCode', s.category_code,
          'level', ps.proficiency_level,
          'experienceRange', ps.experience_range,
          'experienceNotes', ps.experience_notes,
          'verificationStatus', ps.verification_status
        ) order by s.name)
        from mp25m.person_skills ps
        join mp25m.skills s on s.id = ps.skill_id
        where ps.person_id = v_person.id and ps.active = true
      ), '[]'::jsonb),
      'vectors', coalesce((
        select jsonb_agg(jsonb_build_object(
          'personVectorId', pv.id,
          'vectorId', v.id,
          'name', v.name,
          'relationType', pv.relation_type,
          'nodeId', pv.node_id,
          'verificationStatus', pv.verification_status
        ) order by v.name, pv.relation_type)
        from mp25m.person_vectors pv
        join mp25m.vectors v on v.id = pv.vector_id
        where pv.person_id = v_person.id and pv.active = true
      ), '[]'::jsonb),
      'consents', coalesce((
        select jsonb_agg(jsonb_build_object(
          'type', x.consent_type,
          'status', x.status,
          'policyVersion', x.policy_version,
          'grantedAt', x.granted_at,
          'withdrawnAt', x.withdrawn_at
        ) order by x.consent_type)
        from (
          select distinct on (pc.consent_type)
            pc.consent_type, pc.status, pc.policy_version, pc.granted_at, pc.withdrawn_at, pc.created_at
          from mp25m.person_consents pc
          where pc.person_id = v_person.id
          order by pc.consent_type, pc.created_at desc
        ) x
      ), '[]'::jsonb)
    ),
    'catalogs', jsonb_build_object(
      'nodes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', n.id,
          'number', n.node_number,
          'name', n.name,
          'slug', n.slug
        ) order by n.node_number nulls last, n.name)
        from mp25m.nodes n
        where n.status in ('forming','active')
      ), '[]'::jsonb),
      'roles', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', r.code,
          'name', r.name,
          'description', r.description,
          'isInternal', r.is_internal
        ) order by r.name)
        from mp25m.roles r where r.active = true
      ), '[]'::jsonb),
      'skillCategories', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', sc.code,
          'name', sc.name,
          'description', sc.description
        ) order by sc.name)
        from mp25m.skill_categories sc where sc.active = true
      ), '[]'::jsonb),
      'skills', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'categoryCode', s.category_code,
          'description', s.description
        ) order by s.name)
        from mp25m.skills s where s.active = true
      ), '[]'::jsonb),
      'vectors', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', v.id,
          'name', v.name,
          'description', v.description
        ) order by v.name)
        from mp25m.vectors v where v.active = true
      ), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function mp25m_private.profile_get_by_token(text) from public, anon, authenticated;
grant execute on function mp25m_private.profile_get_by_token(text) to service_role;;
