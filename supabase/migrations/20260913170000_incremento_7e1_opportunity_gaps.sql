begin;

create table mp25m.opportunity_gaps (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references mp25m.opportunities(id) on delete restrict,
  requirement_revision_id uuid not null references mp25m.opportunity_requirement_revisions(id) on delete restrict,
  coverage_layer text not null check (coverage_layer in ('network_mp25m', 'expanded_argentina')),
  gap_type text not null check (gap_type in (
    'capacity', 'scale', 'availability', 'resource_equipment',
    'certification_authorization', 'knowledge', 'articulation',
    'financing', 'logistics', 'deadline', 'other'
  )),
  status text not null check (status in (
    'open', 'in_treatment', 'blocked', 'resolved', 'closed_unresolved', 'cancelled'
  )),
  rationale text not null check (char_length(btrim(rationale)) between 3 and 10000),
  responsible_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  opened_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table mp25m.opportunity_gap_status_history (
  id uuid primary key default gen_random_uuid(),
  gap_id uuid not null references mp25m.opportunity_gaps(id) on delete restrict,
  transition_no integer not null check (transition_no > 0),
  status text not null check (status in (
    'open', 'in_treatment', 'blocked', 'resolved', 'closed_unresolved', 'cancelled'
  )),
  rationale text not null check (char_length(btrim(rationale)) between 3 and 10000),
  responsible_internal_user_id uuid references mp25m.internal_users(id) on delete restrict,
  changed_by_internal_user_id uuid not null references mp25m.internal_users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  unique (gap_id, transition_no)
);

create index opportunity_gaps_opportunity_id_idx on mp25m.opportunity_gaps(opportunity_id, opened_at desc);
create index opportunity_gaps_requirement_revision_id_idx on mp25m.opportunity_gaps(requirement_revision_id);
create index opportunity_gap_status_history_gap_id_idx on mp25m.opportunity_gap_status_history(gap_id, transition_no desc);

alter table mp25m.opportunity_gaps enable row level security;
alter table mp25m.opportunity_gap_status_history enable row level security;

revoke all on mp25m.opportunity_gaps, mp25m.opportunity_gap_status_history from public, anon, authenticated, service_role;
grant select, insert, update on mp25m.opportunity_gaps to service_role;
grant select, insert on mp25m.opportunity_gap_status_history to service_role;

create function mp25m_api.open_opportunity_gap(
  p_actor_internal_user_id uuid,
  p_requirement_revision_id uuid,
  p_coverage_layer text,
  p_gap_type text,
  p_rationale text,
  p_responsible_internal_user_id uuid default null
)
returns table (gap_id uuid, opened_at timestamptz)
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_opportunity_id uuid;
  v_coverage_status text;
  v_gap_id uuid;
  v_opened_at timestamptz;
begin
  if p_coverage_layer not in ('network_mp25m', 'expanded_argentina') then
    raise exception 'Invalid opportunity gap coverage layer' using errcode = '22023';
  end if;
  if p_gap_type not in ('capacity', 'scale', 'availability', 'resource_equipment', 'certification_authorization', 'knowledge', 'articulation', 'financing', 'logistics', 'deadline', 'other') then
    raise exception 'Invalid opportunity gap type' using errcode = '22023';
  end if;
  if char_length(btrim(p_rationale)) not between 3 and 10000 then
    raise exception 'Invalid opportunity gap rationale' using errcode = '22023';
  end if;

  select requirement.opportunity_id into v_opportunity_id
  from mp25m.opportunity_requirement_revisions revision
  join mp25m.opportunity_requirements requirement on requirement.id = revision.requirement_id
  where revision.id = p_requirement_revision_id
    and requirement.record_status = 'active'
    and revision.validation_status = 'validated'
    and not exists (
      select 1 from mp25m.opportunity_requirement_revisions newer
      where newer.requirement_id = revision.requirement_id and newer.revision_no > revision.revision_no
    );

  if v_opportunity_id is null then
    raise exception 'Only validated current opportunity requirement revisions may open gaps' using errcode = '23514';
  end if;
  if not mp25m_api.can_operate_opportunity_requirement_evaluation(p_actor_internal_user_id, v_opportunity_id, 'coverage') then
    raise exception 'Internal user cannot open this opportunity gap' using errcode = '42501';
  end if;

  select layer.coverage_status into v_coverage_status
  from mp25m.opportunity_requirement_coverage_evaluations evaluation
  join mp25m.opportunity_requirement_coverage_evaluation_layers layer on layer.coverage_evaluation_id = evaluation.id
  where evaluation.requirement_revision_id = p_requirement_revision_id
    and layer.coverage_layer = p_coverage_layer
  order by evaluation.evaluation_no desc
  limit 1;

  if v_coverage_status not in ('partial', 'missing') then
    raise exception 'Opportunity gaps require a current partial or missing coverage conclusion' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_requirement_revision_id::text || ':' || p_coverage_layer, 0));

  insert into mp25m.opportunity_gaps (
    opportunity_id, requirement_revision_id, coverage_layer, gap_type, status,
    rationale, responsible_internal_user_id, opened_by_internal_user_id
  ) values (
    v_opportunity_id, p_requirement_revision_id, p_coverage_layer, p_gap_type, 'open',
    btrim(p_rationale), p_responsible_internal_user_id, p_actor_internal_user_id
  ) returning id, mp25m.opportunity_gaps.opened_at into v_gap_id, v_opened_at;

  insert into mp25m.opportunity_gap_status_history (
    gap_id, transition_no, status, rationale, responsible_internal_user_id, changed_by_internal_user_id, changed_at
  ) values (
    v_gap_id, 1, 'open', btrim(p_rationale), p_responsible_internal_user_id, p_actor_internal_user_id, v_opened_at
  );

  insert into mp25m.audit_events (
    actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata
  ) values (
    p_actor_internal_user_id, 'opportunity.gap.open', 'mp25m', 'opportunity_gaps', v_gap_id,
    btrim(p_rationale), jsonb_build_object('gap_type', p_gap_type, 'coverage_layer', p_coverage_layer, 'status', 'open'),
    'allowed', jsonb_build_object('opportunity_id', v_opportunity_id, 'requirement_revision_id', p_requirement_revision_id)
  );

  gap_id := v_gap_id;
  opened_at := v_opened_at;
  return next;
