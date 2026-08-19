create or replace function mp25m_private.create_profile_access_token(
  p_person_id uuid,
  p_valid_days integer default 30,
  p_revoke_existing boolean default true
)
returns table(token text, token_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, mp25m_private, mp25m, extensions
as $$
declare
  v_token text;
  v_hash char(64);
  v_id uuid;
  v_expires timestamptz;
begin
  if p_valid_days < 1 or p_valid_days > 365 then
    raise exception 'valid_days_out_of_range';
  end if;

  if not exists (
    select 1 from mp25m.persons p
    where p.id = p_person_id and p.record_status = 'active'
  ) then
    raise exception 'person_not_available';
  end if;

  if p_revoke_existing then
    update mp25m_private.profile_access_tokens
       set status = 'revoked'
     where person_id = p_person_id
       and status = 'active';
  end if;

  loop
    v_token := translate(trim(trailing '=' from encode(extensions.gen_random_bytes(32), 'base64')), '+/', '-_');
    v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
    exit when not exists (
      select 1 from mp25m_private.profile_access_tokens t where t.token_hash = v_hash
    );
  end loop;

  v_expires := now() + make_interval(days => p_valid_days);

  insert into mp25m_private.profile_access_tokens(
    person_id, token_hash, status, expires_at, created_by, metadata
  ) values (
    p_person_id, v_hash, 'active', v_expires, 'mp25m_private.create_profile_access_token',
    jsonb_build_object('valid_days', p_valid_days)
  )
  returning id into v_id;

  return query select v_token, v_id, v_expires;
end;
$$;

revoke all on function mp25m_private.create_profile_access_token(uuid, integer, boolean) from public, anon, authenticated;
grant execute on function mp25m_private.create_profile_access_token(uuid, integer, boolean) to service_role;;
