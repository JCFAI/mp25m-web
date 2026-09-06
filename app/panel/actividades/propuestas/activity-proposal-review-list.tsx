'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useState } from 'react'
import { ReferenceListDialog } from '../../../../components/reference-list-dialog'
import type { ActivityProposal } from '../../../../lib/organizations/activity-proposals'
import type { ActivityResolutionAction } from '../../../../lib/organizations/activity-proposals-manage'
import type { ActivitySearchResult } from '../../../../lib/organizations/activities'
import { resolveActivityProposalAction, type ResolutionState } from './actions'

const fieldClass = 'mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F5D8C]'
const initialState: ResolutionState = { status: 'idle', message: '' }

function ResolutionForm({ proposal, action, onResolved }: {
  proposal: ActivityProposal
  action: ActivityResolutionAction
  onResolved: (message: string) => void
}) {
  const id = useId()
  const [state, submit, pending] = useActionState(async (previous: ResolutionState, form: FormData) => {
    const result = await resolveActivityProposalAction(proposal.proposal_id, action, previous, form)
    if (result.status === 'success') onResolved(result.message)
    return result
  }, initialState)
  const [name, setName] = useState(proposal.proposed_name)
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<ActivitySearchResult | null>(null)
  const [results, setResults] = useState<ActivitySearchResult[]>([])
  const [references, setReferences] = useState<ActivitySearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [referenceLoading, setReferenceLoading] = useState(false)
  const [referenceError, setReferenceError] = useState<string | null>(null)

  useEffect(() => {
    if (action !== 'map' || target || query.trim().length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setSearchError(null)
      try {
        const response = await fetch(`/api/panel/actividades?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('search')
        const items: ActivitySearchResult[] = await response.json()
        if (!controller.signal.aborted) setResults(items)
      } catch {
        if (!controller.signal.aborted) setSearchError('No se pudo consultar el catálogo. Intentá nuevamente.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [action, query, target])

  async function loadReferences() {
    setReferenceLoading(true)
    setReferenceError(null)
    try {
      const response = await fetch('/api/panel/actividades?mode=reference')
      if (!response.ok) throw new Error('reference')
      setReferences(await response.json())
    } catch { setReferenceError('No se pudo cargar la lista. Cerrá y volvé a abrir para reintentar.') }
    finally { setReferenceLoading(false) }
  }
  function selectTarget(item: ActivitySearchResult) {
    setTarget(item); setQuery(item.display_name); setResults([]); setLoading(false); setSearchError(null)
  }

  return (
    <form action={submit} className="mt-4 space-y-4">
      <fieldset disabled={pending} className="min-w-0 space-y-4 disabled:opacity-60">
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm">
          <p className="text-slate-500">{action === 'reject' ? 'Propuesta a rechazar' : action === 'create' ? 'Propuesta origen' : 'Propuesta a resolver'}</p>
          <p className="break-words font-semibold">{proposal.proposed_name}</p>
          <p className="mt-2 text-slate-500">Organización</p>
          <p className="break-words font-semibold">{proposal.organization_name}</p>
          {action !== 'reject' && <>
            <p className="mt-2 text-slate-500">{action === 'map' ? 'Destino seleccionado' : 'Nueva actividad canónica'}</p>
            <p className="break-words font-semibold">{action === 'map' ? target?.display_name || 'Sin seleccionar' : name.trim() || 'Sin nombre'}</p>
            <p className="mt-3 break-words">{proposal.proposed_name} → {action === 'map' ? target?.display_name || 'Elegí una actividad' : name.trim() || 'Ingresá el nombre'}</p>
          </>}
        </div>
        {action === 'map' && <>
          <div>
            <label className="block" htmlFor={`${id}-search`}>Buscar actividad destino</label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <input id={`${id}-search`} autoComplete="off" className={fieldClass} value={query}
                onChange={(e) => { setQuery(e.target.value); setTarget(null); setResults([]); setLoading(false); setSearchError(null) }} />
              <ReferenceListDialog buttonClassName="mt-2" title="Elegir actividad destino" description={`Para la propuesta: "${proposal.proposed_name}". Se muestran hasta 50 actividades; usá el buscador para consultar el resto.`}
                items={references} loading={referenceLoading} errorMessage={referenceError} onOpen={loadReferences}
                emptyMessage="No hay actividades disponibles." getItemKey={item => item.id} getItemSearchText={item => item.display_name}
                renderItem={item => <span>{item.display_name}</span>} onSelect={selectTarget} />
            </div>
          </div>
          <input type="hidden" name="target_activity_id" value={target?.id ?? ''} />
          <div aria-live="polite" className="text-sm text-slate-600">
            {loading ? 'Buscando...' : searchError || (!target && query.trim().length >= 2 && results.length === 0 ? 'Sin resultados para mostrar.' : '')}
          </div>
          {!target && results.length > 0 && <ul className="space-y-1" aria-label="Actividades encontradas">
            {results.map(item => <li key={item.id}><button type="button" className="min-h-11 w-full rounded-lg border border-slate-200 bg-white p-3 text-left text-sm hover:bg-sky-50" onClick={() => selectTarget(item)}>{item.display_name}</button></li>)}
          </ul>}
          <p className="text-sm text-slate-600">Mapear la propuesta no registra la actividad en la organización.</p>
        </>}
        {action === 'create' && <>
          <label className="block" htmlFor={`${id}-name`}>Nombre canónico
            <input id={`${id}-name`} name="canonical_name" required minLength={2} maxLength={200} value={name} onChange={e => setName(e.target.value)} className={fieldClass} />
          </label>
          <label className="block" htmlFor={`${id}-description`}>Descripción opcional
            <textarea id={`${id}-description`} name="description" rows={3} maxLength={2000} className={fieldClass} />
          </label>
          <p className="text-sm text-slate-600">Crear la actividad canónica no la registra automáticamente en la organización.</p>
        </>}
        {action === 'reject' && <p className="text-sm text-slate-600">La propuesta se conserva para trazabilidad, pero no se incorpora al catálogo.</p>}
        <label className="block" htmlFor={`${id}-reason`}>{action === 'reject' ? 'Motivo' : 'Justificación'}
          <textarea id={`${id}-reason`} name="reason" required minLength={3} maxLength={2000} rows={3} className={fieldClass} />
        </label>
        {state.message && <p role="status" className="text-sm text-red-700">{state.message}</p>}
        <button disabled={pending || (action === 'map' && !target)} className="min-h-11 w-full rounded-xl bg-[#1E3A5F] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">
          {pending ? 'Guardando...' : action === 'map' ? 'Mapear propuesta' : action === 'create' ? 'Crear actividad canónica' : 'Rechazar propuesta'}
        </button>
      </fieldset>
    </form>
  )
}

export function ActivityProposalReviewList({ proposals }: { proposals: ActivityProposal[] }) {
  const [message, setMessage] = useState('')
  return <div className="space-y-4">
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {proposals.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm">No hay propuestas de actividades pendientes.</p>}
    {proposals.map(proposal => <article key={proposal.proposal_id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="break-words text-lg font-semibold">{proposal.proposed_name}</h2><span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">Pendiente</span></div>
      <p className="mt-2 break-words text-sm">Organización origen: <Link className="text-[#2F5D8C] underline" href={`/panel/organizaciones/${proposal.organization_id}`}>{proposal.organization_name}</Link></p>
      <p className="mt-1 break-words text-xs text-slate-500">{new Date(proposal.created_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}{proposal.created_by ? ` · ${proposal.created_by}` : ''}</p>
      <div className="mt-4 space-y-3">
        {(['map', 'create', 'reject'] as const).map(action => <details key={action} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-semibold">{action === 'map' ? 'Mapear a existente' : action === 'create' ? 'Crear una actividad canónica nueva' : 'Rechazar propuesta'}</summary>
          <ResolutionForm proposal={proposal} action={action} onResolved={setMessage} />
        </details>)}
      </div>
    </article>)}
  </div>
}
