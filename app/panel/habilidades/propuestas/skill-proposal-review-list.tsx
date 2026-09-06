'use client'

import Link from 'next/link'
import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import { ReferenceListDialog } from '../../../../components/reference-list-dialog'
import {
  createSkillFromProposalAction,
  mapSkillProposalAction,
  rejectSkillProposalAction,
  type SkillProposalResolutionActionState,
} from './actions'

type SkillProposal = {
  proposal_id: string
  proposed_name: string
  normalized_name: string
  description: string | null
  suggested_category_code: string | null
  suggested_category_name: string | null
  suggested_applies_to_person: boolean | null
  suggested_applies_to_organization: boolean | null
  status: string
  resolved_skill_id: string | null
  resolved_skill_name: string | null
  exact_skill_id: string | null
  exact_skill_name: string | null
  exact_alias_skill_id: string | null
  exact_alias_skill_name: string | null
  exact_alias: string | null
  created_by: string | null
  created_at: string
  resolved_by: string | null
  resolved_at: string | null
  resolution_reason: string | null
}

type SkillCategoryOption = {
  code: string
  name: string
  description: string | null
  sort_order: number
  skill_count: number
}

type SkillSearchResult = {
  id: string
  display_name: string
  search_name: string
  category_name: string | null
  description: string | null
  applies_to_person: boolean
  applies_to_organization: boolean
  person_count: number
  organization_count: number
  node_count: number
  alias_count: number
}

const MINIMUM_QUERY_LENGTH = 2

