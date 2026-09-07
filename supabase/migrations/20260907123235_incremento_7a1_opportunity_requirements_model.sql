-- 7A.1: stable requirement identity, historical revisions and server-only reads.
-- Application writes and their governance belong to 7A.2.
begin;

create table mp25m.opportunity_requirements (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references mp25m.opportunities(id) on delete restrict,
  record_status text not null default 'active',
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_requirements_record_status_check
    check (record_status in ('active', 'withdrawn'))
);

create index opportunity_requirements_opportunity_status_idx
  on mp25m.opportunity_requirements(opportunity_id, record_status);

create function mp25m.guard_opportunity_requirement_identity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if new.id is distinct from old.id
    or new.opportunity_id is distinct from old.opportunity_id
    or new.created_by_internal_user_id is distinct from old.created_by_internal_user_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Opportunity requirement identity is immutable'
      using errcode = '23514';
  end if;

  -- record_status and updated_at remain available for future governed writes.
  return new;
end;
$function$;

revoke all on function mp25m.guard_opportunity_requirement_identity()
from public, anon, authenticated, service_role;

create trigger trg_opportunity_requirements_identity_guard
before update on mp25m.opportunity_requirements
for each row execute function mp25m.guard_opportunity_requirement_identity();

create trigger trg_opportunity_requirements_updated_at
before update on mp25m.opportunity_requirements
for each row execute function mp25m.set_updated_at();

create table mp25m.opportunity_requirement_revisions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references mp25m.opportunity_requirements(id) on delete restrict,
  revision_no integer not null,
  name text not null,
  description text,
  requirement_type text not null,
  is_mandatory boolean not null,
  weight smallint not null default 1,
  satisfaction_criteria text,
  skill_id uuid references mp25m.skills(id) on delete restrict,
  activity_id uuid references mp25m.activities(id) on delete restrict,
  conditions jsonb not null default '{}'::jsonb,
  provenance_kind text not null,
  source_id uuid references mp25m.data_sources(id) on delete restrict,
  ingestion_record_id bigint references mp25m.ingestion_records(id) on delete restrict,
  source_locator text,
  source_excerpt text,
  validation_status text not null default 'declared',
  submitted_by_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  submitted_at timestamptz,
  reviewed_by_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  reviewed_at timestamptz,
  review_reason text,
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_requirement_revisions_number_unique unique (requirement_id, revision_no),
  constraint opportunity_requirement_revisions_number_check check (revision_no > 0),
  constraint opportunity_requirement_revisions_name_check check (char_length(btrim(name)) between 3 and 300),
  constraint opportunity_requirement_revisions_description_check check (char_length(description) <= 10000),
  constraint opportunity_requirement_revisions_criteria_length_check check (char_length(satisfaction_criteria) <= 10000),
  constraint opportunity_requirement_revisions_locator_check check (char_length(source_locator) <= 2000),
  constraint opportunity_requirement_revisions_excerpt_check check (char_length(source_excerpt) <= 10000),
  constraint opportunity_requirement_revisions_reason_check check (char_length(review_reason) <= 2000),
  constraint opportunity_requirement_revisions_type_check check (requirement_type in (
    'skill_knowledge', 'productive_capacity', 'activity_service', 'resource_equipment',
    'certification_authorization', 'scale_volume', 'location_territory',
    'availability_deadline', 'language', 'logistics', 'financial',
    'administrative_legal', 'institutional_access', 'other'
  )),
  constraint opportunity_requirement_revisions_weight_check check (weight between 1 and 5),
  constraint opportunity_requirement_revisions_conditions_check check (jsonb_typeof(conditions) = 'object'),
  constraint opportunity_requirement_revisions_reference_check check (
    num_nonnulls(skill_id, activity_id) <= 1
    and (skill_id is null or requirement_type in ('skill_knowledge', 'productive_capacity'))
    and (activity_id is null or requirement_type = 'activity_service')
  ),
  constraint opportunity_requirement_revisions_provenance_check check (provenance_kind in (
    'human_entry', 'source_explicit', 'human_inference', 'system_suggestion'
  )),
  constraint opportunity_requirement_revisions_validation_check check (validation_status in (
    'declared', 'pending', 'validated', 'rejected'
  )),
  constraint opportunity_requirement_revisions_validated_criteria_check check (
    validation_status <> 'validated'
    or (satisfaction_criteria is not null and char_length(btrim(satisfaction_criteria)) > 0)
  ),
  constraint opportunity_requirement_revisions_validation_metadata_check check (
    (validation_status = 'declared'
      and submitted_by_internal_user_id is null and submitted_at is null
      and reviewed_by_internal_user_id is null and reviewed_at is null and review_reason is null)
    or (validation_status = 'pending'
      and submitted_by_internal_user_id is not null and submitted_at is not null
      and reviewed_by_internal_user_id is null and reviewed_at is null and review_reason is null)
    or (validation_status in ('validated', 'rejected')
      and submitted_by_internal_user_id is not null and submitted_at is not null
      and reviewed_by_internal_user_id is not null and reviewed_at is not null)
  ),
  constraint opportunity_requirement_revisions_rejection_reason_check check (
    validation_status <> 'rejected'
    or (review_reason is not null and char_length(btrim(review_reason)) > 0)
  ),
  constraint opportunity_requirement_revisions_review_time_check check (reviewed_at >= submitted_at)
);

