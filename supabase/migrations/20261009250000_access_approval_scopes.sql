-- Server-only active scopes for administrative approval dropdown.
CREATE OR REPLACE VIEW mp25m_api.access_approval_scopes
WITH (security_invoker = true)
AS
SELECT id,scope_type,coalesce(nullif(name,''),scope_type) AS name
FROM mp25m.access_scopes
WHERE is_active AND deleted_at IS NULL AND scope_type IN ('global','node');
REVOKE ALL ON mp25m_api.access_approval_scopes FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON mp25m_api.access_approval_scopes TO service_role;
