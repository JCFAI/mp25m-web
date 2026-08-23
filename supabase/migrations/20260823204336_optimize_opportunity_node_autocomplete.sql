-- Incremento 2 - scalable substring search for node autocomplete.

create extension if not exists pg_trgm
with schema extensions;

create index if not exists idx_nodes_active_opportunity_search_trgm
on mp25m.nodes
using gin (
    (
        regexp_replace(
            normalized_name,
            '^nodo[[:space:]]+',
            '',
            'i'
        )
    ) extensions.gin_trgm_ops
)
where status = 'active';