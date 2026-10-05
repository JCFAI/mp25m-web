'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import type { FoundationRelationKind } from '../../../../lib/opportunities/analysis'
import {
  addOpportunityRequirementMatchFoundationAction,
  type AnalysisActionState,
} from './analysis-actions'

type EvidenceResult = {
  source_record_type: string
  source_record_id: string
  evidence_kind: string
  evidence_text: string
  skill_name: string | null
  activity_name: string | null
  verification_status: string | null
  node_name: string | null
  source_name: string | null
  source_locator: string | null
  allowed_relation_kinds: FoundationRelationKind[]
  already_added: boolean
}

const initialState: AnalysisActionState = {
  status: 'idle',
  message: null,
}

const relationLabels: Record<FoundationRelationKind, string> = {
  direct: 'Directa',
  related: 'Relacionada',
  contextual: 'Contextual',
}

const evidenceKindLabels: Record<string, string> = {
  person_skill: 'Habilidad/capacidad',
  person_skill_evidence: 'Evidencia de habilidad/capacidad',
  person_profile: 'Perfil de la persona',
  person_profile_activity: 'Actividad principal',
  organization_capability: 'Capacidad de la organización',
  organization_capability_evidence: 'Evidencia de capacidad',
  organization_activity: 'Actividad de la organización',
  actor_evidence_fragment: 'Evidencia del actor',
  node_participation: 'Participación en nodo',
  organization_node: 'Vinculación territorial',
  actor_candidate: 'Actor pendiente',
  actor_candidate_node: 'Vinculación territorial del actor pendiente',
  manual_rationale: 'Fundamento manual',
}

const verificationLabels: Record<string, string> = {
  self_reported: 'Declarada por el actor',
  confirmed: 'Confirmada',
  verified: 'Verificada',
  pending: 'Pendiente de verificación',
}

function evidenceKindLabel(value: string) {
  return evidenceKindLabels[value] ?? value.replaceAll('_', ' ')
}

function verificationLabel(value: string) {
  return verificationLabels[value] ?? value.replaceAll('_', ' ')
}

