-- Incremento 2 - Opportunities
--
-- First operational backoffice entity.
-- Browser clients do not receive direct table access.
-- Writes will be performed server-side after internal access checks
-- and recorded in mp25m.audit_events by the application layer.

create table mp25m.opportunities (
    id uuid primary key default gen_random_uuid(),

    title text not null,
    description text not null,

    kind text not null default 'opportunity',
    status text not null default 'open',
    priority text not null default 'normal',

    source_text text null,
    due_date date null,

    created_by_internal_user_id uuid not null
        references mp25m.internal_users(id)
        on delete restrict,

    assigned_to_internal_user_id uuid null
        references mp25m.internal_users(id)
        on delete set null,

    resolved_at timestamptz null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint opportunities_title_length_check
        check (
            char_length(btrim(title)) between 3 and 200
        ),

    constraint opportunities_description_length_check
        check (
            char_length(btrim(description)) between 10 and 10000
        ),

    constraint opportunities_kind_check
        check (
            kind in (
                'opportunity',
                'need'
            )
        ),

    constraint opportunities_status_check
        check (
            status in (
                'draft',
                'open',
                'under_analysis',
                'in_progress',
                'resolved',
                'discarded'
            )
        ),

    constraint opportunities_priority_check
        check (
            priority in (
                'low',
                'normal',
                'high',
                'urgent'
            )
        ),

    constraint opportunities_resolved_at_check
        check (
            (
                status = 'resolved'
                and resolved_at is not null
            )
            or
            (
                status <> 'resolved'
                and resolved_at is null
            )
        )
);

create table mp25m.opportunity_nodes (
    opportunity_id uuid not null
        references mp25m.opportunities(id)
        on delete cascade,

    node_id uuid not null
        references mp25m.nodes(id)
        on delete restrict,

    created_at timestamptz not null default now(),

    primary key (
        opportunity_id,
        node_id
    )
);

create index opportunities_status_idx
    on mp25m.opportunities(status);

create index opportunities_kind_idx
    on mp25m.opportunities(kind);

create index opportunities_priority_idx
    on mp25m.opportunities(priority);

create index opportunities_assigned_to_idx
    on mp25m.opportunities(assigned_to_internal_user_id);

create index opportunities_due_date_idx
    on mp25m.opportunities(due_date)
    where due_date is not null;

create index opportunities_created_at_idx
    on mp25m.opportunities(created_at desc);

create index opportunity_nodes_node_id_idx
    on mp25m.opportunity_nodes(node_id);

create trigger trg_opportunities_updated_at
before update on mp25m.opportunities
for each row
execute function mp25m.set_updated_at();

alter table mp25m.opportunities
    enable row level security;

alter table mp25m.opportunity_nodes
    enable row level security;

revoke all on table mp25m.opportunities
    from public, anon, authenticated;

revoke all on table mp25m.opportunity_nodes
    from public, anon, authenticated;

grant select, insert, update
    on table mp25m.opportunities
    to service_role;

grant select, insert, update, delete
    on table mp25m.opportunity_nodes
    to service_role;

comment on table mp25m.opportunities is
    'Productive opportunities and needs tracked internally by MP25M.';

comment on table mp25m.opportunity_nodes is
    'Territorial nodes related to an opportunity or need.';

comment on column mp25m.opportunities.kind is
    'opportunity = productive opportunity; need = productive need';

comment on column mp25m.opportunities.source_text is
    'Free-text source until structured organization and origin entities are available.';

comment on column mp25m.opportunities.due_date is
    'Optional relevant deadline for the opportunity or need.';