-- Incremento 2 - readable snapshots for opportunity update history.
--
-- Opportunity update audit events preserve human-readable node and actor
-- labels at the moment of the change. UUIDs remain available internally,
-- but the backoffice never needs to expose them.
--
-- Existing audit events are intentionally left untouched because
-- mp25m.audit_events is append-only.

create or replace function mp25m.enrich_opportunity_audit_snapshot(
    p_snapshot jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, mp25m
as $function$
declare
    v_node_names jsonb;
    v_origins jsonb;
begin
    if p_snapshot is null then
        return null;
    end if;

    select
        coalesce(
            jsonb_agg(
                to_jsonb(
                    regexp_replace(
                        n.name,
                        '^Nodo[[:space:]]+',
                        '',
                        'i'
                    )
                )
                order by requested.ordinality
            ),
            '[]'::jsonb
        )
    into v_node_names
    from jsonb_array_elements_text(
        coalesce(
            p_snapshot -> 'node_ids',
            '[]'::jsonb
        )
    )
    with ordinality
        as requested(node_id_text, ordinality)
    join mp25m.nodes n
      on n.id = requested.node_id_text::uuid;


    select
        coalesce(
            jsonb_agg(
                jsonb_strip_nulls(
                    jsonb_build_object(
                        'actor_type',
                            actor.actor_type,
                        'actor_id',
                            actor.actor_id,
                        'display_name',
                            case
                                when actor.actor_type = 'person'
                                    then p.display_name

                                when actor.actor_type = 'organization'
                                    then o.name

                                when actor.actor_type = 'candidate'
                                    then ac.display_name

                                else null
                            end,
                        'type_label',
                            case
                                when actor.actor_type = 'person'
                                    then 'Persona'

                                when actor.actor_type = 'organization'
                                    then coalesce(
                                        ot.name,
                                        'Organización'
                                    )

                                when actor.actor_type = 'candidate'
                                     and ac.actor_kind = 'person'
                                    then 'Persona'

                                when actor.actor_type = 'candidate'
                                     and ac.actor_kind = 'organization'
                                    then coalesce(
                                        cot.name,
                                        'Organización'
                                    )

                                else null
                            end,
                        'is_provisional',
                            actor.actor_type = 'candidate'
                    )
                )
                order by actor.ordinality
            ),
            '[]'::jsonb
        )
    into v_origins
    from (
        select
            source.item ->> 'actor_type'
                as actor_type,

            (source.item ->> 'actor_id')::uuid
                as actor_id,

            source.ordinality

        from jsonb_array_elements(
            coalesce(
                p_snapshot -> 'origin_actors',
                '[]'::jsonb
            )
        )
        with ordinality
            as source(item, ordinality)
    ) actor

    left join mp25m.persons p
      on actor.actor_type = 'person'
     and p.id = actor.actor_id

    left join mp25m.organizations o
      on actor.actor_type = 'organization'
     and o.id = actor.actor_id

    left join mp25m.organization_types ot
      on ot.code = o.organization_type_code

    left join mp25m.actor_candidates ac
      on actor.actor_type = 'candidate'
     and ac.id = actor.actor_id

    left join mp25m.organization_types cot
      on cot.code = ac.organization_type_code;


    return
        p_snapshot
        ||
        jsonb_build_object(
            'node_names',
                v_node_names,
            'origin_actors',
                v_origins
        );
end;
$function$;


revoke all
on function mp25m.enrich_opportunity_audit_snapshot(
    jsonb
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m.enrich_opportunity_audit_snapshot(
    jsonb
)
to service_role;


create or replace function mp25m.enrich_opportunity_update_audit_event()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, mp25m
as $function$
begin
    if new.action = 'opportunity.update'
       and new.target_schema = 'mp25m'
       and new.target_table = 'opportunities'
    then
        new.old_data :=
            mp25m.enrich_opportunity_audit_snapshot(
                new.old_data
            );

        new.new_data :=
            mp25m.enrich_opportunity_audit_snapshot(
                new.new_data
            );
    end if;

    return new;
end;
$function$;


revoke all
on function mp25m.enrich_opportunity_update_audit_event()
from public, anon, authenticated, service_role;

grant execute
on function mp25m.enrich_opportunity_update_audit_event()
to service_role;


drop trigger if exists
    trg_enrich_opportunity_update_audit_event
on mp25m.audit_events;

create trigger
    trg_enrich_opportunity_update_audit_event
before insert
on mp25m.audit_events
for each row
execute function
    mp25m.enrich_opportunity_update_audit_event();


-- Historical audit events are deliberately not rewritten.
-- New opportunity.update events are enriched by the BEFORE INSERT trigger.


comment on function mp25m.enrich_opportunity_audit_snapshot(
    jsonb
) is
    'Adds human-readable node and actor labels to opportunity audit snapshots.';

comment on function mp25m.enrich_opportunity_update_audit_event() is
    'Enriches opportunity.update audit events with human-readable relationship labels before insertion.';