'use client'

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import {
  addOrganizationCapabilityAction,
  type OrganizationCapabilityActionState,
} from './actions'
import { ReferenceListDialog } from '../../../../components/reference-list-dialog'

type SkillSearchResult = {
  id: string
  display_name: string
  search_name: string
  category_name: string | null
  description: string | null
  applies_to_person: boolean
  applies_to_organization: boolean
  organization_count: number
  node_count: number
}

type ConfirmedOrganizationNode = {
  node_id: string
  node_name: string
}

type ActiveCapabilityScope = {
  skill_id: string
  scope_node_id: string | null
}

type OrganizationActivityOption = {
  activity_id: string
  activity_name: string
}

type ActivitySkillSuggestion = {
  activity_id: string
  skill_id: string
  skill_name: string
  skill_search_name: string
  category_code: string | null
  category_name: string | null
  description: string | null
  sort_order: number
}

type ScopeKind = 'institutional' | 'node'

const MINIMUM_QUERY_LENGTH = 2

const initialState: OrganizationCapabilityActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

function fieldClass(hasError: boolean) {
  return hasError
    ? 'mt-2 min-h-12 w-full rounded-xl border border-red-300 bg-red-50/30 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100'
    : 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10'
}

function FieldError({
  message,
}: {
  message?: string
}) {
  if (!message) {
    return null
  }

  return (
    <p className="mt-2 text-xs font-medium text-red-600">
      {message}
    </p>
  )
}

function scopeKey(
  skillId: string,
  nodeId: string | null
) {
  return `${skillId}:${nodeId ?? 'institutional'}`
}

function nodeLabel(node: ConfirmedOrganizationNode) {
  return node.node_name
}

function skillMetadata(skill: SkillSearchResult) {
  const parts = [
    skill.category_name ??
      'Categoría pendiente',
    skill.organization_count === 1
      ? '1 organización asociada'
      : `${skill.organization_count} organizaciones asociadas`,
    skill.node_count === 1
      ? '1 nodo asociado'
      : `${skill.node_count} nodos asociados`,
  ].filter(Boolean)

  return parts.join(' · ')
}

function suggestionToSkill(
  suggestion: ActivitySkillSuggestion
): SkillSearchResult {
  return {
    id: suggestion.skill_id,
    display_name: suggestion.skill_name,
    search_name: suggestion.skill_search_name,
    category_name:
      suggestion.category_name,
    description: suggestion.description,
    applies_to_person: false,
    applies_to_organization: true,
    organization_count: 0,
    node_count: 0,
  }
}

