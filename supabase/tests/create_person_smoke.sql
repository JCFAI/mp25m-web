\set ON_ERROR_STOP on

begin;

-- ===========================================================================
-- 1. ACTOR TEMPORAL AUTORIZADO
-- ===========================================================================

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '10000000-0000-0000-0000-000000000070',
  'authenticated',
  'authenticated',
  'create-person-smoke@mp25m.local',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into mp25m.internal_users (
  id,
  auth_user_id,
  status,
  display_name,
  notes
)
values (
  '20000000-0000-0000-0000-000000000070',
  '10000000-0000-0000-0000-000000000070',
  'active',
  'Usuario Smoke Alta Persona',
  'Fixture transitorio create_person'
);

insert into mp25m.access_role_assignments (
  internal_user_id,
  access_role_code,
  access_scope_id,
  status,
  granted_by_internal_user_id,
  reason
)
select
  '20000000-0000-0000-0000-000000000070',
  'validator',
  scope.id,
  'active',
  '20000000-0000-0000-0000-000000000070',
  'Smoke alta canónica directa'
from mp25m.access_scopes scope
where scope.scope_type = 'global'
  and scope.is_active = true
  and scope.deleted_at is null
limit 1;

\echo ''
\echo '=== ACTOR TEMPORAL ==='

select
  internal_user.id,
  internal_user.display_name,
  role.code as role_code,
  scope.scope_type
from mp25m.internal_users internal_user
join mp25m.access_role_assignments assignment
  on assignment.internal_user_id = internal_user.id
join mp25m.access_roles role
  on role.code = assignment.access_role_code
join mp25m.access_scopes scope
  on scope.id = assignment.access_scope_id
where internal_user.id =
  '20000000-0000-0000-0000-000000000070';


-- ===========================================================================
-- 2. EJECUTAR COMO SERVICE_ROLE
-- ===========================================================================

set local role service_role;

do $smoke$
declare
  v_actor_id constant uuid :=
    '20000000-0000-0000-0000-000000000070';

  v_person_id uuid;

  v_input_name text :=
    '  Smoke   Persona   Canónica   Temporal  ';

  v_expected_display text :=
    'Smoke Persona Canónica Temporal';

  v_count integer;
begin

  -- -----------------------------------------------------------------------
  -- Permisos de función
  -- -----------------------------------------------------------------------

  if not has_function_privilege(
    'service_role',
    'mp25m_api.create_person(uuid, text)',
    'EXECUTE'
  ) then
    raise exception
      'SMOKE: service_role no tiene EXECUTE';
  end if;

  if has_function_privilege(
    'anon',
    'mp25m_api.create_person(uuid, text)',
    'EXECUTE'
  ) then
    raise exception
      'SMOKE: anon tiene EXECUTE inesperadamente';
  end if;

  if has_function_privilege(
    'authenticated',
    'mp25m_api.create_person(uuid, text)',
    'EXECUTE'
  ) then
    raise exception
      'SMOKE: authenticated tiene EXECUTE inesperadamente';
  end if;

  raise notice
    'SMOKE permisos create_person OK';


  -- -----------------------------------------------------------------------
  -- Crear Persona canónica
  -- -----------------------------------------------------------------------

  v_person_id := mp25m_api.create_person(
    v_actor_id,
    v_input_name
  );

  if v_person_id is null then
    raise exception
      'SMOKE: create_person devolvió NULL';
  end if;


  -- -----------------------------------------------------------------------
  -- Verificar fila canónica y normalización
  -- -----------------------------------------------------------------------

  if not exists (
    select 1
    from mp25m.persons person
    where person.id = v_person_id
      and person.display_name = v_expected_display
      and person.normalized_name =
        mp25m_private.normalize_text(v_expected_display)
      and person.record_status = 'active'
  ) then
    raise exception
      'SMOKE: Persona creada faltante o mal normalizada';
  end if;

  raise notice
    'SMOKE creación y normalización OK person_id=%',
    v_person_id;


  -- -----------------------------------------------------------------------
  -- Debe aparecer en la API canónica de referencias
  -- -----------------------------------------------------------------------

  if not exists (
    select 1
    from mp25m_api.canonical_actor_reference_page(
      p_query => v_expected_display,
      p_actor_types => array['person']::text[],
      p_limit => 50
    ) reference
    where reference.actor_id = v_person_id
  ) then
    raise exception
      'SMOKE: Persona no aparece en canonical_actor_reference_page';
  end if;

  raise notice
    'SMOKE referencia canónica OK';


  -- -----------------------------------------------------------------------
  -- No crear relaciones ni información adicional
  -- -----------------------------------------------------------------------

  select count(*)
  into v_count
  from mp25m.person_contacts
  where person_id = v_person_id;

  if v_count <> 0 then
    raise exception
      'SMOKE: se crearon contactos inesperados';
  end if;


  select count(*)
  into v_count
  from mp25m.person_skills
  where person_id = v_person_id;

  if v_count <> 0 then
    raise exception
      'SMOKE: se crearon habilidades inesperadas';
  end if;


  select count(*)
  into v_count
  from mp25m.node_participations
  where person_id = v_person_id;

  if v_count <> 0 then
    raise exception
      'SMOKE: se creó pertenencia a Nodo';
  end if;


  select count(*)
  into v_count
  from mp25m.opportunity_origins
  where person_id = v_person_id;

  if v_count <> 0 then
    raise exception
      'SMOKE: se creó relación con Oportunidad';
  end if;


  select count(*)
  into v_count
  from mp25m.opportunity_articulation_participants
  where person_id = v_person_id;

  if v_count <> 0 then
    raise exception
      'SMOKE: se creó relación con Articulación';
  end if;


  select count(*)
  into v_count
  from mp25m.project_participants
  where person_id = v_person_id;

  if v_count <> 0 then
    raise exception
      'SMOKE: se creó relación con Proyecto';
  end if;

  raise notice
    'SMOKE ausencia de relaciones implícitas OK';


  -- -----------------------------------------------------------------------
  -- Auditoría
  -- -----------------------------------------------------------------------

  if not exists (
    select 1
    from mp25m.audit_events audit
    where audit.action = 'person.create'
      and audit.target_schema = 'mp25m'
      and audit.target_table = 'persons'
      and audit.target_id = v_person_id
      and audit.actor_internal_user_id = v_actor_id
      and audit.result = 'allowed'
      and audit.metadata ->> 'source' = 'panel.personas'
  ) then
    raise exception
      'SMOKE: falta auditoría person.create';
  end if;

  raise notice
    'SMOKE auditoría OK';

  raise notice
    'SMOKE CREATE PERSON COMPLETO OK';
end;
$smoke$;


\echo ''
\echo '=== PERSONA DURANTE EL SMOKE ==='

select
  id,
  display_name,
  normalized_name,
  record_status
from mp25m.persons
where display_name = 'Smoke Persona Canónica Temporal';


rollback;


\echo ''
\echo '=== POST ROLLBACK ==='

select
  (
    select count(*)
    from auth.users
    where id =
      '10000000-0000-0000-0000-000000000070'
  ) as persisted_auth_users,

  (
    select count(*)
    from mp25m.internal_users
    where id =
      '20000000-0000-0000-0000-000000000070'
  ) as persisted_internal_users,

  (
    select count(*)
    from mp25m.persons
    where display_name =
      'Smoke Persona Canónica Temporal'
  ) as persisted_persons;
