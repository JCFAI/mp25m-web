begin;

create table mp25m.opportunity_requirement_coverage_evaluation_layers (
  coverage_evaluation_id uuid not null
    references mp25m.opportunity_requirement_coverage_evaluations(id)
    on delete restrict,
  coverage_layer text not null,
  coverage_status text not null,
  primary key (coverage_evaluation_id, coverage_layer),
  constraint opp_req_coverage_layer_code_check check (
    coverage_layer in ('network_mp25m', 'expanded_argentina')
  ),
  constraint opp_req_coverage_layer_status_check check (
    coverage_status in ('covered', 'partial', 'missing')
  )
);

alter table mp25m.opportunity_requirement_coverage_evaluation_layers
  enable row level security;

revoke all on table mp25m.opportunity_requirement_coverage_evaluation_layers
  from public, anon, authenticated, service_role;

grant select, insert on table mp25m.opportunity_requirement_coverage_evaluation_layers
  to service_role;

comment on table mp25m.opportunity_requirement_coverage_evaluation_layers is
  'Immutable 7D layer conclusions for each requirement coverage evaluation. The expanded Argentina layer includes, but never reduces, the MP25M network layer.';

insert into mp25m.opportunity_requirement_coverage_evaluation_layers (
  coverage_evaluation_id,
  coverage_layer,
  coverage_status
)
select
  evaluation.id,
  layer.coverage_layer,
  evaluation.coverage_status
from mp25m.opportunity_requirement_coverage_evaluations evaluation
cross join (
  values
    ('network_mp25m'::text),
    ('expanded_argentina'::text)
) as layer(coverage_layer);

create or replace function mp25m_api.evaluate_opportunity_requirement_coverage_layers(
  p_actor_internal_user_id uuid,
  p_requirement_revision_id uuid,
  p_expected_evaluation_no integer,
  p_network_coverage_status text,
  p_expanded_coverage_status text,
  p_rationale text,
  p_match_assessment_ids uuid[] default '{}'::uuid[]
)
returns table (
  coverage_evaluation_id uuid,
  evaluation_no integer,
  network_coverage_status text,
  expanded_coverage_status text,
  linked_match_assessment_count integer
)
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_result record;
  v_network_value integer;
  v_expanded_value integer;
begin
  if p_network_coverage_status not in ('covered', 'partial', 'missing')
     or p_expanded_coverage_status not in ('covered', 'partial', 'missing') then
    raise exception 'Invalid opportunity coverage layer status'
      using errcode = '22023';
  end if;

  v_network_value := case p_network_coverage_status
    when 'covered' then 2 when 'partial' then 1 else 0 end;
  v_expanded_value := case p_expanded_coverage_status
    when 'covered' then 2 when 'partial' then 1 else 0 end;

  if v_expanded_value < v_network_value then
    raise exception 'Expanded Argentina coverage cannot be lower than MP25M network coverage'
      using errcode = '22023';
  end if;

  select * into v_result
  from mp25m_api.evaluate_opportunity_requirement_coverage(
    p_actor_internal_user_id,
    p_requirement_revision_id,
    p_expected_evaluation_no,
    p_expanded_coverage_status,
    p_rationale,
    p_match_assessment_ids
  );

  insert into mp25m.opportunity_requirement_coverage_evaluation_layers (
    coverage_evaluation_id,
    coverage_layer,
    coverage_status
  ) values
    (v_result.coverage_evaluation_id, 'network_mp25m', p_network_coverage_status),
    (v_result.coverage_evaluation_id, 'expanded_argentina', p_expanded_coverage_status);

  insert into mp25m.audit_events (
    actor_internal_user_id, action, target_schema, target_table, target_id,
    reason, new_data, result, metadata
  ) values (
    p_actor_internal_user_id,
    'opportunity.requirement.coverage.layers.evaluate',
    'mp25m',
    'opportunity_requirement_coverage_evaluation_layers',
    v_result.coverage_evaluation_id,
    p_rationale,
    jsonb_build_object(
      'network_mp25m', p_network_coverage_status,
      'expanded_argentina', p_expanded_coverage_status
    ),
    'allowed',
    jsonb_build_object('requirement_revision_id', p_requirement_revision_id)
  );

  coverage_evaluation_id := v_result.coverage_evaluation_id;
  evaluation_no := v_result.evaluation_no;
  network_coverage_status := p_network_coverage_status;
  expanded_coverage_status := p_expanded_coverage_status;
  linked_match_assessment_count := v_result.linked_match_assessment_count;
  return next;