end;
$function$;

create function mp25m_api.transition_opportunity_gap(
  p_actor_internal_user_id uuid,
  p_gap_id uuid,
  p_status text,
  p_rationale text,
  p_responsible_internal_user_id uuid default null
)
returns table (gap_id uuid, transition_no integer, changed_at timestamptz)
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_gap mp25m.opportunity_gaps%rowtype;
  v_transition_no integer;
  v_changed_at timestamptz;
begin
  if p_status not in ('open', 'in_treatment', 'blocked', 'resolved', 'closed_unresolved', 'cancelled') then
    raise exception 'Invalid opportunity gap status' using errcode = '22023';
  end if;
  if char_length(btrim(p_rationale)) not between 3 and 10000 then
    raise exception 'Invalid opportunity gap rationale' using errcode = '22023';
  end if;

  select * into v_gap from mp25m.opportunity_gaps where id = p_gap_id for update;
  if not found then raise exception 'Opportunity gap not found' using errcode = 'P0002'; end if;
  if not mp25m_api.can_operate_opportunity_requirement_evaluation(p_actor_internal_user_id, v_gap.opportunity_id, 'coverage') then
    raise exception 'Internal user cannot update this opportunity gap' using errcode = '42501';
  end if;
  if p_status in ('resolved', 'closed_unresolved') and p_responsible_internal_user_id is null then
    raise exception 'Resolving or closing an opportunity gap requires a responsible user' using errcode = '22023';
  end if;

  select coalesce(max(history.transition_no), 0) + 1 into v_transition_no
  from mp25m.opportunity_gap_status_history history where history.gap_id = p_gap_id;

  update mp25m.opportunity_gaps set status = p_status, rationale = btrim(p_rationale),
    responsible_internal_user_id = p_responsible_internal_user_id, updated_at = now()
  where id = p_gap_id returning updated_at into v_changed_at;

  insert into mp25m.opportunity_gap_status_history (
    gap_id, transition_no, status, rationale, responsible_internal_user_id, changed_by_internal_user_id, changed_at
  ) values (
    p_gap_id, v_transition_no, p_status, btrim(p_rationale), p_responsible_internal_user_id, p_actor_internal_user_id, v_changed_at
  );

  insert into mp25m.audit_events (
    actor_internal_user_id, action, target_schema, target_table, target_id, reason, new_data, result, metadata
  ) values (
    p_actor_internal_user_id, 'opportunity.gap.transition', 'mp25m', 'opportunity_gaps', p_gap_id,
    btrim(p_rationale), jsonb_build_object('status', p_status), 'allowed',
    jsonb_build_object('opportunity_id', v_gap.opportunity_id, 'transition_no', v_transition_no)
  );

  gap_id := p_gap_id;
  transition_no := v_transition_no;
  changed_at := v_changed_at;
  return next;
