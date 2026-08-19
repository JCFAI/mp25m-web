create or replace function mp25m_private.normalize_text(p_value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(
    trim(regexp_replace(
      translate(lower(coalesce(p_value,'')), 'áéíóúüñàèìòùäëïöüç', 'aeiouunaeiouaeiouc'),
      '[^a-z0-9]+', ' ', 'g'
    )),
    ''
  );
$$;
revoke all on function mp25m_private.normalize_text(text) from public, anon, authenticated;
grant execute on function mp25m_private.normalize_text(text) to service_role;;