const initialState: SkillProposalResolutionActionState = {
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

function ActionMessage({
  state,
}: {
  state: SkillProposalResolutionActionState
}) {
  if (
    state.status === 'idle' ||
    !state.message
  ) {
    return null
  }

  return (
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
  )
}

function ProposalResolutionContext({
  originLabel,
  originName,
  targetLabel,
  targetName,
  targetPlaceholder = 'Seleccioná una habilidad destino',
}: {
  originLabel: string
  originName: string
  targetLabel?: string
  targetName?: string | null
  targetPlaceholder?: string
}) {
  const readableTarget =
    targetName?.trim() || null

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {originLabel}
      </p>

      <div className="mt-2 grid gap-2 text-slate-900">
        <p className="break-words font-semibold">
          {originName}
        </p>

        {targetLabel ? (
          <>
            <p
              aria-hidden="true"
              className="text-lg leading-none text-slate-400"
            >
              →
            </p>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {targetLabel}
              </p>

              <p className="mt-1 break-words font-semibold text-[#1E3A5F]">
                {readableTarget ??
                  targetPlaceholder}
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function normalizeSearchTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Sin fecha'
  }

  const [datePart] = value.split('T')
  const [year, month, day] =
    datePart.split('-')

  if (!year || !month || !day) {
    return value
  }

  return `${day}/${month}/${year}`
}

function countLabel(
  value: number,
  singular: string,
  plural: string
) {
  return value === 1
    ? `1 ${singular}`
    : `${value} ${plural}`
}

function skillMetadata(skill: SkillSearchResult) {
  return [
    skill.category_name ?? 'Categoría pendiente',
    countLabel(
      skill.person_count,
      'persona',
      'personas'
    ),
    countLabel(
      skill.organization_count,
      'organización',
      'organizaciones'
    ),
    countLabel(
      skill.alias_count,
      'alias',
      'aliases'
    ),
  ].join(' · ')
}

function appliesLabel(proposal: SkillProposal) {
  const labels = []

  if (proposal.suggested_applies_to_person) {
    labels.push('Personas')
  }

  if (
    proposal.suggested_applies_to_organization
  ) {
    labels.push('Organizaciones')
  }

  return labels.length > 0
    ? labels.join(' y ')
    : 'Sin sugerencia'
}

function exactMatchItems(
  proposal: SkillProposal
) {
  return [
    proposal.exact_skill_id &&
    proposal.exact_skill_name
      ? {
          id: proposal.exact_skill_id,
          name: proposal.exact_skill_name,
          detail: 'Nombre canónico exacto',
        }
      : null,
    proposal.exact_alias_skill_id &&
    proposal.exact_alias_skill_name
      ? {
          id: proposal.exact_alias_skill_id,
          name: proposal.exact_alias_skill_name,
          detail: proposal.exact_alias
            ? `Alias exacto: ${proposal.exact_alias}`
            : 'Alias exacto',
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string
    name: string
    detail: string
  }>
}

function optionToSkill(
  id: string,
  name: string
): SkillSearchResult {
  return {
    id,
    display_name: name,
    search_name: normalizeSearchTerm(name),
    category_name: null,
    description: null,
    applies_to_person: true,
    applies_to_organization: true,
    person_count: 0,
    organization_count: 0,
    node_count: 0,
    alias_count: 0,
  }
}

function SkillProposalReviewCard({
  proposal,
  categories,
}: {
  proposal: SkillProposal
  categories: SkillCategoryOption[]
}) {
  const router = useRouter()
  const mapInputId = useId()
  const mapResultsId = useId()
  const mapReasonId = useId()
  const canonicalNameId = useId()
  const categoryId = useId()
  const descriptionId = useId()
  const createReasonId = useId()
  const rejectReasonId = useId()

  const [
    mapState,
    mapFormAction,
    mapPending,
  ] = useActionState(
    mapSkillProposalAction.bind(
      null,
      proposal.proposal_id
    ),
    initialState
  )

  const [
    createState,
    createFormAction,
    createPending,
  ] = useActionState(
    createSkillFromProposalAction.bind(
      null,
      proposal.proposal_id
    ),
    initialState
  )

  const [
    rejectState,
    rejectFormAction,
    rejectPending,
  ] = useActionState(
    rejectSkillProposalAction.bind(
      null,
      proposal.proposal_id
    ),
    initialState
  )

  const [mapQuery, setMapQuery] =
    useState('')
  const [mapResults, setMapResults] =
    useState<SkillSearchResult[]>([])
  const [selectedSkill, setSelectedSkill] =
    useState<SkillSearchResult | null>(null)
  const [mapLoading, setMapLoading] =
    useState(false)
  const [mapHasSearched, setMapHasSearched] =
    useState(false)
  const [mapErrorMessage, setMapErrorMessage] =
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
  const [canonicalName, setCanonicalName] =
    useState(proposal.proposed_name)

  const exactMatches = useMemo(
    () => exactMatchItems(proposal),
    [proposal]
  )
  const mapTerm = mapQuery.trim()
  const mapSearchIsOpen =
    mapTerm.length >= MINIMUM_QUERY_LENGTH &&
    !selectedSkill

  const createAppliesToPerson =
    proposal.suggested_applies_to_person ??
    !proposal.suggested_applies_to_organization
  const createAppliesToOrganization =
    proposal.suggested_applies_to_organization ??
    false

  useEffect(() => {
    if (
      mapState.status !== 'success' &&
      createState.status !== 'success' &&
      rejectState.status !== 'success'
    ) {
      return
    }

    router.refresh()
  }, [
    mapState.status,
    createState.status,
    rejectState.status,
    router,
  ])

  useEffect(() => {
    const currentTerm = mapQuery.trim()

    setMapResults([])
    setMapHasSearched(false)
    setMapErrorMessage(null)

    if (
      selectedSkill ||
      currentTerm.length < MINIMUM_QUERY_LENGTH
    ) {
      setMapLoading(false)
      return
    }

    const controller = new AbortController()

    setMapLoading(true)

    const timeout = window.setTimeout(
      async () => {
        try {
          const searchParams =
            new URLSearchParams()

          searchParams.set('q', currentTerm)
          searchParams.set('application', 'all')

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
            setMapResults(data)
          }
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === 'AbortError'
          ) {
            return
          }

          if (!controller.signal.aborted) {
            setMapResults([])
            setMapErrorMessage(
              'No se pudo completar la búsqueda. Intentá nuevamente.'
            )
          }
        } finally {
          if (!controller.signal.aborted) {
            setMapLoading(false)
            setMapHasSearched(true)
          }
        }
      },
      250
    )

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [mapQuery, selectedSkill])

  function selectSkill(skill: SkillSearchResult) {
    setSelectedSkill(skill)
    setMapQuery(skill.display_name)
    setMapResults([])
    setMapHasSearched(false)
    setMapErrorMessage(null)
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
      searchParams.set('application', 'all')

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

      setReferenceSkills(data)
      setReferenceLoaded(true)
    } catch {
      setReferenceSkills([])
      setReferenceErrorMessage(
        'No se pudo cargar la lista de habilidades. Intentá nuevamente.'
      )
    } finally {
      setReferenceLoading(false)
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold text-slate-950">
            {proposal.proposed_name}
          </h2>

          <p className="mt-1 break-words text-sm leading-6 text-slate-500">
            {proposal.description ??
              'Sin descripción registrada.'}
          </p>
        </div>

        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
          Pendiente
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Categoría sugerida
          </dt>
          <dd className="mt-1 text-slate-700">
            {proposal.suggested_category_name ??
              'Sin sugerencia'}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Aplica a
          </dt>
          <dd className="mt-1 text-slate-700">
            {appliesLabel(proposal)}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Fecha
          </dt>
          <dd className="mt-1 text-slate-700">
            {formatDate(proposal.created_at)}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Autor interno
          </dt>
          <dd className="mt-1 break-words text-slate-700">
            {proposal.created_by ??
              'Usuario interno'}
          </dd>
        </div>
      </dl>

      {exactMatches.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            Coincidencias exactas detectadas
          </p>

          <div className="mt-2 grid gap-2">
            {exactMatches.map((match) => (
              <button
                key={`${match.id}:${match.detail}`}
                type="button"
                onClick={() =>
                  selectSkill(
                    optionToSkill(
                      match.id,
                      match.name
                    )
                  )
                }
                className="min-h-11 rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-xs font-semibold text-[#1E3A5F] transition hover:bg-amber-50"
              >
                <span className="block break-words">
                  {match.name}
                </span>
                <span className="mt-1 block break-words font-normal text-amber-800">
                  {match.detail}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Mapear a existente
          </summary>

          <form
            action={mapFormAction}
            className="mt-4 grid gap-4"
          >
            <ActionMessage state={mapState} />

            <ProposalResolutionContext
              originLabel="Propuesta a resolver"
              originName={proposal.proposed_name}
              targetLabel="Se mapeará a"
              targetName={
                selectedSkill?.display_name
              }
            />

            <div>
              <label
                htmlFor={mapInputId}
                className="text-sm font-semibold text-slate-700"
              >
                Habilidad destino
              </label>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="relative">
                  <input
                    id={mapInputId}
                    value={mapQuery}
                    onChange={(event) => {
                      setSelectedSkill(null)
                      setMapQuery(
                        event.target.value
                      )
                    }}
                    placeholder="Buscar habilidad existente..."
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={
                      mapSearchIsOpen
                    }
                    aria-controls={mapResultsId}
                    aria-busy={mapLoading}
                    className={fieldClass(
                      Boolean(
                        mapState.fieldErrors.targetSkillId
                      )
                    )}
                  />

                  {mapSearchIsOpen ? (
                    <div
                      id={mapResultsId}
                      className="absolute left-0 right-0 z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
                    >
                      {mapLoading ? (
                        <p className="px-4 py-3 text-sm text-slate-500">
                          Buscando habilidades...
                        </p>
                      ) : mapErrorMessage ? (
                        <p className="px-4 py-3 text-sm text-red-600">
                          {mapErrorMessage}
                        </p>
                      ) : mapResults.length > 0 ? (
                        mapResults.map((skill) => (
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
                      ) : mapHasSearched ? (
                        <p className="px-4 py-3 text-sm text-slate-500">
                          No se encontraron habilidades.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <ReferenceListDialog
                  buttonClassName="mt-2"
                  title="Elegir habilidad destino"
                  description={`Para la propuesta: "${proposal.proposed_name}". Consultá el catálogo canónico y seleccioná una habilidad destino sin resolver todavía.`}
                  items={referenceSkills}
                  loading={referenceLoading}
                  errorMessage={
                    referenceErrorMessage
                  }
                  searchPlaceholder="Filtrar por nombre, categoría o descripción..."
                  emptyMessage={
                    referenceLoaded
                      ? 'No hay habilidades disponibles.'
                      : 'No se cargó la lista de habilidades.'
                  }
                  getItemKey={(skill) =>
                    skill.id
                  }
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
                        {skillMetadata(skill)}
                      </span>
                    </>
                  )}
                  onOpen={loadSkillReferenceItems}
                  onSelect={selectSkill}
                />
              </div>

              <input
                type="hidden"
                name="target_skill_id"
                value={selectedSkill?.id ?? ''}
              />

              <input
                type="hidden"
                name="target_skill_name"
                value={
                  selectedSkill?.display_name ?? ''
                }
              />

              {selectedSkill ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-h-11 max-w-full items-center break-words rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                    {selectedSkill.display_name}
                  </span>

                  <Link
                    href={`/panel/habilidades/${selectedSkill.id}`}
                    className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-[#2F5D8C] hover:text-[#1E3A5F]"
                  >
                    Ver ficha
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSkill(null)
                      setMapQuery('')
                    }}
                    className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-[#2F5D8C] hover:text-[#1E3A5F]"
                  >
                    Cambiar
                  </button>
                </div>
              ) : null}

              <FieldError
                message={
                  mapState.fieldErrors
                    .targetSkillId
                }
              />
            </div>

            <label
              htmlFor={mapReasonId}
              className="block"
            >
              <span className="text-sm font-semibold text-slate-700">
                Justificación
              </span>

              <textarea
                id={mapReasonId}
                name="reason"
                rows={3}
                maxLength={2000}
                className={`${fieldClass(
                  Boolean(
                    mapState.fieldErrors.reason
                  )
                )} resize-y leading-6`}
              />

              <FieldError
                message={
                  mapState.fieldErrors.reason
                }
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  mapPending || !selectedSkill
                }
                className="min-h-11 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {mapPending
                  ? 'Mapeando...'
                  : 'Mapear propuesta'}
              </button>
            </div>
          </form>
        </details>

        <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Crear una habilidad canónica nueva
          </summary>

          <form
            action={createFormAction}
            className="mt-4 grid gap-4"
          >
            <ActionMessage state={createState} />

            <ProposalResolutionContext
              originLabel="Propuesta origen"
              originName={proposal.proposed_name}
              targetLabel="Nueva habilidad canónica"
              targetName={canonicalName}
              targetPlaceholder="Completá el nombre canónico"
            />

            <label
              htmlFor={canonicalNameId}
              className="block"
            >
              <span className="text-sm font-semibold text-slate-700">
                Nueva habilidad canónica
              </span>

              <input
                id={canonicalNameId}
                name="canonical_name"
                value={canonicalName}
                onChange={(event) =>
                  setCanonicalName(
                    event.target.value
                  )
                }
                maxLength={160}
                className={fieldClass(
                  Boolean(
                    createState.fieldErrors
                      .canonicalName
                  )
                )}
              />

              <FieldError
                message={
                  createState.fieldErrors
                    .canonicalName
                }
              />
            </label>

            <label
              htmlFor={categoryId}
              className="block"
            >
              <span className="text-sm font-semibold text-slate-700">
                Categoría
              </span>

              <select
                id={categoryId}
                name="category_code"
                defaultValue={
                  proposal.suggested_category_code ??
                  ''
                }
                className={fieldClass(
                  Boolean(
                    createState.fieldErrors
                      .categoryCode
                  )
                )}
              >
                <option value="">
                  Sin categoría
                </option>

                {categories.map((category) => (
                  <option
                    key={category.code}
                    value={category.code}
                  >
                    {category.name}
                  </option>
                ))}
              </select>

              <FieldError
                message={
                  createState.fieldErrors
                    .categoryCode
                }
              />
            </label>

            <label
              htmlFor={descriptionId}
              className="block"
            >
              <span className="text-sm font-semibold text-slate-700">
                Descripción
              </span>

              <textarea
                id={descriptionId}
                name="description"
                rows={3}
                maxLength={2000}
                defaultValue={
                  proposal.description ?? ''
                }
                className={`${fieldClass(
                  Boolean(
                    createState.fieldErrors
                      .description
                  )
                )} resize-y leading-6`}
              />

              <FieldError
                message={
                  createState.fieldErrors
                    .description
                }
              />
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">
                Aplica a
              </legend>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="applies_to_person"
                    defaultChecked={
                      createAppliesToPerson
                    }
                  />
                  Personas
                </label>

                <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="applies_to_organization"
                    defaultChecked={
                      createAppliesToOrganization
                    }
                  />
                  Organizaciones
                </label>
              </div>

              <FieldError
                message={
                  createState.fieldErrors.appliesTo
                }
              />
            </fieldset>

            <label
              htmlFor={createReasonId}
              className="block"
            >
              <span className="text-sm font-semibold text-slate-700">
                Justificación
              </span>

              <textarea
                id={createReasonId}
                name="reason"
                rows={3}
                maxLength={2000}
                className={`${fieldClass(
                  Boolean(
                    createState.fieldErrors
                      .reason
                  )
                )} resize-y leading-6`}
              />

              <FieldError
                message={
                  createState.fieldErrors.reason
                }
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={createPending}
                className="min-h-11 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                {createPending
                  ? 'Creando...'
                  : 'Crear habilidad canónica'}
              </button>
            </div>
          </form>
        </details>

        <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Rechazar propuesta
          </summary>

          <form
            action={rejectFormAction}
            className="mt-4 grid gap-4"
          >
            <p className="text-sm leading-6 text-slate-500">
              La propuesta se conserva para trazabilidad,
              pero no se incorpora al catálogo.
            </p>

            <ActionMessage state={rejectState} />

            <ProposalResolutionContext
              originLabel="Propuesta a rechazar"
              originName={proposal.proposed_name}
            />

            <label
              htmlFor={rejectReasonId}
              className="block"
            >
              <span className="text-sm font-semibold text-slate-700">
                Motivo
              </span>

              <textarea
                id={rejectReasonId}
                name="reason"
                rows={3}
                maxLength={2000}
                className={`${fieldClass(
                  Boolean(
                    rejectState.fieldErrors
                      .reason
                  )
                )} resize-y leading-6`}
              />

              <FieldError
                message={
                  rejectState.fieldErrors.reason
                }
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={rejectPending}
                className="min-h-11 w-full rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                {rejectPending
                  ? 'Rechazando...'
                  : 'Rechazar propuesta'}
              </button>
            </div>
          </form>
        </details>
      </div>
    </article>
  )
}

export function SkillProposalReviewList({
  proposals,
  categories,
}: {
  proposals: SkillProposal[]
  categories: SkillCategoryOption[]
}) {
  if (proposals.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm sm:p-6">
        No hay propuestas de habilidades pendientes.
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {proposals.map((proposal) => (
        <SkillProposalReviewCard
          key={proposal.proposal_id}
          proposal={proposal}
          categories={categories}
        />
      ))}
    </div>
  )
}
