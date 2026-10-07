begin;

create view mp25m_api.opportunity_requirement_current_coverage_list
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
),
current_evaluations as (
  select
    revision.requirement_id,
    revision.opportunity_id,
    revision.requirement_revision_id,
    revision.is_mandatory,
    revision.weight,
    evaluation.id as coverage_evaluation_id,
    evaluation.evaluation_no,
    network.coverage_status as network_coverage_status,
    expanded.coverage_status as expanded_coverage_status
  from current_revisions revision
  left join lateral (
    select
      evaluation.id,
      evaluation.evaluation_no
    from mp25m.opportunity_requirement_coverage_evaluations evaluation
    where evaluation.requirement_revision_id =
      revision.requirement_revision_id
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
  requirement_id,
  requirement_revision_id,
  coverage_evaluation_id,
  evaluation_no,
  is_mandatory,
  weight,
  network_coverage_status,
  expanded_coverage_status
from current_evaluations;

revoke all
on mp25m_api.opportunity_requirement_current_coverage_list
from public, anon, authenticated, service_role;

grant select
on mp25m_api.opportunity_requirement_current_coverage_list
to service_role;

comment on view
mp25m_api.opportunity_requirement_current_coverage_list
is
  '13A read model exposing the exact current validated requirement universe and the latest explicit coverage conclusion for each coverage layer. A null coverage_evaluation_id means not evaluated.';

commit;
