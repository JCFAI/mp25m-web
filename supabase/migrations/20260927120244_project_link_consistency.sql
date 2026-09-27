begin;

-- ============================================================
-- Consistencia del modelo N:M de Proyectos
--
-- projects.opportunity_id es un campo legacy de compatibilidad.
-- Debe reflejar únicamente una relación DIRECTA registrada en
-- project_opportunities.
--
-- Vincular un Proyecto con una Articulación no crea ni implica
-- una relación Proyecto <-> Opportunity.
-- ============================================================

create or replace function
mp25m_api.unlink_project_opportunity(
  p_actor_internal_user_id uuid,
  p_project_id uuid,
  p_opportunity_id uuid,
  p_rationale text
)
returns void
language plpgsql
set search_path to
  'pg_catalog',
  'mp25m',
  'mp25m_api'
as $function$
begin
  if char_length(
    btrim(
      coalesce(
        p_rationale,
        ''
      )
    )
  ) not between 3 and 10000 then
    raise exception
      'Invalid unlink rationale'
      using errcode = '22023';
  end if;

  if not mp25m_api.can_manage_project(
    p_actor_internal_user_id,
    p_project_id
  ) then
    raise exception
      'Internal user cannot update this project'
      using errcode = '42501';
  end if;

  delete from mp25m.project_opportunities
  where project_id =
      p_project_id
    and opportunity_id =
      p_opportunity_id;

  if not found then
    raise exception
      'Project opportunity link not found'
      using errcode = 'P0002';
  end if;

  -- El campo legacy se sincroniza solamente con vínculos
  -- directos Proyecto <-> Opportunity.
  --
  -- Nunca se infiere una Opportunity a partir de una
  -- Articulación vinculada al Proyecto.
  update mp25m.projects project
  set
    opportunity_id = (
      select
        link.opportunity_id

      from mp25m.project_opportunities link

      where link.project_id =
        p_project_id

      order by
        link.added_at,
        link.id

      limit 1
    ),

    updated_at =
      now()

  where project.id =
    p_project_id;

  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    'project.opportunity.unlink',
    'mp25m',
    'projects',
    p_project_id,
    btrim(p_rationale),
    'allowed',

    jsonb_build_object(
      'opportunity_id',
      p_opportunity_id
    )
  );
end;
$function$;


revoke all
  on function mp25m_api.unlink_project_opportunity(
    uuid,
    uuid,
    uuid,
    text
  )
  from public, anon, authenticated, service_role;

grant execute
  on function mp25m_api.unlink_project_opportunity(
    uuid,
    uuid,
    uuid,
    text
  )
  to service_role;

commit;