create index opportunity_requirement_revisions_latest_idx
  on mp25m.opportunity_requirement_revisions(requirement_id, revision_no desc);

create function mp25m.guard_opportunity_requirement_revision_immutable()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if new.id is distinct from old.id
    or new.requirement_id is distinct from old.requirement_id
    or new.revision_no is distinct from old.revision_no
    or new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.requirement_type is distinct from old.requirement_type
    or new.is_mandatory is distinct from old.is_mandatory
    or new.weight is distinct from old.weight
    or new.satisfaction_criteria is distinct from old.satisfaction_criteria
    or new.skill_id is distinct from old.skill_id
    or new.activity_id is distinct from old.activity_id
    or new.conditions is distinct from old.conditions
    or new.provenance_kind is distinct from old.provenance_kind
    or new.source_id is distinct from old.source_id
    or new.ingestion_record_id is distinct from old.ingestion_record_id
    or new.source_locator is distinct from old.source_locator
    or new.source_excerpt is distinct from old.source_excerpt
    or new.created_by_internal_user_id is distinct from old.created_by_internal_user_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Opportunity requirement revision content is immutable; create a new revision'
      using errcode = '23514';
  end if;

  -- Validation metadata and updated_at remain mutable; transitions belong to 7A.2.
  return new;
end;
$function$;

revoke all on function mp25m.guard_opportunity_requirement_revision_immutable()
from public, anon, authenticated, service_role;

create trigger trg_opportunity_requirement_revisions_immutable_guard
before update on mp25m.opportunity_requirement_revisions
for each row execute function mp25m.guard_opportunity_requirement_revision_immutable();

create trigger trg_opportunity_requirement_revisions_updated_at
before update on mp25m.opportunity_requirement_revisions
for each row execute function mp25m.set_updated_at();

alter table mp25m.opportunity_requirements enable row level security;
alter table mp25m.opportunity_requirement_revisions enable row level security;

-- Revoke service_role defaults too: only SELECT is granted in this increment.
revoke all on mp25m.opportunity_requirements, mp25m.opportunity_requirement_revisions
from public, anon, authenticated, service_role;
grant select on mp25m.opportunity_requirements, mp25m.opportunity_requirement_revisions to service_role;

