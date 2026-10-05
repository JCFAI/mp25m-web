'use client'

import {
  useActionState,
  useCallback,
  useMemo,
  useState,
} from 'react'

import { ReferenceListDialog } from '../../../../components/reference-list-dialog'
import {
  useRemoteReferenceList,
  type RemoteReferencePage,
} from '../../../../hooks/use-remote-reference-list'
import type {
  CanonicalActorReference,
  CanonicalActorType,
} from '../../../../lib/opportunities/actors'
import {
  createManualOpportunityRequirementMatchAction,
  type AnalysisActionState,
} from './analysis-actions'

type SelectedActor = {
  actorType: CanonicalActorType
  actorId: string
  displayName: string
}

const initialState: AnalysisActionState = {
  status: 'idle',
  message: null,
}

const actorTypeLabels: Record<
  CanonicalActorType,
  string
> = {
  person: 'Persona',
  organization: 'Organización',
}

function actorMetadata(
  actor: CanonicalActorReference
) {
  const metadata = [
    ...actor.node_names,
    ...actor.role_names,
  ]

  return metadata.length > 0
    ? metadata.join(' · ')
    : actor.type_label
}

export function ManualMatchForm({
  opportunityId,
  requirementRevisionId,
  existingActorKeys,
}: {
  opportunityId: string
  requirementRevisionId: string
  existingActorKeys: string[]
}) {
  const [actorType, setActorType] =
    useState<CanonicalActorType>('person')

  const [selected, setSelected] =
    useState<SelectedActor | null>(null)

  const [inputFocused, setInputFocused] =
    useState(false)

  const resultsId =
    `manual-match-results-${requirementRevisionId}-${actorType}`

  const fetchPage = useCallback(
    async ({
      query,
      cursor,
      signal,
    }: {
      query: string
      cursor: string | null
      signal: AbortSignal
    }) => {
      const params = new URLSearchParams({
        mode: 'reference',
        actor_type: actorType,
        q: query,
        limit: '50',
      })

      if (cursor) {
        params.set('cursor', cursor)
      }

      const response = await fetch(
        `/api/panel/oportunidades/actores?${params.toString()}`,
        {
          signal,
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        throw new Error(
          'No se pudo cargar la lista de actores.'
        )
      }

      return (
        await response.json()
      ) as RemoteReferencePage<CanonicalActorReference>
    },
    [actorType]
  )

  const references = useRemoteReferenceList({
    contextKey:
      `manual-requirement-match:${requirementRevisionId}:${actorType}`,
    getItemKey: (
      actor: CanonicalActorReference
    ) => actor.actor_id,
    fetchPage,
  })

  const existingActorKeySet = useMemo(
    () => new Set(existingActorKeys),
    [existingActorKeys]
  )

  const selectableItems =
    references.items.filter(
      (actor) =>
        !existingActorKeySet.has(
          `${actor.actor_type}:${actor.actor_id}`
        )
    )

  const action =
    createManualOpportunityRequirementMatchAction.bind(
      null,
      opportunityId,
      requirementRevisionId
    )

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    action,
    initialState
  )

  function changeActorType(
    nextType: CanonicalActorType
  ) {
    if (nextType === actorType) return

    setActorType(nextType)
    setSelected(null)
    setInputFocused(false)
  }

  function chooseActor(
    actor: CanonicalActorReference
  ) {
    setSelected({
      actorType: actor.actor_type,
      actorId: actor.actor_id,
      displayName: actor.display_name,
    })
    setInputFocused(false)
  }

  const selectedActorValue = selected
    ? `${selected.actorType}:${selected.actorId}`
    : ''

  const searchPlaceholder =
    actorType === 'person'
      ? 'Buscar persona...'
      : 'Buscar organización...'

  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
        Incorporar actor manualmente
      </summary>

      <form
        action={formAction}
        className="space-y-4 border-t border-slate-200 p-4"
      >
        <input
          type="hidden"
          name="actor"
          value={selectedActorValue}
        />

        <div>
          <p className="text-xs leading-5 text-slate-500">
            Usá esta opción cuando sabés que una persona u organización
            debe ser analizada aunque no haya aparecido entre las
            sugerencias de la búsqueda.
          </p>
        </div>

        <fieldset disabled={pending}>
          <legend className="text-sm font-semibold text-slate-700">
            Tipo de actor
          </legend>

          <div
            className="mt-2 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
            role="group"
            aria-label="Tipo de actor"
          >
            {(
              ['person', 'organization'] as const
            ).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={
                  actorType === type
                }
                onClick={() =>
                  changeActorType(type)
                }
                className={`ux-button min-h-10 rounded-lg px-3 text-sm font-semibold ${
                  actorType === type
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-[#1E3A5F] hover:bg-white'
                }`}
              >
                {actorTypeLabels[type]}
              </button>
            ))}
          </div>

          <div
            className="relative mt-4"
            onFocusCapture={() => {
              setInputFocused(true)
              references.open()
            }}
            onBlurCapture={(event) => {
              const nextTarget =
                event.relatedTarget as Node | null

              if (
                !nextTarget ||
                !event.currentTarget.contains(
                  nextTarget
                )
              ) {
                setInputFocused(false)
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setInputFocused(false)
              }
            }}
          >
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Actor
              </span>

              <input
                type="search"
                value={references.query}
                onFocus={references.open}
                onChange={(event) => {
                  setSelected(null)
                  setInputFocused(true)
                  references.setQuery(
                    event.target.value
                  )
                }}
                placeholder={searchPlaceholder}
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={inputFocused}
                aria-controls={resultsId}
                className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
              />
            </label>

            {inputFocused ? (
              <div
                id={resultsId}
                className="absolute left-0 right-0 z-40 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
              >
                <p className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  {references.query.trim()
                    ? `Buscando “${references.query.trim()}”…`
                    : `Explorá ${
                        actorType === 'person'
                          ? 'personas'
                          : 'organizaciones'
                      } o escribí para filtrar.`}
                </p>

                {references.initialLoading ? (
                  <p className="px-3 py-3 text-sm text-slate-500">
                    Cargando actores...
                  </p>
                ) : references.initialError ? (
                  <div className="px-3 py-3 text-sm text-red-700">
                    <p>{references.initialError}</p>
                    <button
                      type="button"
                      onClick={references.retry}
                      className="mt-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : selectableItems.length > 0 ? (
                  selectableItems
                    .slice(0, 20)
                    .map((actor) => (
                      <button
                        key={`${actor.actor_type}:${actor.actor_id}`}
                        type="button"
                        onMouseDown={(event) =>
                          event.preventDefault()
                        }
                        onClick={() =>
                          chooseActor(actor)
                        }
                        className="block w-full border-b border-slate-100 px-3 py-3 text-left last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                      >
                        <span className="block text-sm font-semibold text-slate-900">
                          {actor.display_name}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {actorMetadata(actor)}
                        </span>
                      </button>
                    ))
                ) : (
                  <p className="px-3 py-3 text-sm text-slate-500">
                    {actorType === 'person'
                      ? 'No hay personas disponibles para esta búsqueda.'
                      : 'No hay organizaciones disponibles para esta búsqueda.'}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </fieldset>

        <p
          role="status"
          aria-live="polite"
          className="text-sm text-slate-600"
        >
          {selected
            ? `${actorTypeLabels[selected.actorType]}: ${selected.displayName}`
            : 'Todavía no seleccionaste un actor.'}
        </p>

        <ReferenceListDialog
          key={actorType}
          buttonLabel={`Ver lista de ${
            actorType === 'person'
              ? 'personas'
              : 'organizaciones'
          }`}
          title={actorTypeLabels[actorType]}
          description="Explorá actores canónicos activos o buscá por nombre. Los actores que ya forman parte del análisis no pueden volver a seleccionarse."
          items={selectableItems}
          getItemKey={(actor) =>
            actor.actor_id
          }
          getItemSearchText={(actor) =>
            actor.display_name
          }
          emptyMessage={
            actorType === 'person'
              ? 'No hay personas disponibles para incorporar.'
              : 'No hay organizaciones disponibles para incorporar.'
          }
          searchPlaceholder={
            searchPlaceholder
          }
          onOpen={references.open}
          onSelect={chooseActor}
          renderItem={(actor) => (
            <>
              <strong>
                {actor.display_name}
              </strong>
              <p className="mt-1 text-xs text-slate-500">
                {actorMetadata(actor)}
              </p>
            </>
          )}
          remote={{
            paginationKey:
              references.paginationKey,
            status: references.status,
            minimumQueryLength:
              references.minimumQueryLength,
            autoLoad: true,
            query: references.query,
            onQueryChange:
              references.setQuery,
            initialLoading:
              references.initialLoading,
            loadingMore:
              references.loadingMore,
            hasMore:
              references.hasMore,
            initialError:
              references.initialError,
            loadMoreError:
              references.loadMoreError,
            onRetry:
              references.retry,
            onLoadMore:
              references.loadMore,
          }}
        />

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Relación con el requerimiento
          </span>

          <select
            name="relation_kind"
            required
            defaultValue=""
            disabled={pending}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">
              Elegir relación...
            </option>
            <option value="related">
              Relacionada
            </option>
            <option value="contextual">
              Contextual
            </option>
          </select>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Una incorporación manual no puede marcarse como relación
            directa sin evidencia canónica estructurada.
          </p>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Qué observamos
          </span>

          <textarea
            name="observed_text"
            required
            minLength={3}
            maxLength={4000}
            rows={3}
            disabled={pending}
            placeholder="Describí el dato, antecedente o conocimiento que motiva incorporar este actor."
            className="mt-1 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Por qué se relaciona con el requerimiento
          </span>

          <textarea
            name="inference_text"
            required
            minLength={3}
            maxLength={4000}
            rows={3}
            disabled={pending}
            placeholder="Explicá por qué lo observado justifica analizar a este actor para este requerimiento."
            className="mt-1 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={
            pending ||
            !selected
          }
          className="ux-button rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
            className={`text-sm ${
              state.status === 'error'
                ? 'text-red-700'
                : 'text-emerald-700'
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </details>
  )
}
