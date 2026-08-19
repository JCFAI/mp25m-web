create schema if not exists mp25m_private;
revoke all on schema mp25m_private from public;
revoke all on schema mp25m_private from anon;
revoke all on schema mp25m_private from authenticated;

grant usage on schema mp25m_private to service_role;

create table if not exists mp25m_private.profile_access_tokens (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references mp25m.persons(id) on delete cascade,
  token_hash char(64) not null unique,
  status varchar(20) not null default 'active' check (status in ('active','used','revoked','expired')),
  expires_at timestamptz not null,
  first_used_at timestamptz,
  last_used_at timestamptz,
  use_count integer not null default 0 check (use_count >= 0),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_profile_access_tokens_person on mp25m_private.profile_access_tokens(person_id);
create index if not exists idx_profile_access_tokens_status_expiry on mp25m_private.profile_access_tokens(status, expires_at);

create table if not exists mp25m_private.profile_submissions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references mp25m.persons(id) on delete cascade,
  access_token_id uuid references mp25m_private.profile_access_tokens(id) on delete set null,
  ingestion_record_id bigint references mp25m.ingestion_records(id) on delete set null,
  form_version varchar(30) not null,
  status varchar(20) not null default 'received' check (status in ('received','processed','needs_review','failed')),
  submitted_at timestamptz not null default now(),
  processed_at timestamptz,
  diff_summary jsonb not null default '{}'::jsonb,
  review_summary jsonb not null default '{}'::jsonb,
  error_message text
);

create index if not exists idx_profile_submissions_person on mp25m_private.profile_submissions(person_id, submitted_at desc);
create index if not exists idx_profile_submissions_status on mp25m_private.profile_submissions(status);

create table if not exists mp25m_private.profile_review_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references mp25m_private.profile_submissions(id) on delete cascade,
  person_id uuid not null references mp25m.persons(id) on delete cascade,
  item_type varchar(40) not null check (item_type in (
    'node_add','node_remove','role_add','role_remove','skill_remove','skill_level_change',
    'contact_change','identity_change','vector_change','consent_change','other'
  )),
  current_data jsonb not null default '{}'::jsonb,
  proposed_data jsonb not null default '{}'::jsonb,
  status varchar(20) not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text
);

create index if not exists idx_profile_review_items_status on mp25m_private.profile_review_items(status, created_at);
create index if not exists idx_profile_review_items_person on mp25m_private.profile_review_items(person_id);

create table if not exists mp25m_private.skill_suggestions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references mp25m_private.profile_submissions(id) on delete set null,
  person_id uuid not null references mp25m.persons(id) on delete cascade,
  proposed_name varchar(180) not null,
  normalized_name varchar(180) not null,
  proposed_category_code varchar(40) references mp25m.skill_categories(code) on delete set null,
  proposed_level smallint check (proposed_level between 1 and 5),
  experience_range varchar(20) check (experience_range in ('lt_1','1_3','4_7','8_15','gt_15','unspecified')),
  description text,
  status varchar(20) not null default 'pending' check (status in ('pending','approved','merged','rejected')),
  resolved_skill_id uuid references mp25m.skills(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  review_notes text
);

create index if not exists idx_skill_suggestions_status on mp25m_private.skill_suggestions(status, created_at);
create index if not exists idx_skill_suggestions_normalized on mp25m_private.skill_suggestions(normalized_name);

alter table mp25m.person_skills
  add column if not exists experience_range varchar(20),
  add column if not exists experience_notes text,
  add column if not exists last_self_reported_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'person_skills_experience_range_check'
      and conrelid = 'mp25m.person_skills'::regclass
  ) then
    alter table mp25m.person_skills
      add constraint person_skills_experience_range_check
      check (experience_range is null or experience_range in ('lt_1','1_3','4_7','8_15','gt_15','unspecified'));
  end if;
end $$;

grant select, insert, update, delete on all tables in schema mp25m_private to service_role;
alter default privileges in schema mp25m_private grant select, insert, update, delete on tables to service_role;;
