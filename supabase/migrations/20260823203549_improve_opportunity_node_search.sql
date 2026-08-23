-- Incremento 2 - scalable node autocomplete for opportunities.
--
-- The canonical node name remains unchanged.
-- The API exposes a clean display name without the historical "Nodo " prefix.

drop view if exists mp25m_api.opportunity_node_options;

create view mp25m_api.opportunity_node_options
with (security_invoker = true)
as
select
    n.id,
    regexp_replace(
        n.name,
        '^Nodo[[:space:]]+',
        '',
        'i'
    ) as display_name,
    regexp_replace(
        n.normalized_name,
        '^nodo[[:space:]]+',
        '',
        'i'
    ) as search_name
from mp25m.nodes n
where n.status = 'active';

revoke all
on mp25m_api.opportunity_node_options
from public, anon, authenticated;

grant select
on mp25m_api.opportunity_node_options
to service_role;

comment on view mp25m_api.opportunity_node_options is
    'Server-only searchable active node lookup. Display names omit the historical Nodo prefix.';

create index if not exists idx_nodes_active_opportunity_search_name
on mp25m.nodes (
    (
        regexp_replace(
            normalized_name,
            '^nodo[[:space:]]+',
            '',
            'i'
        )
    ) text_pattern_ops
)
where status = 'active';