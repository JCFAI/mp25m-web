'use client'

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import { ReferenceListDialog } from '../../../components/reference-list-dialog'
import { useRemoteReferenceList } from '../../../hooks/use-remote-reference-list'

type NodeResult = {
  id: string
  display_name: string
}

type OrganizationTypeOption = {
  code: string
  name: string
  display_order: number
}

type ActorType =
  | 'person'
  | 'organization'
  | 'candidate'

type ActorResult = {
  actor_type: ActorType
  actor_id: string
  display_name: string
  type_label: string
  node_ids: string[]
  node_names: string[]
  role_names: string[]
  is_related_to_selected_node: boolean
  is_provisional: boolean
}

type ProvisionalActor = {
  clientId: string
  actorKind: 'person' | 'organization'
  displayName: string
  organizationTypeCode: string | null
  organizationTypeName: string | null
  contextText: string
  nodes: NodeResult[]
}

type NodePickerProps = {
  selected: NodeResult[]
  onChange: (nodes: NodeResult[]) => void
  hiddenInputName?: string
  placeholder?: string
  helperText?: string
}

function NodePicker({
  selected,
  onChange,
  hiddenInputName,
  placeholder = 'Buscar nodo por nombre...',
  helperText,
}: NodePickerProps) {
  const [inputFocused, setInputFocused] =
    useState(false)
  const resultsId = useId()
  const pickerRef = useRef<HTMLDivElement>(null)

  const fetchReferencePage = useCallback(
    async ({
      query: referenceQuery,
      cursor,
      signal,
    }: {
      query: string
      cursor: string | null
      signal: AbortSignal
    }) => {
      const params = new URLSearchParams({
        mode: 'reference',
        q: referenceQuery,
        limit: '25',
      })

      if (cursor) {
        params.set('cursor', cursor)
      }

      const response = await fetch(
        `/api/panel/nodos?${params.toString()}`,
        {
          signal,
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        throw new Error('No se pudo cargar la lista.')
      }

      return (await response.json()) as {
        items: NodeResult[]
        nextCursor: string | null
      }
    },
    []
  )
  const referenceList = useRemoteReferenceList({
    contextKey: 'opportunity-node-picker',
    getItemKey: (node: NodeResult) => node.id,
    fetchPage: fetchReferencePage,
    minimumQueryLength: 1,
  })

  const selectedNodeIds = useMemo(
    () => new Set(selected.map((node) => node.id)),
    [selected]
  )

  const visibleReferenceNodes =
    referenceList.items.filter(
      (node) => !selectedNodeIds.has(node.id)
    )

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target

      if (
        target instanceof Node &&
        pickerRef.current &&
        !pickerRef.current.contains(target)
      ) {
        setInputFocused(false)
      }
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown
      )
    }
  }, [])

  function addNode(node: NodeResult) {
    if (selected.some((item) => item.id === node.id)) {
      referenceList.setQuery('')
      return
    }

    onChange([...selected, node])
    referenceList.setQuery('')
    setInputFocused(false)
  }

  function removeNode(id: string) {
    onChange(
      selected.filter((node) => node.id !== id)
    )
  }

  return (
    <div className="mt-2">
      {selected.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((node) => (
            <span
              key={node.id}
              className="inline-flex items-center gap-2 rounded-full bg-[#EAF0F7] px-3 py-1.5 text-sm font-medium text-[#1E3A5F]"
            >
              {node.display_name}

              <button
                type="button"
                onClick={() => removeNode(node.id)}
                className="text-[#2F5D8C] hover:text-[#14263D]"
                aria-label={`Quitar ${node.display_name}`}
              >
                ×
              </button>

              {hiddenInputName ? (
                <input
                  type="hidden"
                  name={hiddenInputName}
                  value={node.id}
                />
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <div
        ref={pickerRef}
        className="relative"
        onFocusCapture={() => {
          setInputFocused(true)
          referenceList.open()
        }}
        onBlurCapture={(event) => {
          const nextTarget =
            event.relatedTarget as Node | null

          if (
            !nextTarget ||
            !event.currentTarget.contains(nextTarget)
          ) {
            setInputFocused(false)
          }
        }}
      >
        <input
          value={referenceList.query}
          onChange={(event) =>
            referenceList.setQuery(event.target.value)
          }
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={inputFocused}
          aria-controls={resultsId}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setInputFocused(false)
              event.currentTarget.blur()
            }
          }}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        />

        {inputFocused ? (
          <div
            id={resultsId}
            role="listbox"
            className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <p className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs leading-5 text-slate-500">
              {referenceList.query.trim()
                ? `Buscando “${referenceList.query.trim()}”.`
                : 'Explorá los nodos disponibles o escribí desde el primer carácter.'}
            </p>

            {referenceList.initialLoading ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                Cargando nodos...
              </p>
            ) : referenceList.initialError ? (
              <p className="px-4 py-3 text-sm text-red-600">
                {referenceList.initialError}
              </p>
            ) : visibleReferenceNodes.length > 0 ? (
              visibleReferenceNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => addNode(node)}
                  className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                >
                  {node.display_name}
                </button>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">
                No se encontraron nodos disponibles.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <ReferenceListDialog
        buttonClassName="mt-3"
        title="Elegir nodo"
        description="Explorá los nodos disponibles para relacionarlos con esta oportunidad."
        items={referenceList.items}
        searchPlaceholder="Buscar nodo o jurisdicción..."
        emptyMessage="No se encontraron nodos para esta búsqueda."
        getItemKey={(node) => node.id}
        getItemSearchText={(node) => node.display_name}
        renderItem={(node) => (
          <p className="break-words text-sm font-semibold text-slate-900">
            {node.display_name}
          </p>
        )}
        onOpen={referenceList.open}
        onSelect={addNode}
        remote={{
          minimumQueryLength: 1,
          query: referenceList.query,
          onQueryChange: referenceList.setQuery,
          initialLoading: referenceList.initialLoading,
          loadingMore: referenceList.loadingMore,
          hasMore: referenceList.hasMore,
          initialError: referenceList.initialError,
          loadMoreError: referenceList.loadMoreError,
          onRetry: referenceList.retry,
          onLoadMore: referenceList.loadMore,
        }}
      />

      {helperText ? (
        <p className="mt-2 text-xs leading-5 text-slate-400">
          {helperText}
        </p>
      ) : null}
    </div>
  )
}

function actorMetadata(actor: ActorResult) {
  const parts = [actor.type_label]

  if (actor.role_names.length > 0) {
    parts.push(actor.role_names.join(', '))
  }

  if (actor.node_names.length > 0) {
    parts.push(actor.node_names.join(', '))
  }

  if (actor.is_provisional) {
    parts.push('Pendiente de validación')
  }

  return parts.join(' · ')
}

function actorKey(actor: Pick<ActorResult, 'actor_type' | 'actor_id'>) {
  return `${actor.actor_type}:${actor.actor_id}`
}

export function OpportunityRelations({
  organizationTypes,
  initialNodes = [],
  initialActors = [],
}: {
  organizationTypes: OrganizationTypeOption[]
  initialNodes?: NodeResult[]
  initialActors?: ActorResult[]
}) {
  const [nodes, setNodes] =
    useState<NodeResult[]>(() => initialNodes)

  const [actorInputFocused, setActorInputFocused] =
    useState(false)
  const actorResultsId = useId()
  const actorPickerRef =
    useRef<HTMLDivElement>(null)

  const [selectedActors, setSelectedActors] =
    useState<ActorResult[]>(() => initialActors)

  const [provisionalActors, setProvisionalActors] =
    useState<ProvisionalActor[]>([])

  const [showNewActor, setShowNewActor] =
    useState(false)

  const [newActorKind, setNewActorKind] =
    useState<'person' | 'organization'>('person')

  const [newActorName, setNewActorName] =
    useState('')

  const [newActorOrganizationType, setNewActorOrganizationType] =
    useState(
      organizationTypes[0]?.code ?? ''
    )

  const [newActorContext, setNewActorContext] =
    useState('')

  const [newActorNodes, setNewActorNodes] =
    useState<NodeResult[]>([])

  const selectedNodeIds = useMemo(
    () =>
      nodes
        .map((node) => node.id)
        .toSorted(),
    [nodes]
  )
  const actorContextKey = selectedNodeIds.join(',')
  const fetchActorReferencePage = useCallback(
    async ({
      query: referenceQuery,
      cursor,
      signal,
    }: {
      query: string
      cursor: string | null
      signal: AbortSignal
    }) => {
      const params = new URLSearchParams({
        mode: 'reference',
        q: referenceQuery,
        limit: '25',
      })

      for (const nodeId of selectedNodeIds) {
        params.append('node_id', nodeId)
      }

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
        throw new Error('No se pudo cargar la lista.')
      }

      return (await response.json()) as {
        items: ActorResult[]
        nextCursor: string | null
      }
    },
    [selectedNodeIds]
  )
  const actorReferenceList = useRemoteReferenceList({
    contextKey: actorContextKey,
    getItemKey: actorKey,
    fetchPage: fetchActorReferencePage,
    minimumQueryLength: 1,
  })

  const selectedActorKeys = useMemo(
    () =>
      new Set(
        selectedActors.map(
          (actor) =>
            `${actor.actor_type}:${actor.actor_id}`
        )
      ),
    [selectedActors]
  )

  const visibleReferenceActors =
    actorReferenceList.items.filter(
      (actor) =>
        !selectedActorKeys.has(
          `${actor.actor_type}:${actor.actor_id}`
        )
    )

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target

      if (
        target instanceof Node &&
        actorPickerRef.current &&
        !actorPickerRef.current.contains(target)
      ) {
        setActorInputFocused(false)
      }
    }

    document.addEventListener(
      'pointerdown',
      handlePointerDown
    )

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown
      )
    }
  }, [])

  function addActor(actor: ActorResult) {
    setSelectedActors((current) => {
      if (current.some((item) => actorKey(item) === actorKey(actor))) {
        return current
      }

      return [...current, actor]
    })

    actorReferenceList.setQuery('')
    setActorInputFocused(false)
  }

  function removeActor(
    actorType: ActorType,
    actorId: string
  ) {
    setSelectedActors((current) =>
      current.filter(
        (actor) =>
          !(
            actor.actor_type === actorType &&
            actor.actor_id === actorId
          )
      )
    )
  }

  function openNewActorForm() {
    setNewActorName(
      actorReferenceList.query.trim()
    )
    setNewActorKind('person')
    setNewActorOrganizationType(
      organizationTypes[0]?.code ?? ''
    )
    setNewActorContext('')
    setNewActorNodes([...nodes])
    setShowNewActor(true)
  }

  function cancelNewActor() {
    setShowNewActor(false)
    setNewActorName('')
    setNewActorContext('')
    setNewActorNodes([])
  }

  function addProvisionalActor() {
    const displayName = newActorName.trim()

    if (displayName.length < 2) {
      return
    }

    if (
      newActorKind === 'organization' &&
      !newActorOrganizationType
    ) {
      return
    }

    const organizationType =
      organizationTypes.find(
        (item) =>
          item.code === newActorOrganizationType
      )

    setProvisionalActors((current) => [
      ...current,
      {
        clientId: crypto.randomUUID(),
        actorKind: newActorKind,
        displayName,
        organizationTypeCode:
          newActorKind === 'organization'
            ? newActorOrganizationType
            : null,
        organizationTypeName:
          newActorKind === 'organization'
            ? organizationType?.name ?? 'Organización'
            : null,
        contextText: newActorContext.trim(),
        nodes: [...newActorNodes],
      },
    ])

    actorReferenceList.setQuery('')
    cancelNewActor()
  }

  function removeProvisionalActor(
    clientId: string
  ) {
    setProvisionalActors((current) =>
      current.filter(
        (actor) => actor.clientId !== clientId
      )
    )
  }

  return (
    <>
      <div className="lg:col-span-2">
        <span className="text-sm font-semibold text-slate-700">
          Nodos relacionados
        </span>

        <NodePicker
          selected={nodes}
          onChange={setNodes}
          hiddenInputName="node_ids"
          helperText="Explorá la lista o escribí desde el primer carácter. Podés agregar más de un nodo."
        />
      </div>

      <div className="lg:col-span-2">
        <div>
          <span className="text-sm font-semibold text-slate-700">
            Origen / actores
          </span>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            Personas, empresas o instituciones que dieron origen a la oportunidad.
            Los actores relacionados con los nodos elegidos aparecen primero.
          </p>
        </div>

        {selectedActors.length > 0 ||
        provisionalActors.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {selectedActors.map((actor) => (
              <div
                key={`${actor.actor_type}:${actor.actor_id}`}
                className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">
                    {actor.display_name}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {actorMetadata(actor)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    removeActor(
                      actor.actor_type,
                      actor.actor_id
                    )
                  }
                  className="shrink-0 text-lg leading-none text-slate-400 hover:text-slate-700"
                  aria-label={`Quitar ${actor.display_name}`}
                >
                  ×
                </button>
              </div>
            ))}

            {provisionalActors.map((actor) => (
              <div
                key={actor.clientId}
                className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-800">
                      {actor.displayName}
                    </p>

                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      Pendiente de validación
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {actor.actorKind === 'person'
                      ? 'Persona'
                      : actor.organizationTypeName}

                    {actor.nodes.length > 0
                      ? ` · ${actor.nodes
                          .map(
                            (node) =>
                              node.display_name
                          )
                          .join(', ')}`
                      : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    removeProvisionalActor(
                      actor.clientId
                    )
                  }
                  className="shrink-0 text-lg leading-none text-slate-400 hover:text-slate-700"
                  aria-label={`Quitar ${actor.displayName}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {!showNewActor ? (
          <div
            ref={actorPickerRef}
            className="relative mt-3"
            onFocusCapture={() => {
              setActorInputFocused(true)
              actorReferenceList.open()
            }}
            onBlurCapture={(event) => {
              const nextTarget =
                event.relatedTarget as Node | null

              if (
                !nextTarget ||
                !event.currentTarget.contains(nextTarget)
              ) {
                setActorInputFocused(false)
              }
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={actorReferenceList.query}
                onChange={(event) =>
                  actorReferenceList.setQuery(
                    event.target.value
                  )
                }
                placeholder="Buscar persona, empresa o institución..."
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={actorInputFocused}
                aria-controls={actorResultsId}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setActorInputFocused(false)
                    event.currentTarget.blur()
                  }
                }}
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
              />

              <ReferenceListDialog
                buttonClassName="shrink-0 sm:w-auto"
                title="Elegir actor de origen"
                description="Explorá personas y organizaciones canónicas activas. Los actores relacionados con los nodos elegidos aparecen primero."
                items={actorReferenceList.items}
                searchPlaceholder="Buscar persona u organización..."
                emptyMessage="No se encontraron actores para esta búsqueda."
                getItemKey={actorKey}
                getItemSearchText={(actor) =>
                  [
                    actor.display_name,
                    actor.type_label,
                    ...actor.node_names,
                    ...actor.role_names,
                  ].join(' ')
                }
                renderItem={(actor) => (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {actor.display_name}
                      </p>

                      <span className="rounded-full bg-[#EAF0F7] px-2 py-0.5 text-[10px] font-semibold text-[#2F5D8C]">
                        {actor.actor_type === 'person'
                          ? 'Persona'
                          : 'Organización'}
                      </span>

                      {actor.is_related_to_selected_node ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Nodo relacionado
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                      {actorMetadata(actor)}
                    </p>
                  </div>
                )}
                onOpen={actorReferenceList.open}
                onSelect={addActor}
                remote={{
                  minimumQueryLength: 1,
                  query: actorReferenceList.query,
                  onQueryChange:
                    actorReferenceList.setQuery,
                  initialLoading:
                    actorReferenceList.initialLoading,
                  loadingMore:
                    actorReferenceList.loadingMore,
                  hasMore:
                    actorReferenceList.hasMore,
                  initialError:
                    actorReferenceList.initialError,
                  loadMoreError:
                    actorReferenceList.loadMoreError,
                  onRetry:
                    actorReferenceList.retry,
                  onLoadMore:
                    actorReferenceList.loadMore,
                }}
              />
            </div>

            {actorInputFocused ? (
              <div
                id={actorResultsId}
                role="listbox"
                className="absolute z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
              >
                <p className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs leading-5 text-slate-500">
                  {actorReferenceList.query.trim()
                    ? `Buscando “${actorReferenceList.query.trim()}”.`
                    : 'Explorá personas y organizaciones o escribí desde el primer carácter.'}
                </p>

                {actorReferenceList.initialLoading ? (
                  <p className="px-4 py-3 text-sm text-slate-500">
                    Cargando actores...
                  </p>
                ) : actorReferenceList.initialError ? (
                  <p className="px-4 py-3 text-sm text-red-600">
                    {actorReferenceList.initialError}
                  </p>
                ) : (
                  <>
                    {visibleReferenceActors.map((actor) => (
                      <button
                        key={`${actor.actor_type}:${actor.actor_id}`}
                        type="button"
                        onClick={() => addActor(actor)}
                        className="block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {actor.display_name}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {actorMetadata(actor)}
                            </p>
                          </div>

                          {actor.is_related_to_selected_node ? (
                            <span className="shrink-0 rounded-full bg-[#EAF0F7] px-2 py-1 text-[10px] font-semibold text-[#2F5D8C]">
                              Nodo relacionado
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}

                    {visibleReferenceActors.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-500">
                        No se encontraron actores disponibles.
                      </p>
                    ) : null}

                    {actorReferenceList.query.trim().length >= 2 ? (
                      <button
                        type="button"
                        onClick={openNewActorForm}
                        className="block w-full bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-[#1E3A5F] hover:bg-[#EAF0F7]"
                      >
                        + Registrar “{actorReferenceList.query.trim()}” como actor nuevo
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-[#C8D6E5] bg-[#F7FAFC] p-5">
            <div>
              <p className="text-sm font-semibold text-[#1E3A5F]">
                Nuevo actor provisorio
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Se registrará recién cuando guardes la oportunidad y quedará pendiente de validación.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Tipo de actor
                </span>

                <select
                  value={newActorKind}
                  onChange={(event) =>
                    setNewActorKind(
                      event.target.value as
                        | 'person'
                        | 'organization'
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2F5D8C]"
                >
                  <option value="person">
                    Persona
                  </option>
                  <option value="organization">
                    Organización
                  </option>
                </select>
              </label>

              {newActorKind === 'organization' ? (
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">
                    Tipo de organización
                  </span>

                  <select
                    value={newActorOrganizationType}
                    onChange={(event) =>
                      setNewActorOrganizationType(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2F5D8C]"
                  >
                    {organizationTypes.map((type) => (
                      <option
                        key={type.code}
                        value={type.code}
                      >
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block md:col-span-2">
                <span className="text-xs font-semibold text-slate-600">
                  Nombre
                </span>

                <input
                  value={newActorName}
                  onChange={(event) =>
                    setNewActorName(
                      event.target.value
                    )
                  }
                  minLength={2}
                  maxLength={300}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2F5D8C]"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-xs font-semibold text-slate-600">
                  Contexto o referencia
                </span>

                <input
                  value={newActorContext}
                  onChange={(event) =>
                    setNewActorContext(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2F5D8C]"
                  placeholder="Ej.: contacto aportado por referente local..."
                />
              </label>

              <div className="md:col-span-2">
                <span className="text-xs font-semibold text-slate-600">
                  Nodos vinculados al actor
                </span>

                <NodePicker
                  selected={newActorNodes}
                  onChange={setNewActorNodes}
                  placeholder="Buscar nodo para este actor..."
                  helperText="Podés mantener los nodos de la oportunidad, quitarlos o agregar otros."
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={cancelNewActor}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={addProvisionalActor}
                disabled={
                  newActorName.trim().length < 2 ||
                  (
                    newActorKind ===
                      'organization' &&
                    !newActorOrganizationType
                  )
                }
                className="rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Agregar como actor de origen
              </button>
            </div>
          </div>
        )}

        <input
          type="hidden"
          name="origin_actors_json"
          value={JSON.stringify(
            selectedActors.map((actor) => ({
              actorType: actor.actor_type,
              actorId: actor.actor_id,
            }))
          )}
        />

        <input
          type="hidden"
          name="new_actor_candidates_json"
          value={JSON.stringify(
            provisionalActors.map((actor) => ({
              actorKind: actor.actorKind,
              displayName: actor.displayName,
              organizationTypeCode:
                actor.organizationTypeCode,
              contextText: actor.contextText,
              nodeIds: actor.nodes.map(
                (node) => node.id
              ),
            }))
          )}
        />
      </div>
    </>
  )
}
