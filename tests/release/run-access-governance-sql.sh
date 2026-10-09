#!/usr/bin/env bash
# Reproducible MP25M_S authorization tests against an isolated PostgreSQL test container.
# Does not connect to Supabase. All schema changes and fixtures are rolled back.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER="${MP25M_TEST_DB_CONTAINER:-mp25m-access-test-db}"
DATABASE="${MP25M_TEST_DB_NAME:-mp25m_access_test}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
cat > "$TMP" <<'SQL'
BEGIN;
create schema if not exists mp25m;
create schema if not exists mp25m_private;
create schema if not exists mp25m_api;
create table if not exists mp25m.internal_users (
  id uuid primary key, status text default 'active', deleted_at timestamptz
);
create table if not exists mp25m.access_roles (
  code text primary key, name text not null, description text,
  is_administrative boolean default false, is_active boolean default true,
  display_order int default 0, updated_at timestamptz default now(),
  deleted_at timestamptz
);
create table if not exists mp25m.access_scopes (
  id uuid primary key, scope_type text, scope_entity_id uuid,
  is_active boolean default true, deleted_at timestamptz
);
create table if not exists mp25m.access_role_assignments (
  id uuid primary key default gen_random_uuid(),
  internal_user_id uuid references mp25m.internal_users(id),
  access_role_code text references mp25m.access_roles(code),
  access_scope_id uuid references mp25m.access_scopes(id),
  status text default 'active', revoked_at timestamptz,
  valid_from timestamptz default now(), valid_until timestamptz,
  granted_by_internal_user_id uuid, revoked_by_internal_user_id uuid,
  reason text, updated_at timestamptz default now()
);
alter table mp25m.access_roles add column if not exists deleted_at timestamptz;
alter table mp25m.access_scopes add column if not exists scope_entity_id uuid;
alter table mp25m.access_role_assignments
  add column if not exists granted_by_internal_user_id uuid,
  add column if not exists revoked_by_internal_user_id uuid,
  add column if not exists reason text,
  add column if not exists updated_at timestamptz default now();
alter table mp25m.access_role_assignments alter column id set default gen_random_uuid();
create table if not exists mp25m.audit_events (
  id bigint generated always as identity primary key,
  actor_internal_user_id uuid, action text, target_schema text,
  target_table text, target_id uuid, reason text,
  old_data jsonb, new_data jsonb, result text
);
SQL
for name in \
  20261009200000_access_governance_catalog_and_last_admin.sql \
  20261009210000_grant_internal_access.sql \
  20261009220000_revoke_internal_access.sql; do
  cat "$ROOT/supabase/migrations/$name" >> "$TMP"
  printf '\n' >> "$TMP"
done
cat >> "$TMP" <<'SQL'
insert into mp25m.access_scopes(id,scope_type,scope_entity_id) values
 ('10000000-0000-4000-8000-000000000001','global',null),
 ('10000000-0000-4000-8000-000000000002','node','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000003','node','20000000-0000-4000-8000-000000000002');
insert into mp25m.internal_users(id) values
 ('30000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002'),
 ('30000000-0000-4000-8000-000000000003'),
 ('30000000-0000-4000-8000-000000000004'),
 ('30000000-0000-4000-8000-000000000005');
insert into mp25m.access_roles(code,name) values
 ('administrator','Administrador General'),
 ('participant','Participante'),
 ('node_referent','Referente');
insert into mp25m.access_role_assignments(id,internal_user_id,access_role_code,access_scope_id) values
 ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','administrator','10000000-0000-4000-8000-000000000001'),
 ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','local_administrator','10000000-0000-4000-8000-000000000002'),
 ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','founder_access','10000000-0000-4000-8000-000000000002');
DO $test$
DECLARE
 admin uuid := '30000000-0000-4000-8000-000000000001';
 local_admin uuid := '30000000-0000-4000-8000-000000000002';
 founder uuid := '30000000-0000-4000-8000-000000000003';
 target_a uuid := '30000000-0000-4000-8000-000000000004';
 target_b uuid := '30000000-0000-4000-8000-000000000005';
 global_scope uuid := '10000000-0000-4000-8000-000000000001';
 node_a uuid := '10000000-0000-4000-8000-000000000002';
 node_b uuid := '10000000-0000-4000-8000-000000000003';
 granted uuid;
 blocked boolean;
BEGIN
 granted := mp25m_api.grant_internal_access(admin,target_b,'administrator',global_scope,'Alta de prueba');
 IF NOT EXISTS (SELECT 1 FROM mp25m.audit_events WHERE target_id=granted AND action='internal_access.grant') THEN
   RAISE EXCEPTION 'Missing grant audit';
 END IF;
 RAISE NOTICE 'PASS: global administrator grant audited';
 blocked := false;
 BEGIN
   PERFORM mp25m_api.grant_internal_access(local_admin,target_a,'administrator',global_scope,'Prohibido');
 EXCEPTION WHEN insufficient_privilege THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Local admin granted global admin'; END IF;
 RAISE NOTICE 'PASS: local administrator cannot elevate privileges';
 PERFORM mp25m_api.grant_internal_access(local_admin,target_a,'participant',node_a,'Alta participante');
 blocked := false;
 BEGIN
   PERFORM mp25m_api.grant_internal_access(local_admin,target_a,'participant',node_b,'Prohibido');
 EXCEPTION WHEN insufficient_privilege THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Local admin granted access outside node'; END IF;
 RAISE NOTICE 'PASS: local administrator scoped to own node';
 PERFORM mp25m_api.grant_internal_access(founder,target_b,'node_referent',node_a,'Alta referente');
 blocked := false;
 BEGIN
   PERFORM mp25m_api.grant_internal_access(founder,target_b,'node_referent',node_b,'Prohibido');
 EXCEPTION WHEN insufficient_privilege THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Founder acted outside node'; END IF;
 blocked := false;
 BEGIN
   PERFORM mp25m_api.grant_internal_access(founder,target_b,'local_administrator',node_a,'Prohibido');
 EXCEPTION WHEN insufficient_privilege THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Founder granted local administrator'; END IF;
 RAISE NOTICE 'PASS: founder permissions limited';
 PERFORM mp25m_api.revoke_internal_access(admin,granted,'Revocación de prueba');
 IF NOT EXISTS (SELECT 1 FROM mp25m.access_role_assignments WHERE id=granted AND status='revoked') THEN
   RAISE EXCEPTION 'Revocation failed';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM mp25m.audit_events WHERE target_id=granted AND action='internal_access.revoke') THEN
   RAISE EXCEPTION 'Revocation audit missing';
 END IF;
 RAISE NOTICE 'PASS: audited revocation';
 blocked := false;
 BEGIN
   UPDATE mp25m.access_role_assignments SET status='revoked',revoked_at=now()
   WHERE id='40000000-0000-4000-8000-000000000001';
 EXCEPTION WHEN insufficient_privilege THEN blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'Last global administrator removed'; END IF;
 RAISE NOTICE 'PASS: last global administrator protected';
END;
$test$;
ROLLBACK;
SQL
echo "Running isolated SQL tests in $CONTAINER / $DATABASE"
docker exec -i "$CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$DATABASE" < "$TMP"
echo "PASS: isolated SQL suite completed and rolled back"