export function OrganizationCapabilityAddForm({
  organizationId,
  organizationName,
  confirmedNodes,
  activeCapabilityScopes,
  organizationActivities,
  activitySkillSuggestions,
}: {
  organizationId: string
  organizationName: string
  confirmedNodes: ConfirmedOrganizationNode[]
  activeCapabilityScopes: ActiveCapabilityScope[]
  organizationActivities: OrganizationActivityOption[]
  activitySkillSuggestions: ActivitySkillSuggestion[]
}) {
  const router = useRouter()
  const activitySelectId = useId()
  const inputId = useId()
  const resultsId = useId()
  const institutionalScopeId = useId()
  const nodeScopeId = useId()
  const nodeSelectId = useId()
  const notesId = useId()
  const evidenceId = useId()
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, pending] =
    useActionState(
      addOrganizationCapabilityAction.bind(
        null,
        organizationId,
        organizationName
      ),
      initialState
    )

  const [query, setQuery] = useState('')
  const [results, setResults] =
    useState<SkillSearchResult[]>([])
  const [selectedSkill, setSelectedSkill] =
    useState<SkillSearchResult | null>(null)
  const [scopeKind, setScopeKind] =
    useState<ScopeKind>('institutional')
  const [selectedActivityId, setSelectedActivityId] =
    useState('')
  const [selectedNodeId, setSelectedNodeId] =
    useState(confirmedNodes[0]?.node_id ?? '')
  const [loading, setLoading] =
    useState(false)
  const [hasSearched, setHasSearched] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [referenceSkills, setReferenceSkills] =
    useState<SkillSearchResult[]>([])
  const [
    referenceLoading,
    setReferenceLoading,
  ] = useState(false)
  const [
    referenceLoaded,
    setReferenceLoaded,
  ] = useState(false)
  const [
    referenceErrorMessage,
    setReferenceErrorMessage,
  ] = useState<string | null>(null)

  const activeScopeSet = useMemo(
    () =>
      new Set(
        activeCapabilityScopes.map((scope) =>
          scopeKey(
            scope.skill_id,
            scope.scope_node_id
          )
        )
      ),
    [activeCapabilityScopes]
  )

  const selectedNode =
    confirmedNodes.find(
      (node) => node.node_id === selectedNodeId
    ) ?? null

  const selectedActivitySuggestions =
    useMemo(
      () =>
        activitySkillSuggestions.filter(
          (suggestion) =>
            suggestion.activity_id ===
            selectedActivityId
        ),
      [
        activitySkillSuggestions,
        selectedActivityId,
      ]
    )

  const selectedActivity =
    organizationActivities.find(
      (activity) =>
        activity.activity_id ===
        selectedActivityId
    ) ?? null

  const scopeNodeId =
    scopeKind === 'node'
      ? selectedNodeId || null
      : null

  const availableReferenceSkills =
    useMemo(
      () =>
        referenceSkills.filter(
          (skill) =>
            skill.applies_to_organization &&
            !activeScopeSet.has(
              scopeKey(
                skill.id,
                scopeNodeId
              )
            )
        ),
      [
        activeScopeSet,
        referenceSkills,
        scopeNodeId,
      ]
    )

  const hasActiveDuplicate =
    Boolean(selectedSkill) &&
    selectedSkill !== null &&
    activeScopeSet.has(
      scopeKey(
        selectedSkill.id,
        scopeNodeId
      )
    )

  const term = query.trim()
  const searchIsOpen =
    term.length >= MINIMUM_QUERY_LENGTH &&
    !selectedSkill

  useEffect(() => {
    if (
      scopeKind === 'node' &&
      !selectedNodeId &&
      confirmedNodes.length > 0
    ) {
      setSelectedNodeId(
        confirmedNodes[0].node_id
      )
    }
  }, [
    confirmedNodes,
    scopeKind,
    selectedNodeId,
  ])

  useEffect(() => {
    if (state.status !== 'success') {
      return
    }

    formRef.current?.reset()
    setQuery('')
    setResults([])
    setSelectedSkill(null)
    setScopeKind('institutional')
    setSelectedActivityId('')
    setSelectedNodeId(
      confirmedNodes[0]?.node_id ?? ''
    )
    setHasSearched(false)
    setErrorMessage(null)
    router.refresh()
  }, [
    confirmedNodes,
    state.status,
    state.message,
    router,
  ])

  useEffect(() => {
    const currentTerm = query.trim()

    setResults([])
    setHasSearched(false)
    setErrorMessage(null)

    if (
      selectedSkill ||
      currentTerm.length < MINIMUM_QUERY_LENGTH
    ) {
      setLoading(false)
      return
    }

    const controller = new AbortController()

    setLoading(true)

    const timeout = window.setTimeout(
      async () => {
        try {
          const searchParams =
            new URLSearchParams()

          searchParams.set('q', currentTerm)
          searchParams.set(
            'application',
            'organization'
          )

          const response = await fetch(
            `/api/panel/habilidades?${searchParams.toString()}`,
            {
              signal: controller.signal,
              cache: 'no-store',
            }
          )

          if (!response.ok) {
            throw new Error(
              'No se pudo completar la búsqueda.'
            )
          }

          const data =
            (await response.json()) as SkillSearchResult[]

          if (!controller.signal.aborted) {
            setResults(
              data.filter(
                (skill) =>
                  skill.applies_to_organization &&
                  !activeScopeSet.has(
                    scopeKey(
                      skill.id,
                      scopeNodeId
                    )
                  )
              )
            )
          }
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === 'AbortError'
          ) {
            return
          }

          if (!controller.signal.aborted) {
            setResults([])
            setErrorMessage(
              'No se pudo completar la búsqueda. Intentá nuevamente.'
            )
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false)
            setHasSearched(true)
          }
        }
      },
      250
    )

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [
    activeScopeSet,
    query,
    scopeNodeId,
    selectedSkill,
  ])

  function selectSkill(
    skill: SkillSearchResult
  ) {
    setSelectedSkill(skill)
    setQuery(skill.display_name)
    setResults([])
    setHasSearched(false)
    setErrorMessage(null)
  }

  async function loadSkillReferenceItems() {
    if (
      referenceLoaded ||
      referenceLoading
    ) {
      return
    }

    setReferenceLoading(true)
    setReferenceErrorMessage(null)

    try {
      const searchParams =
        new URLSearchParams()

      searchParams.set('mode', 'reference')
      searchParams.set(
        'application',
        'organization'
      )

      const response = await fetch(
        `/api/panel/habilidades?${searchParams.toString()}`,
        {
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        throw new Error(
          'No se pudo cargar la lista.'
        )
      }

      const data =
        (await response.json()) as SkillSearchResult[]

      setReferenceSkills(
        data.filter(
          (skill) =>
            skill.applies_to_organization
        )
      )
      setReferenceLoaded(true)
    } catch {
      setReferenceSkills([])
      setReferenceErrorMessage(
        'No se pudo cargar la lista de capacidades. Intentá nuevamente.'
      )
    } finally {
      setReferenceLoading(false)
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:gap-5"
    >
      <div>
        <h3 className="text-base font-semibold text-slate-950">
          Agregar capacidad
        </h3>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Buscá una capacidad canónica existente. Las capacidades agregadas desde el panel quedan pendientes de validación hasta que un administrador o validador las confirme.
        </p>
      </div>

      {state.status !== 'idle' &&
      state.message ? (
        <div
          role="alert"
          className={
            state.status === 'success'
              ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'
              : 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {state.message}
        </div>
      ) : null}

      {organizationActivities.length > 0 ? (
        <div>
          <label
            htmlFor={activitySelectId}
            className="text-sm font-semibold text-slate-700"
          >
            Actividad de referencia
          </label>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <select
              id={activitySelectId}
              value={selectedActivityId}
              onChange={(event) =>
                setSelectedActivityId(
                  event.target.value
                )
              }
              className={fieldClass(false)}
            >
              <option value="">
                Sin actividad de referencia
              </option>

              {organizationActivities.map(
                (activity) => (
                  <option
                    key={activity.activity_id}
                    value={activity.activity_id}
                  >
                    {activity.activity_name}
                  </option>
                )
              )}
            </select>

            <ReferenceListDialog
              buttonClassName="mt-2"
              title="Actividades de la organización"
              description="Elegí una actividad registrada para orientar las capacidades sugeridas."
              items={organizationActivities}
              searchPlaceholder="Filtrar actividades..."
              emptyMessage="No hay actividades registradas para usar como referencia."
              getItemKey={(activity) =>
                activity.activity_id
              }
              getItemSearchText={(activity) =>
                activity.activity_name
              }
              renderItem={(activity) => {
                const suggestionCount =
                  activitySkillSuggestions.filter(
                    (suggestion) =>
                      suggestion.activity_id ===
                      activity.activity_id
                  ).length

                return (
                  <>
                    <span className="block break-words text-sm font-semibold text-slate-950">
                      {activity.activity_name}
                    </span>

                    <span className="mt-1 block break-words text-xs leading-5 text-slate-500">
                      {suggestionCount === 1
                        ? '1 capacidad sugerida'
                        : `${suggestionCount} capacidades sugeridas`}
                    </span>
                  </>
                )
              }}
              onSelect={(activity) =>
                setSelectedActivityId(
                  activity.activity_id
                )
              }
            />
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            Elegir una actividad puede ayudarte a encontrar capacidades relacionadas. Es opcional.
          </p>

          {selectedActivityId &&
          selectedActivitySuggestions.length >
            0 ? (
            <div className="mt-3 rounded-xl border border-sky-100 bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Capacidades sugeridas para esta actividad
                </p>

                <ReferenceListDialog
                  buttonLabel="Ver sugerencias"
                  title="Sugerencias de capacidades"
                  description={`Actividad: ${
                    selectedActivity?.activity_name ??
                    'Actividad seleccionada'
                  }. Estas sugerencias no agregan capacidades automáticamente.`}
                  items={
                    selectedActivitySuggestions
                  }
                  searchPlaceholder="Filtrar sugerencias..."
                  emptyMessage="No hay capacidades sugeridas para esta actividad."
                  getItemKey={(suggestion) =>
                    `${suggestion.activity_id}:${suggestion.skill_id}`
                  }
                  getItemSearchText={(suggestion) =>
                    [
                      suggestion.skill_name,
                      suggestion.skill_search_name,
                      suggestion.category_name ??
                        '',
                      suggestion.description ?? '',
                    ].join(' ')
                  }
                  renderItem={(suggestion) => (
                    <>
                      <span className="block break-words text-sm font-semibold text-slate-950">
                        {suggestion.skill_name}
                      </span>

                      <span className="mt-1 block break-words text-xs leading-5 text-slate-500">
                        {suggestion.category_name ??
                          'Categoría pendiente'}
                      </span>

                      {suggestion.description ? (
                        <span className="mt-2 block break-words text-xs leading-5 text-slate-500">
                          {suggestion.description}
                        </span>
                      ) : null}
                    </>
                  )}
                  onSelect={(suggestion) =>
                    selectSkill(
                      suggestionToSkill(
                        suggestion
                      )
                    )
                  }
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {selectedActivitySuggestions.map(
                  (suggestion) => (
                    <button
                      key={`${suggestion.activity_id}:${suggestion.skill_id}`}
                      type="button"
                      onClick={() =>
                        selectSkill(
                          suggestionToSkill(
                            suggestion
                          )
                        )
                      }
                      className="min-h-11 max-w-full rounded-lg border border-[#2F5D8C]/20 bg-white px-3 py-2 text-left text-xs font-semibold text-[#1E3A5F] transition hover:bg-slate-50"
                    >
                      <span className="block break-words">
                        {suggestion.skill_name}
                      </span>

                      <span className="mt-1 block break-words font-normal text-slate-500">
                        {suggestion.category_name ??
                          'Categoría pendiente'}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          ) : selectedActivityId ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              No hay capacidades sugeridas para esta actividad.
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-slate-700"
        >
          Capacidad
        </label>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="relative">
            <input
            id={inputId}
            value={query}
            onChange={(event) => {
              setSelectedSkill(null)
              setQuery(event.target.value)
            }}
            placeholder="Ej.: soldadura, logística..."
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchIsOpen}
            aria-controls={resultsId}
            aria-busy={loading}
            className={fieldClass(
              Boolean(state.fieldErrors.skillId)
            )}
          />

          {searchIsOpen ? (
            <div
              id={resultsId}
              className="absolute left-0 right-0 z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              {loading ? (
                <p className="px-4 py-3 text-sm text-slate-500">
                  Buscando capacidades...
                </p>
              ) : errorMessage ? (
                <p className="px-4 py-3 text-sm text-red-600">
                  {errorMessage}
                </p>
              ) : results.length > 0 ? (
                results.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() =>
                      selectSkill(skill)
                    }
                    className="block min-h-14 w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <span className="block break-words text-sm font-semibold text-slate-900">
                      {skill.display_name}
                    </span>

                    <span className="mt-1 block break-words text-xs leading-5 text-slate-500">
                      {skillMetadata(skill)}
                    </span>
                  </button>
                ))
              ) : hasSearched ? (
                <p className="px-4 py-3 text-sm text-slate-500">
                  No se encontraron capacidades disponibles para organizaciones.
                </p>
              ) : null}
            </div>
          ) : null}
          </div>

          <ReferenceListDialog
            buttonClassName="mt-2"
            title="Capacidades"
            description="Consultá capacidades activas aplicables a organizaciones y seleccioná una sin guardarla todavía."
            items={availableReferenceSkills}
            loading={referenceLoading}
            errorMessage={
              referenceErrorMessage
            }
            searchPlaceholder="Filtrar por nombre, categoría o descripción..."
            emptyMessage={
              referenceLoaded
                ? 'No hay capacidades disponibles para este alcance.'
                : 'No se cargó la lista de capacidades.'
            }
            getItemKey={(skill) => skill.id}
            getItemSearchText={(skill) =>
              [
                skill.display_name,
                skill.search_name,
                skill.category_name ?? '',
                skill.description ?? '',
              ].join(' ')
            }
            renderItem={(skill) => (
              <>
                <span className="block break-words text-sm font-semibold text-slate-950">
                  {skill.display_name}
                </span>

                <span className="mt-1 block break-words text-xs leading-5 text-slate-500">
                  {skill.category_name ??
                    'Categoría pendiente'}
                </span>

                {skill.description ? (
                  <span className="mt-2 block break-words text-xs leading-5 text-slate-500">
                    {skill.description}
                  </span>
                ) : null}
              </>
            )}
            onOpen={loadSkillReferenceItems}
            onSelect={selectSkill}
          />
        </div>

        <input
          type="hidden"
          name="skill_id"
          value={selectedSkill?.id ?? ''}
        />

        <input
          type="hidden"
          name="skill_name"
          value={selectedSkill?.display_name ?? ''}
        />

        {selectedSkill ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-11 max-w-full items-center break-words rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
              {selectedSkill.display_name}
            </span>

            <button
              type="button"
              onClick={() => {
                setSelectedSkill(null)
                setQuery('')
              }}
              className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-[#2F5D8C] hover:text-[#1E3A5F]"
            >
              Cambiar
            </button>
          </div>
        ) : null}

        <FieldError
          message={state.fieldErrors.skillId}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">
          Alcance
        </legend>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label
            htmlFor={institutionalScopeId}
            className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
          >
            <span className="flex items-start gap-3">
              <input
                id={institutionalScopeId}
                type="radio"
                name="scope_kind_choice"
                checked={
                  scopeKind === 'institutional'
                }
                onChange={() =>
                  setScopeKind('institutional')
                }
                className="mt-1"
              />

              <span>
                <span className="block font-semibold text-slate-900">
                  Institucional / general
                </span>
                <span className="mt-1 block leading-5 text-slate-500">
                  Representa una capacidad de la organización, sin afirmar presencia en un nodo.
                </span>
              </span>
            </span>
          </label>

          <label
            htmlFor={nodeScopeId}
            className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700"
          >
            <span className="flex items-start gap-3">
              <input
                id={nodeScopeId}
                type="radio"
                name="scope_kind_choice"
                checked={scopeKind === 'node'}
                disabled={
                  confirmedNodes.length === 0
                }
                onChange={() =>
                  setScopeKind('node')
                }
                className="mt-1"
              />

              <span>
                <span className="block font-semibold text-slate-900">
                  Específica de un nodo
                </span>
                <span className="mt-1 block leading-5 text-slate-500">
                  Sólo se puede usar con nodos donde la organización tiene un vínculo territorial confirmado y vigente.
                </span>
              </span>
            </span>
          </label>
        </div>

        <input
          type="hidden"
          name="scope_kind"
          value={scopeKind}
        />

        <FieldError
          message={state.fieldErrors.scopeKind}
        />
      </fieldset>

      {scopeKind === 'node' ? (
        <div>
          <label
            htmlFor={nodeSelectId}
            className="text-sm font-semibold text-slate-700"
          >
            Nodo confirmado
          </label>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <select
              id={nodeSelectId}
              value={selectedNodeId}
              onChange={(event) =>
                setSelectedNodeId(
                  event.target.value
                )
              }
              className={fieldClass(
                Boolean(state.fieldErrors.nodeId)
              )}
            >
              {confirmedNodes.map((node) => (
                <option
                  key={node.node_id}
                  value={node.node_id}
                >
                  {nodeLabel(node)}
                </option>
              ))}
            </select>

            <ReferenceListDialog
              buttonClassName="mt-2"
              title="Nodos confirmados"
              description="Seleccioná uno de los nodos donde la organización ya tiene presencia territorial confirmada y vigente."
              items={confirmedNodes}
              searchPlaceholder="Filtrar nodos..."
              emptyMessage="No hay nodos confirmados disponibles para esta organización."
              getItemKey={(node) =>
                node.node_id
              }
              getItemSearchText={(node) =>
                node.node_name
              }
              renderItem={(node) => (
                <>
                  <span className="block break-words text-sm font-semibold text-slate-950">
                    {node.node_name}
                  </span>

                  <span className="mt-2 block break-words text-xs leading-5 text-slate-500">
                    Vínculo territorial confirmado para esta organización.
                  </span>
                </>
              )}
              onSelect={(node) =>
                setSelectedNodeId(node.node_id)
              }
            />
          </div>

          <FieldError
            message={state.fieldErrors.nodeId}
          />
        </div>
      ) : null}

      {confirmedNodes.length === 0 ? (
        <p className="text-sm leading-6 text-amber-700">
          Para registrar capacidades específicas de un nodo, primero debe existir un vínculo territorial confirmado y vigente.
        </p>
      ) : null}

      <input
        type="hidden"
        name="node_id"
        value={
          scopeKind === 'node'
            ? selectedNodeId
            : ''
        }
      />

      <input
        type="hidden"
        name="node_name"
        value={
          scopeKind === 'node' && selectedNode
            ? nodeLabel(selectedNode)
            : ''
        }
      />

      {hasActiveDuplicate ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La organización ya tiene esta capacidad registrada para este alcance.
        </div>
      ) : null}

      <label
        htmlFor={notesId}
        className="block"
      >
        <span className="text-sm font-semibold text-slate-700">
          Observaciones
        </span>

        <textarea
          id={notesId}
          name="notes"
          rows={3}
          maxLength={2000}
          className={`${fieldClass(
            Boolean(state.fieldErrors.notes)
          )} resize-y leading-6`}
        />

        <FieldError
          message={state.fieldErrors.notes}
        />
      </label>

      <label
        htmlFor={evidenceId}
        className="block"
      >
        <span className="text-sm font-semibold text-slate-700">
          Evidencia
        </span>

        <textarea
          id={evidenceId}
          name="evidence_text"
          rows={3}
          maxLength={2000}
          className={`${fieldClass(
            Boolean(
              state.fieldErrors.evidenceText
            )
          )} resize-y leading-6`}
          placeholder="Fuente, documento o justificación interna opcional."
        />

        <FieldError
          message={
            state.fieldErrors.evidenceText
          }
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            pending ||
            !selectedSkill ||
            (
              scopeKind === 'node' &&
              !selectedNodeId
            ) ||
            hasActiveDuplicate
          }
          className="min-h-11 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending
            ? 'Guardando...'
            : 'Agregar capacidad'}
        </button>
      </div>
    </form>
  )
}
