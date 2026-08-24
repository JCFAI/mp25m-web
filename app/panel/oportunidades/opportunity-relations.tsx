'use client'

import { useEffect, useMemo, useState } from 'react'

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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NodeResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = query.trim()

    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const timeout = window.setTimeout(async () => {
      setLoading(true)

      try {
        const response = await fetch(
          `/api/panel/oportunidades/nodos?q=${encodeURIComponent(term)}`,
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        )

        if (!response.ok) {
          setResults([])
          return
        }

        const data =
          (await response.json()) as NodeResult[]

        const selectedIds = new Set(
          selected.map((node) => node.id)
        )

        setResults(
          data.filter(
            (node) => !selectedIds.has(node.id)
          )
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query, selected])

  function addNode(node: NodeResult) {
    onChange([...selected, node])
    setQuery('')
    setResults([])
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

      <div className="relative">
        <input
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        />

        {query.trim().length >= 2 ? (
          <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {loading ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                Buscando...
              </p>
            ) : results.length > 0 ? (
              results.map((node) => (
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
                No se encontraron coincidencias.
              </p>
            )}
          </div>
        ) : null}
      </div>

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

  const [actorQuery, setActorQuery] = useState('')
  const [actorResults, setActorResults] =
    useState<ActorResult[]>([])
  const [actorLoading, setActorLoading] =
    useState(false)

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

  useEffect(() => {
    const term = actorQuery.trim()

    if (term.length < 2 || showNewActor) {
      setActorResults([])
      setActorLoading(false)
      return
    }

    const controller = new AbortController()

    const timeout = window.setTimeout(async () => {
      setActorLoading(true)

      try {
        const params = new URLSearchParams()

        params.set('q', term)

        for (const node of nodes) {
          params.append('node_id', node.id)
        }

        const response = await fetch(
          `/api/panel/oportunidades/actores?${params.toString()}`,
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        )

        if (!response.ok) {
          setActorResults([])
          return
        }

        const data =
          (await response.json()) as ActorResult[]

        setActorResults(
          data.filter(
            (actor) =>
              !selectedActorKeys.has(
                `${actor.actor_type}:${actor.actor_id}`
              )
          )
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setActorResults([])
      } finally {
        setActorLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [
    actorQuery,
    nodes,
    selectedActorKeys,
    showNewActor,
  ])

  function addActor(actor: ActorResult) {
    setSelectedActors((current) => [
      ...current,
      actor,
    ])

    setActorQuery('')
    setActorResults([])
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
    setNewActorName(actorQuery.trim())
    setNewActorKind('person')
    setNewActorOrganizationType(
      organizationTypes[0]?.code ?? ''
    )
    setNewActorContext('')
    setNewActorNodes([...nodes])
    setShowNewActor(true)
    setActorResults([])
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

    setActorQuery('')
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
          helperText="Escribí al menos dos caracteres. Podés agregar más de un nodo."
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
          <div className="relative mt-3">
            <input
              value={actorQuery}
              onChange={(event) =>
                setActorQuery(event.target.value)
              }
              placeholder="Buscar persona, empresa o institución..."
              autoComplete="off"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            />

            {actorQuery.trim().length >= 2 ? (
              <div className="absolute z-20 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {actorLoading ? (
                  <p className="px-4 py-3 text-sm text-slate-500">
                    Buscando actores...
                  </p>
                ) : (
                  <>
                    {actorResults.map((actor) => (
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

                    {actorResults.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-500">
                        No se encontraron coincidencias.
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={openNewActorForm}
                      className="block w-full bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-[#1E3A5F] hover:bg-[#EAF0F7]"
                    >
                      + Registrar “{actorQuery.trim()}” como actor nuevo
                    </button>
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
                Incorporar a esta oportunidad
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