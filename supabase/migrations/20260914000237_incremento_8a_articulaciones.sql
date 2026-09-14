begin;

create table mp25m.opportunity_articulations (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references mp25m.opportunities(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 3 and 200),
  objective text not null check (char_length(btrim(objective)) between 3 and 10000),
  status text not null default 'draft' check (status in ('draft', 'active', 'follow_up', 'paused', 'closed_with_result', 'closed_without_result', 'cancelled')),
  responsible_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  closing_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint opportunity_articulations_closure_check check (
    (status in ('closed_with_result', 'closed_without_result') and responsible_internal_user_id is not null and char_length(btrim(coalesce(closing_summary, ''))) between 3 and 10000 and closed_at is not null)
    or (status not in ('closed_with_result', 'closed_without_result') and closed_at is null)
  )
);

create table mp25m.opportunity_articulation_status_history (
  id uuid primary key default gen_random_uuid(),
  articulation_id uuid not null references mp25m.opportunity_articulations(id) on delete restrict,
  transition_no integer not null check (transition_no > 0),
  status text not null check (status in ('draft', 'active', 'follow_up', 'paused', 'closed_with_result', 'closed_without_result', 'cancelled')),
  rationale text not null check (char_length(btrim(rationale)) between 3 and 10000),
  responsible_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  changed_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  unique (articulation_id, transition_no)
);

create table mp25m.opportunity_articulation_participants (
  id uuid primary key default gen_random_uuid(),
  articulation_id uuid not null references mp25m.opportunity_articulations(id) on delete restrict,
  person_id uuid references mp25m.persons(id) on delete restrict,
  organization_id uuid references mp25m.organizations(id) on delete restrict,
  rationale text not null check (char_length(btrim(rationale)) between 3 and 10000),
  added_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  removal_rationale text,
  constraint opportunity_articulation_participants_one_actor check ((person_id is not null)::integer + (organization_id is not null)::integer = 1),
  constraint opportunity_articulation_participants_removal check ((removed_at is null and removed_by_internal_user_id is null and removal_rationale is null) or (removed_at is not null and removed_by_internal_user_id is not null and char_length(btrim(coalesce(removal_rationale, ''))) between 3 and 10000))
);

create table mp25m.opportunity_articulation_followups (
  id uuid primary key default gen_random_uuid(),
  articulation_id uuid not null references mp25m.opportunity_articulations(id) on delete restrict,
  followup_type text not null default 'general' check (followup_type in ('general', 'meeting', 'commitment', 'contact', 'result')),
  detail text not null check (char_length(btrim(detail)) between 3 and 10000),
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index opportunity_articulations_opportunity_idx on mp25m.opportunity_articulations(opportunity_id, created_at desc);
create index opportunity_articulation_participants_articulation_idx on mp25m.opportunity_articulation_participants(articulation_id) where removed_at is null;
create index opportunity_articulation_followups_articulation_idx on mp25m.opportunity_articulation_followups(articulation_id, created_at desc);

alter table mp25m.opportunity_articulations enable row level security;
alter table mp25m.opportunity_articulation_status_history enable row level security;
alter table mp25m.opportunity_articulation_participants enable row level security;
alter table mp25m.opportunity_articulation_followups enable row level security;

revoke all on mp25m.opportunity_articulations, mp25m.opportunity_articulation_status_history, mp25m.opportunity_articulation_participants, mp25m.opportunity_articulation_followups from public, anon, authenticated;
grant select, insert, update on mp25m.opportunity_articulations to service_role;
grant select, insert on mp25m.opportunity_articulation_status_history, mp25m.opportunity_articulation_followups to service_role;
grant select, insert, update on mp25m.opportunity_articulation_participants to service_role;

create view mp25m_api.opportunity_articulation_list with (security_invoker = true) as
select articulation.id as articulation_id, articulation.opportunity_id, articulation.title, articulation.objective, articulation.status,
  articulation.responsible_internal_user_id, responsible.display_name as responsible_display_name,
  articulation.created_by_internal_user_id, creator.display_name as created_by_display_name,
  articulation.closing_summary, articulation.created_at, articulation.updated_at, articulation.closed_at,
  coalesce(participants.participant_count, 0) as participant_count,
  latest_followup.detail as latest_followup_detail, latest_followup.created_at as latest_followup_at
from mp25m.opportunity_articulations articulation
join mp25m.internal_users creator on creator.id = articulation.created_by_internal_user_id
left join mp25m.internal_users responsible on responsible.id = articulation.responsible_internal_user_id
left join lateral (select count(*)::integer as participant_count from mp25m.opportunity_articulation_participants participant where participant.articulation_id = articulation.id and participant.removed_at is null) participants on true
left join lateral (select followup.detail, followup.created_at from mp25m.opportunity_articulation_followups followup where followup.articulation_id = articulation.id order by followup.created_at desc limit 1) latest_followup on true;

revoke all on mp25m_api.opportunity_articulation_list from public, anon, authenticated;
grant select on mp25m_api.opportunity_articulation_list to service_role;

commit;
