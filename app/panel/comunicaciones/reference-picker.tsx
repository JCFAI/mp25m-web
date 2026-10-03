'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { ReferenceListDialog } from '../../../components/reference-list-dialog'
import { useRemoteReferenceList, type RemoteReferencePage } from '../../../hooks/use-remote-reference-list'

export type CommunicationReferenceKind = 'person' | 'node' | 'organization' | 'opportunity' | 'articulation' | 'project' | 'theme' | 'need_offer' | 'agenda_entry' | 'person_skill' | 'organization_capability'
type Option = { id: string; label: string; detail?: string }
export const CommunicationCriterionLabelsContext = createContext<Record<string, string>>({})

const titles: Record<CommunicationReferenceKind, string> = { person: 'Personas', node: 'Nodos', organization: 'Organizaciones', opportunity: 'Oportunidades', articulation: 'Articulaciones', project: 'Proyectos', theme: 'Temas', need_offer: 'Necesidades y ofertas', agenda_entry: 'Entradas manuales de Agenda', person_skill: 'Habilidades para Personas', organization_capability: 'Capacidades para Organizaciones' }
export function CommunicationReferencePicker({ kind, name, value, selectedLabel, onChange }: { kind: CommunicationReferenceKind; name?: string; value?: string; selectedLabel?: string; onChange?: (value: string) => void }) {
  const criterionLabels = useContext(CommunicationCriterionLabelsContext)
  const [selected, setSelected] = useState<Option | null>(null)
  const fetchPage = useCallback(async ({ query, cursor, signal }: { query: string; cursor: string | null; signal: AbortSignal }) => {
    let url: string
    if (kind === 'person' || kind === 'organization') { const params = new URLSearchParams({ mode: 'reference', actor_type: kind, q: query, limit: '50' }); if (cursor) params.set('cursor', cursor); url = `/api/panel/oportunidades/actores?${params}` }
    else if (kind === 'node') { const params = new URLSearchParams({ mode: 'reference', q: query, limit: '50' }); if (cursor) params.set('cursor', cursor); url = `/api/panel/nodos?${params}` }
    else if (kind === 'opportunity') { const params = new URLSearchParams({ q: query, limit: '50' }); if (cursor) params.set('cursor', cursor); url = `/api/panel/oportunidades/referencias?${params}` }
    else if (kind === 'person_skill' || kind === 'organization_capability') { const params = new URLSearchParams({ mode: 'reference', application: kind === 'person_skill' ? 'people' : 'organizations', q: query }); url = `/api/panel/habilidades?${params}` }
    else { const params = new URLSearchParams({ kind, q: query }); url = `/api/panel/comunicaciones/referencias?${params}` }
    const response = await fetch(url, { signal, cache: 'no-store' }); if (!response.ok) throw new Error('No se pudo cargar la lista.'); const page = await response.json() as { items: Record<string, unknown>[]; nextCursor?: string | null }
    return { items: page.items.map((item: Record<string, unknown>) => ({ id: String(item.actor_id ?? item.id ?? item.node_id ?? item.theme_id ?? item.need_offer_id ?? item.articulation_id ?? item.project_id ?? item.agenda_entry_id ?? ''), label: String(item.display_name ?? item.title ?? item.name ?? item.label ?? ''), detail: typeof (item.type_label ?? item.status ?? item.detail) === 'string' ? String(item.type_label ?? item.status ?? item.detail) : undefined })), nextCursor: page.nextCursor ?? null } as RemoteReferencePage<Option>
  }, [kind])
  const references = useRemoteReferenceList({ contextKey: `communication-reference:${kind}`, getItemKey: (item) => item.id, fetchPage })
  const choose = (item: Option) => { setSelected(item); onChange?.(item.id) }
  const persistedLabel = selectedLabel ?? criterionLabels[value ?? '']
  return <div className="mt-2"><input type="hidden" name={name} value={value ?? selected?.id ?? ''} /><p role="status" className="text-sm text-slate-600">{selected ? `Seleccionado: ${selected.label}` : persistedLabel ? `Seleccionado: ${persistedLabel}` : value ? 'La referencia guardada ya no está disponible.' : 'Sin selección.'}</p><ReferenceListDialog buttonLabel={`Elegir ${titles[kind].toLowerCase()}`} title={titles[kind]} description="Buscá o explorá la lista. No se crean entidades nuevas." items={references.items} getItemKey={(item) => item.id} getItemSearchText={(item) => item.label} emptyMessage="No se encontraron opciones." onOpen={references.open} onSelect={choose} renderItem={(item) => <><strong>{item.label}</strong>{item.detail ? <p className="text-xs text-slate-500">{item.detail}</p> : null}</>} remote={{ ...references, autoLoad: true, onQueryChange: references.setQuery, onLoadMore: references.loadMore, onRetry: references.retry }} /></div>
}
