-- Expose existing backoffice identities to trusted server only.
-- Accounts already linked (including suspended/revoked) must not appear as NEW requests.
CREATE OR REPLACE VIEW mp25m_api.internal_account_links
WITH (security_invoker = true)
AS
SELECT auth_user_id, id AS internal_user_id, status
FROM mp25m.internal_users;
REVOKE ALL ON mp25m_api.internal_account_links
FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON mp25m_api.internal_account_links TO service_role;
