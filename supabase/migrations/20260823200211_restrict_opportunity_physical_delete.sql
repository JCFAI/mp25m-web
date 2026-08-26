-- Opportunities are lifecycle-managed through status.
-- Physical deletion is intentionally unavailable to the application backend.

revoke delete
on table mp25m.opportunities
from service_role;