end;
$function$;

revoke all on function mp25m_api.evaluate_opportunity_requirement_coverage_layers(
  uuid, uuid, integer, text, text, text, uuid[]
) from public, anon, authenticated, service_role;

grant execute on function mp25m_api.evaluate_opportunity_requirement_coverage_layers(
  uuid, uuid, integer, text, text, text, uuid[]
) to service_role;

create or replace view mp25m_api.opportunity_coverage_summary_list
with (security_invoker = true)
as
with current_revisions as (
  select
    requirement.id as requirement_id,
    requirement.opportunity_id,
    revision.id as requirement_revision_id,
    revision.is_mandatory,
    revision.weight
  from mp25m.opportunity_requirements requirement
  join mp25m.opportunity_requirement_revisions revision
    on revision.requirement_id = requirement.id
  where requirement.record_status = 'active'
    and revision.validation_status = 'validated'
    and not exists (
      select 1
      from mp25m.opportunity_requirement_revisions newer
      where newer.requirement_id = revision.requirement_id
        and newer.revision_no > revision.revision_no
    )
), current_evaluations as (
  select
    revision.requirement_id,
    revision.opportunity_id,
    revision.is_mandatory,
    revision.weight,
    evaluation.id as coverage_evaluation_id,
    network.coverage_status as network_coverage_status,
    expanded.coverage_status as expanded_coverage_status
  from current_revisions revision
  left join lateral (
    select evaluation.id
    from mp25m.opportunity_requirement_coverage_evaluations evaluation
    where evaluation.requirement_revision_id = revision.requirement_revision_id
    order by evaluation.evaluation_no desc
    limit 1
  ) evaluation on true
  left join mp25m.opportunity_requirement_coverage_evaluation_layers network
    on network.coverage_evaluation_id = evaluation.id
   and network.coverage_layer = 'network_mp25m'
  left join mp25m.opportunity_requirement_coverage_evaluation_layers expanded
    on expanded.coverage_evaluation_id = evaluation.id
   and expanded.coverage_layer = 'expanded_argentina'
)
select
  opportunity_id,
  count(*)::integer as active_requirement_count,
  count(*) filter (where coverage_evaluation_id is not null)::integer as evaluated_requirement_count,
  count(*) filter (where coverage_evaluation_id is null)::integer as unevaluated_requirement_count,
  coalesce(sum(weight) filter (where coverage_evaluation_id is not null), 0)::integer as evaluated_weight_total,
  case when count(*) filter (where coverage_evaluation_id is not null) = 0 then null
    else round(100 * sum(weight * case network_coverage_status when 'covered' then 1 when 'partial' then .5 else 0 end)
      / nullif(sum(weight) filter (where coverage_evaluation_id is not null), 0), 2) end as network_coverage_percent,
  case when count(*) filter (where coverage_evaluation_id is not null) = 0 then null
    else round(100 * sum(weight * case expanded_coverage_status when 'covered' then 1 when 'partial' then .5 else 0 end)
      / nullif(sum(weight) filter (where coverage_evaluation_id is not null), 0), 2) end as expanded_coverage_percent,
  count(*) filter (where is_mandatory and network_coverage_status = 'missing')::integer as mandatory_missing_count,
  count(*) filter (where is_mandatory and network_coverage_status = 'partial')::integer as mandatory_partial_count,
  count(*) filter (where is_mandatory and coverage_evaluation_id is null)::integer as mandatory_unevaluated_count
from current_evaluations
group by opportunity_id;

revoke all on mp25m_api.opportunity_coverage_summary_list
  from public, anon, authenticated, service_role;

grant select on mp25m_api.opportunity_coverage_summary_list to service_role;

