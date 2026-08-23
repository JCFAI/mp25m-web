insert into mp25m.access_roles (
  code,
  name,
  description,
  is_administrative,
  is_active,
  display_order
)
values
  (
    'administrator',
    'Administrador',
    'Administración general del backoffice, usuarios internos, roles y configuración.',
    true,
    true,
    10
  ),
  (
    'validator',
    'Validador',
    'Revisión y validación de información dentro del alcance asignado.',
    false,
    true,
    20
  ),
  (
    'articulator',
    'Articulador',
    'Gestión operativa de articulaciones y oportunidades dentro del alcance asignado.',
    false,
    true,
    30
  ),
  (
    'node_referent',
    'Referente de nodo',
    'Acceso operativo sobre uno o más nodos expresamente asignados.',
    false,
    true,
    40
  ),
  (
    'participant',
    'Participante',
    'Acceso interno limitado a las funciones habilitadas para participantes.',
    false,
    true,
    50
  ),
  (
    'authority_analyst',
    'Autoridad/Analista',
    'Consulta de indicadores e información agregada dentro del alcance autorizado.',
    false,
    true,
    60
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_administrative = excluded.is_administrative,
  is_active = excluded.is_active,
  display_order = excluded.display_order,
  deleted_at = null,
  updated_at = now();

insert into mp25m.access_scopes (
  scope_type,
  scope_key,
  scope_entity_id,
  name,
  description,
  is_active
)
select
  'global',
  null,
  null,
  'Global',
  'Alcance institucional completo del Sistema MP25M.',
  true
where not exists (
  select 1
  from mp25m.access_scopes
  where scope_type = 'global'
    and is_active = true
    and deleted_at is null
);
