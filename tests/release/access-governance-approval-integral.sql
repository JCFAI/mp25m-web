\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email) VALUES
 ('e0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','approval-admin@example.invalid'),
 ('e0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','approval-new@example.invalid'),
 ('e0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','approval-unauthorized@example.invalid');
INSERT INTO mp25m.internal_users(id,auth_user_id) VALUES
 ('f0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001'),
 ('f0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003');
INSERT INTO mp25m.access_role_assignments(internal_user_id,access_role_code,access_scope_id)
SELECT 'f0000000-0000-4000-8000-000000000001','administrator',id
FROM mp25m.access_scopes WHERE scope_type='global' AND is_active AND deleted_at IS NULL;
SET LOCAL ROLE service_role;
DO $test$
DECLARE
  admin uuid := 'f0000000-0000-4000-8000-000000000001';
  outsider uuid := 'f0000000-0000-4000-8000-000000000003';
  target_auth uuid := 'e0000000-0000-4000-8000-000000000002';
  global_scope uuid;
  created uuid;
  blocked boolean;
BEGIN
  SELECT id INTO STRICT global_scope FROM mp25m.access_scopes
    WHERE scope_type='global' AND is_active AND deleted_at IS NULL;
  blocked := false;
  BEGIN
    PERFORM mp25m_api.approve_internal_access_request(outsider,target_auth,
      'Cuenta de prueba','participant',global_scope,'Sin permiso');
  EXCEPTION WHEN insufficient_privilege THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Unauthorized approval succeeded'; END IF;
  IF EXISTS (SELECT 1 FROM mp25m.internal_users WHERE auth_user_id=target_auth) THEN
    RAISE EXCEPTION 'Unauthorized approval created internal user'; END IF;
  RAISE NOTICE 'PASS: unauthorized approval denied without side effects';

  created := mp25m_api.approve_internal_access_request(admin,target_auth,
      'Cuenta de prueba','participant',global_scope,'Aprobación de prueba');
  IF NOT EXISTS (SELECT 1 FROM mp25m.access_role_assignments
      WHERE internal_user_id=created AND access_role_code='participant' AND status='active') THEN
    RAISE EXCEPTION 'First grant missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM mp25m.audit_events
      WHERE target_id=created AND action='internal_user.approve' AND result='allowed') THEN
    RAISE EXCEPTION 'Onboarding audit missing'; END IF;
  RAISE NOTICE 'PASS: atomic user approval, grant and audit';

  blocked := false;
  BEGIN
    PERFORM mp25m_api.approve_internal_access_request(admin,target_auth,
      'Duplicado','participant',global_scope,'Duplicado');
  EXCEPTION WHEN unique_violation THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Duplicate auth identity approved'; END IF;
  RAISE NOTICE 'PASS: duplicate Auth identity refused';
END;
$test$;
RESET ROLE;
ROLLBACK;
