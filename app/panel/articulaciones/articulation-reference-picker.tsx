'use client'

import { useState } from 'react'
import { ReferenceListDialog } from '../../../components/reference-list-dialog'
import { useRemoteReferenceList, type RemoteReferencePage } from '../../../hooks/use-remote-reference-list'
import type { CanonicalActorReference } from '../../../lib/opportunities/actors'
import type { OpportunityReference } from '../../../lib/opportunities/reference'

type Option = { id: string; label: string; description: string }

export function ArticulationReferencePicker({ kind, excludedIds = [] }: {
  kind: 'actor' | 'opportunity'; excludedIds?: string[]
}) {
  const [selected, setSelected] = useState<Option | null>(null)
  const list = useRemoteReferenceList<Option>({
    contextKey: kind,
    getItemKey: (item) => item.id,
    fetchPage: async ({ query, cursor, signal }) => {
      const params = new URLSearchParams({ q: query, limit: '50' })
      if (cursor) params.set('cursor', cursor)
      if (kind === 'actor') params.set('mode', 'reference')
      const endpoint = kind === 'actor' ? 'actores' : 'referencias'
      const response = await fetch(`/api/panel/oportunidades/${endpoint}?${params}`, { signal })
      if (!response.ok) throw new Error('No se pudo cargar la lista.')
      if (kind === 'actor') {
        const page: RemoteReferencePage<CanonicalActorReference> = await response.json()
        return { ...page, items: page.items.map((actor) => ({
          id: `${actor.actor_type}:${actor.actor_id}`, label: actor.display_name, description: actor.type_label,
        })) }
      }
      const page: RemoteReferencePage<OpportunityReference> = await response.json()
      return { ...page, items: page.items.map((opportunity) => ({
        id: opportunity.id, label: opportunity.title, description: 'Oportunidad',
      })) }
    },
  })
  const validSelection = selected && !excludedIds.includes(selected.id) ? selected : null
  return <div className="space-y-2">
    <input type="hidden" name={kind === 'actor' ? 'actor' : 'opportunity_id'} value={validSelection?.id ?? ''} />
    <p role="status" className="text-sm text-slate-700">{validSelection ? `Selección: ${validSelection.label}` : 'Sin selección'}</p>
    <ReferenceListDialog
      buttonLabel={kind === 'actor' ? 'Elegir persona u organización' : 'Elegir oportunidad'}
      title={kind === 'actor' ? 'Personas y organizaciones' : 'Oportunidades'}
      description="Explorá la lista o buscá por nombre. Se cargan hasta 50 opciones por página."
      items={list.items}
      getItemKey={(item) => item.id}
      getItemSearchText={(item) => item.label}
      emptyMessage="No se encontraron resultados."
      onOpen={list.open}
      onSelect={(item) => { if (!excludedIds.includes(item.id)) setSelected(item) }}
      renderItem={(item) => <><strong>{item.label}</strong><p className="text-xs text-slate-500">{excludedIds.includes(item.id) ? 'Ya vinculada' : item.description}</p></>}
      remote={{ ...list, autoLoad: true, onQueryChange: list.setQuery, onLoadMore: list.loadMore, onRetry: list.retry }}
    />
  </div>
}