create view mp25m_api.opportunity_requirement_revision_list
with (security_invoker = true) as
select
  requirement.id as requirement_id,
  requirement.opportunity_id,
  requirement.record_status,
  revision.id as revision_id,
  revision.revision_no,
  revision.name,
  revision.description,
  revision.requirement_type,
  revision.is_mandatory,
  revision.weight,
  revision.satisfaction_criteria,
  revision.skill_id,
  skill.name::text as skill_name,
  revision.activity_id,
  activity.name::text as activity_name,
  revision.conditions,
  revision.provenance_kind,
  revision.source_id,
  source.name::text as source_name,
  source.source_type::text as source_type,
  revision.ingestion_record_id,
  revision.source_locator,
  revision.source_excerpt,
  revision.validation_status,
  revision.submitted_by_internal_user_id,
  revision.submitted_at,
  revision.reviewed_by_internal_user_id,
  revision.reviewed_at,
  revision.review_reason,
  requirement.created_by_internal_user_id,
  revision.created_by_internal_user_id as revision_created_by_internal_user_id,
  requirement.created_at,
  requirement.updated_at,
  revision.created_at as revision_created_at,
  revision.updated_at as revision_updated_at
from mp25m.opportunity_requirements requirement
join mp25m.opportunity_requirement_revisions revision on revision.requirement_id = requirement.id
-- Do not filter inactive catalogs: historical references remain readable.
left join mp25m.skills skill on skill.id = revision.skill_id
left join mp25m.activities activity on activity.id = revision.activity_id
left join mp25m.data_sources source on source.id = revision.source_id;

create view mp25m_api.opportunity_requirement_list
with (security_invoker = true) as
select
  requirement.id as requirement_id,
  requirement.opportunity_id,
  requirement.record_status,
  current_revision.revision_id,
  current_revision.revision_no,
  current_revision.name,
  current_revision.description,
  current_revision.requirement_type,
  current_revision.is_mandatory,
  current_revision.weight,
  current_revision.satisfaction_criteria,
  current_revision.skill_id,
  current_revision.skill_name,
  current_revision.activity_id,
  current_revision.activity_name,
  current_revision.conditions,
  current_revision.provenance_kind,
  current_revision.source_id,
  current_revision.source_name,
  current_revision.source_type,
  current_revision.ingestion_record_id,
  current_revision.source_locator,
  current_revision.source_excerpt,
  current_revision.validation_status,
  current_revision.submitted_by_internal_user_id,
  current_revision.submitted_at,
  current_revision.reviewed_by_internal_user_id,
  current_revision.reviewed_at,
  current_revision.review_reason,
  requirement.created_by_internal_user_id,
  current_revision.revision_created_by_internal_user_id,
  requirement.created_at,
  requirement.updated_at,
  current_revision.revision_created_at,
  current_revision.revision_updated_at,
  (select count(*) from mp25m.opportunity_requirement_revisions history
    where history.requirement_id = requirement.id) as revision_count
from mp25m.opportunity_requirements requirement
left join lateral (
  select revision.* from mp25m_api.opportunity_requirement_revision_list revision
  where revision.requirement_id = requirement.id
  order by revision.revision_no desc limit 1
) current_revision on true;

revoke all on mp25m_api.opportunity_requirement_list, mp25m_api.opportunity_requirement_revision_list
from public, anon, authenticated, service_role;
grant select on mp25m_api.opportunity_requirement_list, mp25m_api.opportunity_requirement_revision_list to service_role;

comment on table mp25m.opportunity_requirements is
  'Stable opportunity requirement identity. Withdrawal preserves history; no current revision pointer.';
comment on table mp25m.opportunity_requirement_revisions is
  'Historical semantic revisions. Application is read-only in 7A.1. Future governed writes must create a new revision for semantic changes and audit validation metadata transitions.';
comment on column mp25m.opportunity_requirement_revisions.provenance_kind is
  'human_entry: human declaration; source_explicit: explicit source condition; human_inference: human interpretation; system_suggestion: future suggestion requiring human governance.';
comment on column mp25m.opportunity_requirement_revisions.conditions is
  'Heterogeneous structured conditions; not a substitute for type, weight, mandatory flag or satisfaction criteria.';
comment on view mp25m_api.opportunity_requirement_list is
  'One row per requirement, including withdrawn and identities without revisions. Current means highest revision_no, not latest validated revision.';
comment on view mp25m_api.opportunity_requirement_revision_list is
  'All historical revisions with canonical references preserved even when catalogs become inactive.';

commit;
