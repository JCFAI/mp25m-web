'use client'

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  useRouter,
} from 'next/navigation'

import type {
  FoundationRelationKind,
  MatchActorKind,
  MatchStatus,
  OpportunityRequirementMatchCandidate,
} from '../../../../lib/opportunities/analysis'
import {
  acceptOpportunityRequirementMatchCandidateAction,
  type AnalysisActionState,
} from './analysis-actions'

const initialState: AnalysisActionState = {
  status: 'idle',
  message: null,
}

const actorKindLabels: Record<
  MatchActorKind,
  string
> = {
  person: 'Persona',
  organization: 'Organización',
  candidate: 'Actor pendiente',
}

const relationLabels: Record<
  FoundationRelationKind,
  string
> = {
  direct: 'Coincidencia directa',
  related: 'Relacionado',
  contextual: 'Contextual',
}

const verificationLabels: Record<
  string,
  string
> = {
  confirmed: 'Confirmada',
  self_reported: 'Declarada por el actor',
  candidate: 'Pendiente de verificación',
}

function foundationText(
  foundation: Record<string, unknown>,
  key: string
) {
  const value = foundation[key]

  return typeof value === 'string' &&
    value.trim()
    ? value.trim()
    : null
}

function foundationRelationLabel(
  foundation: Record<string, unknown>
) {
  const value =
    foundationText(
      foundation,
      'relation_kind'
    )

  if (
    value === 'direct' ||
    value === 'related' ||
    value === 'contextual'
  ) {
    return relationLabels[value]
  }

  return null
}

function foundationVerificationLabel(
  foundation: Record<string, unknown>
) {
  const value =
    foundationText(
      foundation,
      'verification_status'
    )

  if (!value) return null

  return (
    verificationLabels[value] ??
    value.replaceAll('_', ' ')
  )
}

const existingStatusLabels: Record<
  MatchStatus,
  string
> = {
  suggested: 'Pendiente de decisión',
  accepted_for_analysis:
    'Ya incorporado al análisis',
  discarded:
    'Descartado del análisis',
}

