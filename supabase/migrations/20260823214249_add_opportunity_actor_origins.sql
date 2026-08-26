-- Incremento 2 - Actors and opportunity origins.
--
-- Persons and organizations remain distinct canonical entities.
-- New actors discovered while registering an opportunity are stored as
-- provisional candidates until they are reviewed and resolved.

create table mp25m.organization_types (
    code text primary key,
    name text not null unique,
    display_order integer not null default 100,
    is_active boolean not null default true
);

insert into mp25m.organization_types (
    code,
    name,
    display_order
)
values
    ('company', 'Empresa', 10),
    ('cooperative', 'Cooperativa', 20),
    ('educational_institution', 'Institución educativa', 30),
    ('union', 'Sindicato', 40),
    ('business_chamber', 'Cámara empresaria', 50),
    ('public_body', 'Organismo público', 60),
    ('health_institution', 'Institución de salud', 70),
    ('cultural_institution', 'Institución cultural', 80),
    ('ngo', 'ONG / asociación civil', 90),
    ('other', 'Otra organización', 100);


create table mp25m.organizations (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    normalized_name text not null,

    organization_type_code text not null
        references mp25m.organization_types(code)
        on delete restrict,

    notes text null,

    record_status text not null default 'active',

    merged_into_id uuid null
        references mp25m.organizations(id)
        on delete restrict,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint organizations_name_length_check
        check (
            char_length(btrim(name)) between 2 and 300
        ),

    constraint organizations_record_status_check
        check (
            record_status in (
                'active',
                'archived',
                'merged'
            )
        ),

    constraint organizations_merged_consistency_check
        check (
            (
                record_status = 'merged'
                and merged_into_id is not null
            )
            or
            (
                record_status <> 'merged'
                and merged_into_id is null
            )
        ),

    constraint organizations_not_merged_into_self_check
        check (
            merged_into_id is null
            or merged_into_id <> id
        )
);

create index organizations_normalized_name_idx
    on mp25m.organizations(normalized_name);

create index organizations_active_search_trgm_idx
    on mp25m.organizations
    using gin (
        normalized_name extensions.gin_trgm_ops
    )
    where record_status = 'active';


create table mp25m.organization_nodes (
    organization_id uuid not null
        references mp25m.organizations(id)
        on delete cascade,

    node_id uuid not null
        references mp25m.nodes(id)
        on delete restrict,

    created_at timestamptz not null default now(),

    primary key (
        organization_id,
        node_id
    )
);

create index organization_nodes_node_id_idx
    on mp25m.organization_nodes(node_id);


create table mp25m.actor_candidates (
    id uuid primary key default gen_random_uuid(),

    actor_kind text not null,

    display_name text not null,
    normalized_name text not null,

    organization_type_code text null
        references mp25m.organization_types(code)
        on delete restrict,

    context_text text null,

    status text not null default 'pending',

    created_by_internal_user_id uuid not null
        references mp25m.internal_users(id)
        on delete restrict,

    resolved_person_id uuid null
        references mp25m.persons(id)
        on delete restrict,

    resolved_organization_id uuid null
        references mp25m.organizations(id)
        on delete restrict,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint actor_candidates_kind_check
        check (
            actor_kind in (
                'person',
                'organization'
            )
        ),

    constraint actor_candidates_name_length_check
        check (
            char_length(btrim(display_name))
            between 2 and 300
        ),

    constraint actor_candidates_type_consistency_check
        check (
            (
                actor_kind = 'organization'
                and organization_type_code is not null
            )
            or
            (
                actor_kind = 'person'
                and organization_type_code is null
            )
        ),

    constraint actor_candidates_status_check
        check (
            status in (
                'pending',
                'approved',
                'rejected',
                'merged'
            )
        ),

    constraint actor_candidates_resolution_check
        check (
            num_nonnulls(
                resolved_person_id,
                resolved_organization_id
            ) <= 1
        )
);

create index actor_candidates_normalized_name_idx
    on mp25m.actor_candidates(normalized_name);

create index actor_candidates_pending_search_trgm_idx
    on mp25m.actor_candidates
    using gin (
        normalized_name extensions.gin_trgm_ops
    )
    where status = 'pending';


create table mp25m.actor_candidate_nodes (
    actor_candidate_id uuid not null
        references mp25m.actor_candidates(id)
        on delete cascade,

    node_id uuid not null
        references mp25m.nodes(id)
        on delete restrict,

    created_at timestamptz not null default now(),

    primary key (
        actor_candidate_id,
        node_id
    )
);

create index actor_candidate_nodes_node_id_idx
    on mp25m.actor_candidate_nodes(node_id);


create table mp25m.opportunity_origins (
    id uuid primary key default gen_random_uuid(),

    opportunity_id uuid not null
        references mp25m.opportunities(id)
        on delete cascade,

    person_id uuid null
        references mp25m.persons(id)
        on delete restrict,

    organization_id uuid null
        references mp25m.organizations(id)
        on delete restrict,

    actor_candidate_id uuid null
        references mp25m.actor_candidates(id)
        on delete restrict,

    created_at timestamptz not null default now(),

    constraint opportunity_origins_exactly_one_actor_check
        check (
            num_nonnulls(
                person_id,
                organization_id,
                actor_candidate_id
            ) = 1
        )
);

create unique index opportunity_origins_person_unique
    on mp25m.opportunity_origins(
        opportunity_id,
        person_id
    )
    where person_id is not null;

create unique index opportunity_origins_organization_unique
    on mp25m.opportunity_origins(
        opportunity_id,
        organization_id
    )
    where organization_id is not null;

create unique index opportunity_origins_candidate_unique
    on mp25m.opportunity_origins(
        opportunity_id,
        actor_candidate_id
    )
    where actor_candidate_id is not null;


create trigger trg_organizations_updated_at
before update on mp25m.organizations
for each row
execute function mp25m.set_updated_at();

create trigger trg_actor_candidates_updated_at
before update on mp25m.actor_candidates
for each row
execute function mp25m.set_updated_at();


alter table mp25m.organization_types
    enable row level security;

alter table mp25m.organizations
    enable row level security;

alter table mp25m.organization_nodes
    enable row level security;

alter table mp25m.actor_candidates
    enable row level security;

alter table mp25m.actor_candidate_nodes
    enable row level security;

alter table mp25m.opportunity_origins
    enable row level security;


revoke all on table mp25m.organization_types
    from public, anon, authenticated;

revoke all on table mp25m.organizations
    from public, anon, authenticated;

revoke all on table mp25m.organization_nodes
    from public, anon, authenticated;

revoke all on table mp25m.actor_candidates
    from public, anon, authenticated;

revoke all on table mp25m.actor_candidate_nodes
    from public, anon, authenticated;

revoke all on table mp25m.opportunity_origins
    from public, anon, authenticated;


grant select
on table mp25m.organization_types
to service_role;

grant select, insert, update
on table mp25m.organizations
to service_role;

grant select, insert, update, delete
on table mp25m.organization_nodes
to service_role;

grant select, insert, update
on table mp25m.actor_candidates
to service_role;

grant select, insert, update, delete
on table mp25m.actor_candidate_nodes
to service_role;

grant select, insert, delete
on table mp25m.opportunity_origins
to service_role;


comment on table mp25m.organizations is
    'Canonical organizations participating in or related to the MP25M territorial network.';

comment on table mp25m.actor_candidates is
    'Provisional people or organizations discovered during backoffice workflows and awaiting review/deduplication.';

comment on table mp25m.opportunity_origins is
    'Persons, organizations or provisional actor candidates that originated an opportunity.';