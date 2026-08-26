-- Incremento 2 - tighten effective service_role privileges
-- for the actor/origin model.

-- Catalog managed through migrations, not application writes.
revoke insert, update, delete
on table mp25m.organization_types
from service_role;

-- Canonical organizations are archived/merged, never physically deleted.
revoke delete
on table mp25m.organizations
from service_role;

-- Provisional actors preserve review and provenance history.
revoke delete
on table mp25m.actor_candidates
from service_role;

-- Opportunity origins are added or removed as relationships;
-- they are not updated in place.
revoke update
on table mp25m.opportunity_origins
from service_role;