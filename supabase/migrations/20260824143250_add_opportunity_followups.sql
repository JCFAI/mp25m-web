-- Incremento 2 - operational follow-up for opportunities.
--
-- Follow-up entries are first-class, append-only records.
-- They represent operational activity, not changes to the canonical
-- opportunity fields.
--
-- Browser clients never access this table directly.

create table mp25m.opportunity_followups (
    id uuid primary key default gen_random_uuid(),

    opportunity_id uuid not null
        references mp25m.opportunities(id)
        on delete restrict,

    kind text not null default 'note'
        check (
            kind in (
                'note',
                'contact',
                'meeting',
                'commitment',
                'delivery',
                'other'
            )
        ),

    body text not null
        check (
            char_length(btrim(body))
                between 3 and 5000
        ),

    created_by_internal_user_id uuid not null
        references mp25m.internal_users(id)
        on delete restrict,

    created_at timestamptz not null
        default now()
);


create index idx_opportunity_followups_opportunity_created
on mp25m.opportunity_followups (
    opportunity_id,
    created_at desc
);


alter table mp25m.opportunity_followups
enable row level security;


revoke all
on mp25m.opportunity_followups
from public, anon, authenticated, service_role;

grant select, insert
on mp25m.opportunity_followups
to service_role;


-- Follow-up history must remain immutable once recorded.

create or replace function
mp25m.opportunity_followups_append_only_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
    raise exception using
        errcode = '42501',
        message = format(
            'mp25m.opportunity_followups is append-only; %s is not allowed',
            tg_op
        );
end;
$function$;


revoke all
on function mp25m.opportunity_followups_append_only_guard()
from public, anon, authenticated, service_role;


create trigger
    trg_opportunity_followups_prevent_update
before update
on mp25m.opportunity_followups
for each row
execute function
    mp25m.opportunity_followups_append_only_guard();


create trigger
    trg_opportunity_followups_prevent_delete
before delete
on mp25m.opportunity_followups
for each row
execute function
    mp25m.opportunity_followups_append_only_guard();


create trigger
    trg_opportunity_followups_prevent_truncate
before truncate
on mp25m.opportunity_followups
for each statement
execute function
    mp25m.opportunity_followups_append_only_guard();


-- Server-only write boundary.

create or replace function
mp25m_api.create_opportunity_followup(
    p_actor_internal_user_id uuid,
    p_opportunity_id uuid,
    p_kind text,
    p_body text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_followup_id uuid;
    v_body text;
begin
    if not exists (
        select 1
        from mp25m.internal_users iu
        where iu.id = p_actor_internal_user_id
          and iu.status = 'active'
          and iu.deleted_at is null
    ) then
        raise exception
            'Invalid or inactive internal user'
            using errcode = '42501';
    end if;

    if not exists (
        select 1
        from mp25m.opportunities o
        where o.id = p_opportunity_id
    ) then
        raise exception
            'Opportunity not found'
            using errcode = 'P0002';
    end if;

    if p_kind not in (
        'note',
        'contact',
        'meeting',
        'commitment',
        'delivery',
        'other'
    ) then
        raise exception
            'Invalid opportunity follow-up kind'
            using errcode = '22023';
    end if;

    v_body := btrim(p_body);

    if v_body is null
       or char_length(v_body) < 3
       or char_length(v_body) > 5000
    then
        raise exception
            'Invalid opportunity follow-up body'
            using errcode = '22023';
    end if;


    insert into mp25m.opportunity_followups (
        opportunity_id,
        kind,
        body,
        created_by_internal_user_id
    )
    values (
        p_opportunity_id,
        p_kind,
        v_body,
        p_actor_internal_user_id
    )
    returning id
    into v_followup_id;


    insert into mp25m.audit_events (
        actor_internal_user_id,
        action,
        target_schema,
        target_table,
        target_id,
        new_data,
        result,
        metadata
    )
    values (
        p_actor_internal_user_id,
        'opportunity.followup.create',
        'mp25m',
        'opportunity_followups',
        v_followup_id,
        jsonb_build_object(
            'kind',
                p_kind,
            'body',
                v_body
        ),
        'allowed',
        jsonb_build_object(
            'opportunity_id',
                p_opportunity_id
        )
    );


    return v_followup_id;
end;
$function$;


revoke all
on function mp25m_api.create_opportunity_followup(
    uuid,
    uuid,
    text,
    text
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.create_opportunity_followup(
    uuid,
    uuid,
    text,
    text
)
to service_role;


comment on table mp25m.opportunity_followups is
    'Append-only operational follow-up entries for opportunities.';

comment on function mp25m_api.create_opportunity_followup(
    uuid,
    uuid,
    text,
    text
) is
    'Creates an immutable operational follow-up entry and its audit event.';