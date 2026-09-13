begin;

create or replace function mp25m_api.create_opportunity_coverage_snapshot(
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

  select summary.* into v_summary
  from mp25m_api.opportunity_coverage_summary_list summary
  where summary.opportunity_id = p_opportunity_id;

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

commit;
