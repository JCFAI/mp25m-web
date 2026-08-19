alter table mp25m.persons
  add column if not exists residence_province_text text,
  add column if not exists residence_locality_text text;

alter table mp25m.person_contacts
  add column if not exists active boolean not null default true,
  add column if not exists ended_at timestamptz,
  add column if not exists last_self_reported_at timestamptz;

alter table mp25m.person_vectors
  add column if not exists active boolean not null default true,
  add column if not exists last_self_reported_at timestamptz;

create index if not exists idx_person_contacts_person_active
  on mp25m.person_contacts(person_id, active);
create index if not exists idx_person_vectors_person_active
  on mp25m.person_vectors(person_id, active);

insert into mp25m.data_sources(name, source_type, description, external_reference, metadata, active)
select
  'MP25M Profile Update Form v1',
  'form',
  'Formulario electrónico personalizado para actualización de datos, nodos, roles, habilidades, vectores y consentimientos.',
  'profile-update-v1',
  jsonb_build_object('form_version','1.0'),
  true
where not exists (
  select 1 from mp25m.data_sources where external_reference = 'profile-update-v1'
);

create or replace function mp25m_private.normalize_text(p_value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      translate(lower(coalesce(p_value,'')), 'áéíóúüñàèìòùäëïöüç', 'aeiouunaeiouaeiouc'),
      '[^a-z0-9]+', '-', 'g'
    )),
    ''
  );
$$;

create or replace function mp25m_private.normalize_ar_mobile(p_value text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  d text := regexp_replace(coalesce(p_value,''), '\D', '', 'g');
begin
  if d = '' then return null; end if;
  if d like '00%' then d := substr(d,3); end if;
  if d like '549%' and length(d) = 13 then return '+' || d; end if;
  if d like '54%' and length(d) = 12 then return '+549' || substr(d,3); end if;
  if d like '9%' and length(d) = 11 then return '+54' || d; end if;
  if d like '0%' then d := substr(d,2); end if;
  if length(d) = 10 then return '+549' || d; end if;
  return null;
end;
$$;

revoke all on function mp25m_private.normalize_text(text) from public, anon, authenticated;
revoke all on function mp25m_private.normalize_ar_mobile(text) from public, anon, authenticated;
grant execute on function mp25m_private.normalize_text(text) to service_role;
grant execute on function mp25m_private.normalize_ar_mobile(text) to service_role;;
