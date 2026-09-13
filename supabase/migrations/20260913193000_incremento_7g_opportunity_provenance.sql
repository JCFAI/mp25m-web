begin;

create table mp25m.opportunity_provenance (
  opportunity_id uuid primary key references mp25m.opportunities(id) on delete cascade,
  origin_kind text not null default 'manual' check (origin_kind in ('manual', 'opportunity_candidate')),
  detection_method text not null default 'manual' check (detection_method in ('manual', 'radar_broad', 'radar_directed')),
  origin_entity_id uuid,
  source_id uuid references mp25m.data_sources(id) on delete restrict,
  ingestion_record_id bigint references mp25m.ingestion_records(id) on delete restrict,
  source_locator text check (source_locator is null or char_length(source_locator) <= 2000),
  source_excerpt text check (source_excerpt is null or char_length(source_excerpt) <= 10000),
  external_reference text check (external_reference is null or char_length(external_reference) <= 500),
  issuer_organization_name text check (issuer_organization_name is null or char_length(issuer_organization_name) <= 300),
  source_country_name text check (source_country_name is null or char_length(source_country_name) <= 120),
  target_market text check (target_market is null or char_length(target_market) <= 300),
  published_at date,
  detected_at timestamptz,
  expires_at timestamptz,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_provenance_origin_reference_check check (
    (origin_kind = 'manual' and origin_entity_id is null)
    or origin_kind = 'opportunity_candidate'
  )
);

create trigger trg_opportunity_provenance_updated_at
before update on mp25m.opportunity_provenance
for each row execute function mp25m.set_updated_at();

insert into mp25m.opportunity_provenance (opportunity_id, source_excerpt)
select opportunity.id, nullif(btrim(opportunity.source_text), '')
from mp25m.opportunities opportunity
on conflict (opportunity_id) do nothing;

create function mp25m.ensure_manual_opportunity_provenance()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, mp25m
as $function$
begin
  insert into mp25m.opportunity_provenance (opportunity_id, source_excerpt)
  values (new.id, nullif(btrim(new.source_text), ''));
  return new;
end;
$function$;

create trigger trg_opportunities_manual_provenance
after insert on mp25m.opportunities
for each row execute function mp25m.ensure_manual_opportunity_provenance();

alter table mp25m.opportunity_provenance enable row level security;
revoke all on mp25m.opportunity_provenance from public, anon, authenticated, service_role;
grant select, insert, update on mp25m.opportunity_provenance to service_role;

create view mp25m_api.opportunity_provenance_list with (security_invoker = true) as
select
  provenance.opportunity_id,
  provenance.origin_kind,
  provenance.detection_method,
  provenance.origin_entity_id,
  source.name as source_name,
  provenance.source_locator,
  provenance.source_excerpt,
  provenance.external_reference,
  provenance.issuer_organization_name,
  provenance.source_country_name,
  provenance.target_market,
  provenance.published_at,
  provenance.detected_at,
  provenance.expires_at,
  provenance.captured_at
from mp25m.opportunity_provenance provenance
left join mp25m.data_sources source on source.id = provenance.source_id;

revoke all on mp25m_api.opportunity_provenance_list from public, anon, authenticated, service_role;
grant select on mp25m_api.opportunity_provenance_list to service_role;

comment on table mp25m.opportunity_provenance is
  '7G provenance prepared for future Radar signals and opportunity candidates; it does not implement detection, ingestion or automatic opportunity creation.';

commit;
