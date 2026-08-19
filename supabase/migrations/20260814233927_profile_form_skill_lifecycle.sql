alter table mp25m.person_skills
  add column if not exists active boolean not null default true;

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
join mp25m.nodes n on n.id = np.node_id
join mp25m.persons p on p.id = np.person_id
join mp25m.person_skills ps on ps.person_id = p.id
join mp25m.skills s on s.id = ps.skill_id
left join mp25m.skill_categories sc on sc.code = s.category_code
where np.verification_status = 'confirmed'
  and np.status = 'active'
  and ps.active = true
  and ps.verification_status in ('self_reported','confirmed')
group by n.id, n.node_number, n.name, s.id, s.name, sc.name;

drop view if exists mp25m.v_node_skill_summary;
create view mp25m.v_node_skill_summary with (security_invoker = true) as
select
  n.id as node_id,
  n.node_number,
  n.name as node_name,
  count(distinct np.person_id) as confirmed_people,
  count(distinct ps.skill_id) filter (
    where ps.active = true and ps.verification_status in ('self_reported','confirmed')
  ) as distinct_skills,
  count(distinct ps.person_id) filter (
    where ps.active = true and ps.verification_status in ('self_reported','confirmed')
  ) as people_with_skills
from mp25m.nodes n
left join mp25m.node_participations np
  on np.node_id = n.id
 and np.verification_status = 'confirmed'
 and np.status = 'active'
left join mp25m.person_skills ps on ps.person_id = np.person_id
group by n.id, n.node_number, n.name;;