function CandidateAction({
  opportunityId,
  requirementRevisionId,
  candidate,
}: {
  opportunityId: string
  requirementRevisionId: string
  candidate: OpportunityRequirementMatchCandidate
}) {
  const router = useRouter()

  const action =
    acceptOpportunityRequirementMatchCandidateAction.bind(
      null,
      opportunityId,
      requirementRevisionId,
      candidate.actor_kind,
      candidate.actor_id
    )

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    action,
    initialState
  )

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh()
    }
  }, [
    router,
    state.status,
  ])

  if (state.status === 'success') {
    return (
      <span
        role="status"
        className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
      >
        Ya incorporado al análisis
      </span>
    )
  }

  if (
    candidate.existing_match_status
  ) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        {
          existingStatusLabels[
            candidate.existing_match_status
          ]
        }
      </span>
    )
  }

  if (!candidate.persistence_allowed) {
    return (
      <span className="text-xs text-slate-400">
        Sólo disponible para consulta
      </span>
    )
  }

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className="ux-button rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? 'Incorporando…'
          : 'Incorporar al análisis'}
      </button>

      {state.message ? (
        <p
          role={
            state.status === 'error'
              ? 'alert'
              : 'status'
          }
          className={`mt-2 text-xs ${
            state.status === 'error'
              ? 'text-red-700'
              : 'text-emerald-700'
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

export function MatchCandidateSearch({
  opportunityId,
  requirementRevisionId,
}: {
  opportunityId: string
  requirementRevisionId: string
}) {
  const [
    candidates,
    setCandidates,
  ] = useState<
    OpportunityRequirementMatchCandidate[] | null
  >(null)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  )

  const [
    filter,
    setFilter,
  ] = useState('')

  const [
    actorKind,
    setActorKind,
  ] = useState<
    MatchActorKind | 'all'
  >('all')

  async function loadCandidates() {
    setLoading(true)
    setError(null)

    try {
      const response =
        await fetch(
          `/api/panel/oportunidades/${opportunityId}/requirements/${requirementRevisionId}/candidates`,
          {
            cache: 'no-store',
          }
        )

      const body =
        await response.json() as
          | OpportunityRequirementMatchCandidate[]
          | { error?: string }

      if (
        !response.ok ||
        !Array.isArray(body)
      ) {
        throw new Error(
          'No se pudieron buscar actores para analizar.'
        )
      }

      setCandidates(body)
    } catch (error) {
      setCandidates(null)
      setError(
        error instanceof Error
          ? error.message
          : 'No se pudieron buscar actores para analizar.'
      )
    } finally {
      setLoading(false)
    }
  }

  const visibleCandidates =
    useMemo(() => {
      if (!candidates) return []

      const normalizedFilter =
        filter
          .trim()
          .toLocaleLowerCase('es')

      return candidates.filter(
        (candidate) => {
          if (
            actorKind !== 'all' &&
            candidate.actor_kind !==
              actorKind
          ) {
            return false
          }

          if (!normalizedFilter) {
            return true
          }

          return candidate.actor_display_name
            .toLocaleLowerCase('es')
            .includes(
              normalizedFilter
            )
        }
      )
    }, [
      actorKind,
      candidates,
      filter,
    ])

  return (
    <section className="mt-4 rounded-xl border border-[#C8D6E5] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            Buscar actores para analizar
          </h4>

          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            El sistema busca personas,
            organizaciones y actores
            pendientes relacionados con
            este requerimiento. Incorporar
            un actor permite analizarlo,
            pero no significa que cumpla
            el requerimiento.
          </p>
        </div>

        <button
          type="button"
          onClick={loadCandidates}
          disabled={loading}
          className="ux-button rounded-lg border border-[#2F5D8C] px-3 py-2 text-sm font-semibold text-[#1E3A5F] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? 'Buscando…'
            : candidates
              ? 'Actualizar resultados'
              : 'Buscar actores'}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      ) : null}

      {candidates ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]">
            <label className="text-sm font-medium text-slate-700">
              Filtrar por nombre
              <input
                value={filter}
                onChange={(event) =>
                  setFilter(
                    event.target.value
                  )
                }
                placeholder="Escribí desde el primer carácter…"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Tipo de actor
              <select
                value={actorKind}
                onChange={(event) =>
                  setActorKind(
                    event.target.value as
                      MatchActorKind |
                      'all'
                  )
                }
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              >
                <option value="all">
                  Todos
                </option>
                <option value="person">
                  Personas
                </option>
                <option value="organization">
                  Organizaciones
                </option>
                <option value="candidate">
                  Actores pendientes
                </option>
              </select>
            </label>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            {
              visibleCandidates.length
            }{' '}
            de {candidates.length}{' '}
            resultados visibles.
          </p>

          {visibleCandidates.length === 0 ? (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
              No hay actores que coincidan
              con los filtros actuales.
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {visibleCandidates.map(
                (candidate) => (
                  <article
                    key={`${candidate.actor_kind}:${candidate.actor_id}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h5 className="font-semibold text-slate-900">
                          {
                            candidate.actor_display_name
                          }
                        </h5>

                        <p className="mt-1 text-xs text-slate-500">
                          {
                            actorKindLabels[
                              candidate.actor_kind
                            ]
                          }
                          {' · '}
                          {
                            relationLabels[
                              candidate.strongest_relation_kind
                            ]
                          }
                          {' · '}
                          {
                            candidate.foundation_count
                          }{' '}
                          evidencia
                          {
                            candidate.foundation_count ===
                            1
                              ? ''
                              : 's'
                          }
                        </p>

                        {candidate.territorially_related ? (
                          <p className="mt-1 text-xs font-medium text-[#2F5D8C]">
                            Tiene relación
                            territorial con
                            la oportunidad.
                          </p>
                        ) : null}

                        {candidate.foundations.length > 0 ? (
                          <details className="mt-3 max-w-3xl rounded-lg border border-slate-200 bg-white">
                            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[#1E3A5F]">
                              Ver evidencias que explican el resultado
                              {' · '}
                              {candidate.foundation_count}
                              {candidate.foundation_count === 1
                                ? ' evidencia'
                                : ' evidencias'}
                            </summary>

                            <div className="space-y-2 border-t border-slate-200 p-3">
                              {candidate.foundations.map(
                                (foundation, index) => {
                                  const observedText =
                                    foundationText(
                                      foundation,
                                      'observed_text'
                                    )

                                  const inferenceText =
                                    foundationText(
                                      foundation,
                                      'inference_text'
                                    )

                                  const sourceName =
                                    foundationText(
                                      foundation,
                                      'source_name'
                                    )

                                  const sourceExcerpt =
                                    foundationText(
                                      foundation,
                                      'source_excerpt'
                                    )

                                  const sourceLocator =
                                    foundationText(
                                      foundation,
                                      'source_locator'
                                    )

                                  const relation =
                                    foundationRelationLabel(
                                      foundation
                                    )

                                  const verification =
                                    foundationVerificationLabel(
                                      foundation
                                    )

                                  return (
                                    <article
                                      key={index}
                                      className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"
                                    >
                                      <div className="flex flex-wrap gap-2">
                                        {relation ? (
                                          <span className="rounded-full bg-[#E8F0F8] px-2 py-0.5 font-semibold text-[#1E3A5F]">
                                            {relation}
                                          </span>
                                        ) : null}

                                        {verification ? (
                                          <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-600">
                                            {verification}
                                          </span>
                                        ) : null}
                                      </div>

                                      {observedText ? (
                                        <p className="mt-2 whitespace-pre-wrap text-slate-700">
                                          {observedText}
                                        </p>
                                      ) : sourceExcerpt ? (
                                        <p className="mt-2 whitespace-pre-wrap text-slate-700">
                                          {sourceExcerpt}
                                        </p>
                                      ) : (
                                        <p className="mt-2 italic text-slate-500">
                                          La evidencia no tiene una descripción textual disponible.
                                        </p>
                                      )}

                                      {inferenceText ? (
                                        <p className="mt-2">
                                          <span className="font-semibold text-slate-700">
                                            Relación con el requerimiento:
                                          </span>{' '}
                                          {inferenceText}
                                        </p>
                                      ) : null}

                                      {sourceName || sourceLocator ? (
                                        <p className="mt-2 break-words text-slate-400">
                                          <span className="font-semibold">
                                            Fuente:
                                          </span>{' '}
                                          {sourceName ?? sourceLocator}
                                        </p>
                                      ) : null}
                                    </article>
                                  )
                                }
                              )}

                              {candidate.foundation_count >
                              candidate.foundations.length ? (
                                <p className="text-xs italic text-slate-500">
                                  Se muestran las{' '}
                                  {candidate.foundations.length}{' '}
                                  evidencias de mayor relevancia de un total de{' '}
                                  {candidate.foundation_count}.
                                </p>
                              ) : null}
                            </div>
                          </details>
                        ) : null}
                      </div>

                      <CandidateAction
                        opportunityId={
                          opportunityId
                        }
                        requirementRevisionId={
                          requirementRevisionId
                        }
                        candidate={
                          candidate
                        }
                      />
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
          Ejecutá la búsqueda para ver
          actores relacionados con este
          requerimiento.
        </p>
      )}
    </section>
  )
}