end;
$function$;

revoke all on function mp25m_api.open_opportunity_gap(uuid, uuid, text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function mp25m_api.transition_opportunity_gap(uuid, uuid, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function mp25m_api.open_opportunity_gap(uuid, uuid, text, text, text, uuid) to service_role;
grant execute on function mp25m_api.transition_opportunity_gap(uuid, uuid, text, text, uuid) to service_role;

create view mp25m_api.opportunity_gap_list with (security_invoker = true) as
select
  gap.id as gap_id, gap.opportunity_id, gap.requirement_revision_id, revision.requirement_id,
  revision.name as requirement_name, gap.coverage_layer, gap.gap_type, gap.status, gap.rationale,
  gap.responsible_internal_user_id, responsible.display_name as responsible_display_name,
  gap.opened_by_internal_user_id, opener.display_name as opened_by_display_name,
  gap.opened_at, gap.updated_at,
  layer.coverage_status as current_coverage_status
from mp25m.opportunity_gaps gap
join mp25m.opportunity_requirement_revisions revision on revision.id = gap.requirement_revision_id
left join mp25m.internal_users responsible on responsible.id = gap.responsible_internal_user_id
join mp25m.internal_users opener on opener.id = gap.opened_by_internal_user_id
left join lateral (
  select coverage_layer.coverage_status
  from mp25m.opportunity_requirement_coverage_evaluations evaluation
  join mp25m.opportunity_requirement_coverage_evaluation_layers coverage_layer on coverage_layer.coverage_evaluation_id = evaluation.id
  where evaluation.requirement_revision_id = gap.requirement_revision_id and coverage_layer.coverage_layer = gap.coverage_layer
  order by evaluation.evaluation_no desc limit 1
) layer on true;

create view mp25m_api.opportunity_gap_status_history_list with (security_invoker = true) as
select history.gap_id, history.transition_no, history.status, history.rationale,
  history.responsible_internal_user_id, responsible.display_name as responsible_display_name,
  history.changed_by_internal_user_id, changer.display_name as changed_by_display_name, history.changed_at
from mp25m.opportunity_gap_status_history history
left join mp25m.internal_users responsible on responsible.id = history.responsible_internal_user_id
join mp25m.internal_users changer on changer.id = history.changed_by_internal_user_id;

revoke all on mp25m_api.opportunity_gap_list, mp25m_api.opportunity_gap_status_history_list from public, anon, authenticated, service_role;
grant select on mp25m_api.opportunity_gap_list, mp25m_api.opportunity_gap_status_history_list to service_role;

commit;