comment on view mp25m_api.opportunity_coverage_summary_list is
  'Dynamic 7D global coverage and completeness summary. Both layers use the same current evaluated requirement universe and denominator.';


create table mp25m.opportunity_coverage_snapshots (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references mp25m.opportunities(id) on delete restrict,
  snapshot_no integer not null check (snapshot_no > 0),
  formula_version text not null default '7d-v1',
  active_requirement_count integer not null check (active_requirement_count >= 0),
  evaluated_requirement_count integer not null check (evaluated_requirement_count >= 0),
  network_coverage_percent numeric(6, 2),
  expanded_coverage_percent numeric(6, 2),
  created_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (opportunity_id, snapshot_no),
  check (evaluated_requirement_count <= active_requirement_count)
);

create table mp25m.opportunity_coverage_snapshot_requirements (
  snapshot_id uuid not null references mp25m.opportunity_coverage_snapshots(id) on delete restrict,
  requirement_id uuid not null references mp25m.opportunity_requirements(id) on delete restrict,
  requirement_revision_id uuid not null references mp25m.opportunity_requirement_revisions(id) on delete restrict,
  coverage_evaluation_id uuid references mp25m.opportunity_requirement_coverage_evaluations(id) on delete restrict,
  is_mandatory boolean not null,
  weight smallint not null check (weight > 0),
  network_coverage_status text,
  expanded_coverage_status text,
  primary key (snapshot_id, requirement_revision_id),
  check (network_coverage_status in ('covered', 'partial', 'missing')),
  check (expanded_coverage_status in ('covered', 'partial', 'missing')),
  check (
    (coverage_evaluation_id is null
      and network_coverage_status is null
      and expanded_coverage_status is null)
    or
    (coverage_evaluation_id is not null
      and network_coverage_status is not null
      and expanded_coverage_status is not null)
  )
);

alter table mp25m.opportunity_coverage_snapshots enable row level security;
alter table mp25m.opportunity_coverage_snapshot_requirements enable row level security;

revoke all on table mp25m.opportunity_coverage_snapshots
  from public, anon, authenticated, service_role;
revoke all on table mp25m.opportunity_coverage_snapshot_requirements
  from public, anon, authenticated, service_role;

grant select, insert on table mp25m.opportunity_coverage_snapshots to service_role;
grant select, insert on table mp25m.opportunity_coverage_snapshot_requirements to service_role;

comment on table mp25m.opportunity_coverage_snapshots is
  'Explicit immutable 7D snapshots of an opportunity global coverage summary.';
comment on table mp25m.opportunity_coverage_snapshot_requirements is
  'Exact active validated requirement universe and current coverage conclusions captured by a 7D snapshot.';

