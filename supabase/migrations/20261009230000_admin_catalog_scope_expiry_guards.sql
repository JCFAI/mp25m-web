-- MP25M_S: fail-closed guards against disabling administrator catalog/scope
-- and scheduling expiry of effective global administrator grants.
-- Run only after reviewing actual production rows and testing on a full schema.
DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM mp25m.access_role_assignments a
    JOIN mp25m.access_scopes s ON s.id = a.access_scope_id
    WHERE a.access_role_code = 'administrator'
      AND s.scope_type = 'global' AND s.is_active AND s.deleted_at IS NULL
      AND a.status = 'active' AND a.revoked_at IS NULL
      AND a.valid_from <= now()
      AND a.valid_until IS NOT NULL AND a.valid_until > now()
  ) THEN
    RAISE EXCEPTION 'Cannot apply expiry guard: active global administrator grants have scheduled expiry. Review manually first.'
      USING ERRCODE = '23514';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION mp25m_private.guard_admin_catalog()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, mp25m, mp25m_private
AS $fn$
BEGIN
  IF OLD.code <> 'administrator' THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_OP = 'UPDATE'
    AND NEW.code = OLD.code
    AND NEW.is_active = true AND NEW.deleted_at IS NULL
  THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(20261009, 1);
  IF EXISTS (
    SELECT 1 FROM mp25m.access_role_assignments a
    JOIN mp25m.access_scopes s ON s.id=a.access_scope_id
    JOIN mp25m.internal_users u ON u.id=a.internal_user_id
    WHERE a.access_role_code='administrator' AND a.status='active'
      AND a.revoked_at IS NULL AND a.valid_from<=now()
      AND (a.valid_until IS NULL OR a.valid_until>now())
      AND s.scope_type='global' AND s.is_active AND s.deleted_at IS NULL
      AND u.status='active' AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot disable or delete administrator role with active administrators'
      USING ERRCODE='42501';
  END IF;
  RETURN coalesce(NEW,OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS guard_admin_catalog ON mp25m.access_roles;
CREATE TRIGGER guard_admin_catalog BEFORE UPDATE OR DELETE ON mp25m.access_roles
FOR EACH ROW EXECUTE FUNCTION mp25m_private.guard_admin_catalog();

CREATE OR REPLACE FUNCTION mp25m_private.guard_global_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, mp25m, mp25m_private
AS $fn$
BEGIN
  IF OLD.scope_type <> 'global' THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_OP='UPDATE'
    AND NEW.id=OLD.id AND NEW.scope_type='global'
    AND NEW.is_active=true AND NEW.deleted_at IS NULL
  THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(20261009, 1);
  IF EXISTS (
    SELECT 1 FROM mp25m.access_role_assignments a
    JOIN mp25m.internal_users u ON u.id=a.internal_user_id
    WHERE a.access_scope_id=OLD.id AND a.access_role_code='administrator'
      AND a.status='active' AND a.revoked_at IS NULL
      AND a.valid_from<=now() AND (a.valid_until IS NULL OR a.valid_until>now())
      AND u.status='active' AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot disable or delete global scope holding active administrators'
      USING ERRCODE='42501';
  END IF;
  RETURN coalesce(NEW,OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS guard_global_scope ON mp25m.access_scopes;
CREATE TRIGGER guard_global_scope BEFORE UPDATE OR DELETE ON mp25m.access_scopes
FOR EACH ROW EXECUTE FUNCTION mp25m_private.guard_global_scope();

CREATE OR REPLACE FUNCTION mp25m_private.guard_admin_grant_expiry()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, mp25m, mp25m_private
AS $fn$
DECLARE v_global boolean;
BEGIN
  IF NEW.access_role_code <> 'administrator'
    OR NEW.status <> 'active' OR NEW.revoked_at IS NOT NULL
  THEN RETURN NEW; END IF;
  SELECT (scope_type='global') INTO v_global
  FROM mp25m.access_scopes WHERE id=NEW.access_scope_id;
  IF coalesce(v_global,false) AND
    (NEW.valid_until IS NOT NULL OR NEW.valid_from > now())
  THEN
    RAISE EXCEPTION 'Active global administrator grants must start now or earlier and cannot expire automatically'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS guard_admin_grant_expiry ON mp25m.access_role_assignments;
CREATE TRIGGER guard_admin_grant_expiry BEFORE INSERT OR UPDATE ON mp25m.access_role_assignments
FOR EACH ROW EXECUTE FUNCTION mp25m_private.guard_admin_grant_expiry();
