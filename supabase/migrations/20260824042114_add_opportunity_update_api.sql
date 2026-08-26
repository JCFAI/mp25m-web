-- Incremento 2 - atomic opportunity editing.
--
-- Updates the opportunity descriptive data, territorial nodes and origin actors
-- in one transaction while preserving audit history.
--
-- Opportunity lifecycle status is intentionally managed by
-- mp25m_api.update_opportunity_status().

create or replace function mp25m_api.update_opportunity_details(
    p_actor_internal_user_id uuid,
    p_opportunity_id uuid,
    p_title text,
    p_description text,
    p_kind text,
    p_priority text,
    p_source_text text,
    p_due_date date,
    p_node_ids uuid[],
    p_origin_actors jsonb default '[]'::jsonb,
    p_new_actor_candidates jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
    v_old_opportunity mp25m.opportunities%rowtype;

    v_old_node_ids uuid[];
    v_new_node_ids uuid[];

    v_old_origins jsonb;
    v_new_origins jsonb;

    v_actor jsonb;
    v_actor_type text;
    v_actor_id uuid;

    v_candidate jsonb;
    v_candidate_id uuid;
    v_candidate_kind text;
    v_candidate_name text;
    v_candidate_normalized_name text;
    v_candidate_organization_type text;
    v_candidate_context text;
    v_candidate_node_ids uuid[];
begin
    if not exists (
        select 1
        from mp25m.internal_users iu
        where iu.id = p_actor_internal_user_id
          and iu.status = 'active'
          and iu.deleted_at is null
    ) then
        raise exception 'Invalid or inactive internal user'
            using errcode = '42501';
    end if;

    select *
    into v_old_opportunity
    from mp25m.opportunities o
    where o.id = p_opportunity_id
    for update;

    if not found then
        raise exception 'Opportunity not found'
            using errcode = 'P0002';
    end if;

    if p_kind not in (
        'opportunity',
        'need'
    ) then
        raise exception 'Invalid opportunity kind'
            using errcode = '22023';
    end if;

    if p_priority not in (
        'low',
        'normal',
        'high',
        'urgent'
    ) then
        raise exception 'Invalid opportunity priority'
            using errcode = '22023';
    end if;

    if jsonb_typeof(
        coalesce(
            p_origin_actors,
            '[]'::jsonb
        )
    ) <> 'array' then
        raise exception 'Origin actors must be a JSON array'
            using errcode = '22023';
    end if;

    if jsonb_typeof(
        coalesce(
            p_new_actor_candidates,
            '[]'::jsonb
        )
    ) <> 'array' then
        raise exception 'New actor candidates must be a JSON array'
            using errcode = '22023';
    end if;

    select
        coalesce(
            array_agg(
                distinct requested.node_id
                order by requested.node_id
            ),
            '{}'::uuid[]
        )
    into v_new_node_ids
    from unnest(
        coalesce(
            p_node_ids,
            '{}'::uuid[]
        )
    ) requested(node_id);

    if exists (
        select 1
        from unnest(v_new_node_ids) requested(node_id)
        left join mp25m.nodes n
          on n.id = requested.node_id
        where n.id is null
           or n.status <> 'active'
    ) then
        raise exception 'One or more opportunity nodes are invalid or inactive'
            using errcode = '23503';
    end if;

    select
        coalesce(
            array_agg(
                node_id
                order by node_id
            ),
            '{}'::uuid[]
        )
    into v_old_node_ids
    from mp25m.opportunity_nodes
    where opportunity_id = p_opportunity_id;

    select
        coalesce(
            jsonb_agg(
                origin
                order by
                    origin ->> 'actor_type',
                    origin ->> 'actor_id'
            ),
            '[]'::jsonb
        )
    into v_old_origins
    from (
        select
            jsonb_build_object(
                'actor_type',
                case
                    when oo.person_id is not null
                        then 'person'
                    when oo.organization_id is not null
                        then 'organization'
                    else 'candidate'
                end,
                'actor_id',
                coalesce(
                    oo.person_id,
                    oo.organization_id,
                    oo.actor_candidate_id
                )
            ) as origin
        from mp25m.opportunity_origins oo
        where oo.opportunity_id = p_opportunity_id
    ) existing_origins;

    update mp25m.opportunities
    set
        title = btrim(p_title),
        description = btrim(p_description),
        kind = p_kind,
        priority = p_priority,
        source_text = nullif(
            btrim(p_source_text),
            ''
        ),
        due_date = p_due_date
    where id = p_opportunity_id;

    delete from mp25m.opportunity_nodes
    where opportunity_id = p_opportunity_id;

    insert into mp25m.opportunity_nodes (
        opportunity_id,
        node_id
    )
    select
        p_opportunity_id,
        requested.node_id
    from unnest(
        v_new_node_ids
    ) requested(node_id);

    delete from mp25m.opportunity_origins
    where opportunity_id = p_opportunity_id;

    for v_actor in
        select value
        from jsonb_array_elements(
            coalesce(
                p_origin_actors,
                '[]'::jsonb
            )
        )
    loop
        v_actor_type :=
            nullif(
                btrim(
                    v_actor ->> 'actor_type'
                ),
                ''
            );

        begin
            v_actor_id :=
                (v_actor ->> 'actor_id')::uuid;
        exception
            when invalid_text_representation then
                raise exception 'Invalid origin actor identifier'
                    using errcode = '22023';
        end;

        if v_actor_id is null then
            raise exception 'Origin actor identifier is required'
                using errcode = '22023';
        end if;

        case v_actor_type
            when 'person' then
                if not exists (
                    select 1
                    from mp25m.persons p
                    where p.id = v_actor_id
                      and p.record_status = 'active'
                ) then
                    raise exception 'Invalid or inactive origin person'
                        using errcode = '23503';
                end if;

                insert into mp25m.opportunity_origins (
                    opportunity_id,
                    person_id
                )
                values (
                    p_opportunity_id,
                    v_actor_id
                )
                on conflict do nothing;

            when 'organization' then
                if not exists (
                    select 1
                    from mp25m.organizations o
                    where o.id = v_actor_id
                      and o.record_status = 'active'
                ) then
                    raise exception 'Invalid or inactive origin organization'
                        using errcode = '23503';
                end if;

                insert into mp25m.opportunity_origins (
                    opportunity_id,
                    organization_id
                )
                values (
                    p_opportunity_id,
                    v_actor_id
                )
                on conflict do nothing;

            when 'candidate' then
                if not exists (
                    select 1
                    from mp25m.actor_candidates ac
                    where ac.id = v_actor_id
                      and ac.status = 'pending'
                ) then
                    raise exception 'Invalid origin actor candidate'
                        using errcode = '23503';
                end if;

                insert into mp25m.opportunity_origins (
                    opportunity_id,
                    actor_candidate_id
                )
                values (
                    p_opportunity_id,
                    v_actor_id
                )
                on conflict do nothing;

            else
                raise exception 'Unsupported origin actor type: %',
                    coalesce(
                        v_actor_type,
                        '<null>'
                    )
                    using errcode = '22023';
        end case;
    end loop;

    for v_candidate in
        select value
        from jsonb_array_elements(
            coalesce(
                p_new_actor_candidates,
                '[]'::jsonb
            )
        )
    loop
        v_candidate_kind :=
            nullif(
                btrim(
                    v_candidate ->> 'actor_kind'
                ),
                ''
            );

        v_candidate_name :=
            nullif(
                btrim(
                    v_candidate ->> 'display_name'
                ),
                ''
            );

        v_candidate_organization_type :=
            nullif(
                btrim(
                    v_candidate ->> 'organization_type_code'
                ),
                ''
            );

        v_candidate_context :=
            nullif(
                btrim(
                    v_candidate ->> 'context_text'
                ),
                ''
            );

        if v_candidate_kind not in (
            'person',
            'organization'
        ) then
            raise exception 'Invalid provisional actor kind'
                using errcode = '22023';
        end if;

        if v_candidate_name is null
           or char_length(v_candidate_name) < 2
           or char_length(v_candidate_name) > 300
        then
            raise exception 'Invalid provisional actor name'
                using errcode = '22023';
        end if;

        if v_candidate_kind = 'person' then
            v_candidate_organization_type := null;
        else
            if v_candidate_organization_type is null
               or not exists (
                    select 1
                    from mp25m.organization_types ot
                    where ot.code =
                        v_candidate_organization_type
                      and ot.is_active = true
               )
            then
                raise exception 'Invalid organization type'
                    using errcode = '23503';
            end if;
        end if;

        v_candidate_normalized_name :=
            regexp_replace(
                extensions.unaccent(
                    lower(
                        v_candidate_name
                    )
                ),
                '[^a-z0-9]+',
                ' ',
                'g'
            );

        if jsonb_typeof(
            coalesce(
                v_candidate -> 'node_ids',
                '[]'::jsonb
            )
        ) <> 'array' then
            raise exception 'Provisional actor node_ids must be an array'
                using errcode = '22023';
        end if;

        begin
            select
                coalesce(
                    array_agg(
                        distinct node_id
                    ),
                    '{}'::uuid[]
                )
            into v_candidate_node_ids
            from (
                select
                    value::uuid as node_id
                from jsonb_array_elements_text(
                    coalesce(
                        v_candidate -> 'node_ids',
                        '[]'::jsonb
                    )
                )
            ) parsed_nodes;
        exception
            when invalid_text_representation then
                raise exception 'Invalid provisional actor node identifier'
                    using errcode = '22023';
        end;

        if exists (
            select 1
            from unnest(
                v_candidate_node_ids
            ) requested(node_id)
            left join mp25m.nodes n
              on n.id = requested.node_id
            where n.id is null
               or n.status <> 'active'
        ) then
            raise exception 'One or more provisional actor nodes are invalid or inactive'
                using errcode = '23503';
        end if;

        insert into mp25m.actor_candidates (
            actor_kind,
            display_name,
            normalized_name,
            organization_type_code,
            context_text,
            status,
            created_by_internal_user_id
        )
        values (
            v_candidate_kind,
            v_candidate_name,
            v_candidate_normalized_name,
            v_candidate_organization_type,
            v_candidate_context,
            'pending',
            p_actor_internal_user_id
        )
        returning id
        into v_candidate_id;

        insert into mp25m.actor_candidate_nodes (
            actor_candidate_id,
            node_id
        )
        select
            v_candidate_id,
            requested.node_id
        from unnest(
            v_candidate_node_ids
        ) requested(node_id);

        insert into mp25m.opportunity_origins (
            opportunity_id,
            actor_candidate_id
        )
        values (
            p_opportunity_id,
            v_candidate_id
        );

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
            'actor_candidate.create',
            'mp25m',
            'actor_candidates',
            v_candidate_id,
            jsonb_build_object(
                'actor_kind',
                    v_candidate_kind,
                'display_name',
                    v_candidate_name,
                'organization_type_code',
                    v_candidate_organization_type,
                'context_text',
                    v_candidate_context,
                'status',
                    'pending'
            ),
            'allowed',
            jsonb_build_object(
                'created_from',
                    'opportunity.update',
                'opportunity_id',
                    p_opportunity_id,
                'node_ids',
                    v_candidate_node_ids
            )
        );
    end loop;

    select
        coalesce(
            jsonb_agg(
                origin
                order by
                    origin ->> 'actor_type',
                    origin ->> 'actor_id'
            ),
            '[]'::jsonb
        )
    into v_new_origins
    from (
        select
            jsonb_build_object(
                'actor_type',
                case
                    when oo.person_id is not null
                        then 'person'
                    when oo.organization_id is not null
                        then 'organization'
                    else 'candidate'
                end,
                'actor_id',
                coalesce(
                    oo.person_id,
                    oo.organization_id,
                    oo.actor_candidate_id
                )
            ) as origin
        from mp25m.opportunity_origins oo
        where oo.opportunity_id = p_opportunity_id
    ) current_origins;

    insert into mp25m.audit_events (
        actor_internal_user_id,
        action,
        target_schema,
        target_table,
        target_id,
        old_data,
        new_data,
        result,
        metadata
    )
    values (
        p_actor_internal_user_id,
        'opportunity.update',
        'mp25m',
        'opportunities',
        p_opportunity_id,
        jsonb_build_object(
            'title',
                v_old_opportunity.title,
            'description',
                v_old_opportunity.description,
            'kind',
                v_old_opportunity.kind,
            'priority',
                v_old_opportunity.priority,
            'source_text',
                v_old_opportunity.source_text,
            'due_date',
                v_old_opportunity.due_date,
            'node_ids',
                v_old_node_ids,
            'origin_actors',
                v_old_origins
        ),
        jsonb_build_object(
            'title',
                btrim(p_title),
            'description',
                btrim(p_description),
            'kind',
                p_kind,
            'priority',
                p_priority,
            'source_text',
                nullif(
                    btrim(p_source_text),
                    ''
                ),
            'due_date',
                p_due_date,
            'node_ids',
                v_new_node_ids,
            'origin_actors',
                v_new_origins
        ),
        'allowed',
        '{}'::jsonb
    );
end;
$function$;


revoke all
on function mp25m_api.update_opportunity_details(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    text,
    date,
    uuid[],
    jsonb,
    jsonb
)
from public, anon, authenticated, service_role;

grant execute
on function mp25m_api.update_opportunity_details(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    text,
    date,
    uuid[],
    jsonb,
    jsonb
)
to service_role;


comment on function mp25m_api.update_opportunity_details(
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    text,
    date,
    uuid[],
    jsonb,
    jsonb
) is
    'Atomically edits opportunity descriptive data, nodes and origin actors while preserving audit history.';