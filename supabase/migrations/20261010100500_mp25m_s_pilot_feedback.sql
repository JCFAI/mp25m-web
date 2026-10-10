begin;

create table mp25m.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  feedback_type text not null
    check (feedback_type in ('difficulty', 'suggestion', 'error', 'other')),
  detail text not null
    check (char_length(btrim(detail)) between 3 and 5000),
  context_path text
    check (
      context_path is null
      or char_length(btrim(context_path)) between 1 and 500
    ),
  created_by_internal_user_id uuid not null
    references mp25m.internal_users(id)
    on delete restrict,
  created_at timestamptz not null default now()
);

comment on table mp25m.pilot_feedback is
  'Feedback submitted by internal users during the MP25M pilot.';

create index pilot_feedback_created_at_idx
  on mp25m.pilot_feedback(created_at desc);

create index pilot_feedback_creator_idx
  on mp25m.pilot_feedback(created_by_internal_user_id, created_at desc);

alter table mp25m.pilot_feedback enable row level security;

revoke all on mp25m.pilot_feedback
from public, anon, authenticated, service_role;

grant insert, select on mp25m.pilot_feedback
to service_role;

create or replace function mp25m_api.create_pilot_feedback(
  p_actor_internal_user_id uuid,
  p_feedback_type text,
  p_detail text,
  p_context_path text default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, mp25m, mp25m_api
as $function$
declare
  v_id uuid;
  v_detail text := btrim(coalesce(p_detail, ''));
  v_context text := nullif(btrim(coalesce(p_context_path, '')), '');
begin
  if not exists (
    select 1
    from mp25m.internal_users internal_user
    where internal_user.id = p_actor_internal_user_id
      and internal_user.status = 'active'
      and internal_user.deleted_at is null
  ) then
    raise exception 'Active internal user required'
      using errcode = '42501';
  end if;

  if p_feedback_type not in ('difficulty', 'suggestion', 'error', 'other') then
    raise exception 'Invalid feedback type'
      using errcode = '22023';
  end if;

  if char_length(v_detail) not between 3 and 5000 then
    raise exception 'Invalid feedback detail'
      using errcode = '22023';
  end if;

  if v_context is not null and char_length(v_context) > 500 then
    raise exception 'Invalid feedback context'
      using errcode = '22023';
  end if;

  insert into mp25m.pilot_feedback (
    feedback_type,
    detail,
    context_path,
    created_by_internal_user_id
  )
  values (
    p_feedback_type,
    v_detail,
    v_context,
    p_actor_internal_user_id
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function mp25m_api.create_pilot_feedback(uuid, text, text, text)
from public, anon, authenticated, service_role;

grant execute on function mp25m_api.create_pilot_feedback(uuid, text, text, text)
to service_role;

commit;
