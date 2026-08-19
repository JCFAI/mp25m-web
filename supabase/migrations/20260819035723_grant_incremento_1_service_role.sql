grant select, insert, update, delete
on table
  mp25m.internal_users,
  mp25m.access_roles,
  mp25m.access_scopes,
  mp25m.access_role_assignments,
  mp25m.audit_events
to service_role;