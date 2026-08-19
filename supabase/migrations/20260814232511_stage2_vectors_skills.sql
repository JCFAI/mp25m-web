create table if not exists mp25m.skill_categories (
  code varchar(40) primary key,
  name varchar(120) not null unique,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists mp25m.skills (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null,
  normalized_name varchar(180) not null unique,
  category_code varchar(40) references mp25m.skill_categories(code) on delete restrict,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mp25m.skill_aliases (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references mp25m.skills(id) on delete cascade,
  alias varchar(180) not null,
  normalized_alias varchar(180) not null,
  unique(skill_id, normalized_alias)
);
create index if not exists idx_skill_aliases_normalized on mp25m.skill_aliases(normalized_alias);

create table if not exists mp25m.person_skills (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references mp25m.persons(id) on delete restrict,
  skill_id uuid not null references mp25m.skills(id) on delete restrict,
  proficiency_level smallint check (proficiency_level between 1 and 5),
  verification_status varchar(20) not null default 'self_reported'
    check (verification_status in ('self_reported','candidate','confirmed','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(person_id, skill_id)
);
create index if not exists idx_person_skills_person on mp25m.person_skills(person_id);
create index if not exists idx_person_skills_skill on mp25m.person_skills(skill_id);
create index if not exists idx_person_skills_status on mp25m.person_skills(verification_status);

create table if not exists mp25m.person_skill_evidence (
  id uuid primary key default gen_random_uuid(),
  person_skill_id uuid not null references mp25m.person_skills(id) on delete cascade,
  ingestion_record_id bigint references mp25m.ingestion_records(id) on delete set null,
  evidence_type varchar(30) not null
    check (evidence_type in ('self_reported_activity','self_reported_interest','derived_from_shifted_field','admin_validation','other')),
  evidence_text text not null,
  confidence numeric(4,3) check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);
create index if not exists idx_person_skill_evidence_skill on mp25m.person_skill_evidence(person_skill_id);
create index if not exists idx_person_skill_evidence_ingestion on mp25m.person_skill_evidence(ingestion_record_id);

create table if not exists mp25m.vectors (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null,
  normalized_name varchar(180) not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mp25m.vector_aliases (
  id uuid primary key default gen_random_uuid(),
  vector_id uuid not null references mp25m.vectors(id) on delete cascade,
  alias varchar(180) not null,
  normalized_alias varchar(180) not null,
  unique(vector_id, normalized_alias)
);
create index if not exists idx_vector_aliases_normalized on mp25m.vector_aliases(normalized_alias);

create table if not exists mp25m.node_vectors (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references mp25m.nodes(id) on delete restrict,
  vector_id uuid not null references mp25m.vectors(id) on delete restrict,
  verification_status varchar(20) not null default 'pending'
    check (verification_status in ('pending','confirmed','rejected')),
  evidence_text text,
  source_id uuid references mp25m.data_sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(node_id, vector_id)
);
create index if not exists idx_node_vectors_node on mp25m.node_vectors(node_id);
create index if not exists idx_node_vectors_vector on mp25m.node_vectors(vector_id);

create table if not exists mp25m.person_vectors (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references mp25m.persons(id) on delete restrict,
  vector_id uuid not null references mp25m.vectors(id) on delete restrict,
  node_id uuid references mp25m.nodes(id) on delete restrict,
  relation_type varchar(30) not null default 'participates_or_interested'
    check (relation_type in ('participates_or_interested','participates','interested','coordinates','contact')),
  verification_status varchar(20) not null default 'self_reported'
    check (verification_status in ('self_reported','pending','confirmed','rejected')),
  evidence_text text,
  ingestion_record_id bigint references mp25m.ingestion_records(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_person_vectors_scope
on mp25m.person_vectors(person_id, vector_id, coalesce(node_id,'00000000-0000-0000-0000-000000000000'::uuid), relation_type);
create index if not exists idx_person_vectors_person on mp25m.person_vectors(person_id);
create index if not exists idx_person_vectors_vector on mp25m.person_vectors(vector_id);

drop trigger if exists trg_skills_updated_at on mp25m.skills;
create trigger trg_skills_updated_at before update on mp25m.skills
for each row execute function mp25m.set_updated_at();

drop trigger if exists trg_person_skills_updated_at on mp25m.person_skills;
create trigger trg_person_skills_updated_at before update on mp25m.person_skills
for each row execute function mp25m.set_updated_at();

drop trigger if exists trg_vectors_updated_at on mp25m.vectors;
create trigger trg_vectors_updated_at before update on mp25m.vectors
for each row execute function mp25m.set_updated_at();

drop trigger if exists trg_node_vectors_updated_at on mp25m.node_vectors;
create trigger trg_node_vectors_updated_at before update on mp25m.node_vectors
for each row execute function mp25m.set_updated_at();

drop view if exists mp25m.v_node_skill_map;
create view mp25m.v_node_skill_map with (security_invoker = true) as
select
  n.id as node_id,
  n.node_number,
  n.name as node_name,
  s.id as skill_id,
  s.name as skill_name,
  sc.name as skill_category,
  count(distinct ps.person_id) as people_count,
  array_agg(distinct p.display_name order by p.display_name) as people
from mp25m.node_participations np
join mp25m.nodes n on n.id=np.node_id
join mp25m.persons p on p.id=np.person_id
join mp25m.person_skills ps on ps.person_id=p.id
join mp25m.skills s on s.id=ps.skill_id
left join mp25m.skill_categories sc on sc.code=s.category_code
where np.verification_status='confirmed'
  and np.status='active'
  and ps.verification_status in ('self_reported','confirmed')
group by n.id,n.node_number,n.name,s.id,s.name,sc.name;

drop view if exists mp25m.v_node_skill_summary;
create view mp25m.v_node_skill_summary with (security_invoker = true) as
select
  n.id as node_id,
  n.node_number,
  n.name as node_name,
  count(distinct np.person_id) as confirmed_people,
  count(distinct ps.skill_id) filter (where ps.verification_status in ('self_reported','confirmed')) as distinct_skills,
  count(distinct ps.person_id) filter (where ps.verification_status in ('self_reported','confirmed')) as people_with_skills
from mp25m.nodes n
left join mp25m.node_participations np on np.node_id=n.id and np.verification_status='confirmed' and np.status='active'
left join mp25m.person_skills ps on ps.person_id=np.person_id
group by n.id,n.node_number,n.name;;
