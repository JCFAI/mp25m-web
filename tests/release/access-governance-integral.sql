-- MP25M_S integral authorization smoke test on a FRESH, disposable Supabase DB.
-- Runs as postgres, switches to the actual service_role, and always ROLLBACKs.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id, instance_id, aud, role, email)
SELECT u.id, '00000000-0000-0000-0000-000000000000'::uuid,
       'authenticated', 'authenticated', u.email
FROM (VALUES
 ('a0000000-0000-4000-8000-000000000001'::uuid,'integral-admin@example.invalid'),
 ('a0000000-0000-4000-8000-000000000002'::uuid,'integral-local@example.invalid'),
 ('a0000000-0000-4000-8000-000000000003'::uuid,'integral-founder@example.invalid'),
 ('a0000000-0000-4000-8000-000000000004'::uuid,'integral-target-a@example.invalid'),
 ('a0000000-0000-4000-8000-000000000005'::uuid,'integral-target-b@example.invalid')
) AS u(id,email);
INSERT INTO mp25m.internal_users(id,auth_user_id) VALUES
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001'),
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002'),
 ('b0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003'),
 ('b0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000004'),
 ('b0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000005');
INSERT INTO mp25m.access_scopes(id,scope_type,scope_entity_id,name) VALUES
 ('c0000000-0000-4000-8000-000000000002','node','d0000000-0000-4000-8000-000000000001','Nodo de pruebas A'),
 ('c0000000-0000-4000-8000-000000000003','node','d0000000-0000-4000-8000-000000000002','Nodo de pruebas B');
INSERT INTO mp25m.access_role_assignments(internal_user_id,access_role_code,access_scope_id)
SELECT 'b0000000-0000-4000-8000-000000000001','administrator',id
FROM mp25m.access_scopes WHERE scope_type='global' AND is_active AND deleted_at IS NULL;
INSERT INTO mp25m.access_role_assignments(internal_user_id,access_role_code,access_scope_id) VALUES
 ('b0000000-0000-4000-8000-000000000002','local_administrator','c0000000-0000-4000-8000-000000000002'),
 ('b0000000-0000-4000-8000-000000000003','founder_access','c0000000-0000-4000-8000-000000000002');
SET LOCAL ROLE service_role;
DO $test$
DECLARE
 admin uuid := 'b0000000-0000-4000-8000-000000000001';
 local_admin uuid := 'b0000000-0000-4000-8000-000000000002';
 founder uuid := 'b0000000-0000-4000-8000-000000000003';
 target_a uuid := 'b0000000-0000-4000-8000-000000000004';
 target_b uuid := 'b0000000-0000-4000-8000-000000000005';
 node_a uuid := 'c0000000-0000-4000-8000-000000000002';
 node_b uuid := 'c0000000-0000-4000-8000-000000000003';
 global_scope uuid;
 granted uuid;
 blocked boolean;
BEGIN
 SELECT id INTO STRICT global_scope FROM mp25m.access_scopes
 WHERE scope_type='global' AND is_active AND deleted_at IS NULL;
 granted:=mp25m_api.grant_internal_access(admin,target_b,'administrator',global_scope,'Prueba integral');
 IF NOT EXISTS (SELECT 1 FROM mp25m.audit_events
   WHERE target_id=granted AND action='internal_access.grant' AND result='allowed') THEN
   RAISE EXCEPTION 'Grant audit missing';
 END IF;
 RAISE NOTICE 'PASS: service_role granted global administrator and audited';
 blocked:=false;
 BEGIN
   PERFORM mp25m_api.grant_internal_access(local_admin,target_a,'administrator',global_scope,'Denegado');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Local escalation permitted'; END IF;
 RAISE NOTICE 'PASS: local admin cannot elevate to global';
 PERFORM mp25m_api.grant_internal_access(local_admin,target_a,'participant',node_a,'Alta local');
 blocked:=false;
 BEGIN
   PERFORM mp25m_api.grant_internal_access(local_admin,target_a,'participant',node_b,'Denegado');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cross-node access allowed'; END IF;
 RAISE NOTICE 'PASS: local admin limited to own node';
 PERFORM mp25m_api.grant_internal_access(founder,target_b,'node_referent',node_a,'Alta referente');
 blocked:=false;
 BEGIN
   PERFORM mp25m_api.grant_internal_access(founder,target_b,'local_administrator',node_a,'Denegado');
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Founder elevated access'; END IF;
 RAISE NOTICE 'PASS: founder cannot appoint administrator';
 PERFORM mp25m_api.revoke_internal_access(admin,granted,'Baja de prueba');
 IF NOT EXISTS (SELECT 1 FROM mp25m.audit_events
   WHERE target_id=granted AND action='internal_access.revoke' AND result='allowed') THEN
   RAISE EXCEPTION 'Revoke audit missing';
 END IF;
 RAISE NOTICE 'PASS: service_role revoked access and audited';
 blocked:=false;
 BEGIN
   UPDATE mp25m.access_role_assignments SET status='revoked',revoked_at=now()
   WHERE internal_user_id=admin AND access_role_code='administrator';
 EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Last admin removal succeeded'; END IF;
 RAISE NOTICE 'PASS: last administrator protected';
END;
$test$;
RESET ROLE;
ROLLBACK;
