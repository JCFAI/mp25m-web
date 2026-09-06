'use client'

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import {
  addPersonSkillAction,
  proposePersonSkillAction,
  type PersonSkillActionState,
} from './actions'
import { ReferenceListDialog } from '../../../../components/reference-list-dialog'
import {
  combineSkillProposalTerms,
  findSkillProposalTermMatch,
  isPendingSkillProposalDuplicateMessage,
  mapPendingSkillProposalReferencesToTerms,
  normalizeSkillProposalTerm,
  pendingSkillProposalDuplicateNotice,
  skillProposalTermMessage,
  type HandledSkillProposalTerm,
  type PendingSkillProposalReferenceOption,
} from '../../../../lib/skills/pending-proposal-reference'

type SkillSearchResult = {
  id: string
  display_name: string
  category_name: string | null
  search_name: string
  description: string | null
  applies_to_person: boolean
  applies_to_organization: boolean
  person_count: number
}

const MINIMUM_QUERY_LENGTH = 2

const initialState: PersonSkillActionState = {
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

function skillMetadata(skill: SkillSearchResult) {
  const parts = [
    skill.category_name ??
      'Categoría pendiente',
    skill.applies_to_organization
      ? 'También aplica a organizaciones'
      : null,
    skill.person_count === 1
      ? '1 persona asociada'
      : `${skill.person_count} personas asociadas`,
  ].filter(Boolean)

  return parts.join(' · ')
}

function proposalTermMessage(
  match: Parameters<
    typeof skillProposalTermMessage
  >[0]
) {
  if (!match) {
    return null
  }

  if (match.matchKind === 'related') {
    return `Ya existe una propuesta relacionada pendiente: "${match.label}".`
  }

  if (match.source === 'submitted') {
    return `Ya propusiste "${match.label}". La propuesta está pendiente de revisión del catálogo.`
  }

  return `Ya existe una propuesta pendiente para "${match.label}".`
}

export function PersonSkillAddForm({
  personId,
  personName,
  activeSkillIds,
}: {
  personId: string
  personName: string
  activeSkillIds: string[]
}) {
  const router = useRouter()
  const inputId = useId()
  const resultsId = useId()
  const proficiencyId = useId()
  const experienceRangeId = useId()
  const experienceNotesId = useId()
  const notesId = useId()
  const evidenceId = useId()
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, pending] =
    useActionState(
      addPersonSkillAction.bind(
        null,
        personId,
        personName
      ),
      initialState
    )

  const [
    proposalState,
    proposalFormAction,
    proposalPending,
  ] = useActionState(
    proposePersonSkillAction.bind(
      null,
      personId
    ),
    initialState
  )

  const [query, setQuery] = useState('')
  const [results, setResults] =
    useState<SkillSearchResult[]>([])
  const [selectedSkill, setSelectedSkill] =
    useState<SkillSearchResult | null>(null)
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
  const [
    pendingProposalReferences,
    setPendingProposalReferences,
  ] = useState<
    PendingSkillProposalReferenceOption[]
  >([])
  const [
    pendingProposalReferencesLoading,
    setPendingProposalReferencesLoading,
  ] = useState(false)
  const [
    pendingProposalReferencesLoaded,
    setPendingProposalReferencesLoaded,
  ] = useState(false)
  const [
    pendingProposalReferencesErrorMessage,
    setPendingProposalReferencesErrorMessage,
  ] = useState<string | null>(null)
  const pendingProposalReferencesRequestRef =
    useRef<Promise<void> | null>(null)
  const [lastAction, setLastAction] =
    useState<'add' | 'proposal'>('add')
  const [addFeedbackVisible, setAddFeedbackVisible] =
    useState(false)

  const [proposalFeedbackVisible, setProposalFeedbackVisible] =
    useState(false)

  const [submittedProposalTerm, setSubmittedProposalTerm] =
    useState('')

  const [handledProposalTerms, setHandledProposalTerms] =
    useState<Map<string, HandledSkillProposalTerm>>(
      () => new Map()
    )

  const activeSkillIdSet = useMemo(
    () => new Set(activeSkillIds),
    [activeSkillIds]
  )

  const availableReferenceSkills =
    useMemo(
      () =>
        referenceSkills.filter(
          (skill) =>
            skill.applies_to_person &&
            !activeSkillIdSet.has(skill.id)
        ),
      [activeSkillIdSet, referenceSkills]
    )

  const pendingProposalTerms = useMemo(
    () =>
      mapPendingSkillProposalReferencesToTerms(
        pendingProposalReferences
      ),
    [pendingProposalReferences]
  )

  const combinedProposalTerms = useMemo(
    () =>
      combineSkillProposalTerms(
        pendingProposalTerms,
        handledProposalTerms
      ),
    [
      handledProposalTerms,
      pendingProposalTerms,
    ]
  )

  const term = query.trim()
  const normalizedTerm =
    normalizeSkillProposalTerm(term)
  const searchIsOpen =
    term.length >= MINIMUM_QUERY_LENGTH &&
    !selectedSkill
  const handledProposalMatch =
    findSkillProposalTermMatch(
      normalizedTerm,
      combinedProposalTerms
    )
  const handledProposalMessage =
    proposalTermMessage(
      handledProposalMatch
    )
  const pendingProposalLookupMessage =
    searchIsOpen &&
    hasSearched &&
    !loading &&
    !errorMessage &&
    results.length === 0 &&
    !handledProposalMessage
      ? pendingProposalReferencesErrorMessage ??
        (
          !pendingProposalReferencesLoaded ||
          pendingProposalReferencesLoading
            ? 'Verificando propuestas pendientes...'
            : null
        )
      : null
  const exactResultExists = results.some(
    (skill) =>
      skill.search_name === normalizedTerm
  )

  const showProposalAction =
    searchIsOpen &&
    hasSearched &&
    !loading &&
    !errorMessage &&
    pendingProposalReferencesLoaded &&
    !pendingProposalReferencesErrorMessage &&
    !exactResultExists &&
    !handledProposalMatch

  const currentState =
    lastAction === 'proposal'
      ? proposalFeedbackVisible
        ? proposalState
        : initialState
      : addFeedbackVisible
        ? state
        : initialState
  const proposalDuplicateNotice =
    lastAction === 'proposal' &&
    proposalFeedbackVisible &&
    proposalState.status === 'error' &&
    isPendingSkillProposalDuplicateMessage(
      proposalState.message
    )
  const currentStateMessage =
    proposalDuplicateNotice
      ? pendingSkillProposalDuplicateNotice(
          submittedProposalTerm
        )
      : currentState.message
  const proposalNameFieldError =
    proposalFeedbackVisible &&
    !proposalDuplicateNotice
      ? proposalState.fieldErrors.proposedName
      : undefined

  const loadPendingProposalReferences =
    useCallback(async () => {
      if (
        pendingProposalReferencesLoaded ||
        pendingProposalReferencesRequestRef.current
      ) {
        return
      }

      const request = (async () => {
        setPendingProposalReferencesLoading(true)
        setPendingProposalReferencesErrorMessage(null)

        try {
          const searchParams =
            new URLSearchParams()

          searchParams.set(
            'mode',
            'pending-proposals'
          )

          const response = await fetch(
            `/api/panel/habilidades?${searchParams.toString()}`,
            {
              cache: 'no-store',
            }
          )

          if (!response.ok) {
            throw new Error(
              'No se pudo verificar la propuesta.'
            )
          }

          const data =
            (await response.json()) as PendingSkillProposalReferenceOption[]

          setPendingProposalReferences(data)
          setPendingProposalReferencesLoaded(true)
        } catch {
          setPendingProposalReferences([])
          setPendingProposalReferencesErrorMessage(
            'No se pudo verificar si ya existe una propuesta pendiente. Intentá nuevamente.'
          )
        } finally {
          setPendingProposalReferencesLoading(false)
          pendingProposalReferencesRequestRef.current =
            null
        }
      })()

      pendingProposalReferencesRequestRef.current =
        request

      await request
    }, [pendingProposalReferencesLoaded])

  useEffect(() => {
    if (state.status === 'idle') {
      return
    }

    setAddFeedbackVisible(true)
    setProposalFeedbackVisible(false)

    if (state.status !== 'success') {
      return
    }

    formRef.current?.reset()
    setQuery('')
    setResults([])
    setSelectedSkill(null)
    setHasSearched(false)
    setErrorMessage(null)

    router.refresh()
  }, [
    state.status,
    state.message,
    router,
  ])

  useEffect(() => {
    if (proposalState.status === 'idle') {
      return
    }

    setProposalFeedbackVisible(true)
    setAddFeedbackVisible(false)

    const normalizedSubmittedTerm =
      normalizeSkillProposalTerm(
        submittedProposalTerm
      )
    const submittedLabel =
      submittedProposalTerm.trim()
    const duplicatePendingProposal =
      isPendingSkillProposalDuplicateMessage(
        proposalState.message
      )

    if (
      normalizedSubmittedTerm &&
      (
        proposalState.status === 'success' ||
        duplicatePendingProposal
      )
    ) {
      setHandledProposalTerms((current) => {
        const next = new Map(current)
        next.set(normalizedSubmittedTerm, {
          label: submittedLabel,
          source:
            proposalState.status === 'success'
              ? 'submitted'
              : 'pending',
        })
        return next
      })
    }

    if (proposalState.status === 'success') {
      setQuery('')
      setResults([])
      setSelectedSkill(null)
      setHasSearched(false)
      setErrorMessage(null)

      // Una propuesta modifica el catálogo, no la ficha
      // de la persona. No hacemos router.refresh().
    }
  }, [
    proposalState.status,
    proposalState.message,
    submittedProposalTerm,
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

    void loadPendingProposalReferences()

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
            'person'
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
                  skill.applies_to_person &&
                  !activeSkillIdSet.has(skill.id)
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
    query,
    selectedSkill,
    activeSkillIdSet,
    loadPendingProposalReferences,
  ])

  function clearActionFeedback() {
    setAddFeedbackVisible(false)
    setProposalFeedbackVisible(false)
  }

  function selectSkill(
    skill: SkillSearchResult
  ) {
    setSelectedSkill(skill)
    setQuery(skill.display_name)
    setResults([])
    setHasSearched(false)
    setErrorMessage(null)
    clearActionFeedback()
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
        'person'
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
            skill.applies_to_person
        )
      )
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
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        const submitter =
          (
            event.nativeEvent as SubmitEvent
          ).submitter

        setLastAction(
          submitter instanceof
            HTMLButtonElement &&
            submitter.dataset.action ===
              'proposal'
            ? 'proposal'
            : 'add'
        )
      }}
      className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:gap-5"
    >
      <div>
        <h3 className="text-base font-semibold text-slate-950">
          Agregar habilidad
        </h3>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Buscá una habilidad canónica existente. Las habilidades agregadas desde el panel quedan pendientes de validación hasta que un administrador o validador las confirme.
        </p>
      </div>

      {currentState.status !== 'idle' &&
      currentStateMessage ? (
        <div
          role={
            proposalDuplicateNotice
              ? 'status'
              : 'alert'
          }
          className={
            proposalDuplicateNotice
              ? 'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800'
              : currentState.status === 'success'
              ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'
              : 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {currentStateMessage}
        </div>
      ) : null}

      <div>
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-slate-700"
        >
          Habilidad
        </label>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="relative">
            <input
              id={inputId}
              value={query}
              onChange={(event) => {
                setSelectedSkill(null)
                setQuery(event.target.value)
                clearActionFeedback()
                setLastAction('add')
              }}
              placeholder="Ej.: soldadura, programación..."
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={searchIsOpen}
              aria-controls={resultsId}
              aria-busy={loading}
              className={fieldClass(
                Boolean(
                  state.fieldErrors.skillId ||
                    proposalNameFieldError
                )
              )}
            />

            {searchIsOpen ? (
              <div
                id={resultsId}
                className="absolute left-0 right-0 z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
              >
                {loading ? (
                  <p className="px-4 py-3 text-sm text-slate-500">
                    Buscando habilidades...
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
                ) : hasSearched &&
                  !handledProposalMessage &&
                  !pendingProposalLookupMessage ? (
                  <p className="px-4 py-3 text-sm text-slate-500">
                    No se encontraron habilidades disponibles.
                  </p>
                ) : null}

                {!loading &&
                !errorMessage &&
                handledProposalMessage ? (
                  <p className="border-t border-slate-100 px-4 py-3 text-sm text-amber-800">
                    {handledProposalMessage}
                  </p>
                ) : null}

                {!loading &&
                !errorMessage &&
                pendingProposalLookupMessage ? (
                  <p className="border-t border-slate-100 px-4 py-3 text-sm text-amber-800">
                    {pendingProposalLookupMessage}
                  </p>
                ) : null}

                {showProposalAction ? (
                  <div className="border-t border-slate-100 p-3">
                    <button
                      type="submit"
                      formAction={proposalFormAction}
                      data-action="proposal"
                      onClick={() => {
                        setLastAction('proposal')
                        clearActionFeedback()
                        setSubmittedProposalTerm(term)
                      }}
                      disabled={
                        proposalPending ||
                        term.length <
                          MINIMUM_QUERY_LENGTH
                      }
                      className="min-h-11 w-full rounded-xl border border-[#2F5D8C]/30 bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#1E3A5F] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      {proposalPending
                        ? 'Proponiendo...'
                        : `+ Proponer "${term}" como nueva habilidad`}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <ReferenceListDialog
            buttonClassName="mt-2"
            title="Habilidades"
            description="Consultá habilidades activas aplicables a personas y seleccioná una sin guardarla todavía."
            items={availableReferenceSkills}
            loading={referenceLoading}
            errorMessage={
              referenceErrorMessage
            }
            searchPlaceholder="Filtrar por nombre, categoría o descripción..."
            emptyMessage={
              referenceLoaded
                ? 'No hay habilidades disponibles para esta persona.'
                : 'No se cargó la lista de habilidades.'
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
                  {skillMetadata(skill)}
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

        <input
          type="hidden"
          name="proposed_name"
          value={term}
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
                clearActionFeedback()
              }}
              className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-[#2F5D8C] hover:text-[#1E3A5F]"
            >
              Cambiar
            </button>
          </div>
        ) : null}
        <FieldError
          message={
            state.fieldErrors.skillId ??
            proposalNameFieldError
          }
        />
      </div>

      {!selectedSkill ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
          Seleccioná una habilidad existente para completar nivel,
          experiencia, observaciones y evidencia. Si la habilidad no
          existe, podés proponerla para revisión del catálogo.
        </div>
      ) : null}

      <fieldset
        disabled={!selectedSkill}
        className={
          selectedSkill
            ? 'grid gap-4 sm:gap-5'
            : 'grid gap-4 opacity-50 sm:gap-5'
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
        <label
          htmlFor={proficiencyId}
          className="block"
        >
          <span className="text-sm font-semibold text-slate-700">
            Nivel
          </span>

          <select
            id={proficiencyId}
            name="proficiency_level"
            className={fieldClass(
              Boolean(
                state.fieldErrors.proficiencyLevel
              )
            )}
          >
            <option value="">
              Sin informar
            </option>
            <option value="1">1 / 5</option>
            <option value="2">2 / 5</option>
            <option value="3">3 / 5</option>
            <option value="4">4 / 5</option>
            <option value="5">5 / 5</option>
          </select>

          <FieldError
            message={
              state.fieldErrors.proficiencyLevel
            }
          />
        </label>

        <label
          htmlFor={experienceRangeId}
          className="block"
        >
          <span className="text-sm font-semibold text-slate-700">
            Experiencia
          </span>

          <select
            id={experienceRangeId}
            name="experience_range"
            className={fieldClass(
              Boolean(
                state.fieldErrors.experienceRange
              )
            )}
          >
            <option value="">
              Sin informar
            </option>
            <option value="lt_1">
              Menos de 1 año
            </option>
            <option value="1_3">
              1 a 3 años
            </option>
            <option value="4_7">
              4 a 7 años
            </option>
            <option value="8_15">
              8 a 15 años
            </option>
            <option value="gt_15">
              Más de 15 años
            </option>
            <option value="unspecified">
              Sin especificar
            </option>
          </select>

          <FieldError
            message={
              state.fieldErrors.experienceRange
            }
          />
        </label>
      </div>

      <label
        htmlFor={experienceNotesId}
        className="block"
      >
        <span className="text-sm font-semibold text-slate-700">
          Notas de experiencia
        </span>

        <textarea
          id={experienceNotesId}
          name="experience_notes"
          rows={3}
          maxLength={2000}
          className={`${fieldClass(
            Boolean(
              state.fieldErrors.experienceNotes
            )
          )} resize-y leading-6`}
        />

        <FieldError
          message={
            state.fieldErrors.experienceNotes
          }
        />
      </label>

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
          data-action="add"
          onClick={() => {
            setLastAction('add')
            clearActionFeedback()
          }}
          disabled={pending || !selectedSkill}
          className="min-h-11 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending
            ? 'Guardando...'
            : 'Agregar habilidad'}
        </button>
      </div>
    </fieldset>
    </form>
  )
}