export function MatchFoundationAddForm({
  opportunityId,
  matchId,
}: {
  opportunityId: string
  matchId: string
}) {
  const action = addOpportunityRequirementMatchFoundationAction.bind(
    null,
    opportunityId,
    matchId
  )
  const [state, formAction, pending] = useActionState(action, initialState)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EvidenceResult[]>([])
  const [completedQuery, setCompletedQuery] = useState<string | null>(null)
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceResult | null>(null)
  const [relationKind, setRelationKind] = useState<FoundationRelationKind | ''>('')
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [searchMessage, setSearchMessage] = useState<string | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [relationError, setRelationError] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<HTMLDivElement>(null)
  const relationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(event.target as Node)
      ) {
        setListOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setListOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    const term = query.trim()

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setSearchState('loading')
      setSearchMessage(null)

      try {
        const response = await fetch(
          `/api/panel/oportunidades/${opportunityId}/matches/${matchId}/evidence?q=${encodeURIComponent(term)}`,
          { signal: controller.signal, cache: 'no-store' }
        )
        const body = await response.json() as EvidenceResult[] | { error?: string }

        if (!response.ok || !Array.isArray(body)) {
          throw new Error('No se pudo buscar evidencia para este actor.')
        }

        setResults(body)
        setCompletedQuery(term)
        setSearchState('idle')
      } catch (error) {
        if (controller.signal.aborted) return
        setResults([])
        setCompletedQuery(null)
        setSearchState('error')
        setSearchMessage(
          error instanceof Error
            ? error.message
            : 'No se pudo buscar evidencia para este actor.'
        )
      }
    }, 300)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [matchId, opportunityId, query])

  const searchTerm = query.trim()
  const searchCompletedForCurrentTerm =
    completedQuery === searchTerm

  function selectEvidence(evidence: EvidenceResult) {
    if (evidence.already_added) return

    setSelectedEvidence(evidence)
    setQuery(evidence.evidence_text)
    setRelationKind('')
    setSelectionError(null)
    setRelationError(null)
    setListOpen(false)
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!selectedEvidence) {
          event.preventDefault()
          setSelectionError('Seleccioná una evidencia de los resultados de búsqueda.')
          selectionRef.current?.focus()
          return
        }

        if (!relationKind) {
          event.preventDefault()
          setRelationError('Elegí cómo se relaciona la evidencia con el requerimiento.')
          relationRef.current?.focus()
        }
      }}
      className="mt-4 rounded-xl border border-[#C8D6E5] bg-slate-50 p-4"
    >
      <p className="text-sm font-semibold text-[#1E3A5F]">Agregar evidencia</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Buscá evidencia existente del mismo actor. Agregarla no modifica evaluaciones ni cobertura ya registradas.
      </p>

      <div
        ref={selectorRef}
        className="relative mt-4"
      >
        <label className="block text-sm font-medium text-slate-700">
          Buscar evidencia
          <input
            value={query}
            onFocus={() => setListOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedEvidence(null)
              setRelationKind('')
              setSelectionError(null)
              setRelationError(null)
              setSearchMessage(null)
              setListOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setListOpen(false)
              }
            }}
            role="combobox"
            aria-expanded={listOpen}
            aria-controls="evidence-results"
            aria-autocomplete="list"
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            placeholder="Buscar evidencia…"
          />
        </label>

        <p className="mt-1 text-xs text-slate-500">
          Explorá la evidencia disponible del actor o escribí desde el primer carácter.
          Se muestran hasta 20 registros, priorizando los más recientes.
        </p>

        {listOpen ? (
          <div
            id="evidence-results"
            ref={selectionRef}
            role="listbox"
            tabIndex={-1}
            className="absolute z-30 mt-2 max-h-96 w-full space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg outline-none focus:ring-2 focus:ring-[#2F5D8C]/20"
          >
            {!searchCompletedForCurrentTerm && searchState !== 'error' ? (
              <p className="rounded-lg px-3 py-2 text-xs text-slate-500">
                Cargando evidencia disponible…
              </p>
            ) : null}

            {searchCompletedForCurrentTerm && searchState === 'idle' && results.length === 0 ? (
              <p className="rounded-lg px-3 py-2 text-xs text-slate-500">
                {searchTerm
                  ? 'No se encontró evidencia disponible para esta búsqueda.'
                  : 'No hay evidencia disponible para este actor.'}
              </p>
            ) : null}

            {searchCompletedForCurrentTerm ? results.map((evidence) => {
              const selected =
                selectedEvidence?.source_record_type === evidence.source_record_type &&
                selectedEvidence?.source_record_id === evidence.source_record_id

              return (
                <button
                  key={`${evidence.source_record_type}:${evidence.source_record_id}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={evidence.already_added}
                  onClick={() => selectEvidence(evidence)}
                  className={`block w-full rounded-xl border p-3 text-left text-xs leading-5 transition ${
                    evidence.already_added
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                      : selected
                        ? 'border-[#2F5D8C] bg-[#E8F0F8] text-slate-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-[#8EACC9]'
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">
                    <span>{evidenceKindLabel(evidence.evidence_kind)}</span>

                    {evidence.already_added ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                        Ya agregada
                      </span>
                    ) : null}
                  </span>

                  <span className="mt-1 block whitespace-pre-wrap break-words">
                    {evidence.evidence_text}
                  </span>

                  {evidence.skill_name || evidence.activity_name ? (
                    <span className="mt-1 block text-slate-500">
                      {[evidence.skill_name, evidence.activity_name]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  ) : null}

                  {evidence.verification_status ? (
                    <span className="mt-1 block text-slate-400">
                      Verificación: {verificationLabel(evidence.verification_status)}
                    </span>
                  ) : null}

                  {evidence.node_name ? (
                    <span className="mt-1 block text-slate-400">
                      Nodo: {evidence.node_name}
                    </span>
                  ) : null}

                  {evidence.source_name || evidence.source_locator ? (
                    <span className="mt-1 block break-words text-slate-400">
                      Fuente: {evidence.source_name ?? evidence.source_locator}
                    </span>
                  ) : null}
                </button>
              )
            }) : null}

            {searchMessage ? (
              <p
                role="alert"
                className="text-sm font-medium text-red-700"
              >
                {searchMessage}
              </p>
            ) : null}
          </div>
        ) : null}

        {selectionError ? (
          <p
            role="alert"
            className="mt-2 text-sm font-medium text-red-700"
          >
            {selectionError}
          </p>
        ) : null}
      </div>

      {selectedEvidence ? (
        <div ref={relationRef} tabIndex={-1} className="mt-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2F5D8C]/20">
          <p className="text-sm font-medium text-slate-700">Relación con el requerimiento</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedEvidence.allowed_relation_kinds.map((kind) => (
              <label key={kind} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="relation_kind"
                  value={kind}
                  checked={relationKind === kind}
                  onChange={() => {
                    setRelationKind(kind)
                    setRelationError(null)
                  }}
                  className="h-4 w-4 border-slate-300 text-[#2F5D8C]"
                />
                {relationLabels[kind]}
              </label>
            ))}
          </div>
          {relationError ? <p role="alert" className="mt-2 text-sm font-medium text-red-700">{relationError}</p> : null}
        </div>
      ) : null}

      <input type="hidden" name="source_record_type" value={selectedEvidence?.source_record_type ?? ''} />
      <input type="hidden" name="source_record_id" value={selectedEvidence?.source_record_id ?? ''} />

      {state.message ? (
        <p role="alert" className={`mt-3 text-sm font-medium ${state.status === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-xl bg-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E3A5F] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? 'Agregando…' : 'Usar esta evidencia'}
      </button>
    </form>
  )
}
