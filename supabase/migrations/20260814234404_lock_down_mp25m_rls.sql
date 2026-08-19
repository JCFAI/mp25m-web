-- MP25M server-only access hardening

-- 1) Enable RLS on every base/partitioned table currently in mp25m.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'mp25m'
      AND c.relkind IN ('r','p')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schema_name, r.table_name);
  END LOOP;
END
$$;

-- 2) Views must run with caller privileges and respect underlying RLS.
ALTER VIEW mp25m.v_node_skill_map SET (security_invoker = true);
ALTER VIEW mp25m.v_node_skill_summary SET (security_invoker = true);

-- 3) Browser-facing roles get no direct schema/object privileges.
REVOKE ALL ON SCHEMA mp25m FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA mp25m FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA mp25m FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA mp25m FROM PUBLIC, anon, authenticated;

-- 4) Backend service role is the only Data API role allowed into this schema.
GRANT USAGE ON SCHEMA mp25m TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA mp25m TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA mp25m TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mp25m TO service_role;

-- 5) Future objects: no browser grants by default; service_role stays backend-enabled.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA mp25m
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA mp25m
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA mp25m
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA mp25m
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA mp25m
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA mp25m
  GRANT EXECUTE ON FUNCTIONS TO service_role;

-- 6) Auto-enable RLS on future mp25m tables created through SQL/migrations.
CREATE OR REPLACE FUNCTION mp25m_private.auto_enable_mp25m_rls()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name = 'mp25m' THEN
      EXECUTE format('ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION mp25m_private.auto_enable_mp25m_rls() FROM PUBLIC, anon, authenticated;

DROP EVENT TRIGGER IF EXISTS mp25m_ensure_rls;
CREATE EVENT TRIGGER mp25m_ensure_rls
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
EXECUTE FUNCTION mp25m_private.auto_enable_mp25m_rls();
;
