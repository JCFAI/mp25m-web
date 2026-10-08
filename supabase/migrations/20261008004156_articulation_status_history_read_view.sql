create or replace view
mp25m_api.opportunity_articulation_status_history_list
with (security_invoker = true)
as
select
  history.id as history_id,
  history.articulation_id,
  history.transition_no,
  history.status,
  history.rationale,
  history.responsible_internal_user_id,
  responsible.display_name as responsible_display_name,
  history.changed_by_internal_user_id,
  changed_by.display_name as changed_by_display_name,
  history.changed_at
from mp25m.opportunity_articulation_status_history history
join mp25m.internal_users changed_by
  on changed_by.id =
    history.changed_by_internal_user_id
left join mp25m.internal_users responsible
  on responsible.id =
    history.responsible_internal_user_id;

revoke all
  on mp25m_api.opportunity_articulation_status_history_list
  from public, anon, authenticated;

grant select
  on mp25m_api.opportunity_articulation_status_history_list
  to service_role;

comment on view
  mp25m_api.opportunity_articulation_status_history_list
is
  'Immutable status transition history for opportunity articulations, including responsible and author display names.';
