-- Atomic onboarding: create an internal user and the first access grant.
-- Supabase Auth user must already exist. No canonical territorial person is created.
-- Only the authenticated server action may resolve the acting internal user ID.
CREATE OR REPLACE FUNCTION mp25m_api.approve_internal_access_request(
  p_actor_internal_user_id uuid,
  p_auth_user_id uuid,
  p_display_name text,
  p_role_code text,
  p_scope_id uuid,
  p_reason text
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, mp25m, mp25m_api
AS $function$
DECLARE
  v_user_id uuid;
  v_grant_id uuid;
  v_name text := btrim(coalesce(p_display_name,''));
BEGIN
  IF p_actor_internal_user_id IS NULL OR p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Actor and Auth user are required' USING ERRCODE='22023';
  END IF;
  IF length(v_name) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Invalid display name' USING ERRCODE='22023';
  END IF;
  IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 2000 THEN
    RAISE EXCEPTION 'Invalid reason' USING ERRCODE='22023';
  END IF;

  -- Only global administrators may onboard new backoffice identities.
  IF NOT EXISTS (
    SELECT 1
    FROM mp25m.internal_users u
    JOIN mp25m.access_role_assignments a ON a.internal_user_id=u.id
    JOIN mp25m.access_roles r ON r.code=a.access_role_code
    JOIN mp25m.access_scopes s ON s.id=a.access_scope_id
    WHERE u.id=p_actor_internal_user_id AND u.status='active' AND u.deleted_at IS NULL
      AND a.status='active' AND a.revoked_at IS NULL
      AND a.valid_from<=now() AND (a.valid_until IS NULL OR a.valid_until>now())
      AND r.code='administrator' AND r.is_active AND r.deleted_at IS NULL
      AND s.scope_type='global' AND s.is_active AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Global administrator required' USING ERRCODE='42501';
  END IF;

  -- Validate role and scope before creating anything. The grant RPC repeats
  -- the full authorization check inside this same database transaction.
  IF NOT EXISTS (
    SELECT 1 FROM mp25m.access_roles r
    JOIN mp25m.access_scopes s ON s.id=p_scope_id
    WHERE r.code=p_role_code AND r.is_active AND r.deleted_at IS NULL
      AND s.is_active AND s.deleted_at IS NULL
      AND ((r.code='administrator' AND s.scope_type='global')
        OR (r.code IN ('local_administrator','founder_access','node_referent') AND s.scope_type='node')
        OR (r.code IN ('participant','validator','articulator','authority_analyst')
            AND s.scope_type IN ('node','global')))
  ) THEN
    RAISE EXCEPTION 'Invalid role or scope for onboarding' USING ERRCODE='42501';
  END IF;

  -- Unique auth_user_id constraint prevents duplicate internal identities.
  -- FK to auth.users guarantees that the Auth account exists.
  INSERT INTO mp25m.internal_users (auth_user_id, display_name, created_by_internal_user_id)
  VALUES (p_auth_user_id, v_name, p_actor_internal_user_id)
  RETURNING id INTO v_user_id;

  SELECT mp25m_api.grant_internal_access(
    p_actor_internal_user_id,v_user_id,p_role_code,p_scope_id,p_reason
  ) INTO v_grant_id;

  INSERT INTO mp25m.audit_events (
    actor_internal_user_id,action,target_schema,target_table,target_id,
    reason,new_data,result
  ) VALUES (
    p_actor_internal_user_id,'internal_user.approve','mp25m','internal_users',
    v_user_id,btrim(p_reason),
    jsonb_build_object('auth_user_id',p_auth_user_id,'role',p_role_code,
      'scope_id',p_scope_id,'first_assignment_id',v_grant_id),
    'allowed'
  );
  RETURN v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION mp25m_api.approve_internal_access_request(uuid,uuid,text,text,uuid,text)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION mp25m_api.approve_internal_access_request(uuid,uuid,text,text,uuid,text)
TO service_role;
