'use client'

import {
  useCallback,
  useId,
  useMemo,
  useState,
} from 'react'

import { ReferenceListDialog } from '../../../components/reference-list-dialog'
import {
  useRemoteReferenceList,
  type RemoteReferencePage,
} from '../../../hooks/use-remote-reference-list'
import type {
  CanonicalActorReference,
  CanonicalActorType,
} from '../../../lib/opportunities/actors'

type SelectedParticipant = {
  actorType: CanonicalActorType
  actorId: string
  displayName: string
}

type ParticipantPickerProps = {
  disabled?: boolean
  existingActorKeys: string[]
  onSelectionChange?: (hasSelection: boolean) => void
}

const actorTypeLabels: Record<
  CanonicalActorType,
  string
> = {
  person: 'Persona',
  organization: 'Organización',
}

function actorMetadata(
  actor: CanonicalActorReference,
) {
  const metadata = [
    ...actor.node_names,
    ...actor.role_names,
  ]

  return metadata.length > 0
    ? metadata.join(' · ')
    : actor.type_label
}

export function ProjectParticipantPicker({
  disabled = false,
  existingActorKeys,
  onSelectionChange,
}: ParticipantPickerProps) {
  const inputId = useId()
  const [actorType, setActorType] =
    useState<CanonicalActorType>('person')
  const [selected, setSelected] =
    useState<SelectedParticipant | null>(null)

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
        { signal, cache: 'no-store' },
      )

      if (!response.ok) {
        throw new Error('No se pudo cargar la lista.')
      }

      return (await response.json()) as RemoteReferencePage<
        CanonicalActorReference
      >
    },
    [actorType],
  )

  const references = useRemoteReferenceList({
    contextKey: `project-participant:${actorType}`,
    getItemKey: (actor: CanonicalActorReference) =>
      actor.actor_id,
    fetchPage,
  })

  const selectedActorValue = selected
    ? `${selected.actorType}:${selected.actorId}`
    : ''
  const selectedLabel = selected
    ? `${actorTypeLabels[selected.actorType]}: ${selected.displayName}`
    : 'Todavía no seleccionaste un participante.'
  const searchPlaceholder =
    actorType === 'person'
      ? 'Buscar persona...'
      : 'Buscar organización...'

  const emptyMessage = actorType === 'person'
    ? 'No hay personas canónicas disponibles para agregar al proyecto.'
    : 'No hay organizaciones canónicas disponibles para agregar al proyecto.'
  const existingActorKeySet = useMemo(
    () => new Set(existingActorKeys),
    [existingActorKeys],
  )
  const selectableItems = references.items.filter(
    (actor) => !existingActorKeySet.has(
      `${actor.actor_type}:${actor.actor_id}`,
    ),
  )

  function chooseActor(
    actor: CanonicalActorReference,
  ) {
    setSelected({
      actorType: actor.actor_type,
      actorId: actor.actor_id,
      displayName: actor.display_name,
    })
    onSelectionChange?.(true)
  }

  function changeActorType(
    nextActorType: CanonicalActorType,
  ) {
    if (nextActorType === actorType) {
      return
    }

    setActorType(nextActorType)
    setSelected(null)
    onSelectionChange?.(false)
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="actor"
        value={selectedActorValue}
      />

      <fieldset disabled={disabled}>
        <legend className="text-sm font-semibold text-slate-700">
          Buscar participante
        </legend>

        <div
          className="mt-2 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1"
          role="group"
          aria-label="Tipo de participante"
        >
          {(
            ['person', 'organization'] as const
          ).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={actorType === type}
              onClick={() => changeActorType(type)}
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

        <label
          htmlFor={inputId}
          className="mt-3 block text-sm text-slate-700"
        >
          Nombre
        </label>
        <input
          id={inputId}
          type="search"
          value={references.query}
          onFocus={references.open}
          onChange={(event) =>
            references.setQuery(event.target.value)
          }
          placeholder={searchPlaceholder}
          autoComplete="off"
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
        />
      </fieldset>

      <p
        role="status"
        aria-live="polite"
        className="text-sm text-slate-600"
      >
        {selectedLabel}
      </p>

      <ReferenceListDialog
        key={actorType}
        buttonLabel={`Ver lista de ${
          actorType === 'person'
            ? 'personas'
            : 'organizaciones'
        }`}
        title={actorTypeLabels[actorType]}
        description="Explorá la lista o buscá por nombre. Se cargan hasta 50 opciones por página."
        items={selectableItems}
        getItemKey={(actor) => actor.actor_id}
        getItemSearchText={(actor) => actor.display_name}
        emptyMessage={emptyMessage}
        searchPlaceholder={searchPlaceholder}
        onOpen={references.open}
        onSelect={chooseActor}
        renderItem={(actor) => (
          <>
            <strong>{actor.display_name}</strong>
            <p className="mt-1 text-xs text-slate-500">
              {actorMetadata(actor)}
            </p>
          </>
        )}
        remote={{
          paginationKey: references.paginationKey,
          status: references.status,
          minimumQueryLength:
            references.minimumQueryLength,
          autoLoad: true,
          query: references.query,
          onQueryChange: references.setQuery,
          initialLoading: references.initialLoading,
          loadingMore: references.loadingMore,
          hasMore: references.hasMore,
          initialError: references.initialError,
          loadMoreError: references.loadMoreError,
          onRetry: references.retry,
          onLoadMore: references.loadMore,
        }}
      />
    </div>
  )
}