create function mp25m_api.create_opportunity_coverage_snapshot(
  p_actor_internal_user_id uuid,
  p_opportunity_id uuid
)
returns table (
  snapshot_id uuid,
  snapshot_no integer,
  created_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_snapshot_id uuid;
  v_snapshot_no integer;
  v_created_at timestamptz;
  v_summary mp25m_api.opportunity_coverage_summary_list%rowtype;
begin
  if not mp25m_api.can_operate_opportunity_requirement_evaluation(
    p_actor_internal_user_id,
    p_opportunity_id,
    'coverage'
  ) then
    raise exception 'Internal user cannot create this opportunity coverage snapshot'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_opportunity_id::text, 0));

  select * into v_summary
  from mp25m_api.opportunity_coverage_summary_list
  where opportunity_id = p_opportunity_id;

  select coalesce(max(snapshot.snapshot_no), 0) + 1
  into v_snapshot_no
  from mp25m.opportunity_coverage_snapshots snapshot
  where snapshot.opportunity_id = p_opportunity_id;

  insert into mp25m.opportunity_coverage_snapshots as snapshot (
    opportunity_id,
    snapshot_no,
    active_requirement_count,
    evaluated_requirement_count,
    network_coverage_percent,
    expanded_coverage_percent,
    created_by_internal_user_id
  ) values (
    p_opportunity_id,
    v_snapshot_no,
    coalesce(v_summary.active_requirement_count, 0),
    coalesce(v_summary.evaluated_requirement_count, 0),
    v_summary.network_coverage_percent,
    v_summary.expanded_coverage_percent,
    p_actor_internal_user_id
  )
  returning snapshot.id, snapshot.created_at into v_snapshot_id, v_created_at;

  insert into mp25m.opportunity_coverage_snapshot_requirements (
    snapshot_id,
    requirement_id,
    requirement_revision_id,
    coverage_evaluation_id,
    is_mandatory,
    weight,
    network_coverage_status,
    expanded_coverage_status
  )
  with current_revisions as (
    select
      requirement.id as requirement_id,
      revision.id as requirement_revision_id,
      revision.is_mandatory,
      revision.weight
    from mp25m.opportunity_requirements requirement
    join mp25m.opportunity_requirement_revisions revision
      on revision.requirement_id = requirement.id
    where requirement.opportunity_id = p_opportunity_id
      and requirement.record_status = 'active'
      and revision.validation_status = 'validated'
      and not exists (
        select 1
        from mp25m.opportunity_requirement_revisions newer
        where newer.requirement_id = revision.requirement_id
          and newer.revision_no > revision.revision_no
      )
  )
  select
    v_snapshot_id,
    revision.requirement_id,
    revision.requirement_revision_id,
    evaluation.id,
    revision.is_mandatory,
    revision.weight,
    network.coverage_status,
    expanded.coverage_status
  from current_revisions revision
  left join lateral (
    select evaluation.id
    from mp25m.opportunity_requirement_coverage_evaluations evaluation
    where evaluation.requirement_revision_id = revision.requirement_revision_id
    order by evaluation.evaluation_no desc
    limit 1
  ) evaluation on true
  left join mp25m.opportunity_requirement_coverage_evaluation_layers network
    on network.coverage_evaluation_id = evaluation.id
   and network.coverage_layer = 'network_mp25m'
  left join mp25m.opportunity_requirement_coverage_evaluation_layers expanded
    on expanded.coverage_evaluation_id = evaluation.id
   and expanded.coverage_layer = 'expanded_argentina';

  insert into mp25m.audit_events (
    actor_internal_user_id, action, target_schema, target_table, target_id,
    reason, new_data, result, metadata
  ) values (
    p_actor_internal_user_id,
    'opportunity.coverage.snapshot.create',
    'mp25m',
    'opportunity_coverage_snapshots',
    v_snapshot_id,
    'Explicit 7D global coverage snapshot',
    jsonb_build_object(
      'snapshot_no', v_snapshot_no,
      'network_coverage_percent', v_summary.network_coverage_percent,
      'expanded_coverage_percent', v_summary.expanded_coverage_percent
    ),
    'allowed',
    jsonb_build_object('opportunity_id', p_opportunity_id)
  );

  snapshot_id := v_snapshot_id;
  snapshot_no := v_snapshot_no;
  created_at := v_created_at;
  return next;
end;
$function$;

revoke all on function mp25m_api.create_opportunity_coverage_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function mp25m_api.create_opportunity_coverage_snapshot(uuid, uuid)
  to service_role;

create view mp25m_api.opportunity_coverage_snapshot_list
with (security_invoker = true)
as
select
  snapshot.id as snapshot_id,
  snapshot.opportunity_id,
  snapshot.snapshot_no,
  snapshot.formula_version,
  snapshot.active_requirement_count,
  snapshot.evaluated_requirement_count,
  snapshot.network_coverage_percent,
  snapshot.expanded_coverage_percent,
  snapshot.created_at,
  creator.display_name as created_by_display_name
from mp25m.opportunity_coverage_snapshots snapshot
join mp25m.internal_users creator
  on creator.id = snapshot.created_by_internal_user_id;

revoke all on mp25m_api.opportunity_coverage_snapshot_list
  from public, anon, authenticated, service_role;
grant select on mp25m_api.opportunity_coverage_snapshot_list to service_role;

comment on view mp25m_api.opportunity_coverage_snapshot_list is
  'Immutable 7D global coverage snapshot history for an opportunity.';

commit;
