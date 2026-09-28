'use client'

import { useState } from 'react'

import { ReferenceListDialog } from '../../../components/reference-list-dialog'
import {
  useRemoteReferenceList,
  type RemoteReferencePage,
} from '../../../hooks/use-remote-reference-list'
import type { CanonicalActorReference } from '../../../lib/opportunities/actors'
import type { ResultContributorCandidate } from '../../../lib/results/results'

type ActorOption = {
  id: string
  label: string
  description: string
}

export function ResultActorPicker({
  candidates,
  excludedActorKeys,
}: {
  candidates: ResultContributorCandidate[]
  excludedActorKeys: string[]
}) {
  const [selected, setSelected] =
    useState<ActorOption | null>(null)

  const excluded =
    new Set(excludedActorKeys)

  const list =
    useRemoteReferenceList<ActorOption>({
      contextKey: 'result-contributor',
      getItemKey: (item) => item.id,

      fetchPage: async ({
        query,
        cursor,
        signal,
      }) => {
        const params =
          new URLSearchParams({
            q: query,
            limit: '50',
            mode: 'reference',
          })

        if (cursor) {
          params.set('cursor', cursor)
        }

        const response =
          await fetch(
            `/api/panel/oportunidades/actores?${params}`,
            { signal },
          )

        if (!response.ok) {
          throw new Error(
            'No se pudo cargar la lista.',
          )
        }

        const page:
          RemoteReferencePage<CanonicalActorReference> =
          await response.json()

        return {
          ...page,
          items: page.items.map(
            (actor) => ({
              id:
                `${actor.actor_type}:${actor.actor_id}`,
              label:
                actor.display_name,
              description:
                actor.type_label,
            }),
          ),
        }
      },
    })

  const candidateOptions =
    candidates.map(
      (candidate) => ({
        id:
          `${candidate.actor_type}:${candidate.actor_id}`,

        label:
          candidate.display_name,

        description:
          `${candidate.actor_type === 'person'
            ? 'Persona'
            : 'Organización'
          } · ${
            candidate.is_current_participant
              ? 'Participante actual'
              : 'Participó anteriormente'
          }`,
      }),
    )

  const selectedId =
    selected &&
    !excluded.has(selected.id)
      ? selected.id
      : ''

  function selectCandidate(
    value: string,
  ) {
    const option =
      candidateOptions.find(
        (item) =>
          item.id === value,
      )

    setSelected(
      option ?? null,
    )
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="actor"
        value={selectedId}
      />

      {candidateOptions.length ? (
        <label className="block text-sm">
          Participantes vinculados

          <select
            value={
              candidateOptions.some(
                (item) =>
                  item.id ===
                  selected?.id,
              )
                ? selected?.id ?? ''
                : ''
            }
            onChange={(event) =>
              selectCandidate(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          >
            <option value="">
              Elegir participante histórico...
            </option>

            {candidateOptions.map(
              (candidate) => {
                const disabled =
                  excluded.has(
                    candidate.id,
                  )

                return (
                  <option
                    key={candidate.id}
                    value={candidate.id}
                    disabled={disabled}
                  >
                    {candidate.label}
                    {' · '}
                    {disabled
                      ? 'Ya registrado'
                      : candidate.description}
                  </option>
                )
              },
            )}
          </select>
        </label>
      ) : (
        <p className="text-sm text-slate-500">
          Este origen todavía no tiene
          participantes históricos para
          sugerir.
        </p>
      )}

      <div>
        <p className="mb-2 text-xs text-slate-500">
          También podés buscar cualquier
          Persona u Organización canónica.
        </p>

        <ReferenceListDialog
          buttonLabel="Buscar otra persona u organización"
          title="Personas y organizaciones"
          description="Buscá por nombre. Elegir un actor no lo incorpora automáticamente como participante de la articulación o proyecto."
          items={list.items}
          getItemKey={(item) =>
            item.id
          }
          getItemSearchText={(item) =>
            item.label
          }
          emptyMessage="No se encontraron resultados."
          onOpen={list.open}
          onSelect={(item) => {
            if (
              !excluded.has(item.id)
            ) {
              setSelected(item)
            }
          }}
          renderItem={(item) => (
            <>
              <strong>
                {item.label}
              </strong>

              <p className="text-xs text-slate-500">
                {excluded.has(item.id)
                  ? 'Ya tiene una contribución activa en este resultado'
                  : item.description}
              </p>
            </>
          )}
          remote={{
            ...list,
            autoLoad: true,
            onQueryChange:
              list.setQuery,
            onLoadMore:
              list.loadMore,
            onRetry:
              list.retry,
          }}
        />
      </div>

      <p
        role="status"
        className="text-sm text-slate-700"
      >
        {selectedId
          ? `Selección: ${selected?.label}`
          : 'Sin selección'}
      </p>
    </div>
  )
}
