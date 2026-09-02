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
  addOrganizationActivityAction,
  proposeOrganizationActivityAction,
  type OrganizationActivityActionState,
} from './actions'
import { ReferenceListDialog } from '../../../../components/reference-list-dialog'

type ActivitySearchResult = {
  id: string
  display_name: string
  search_name: string
  description: string | null
  organization_count: number
  suggested_skill_count: number
}

const MINIMUM_QUERY_LENGTH = 2

const initialState: OrganizationActivityActionState = {
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

function normalizeSearchTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function activityMetadata(
  activity: ActivitySearchResult
) {
  const organizationText =
    activity.organization_count === 1
      ? '1 organización asociada'
      : `${activity.organization_count} organizaciones asociadas`

  const suggestionText =
    activity.suggested_skill_count === 1
      ? '1 capacidad sugerida'
      : `${activity.suggested_skill_count} capacidades sugeridas`

  return `${organizationText} · ${suggestionText}`
}

export function OrganizationActivityForm({
  organizationId,
  organizationName,
  activeActivityIds,
}: {
  organizationId: string
  organizationName: string
  activeActivityIds: string[]
}) {
  const router = useRouter()
  const inputId = useId()
  const resultsId = useId()
  const notesId = useId()
  const formRef = useRef<HTMLFormElement>(null)

  const [
    addState,
    addFormAction,
    addPending,
  ] = useActionState(
    addOrganizationActivityAction.bind(
      null,
      organizationId,
      organizationName
    ),
    initialState
  )

  const [
    proposalState,
    proposalFormAction,
    proposalPending,
  ] = useActionState(
    proposeOrganizationActivityAction.bind(
      null,
      organizationId,
      organizationName
    ),
    initialState
  )

  const [query, setQuery] = useState('')
  const [results, setResults] =
    useState<ActivitySearchResult[]>([])
  const [selectedActivity, setSelectedActivity] =
    useState<ActivitySearchResult | null>(null)
  const [loading, setLoading] =
    useState(false)
  const [hasSearched, setHasSearched] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [
    referenceActivities,
    setReferenceActivities,
  ] = useState<ActivitySearchResult[]>([])
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
  const [lastAction, setLastAction] =
    useState<'add' | 'proposal'>('add')

  const activeActivitySet = useMemo(
    () => new Set(activeActivityIds),
    [activeActivityIds]
  )

  const availableReferenceActivities =
    useMemo(
      () =>
        referenceActivities.filter(
          (activity) =>
            !activeActivitySet.has(
              activity.id
            )
        ),
      [
        activeActivitySet,
        referenceActivities,
      ]
    )

  const term = query.trim()
  const normalizedTerm =
    normalizeSearchTerm(term)
  const searchIsOpen =
    term.length >= MINIMUM_QUERY_LENGTH &&
    !selectedActivity
  const exactResultExists = results.some(
    (activity) =>
      activity.search_name === normalizedTerm
  )
  const showProposalAction =
    searchIsOpen &&
    hasSearched &&
    !loading &&
    !errorMessage &&
    !exactResultExists

  const hasActiveDuplicate =
    Boolean(selectedActivity) &&
    selectedActivity !== null &&
    activeActivitySet.has(
      selectedActivity.id
    )

  const currentState =
    lastAction === 'proposal'
      ? proposalState
      : addState

  useEffect(() => {
    if (
      addState.status !== 'success' &&
      proposalState.status !== 'success'
    ) {
      return
    }

    formRef.current?.reset()
    setQuery('')
    setResults([])
    setSelectedActivity(null)
    setHasSearched(false)
    setErrorMessage(null)
    router.refresh()
  }, [
    addState.status,
    addState.message,
    proposalState.status,
    proposalState.message,
    router,
  ])

  useEffect(() => {
    const currentTerm = query.trim()

    setResults([])
    setHasSearched(false)
    setErrorMessage(null)

    if (
      selectedActivity ||
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

          const response = await fetch(
            `/api/panel/actividades?${searchParams.toString()}`,
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
            (await response.json()) as ActivitySearchResult[]

          if (!controller.signal.aborted) {
            setResults(
              data.filter(
                (activity) =>
                  !activeActivitySet.has(
                    activity.id
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
    activeActivitySet,
    query,
    selectedActivity,
  ])

  async function loadActivityReferenceItems() {
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

      const response = await fetch(
        `/api/panel/actividades?${searchParams.toString()}`,
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
        (await response.json()) as ActivitySearchResult[]

      setReferenceActivities(data)
      setReferenceLoaded(true)
    } catch {
      setReferenceActivities([])
      setReferenceErrorMessage(
        'No se pudo cargar la lista de actividades. Intentá nuevamente.'
      )
    } finally {
      setReferenceLoading(false)
    }
  }

  return (
    <form
      ref={formRef}
      action={addFormAction}
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
          Agregar actividad
        </h3>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Buscá una actividad canónica existente. Las actividades agregadas desde el panel quedan pendientes de validación hasta que un administrador o validador las confirme.
        </p>
      </div>

      {currentState.status !== 'idle' &&
      currentState.message ? (
        <div
          role="alert"
          className={
            currentState.status === 'success'
              ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'
              : 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {currentState.message}
        </div>
      ) : null}

      <div>
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-slate-700"
        >
          Actividad
        </label>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="relative">
            <input
            id={inputId}
            value={query}
            onChange={(event) => {
              setSelectedActivity(null)
              setQuery(event.target.value)
            }}
            placeholder="Ej.: metalmecánica, alimentos..."
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchIsOpen}
            aria-controls={resultsId}
            aria-busy={loading}
            className={fieldClass(
              Boolean(
                addState.fieldErrors.activityId ||
                  proposalState.fieldErrors.proposedName
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
                  Buscando actividades...
                </p>
              ) : errorMessage ? (
                <p className="px-4 py-3 text-sm text-red-600">
                  {errorMessage}
                </p>
              ) : results.length > 0 ? (
                results.map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => {
                      setSelectedActivity(
                        activity
                      )
                      setQuery(
                        activity.display_name
                      )
                      setResults([])
                      setHasSearched(false)
                    }}
                    className="block min-h-14 w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <span className="block break-words text-sm font-semibold text-slate-900">
                      {activity.display_name}
                    </span>

                    <span className="mt-1 block break-words text-xs leading-5 text-slate-500">
                      {activityMetadata(
                        activity
                      )}
                    </span>
                  </button>
                ))
              ) : hasSearched ? (
                <p className="px-4 py-3 text-sm text-slate-500">
                  No se encontraron actividades con ese texto.
                </p>
              ) : null}

              {showProposalAction ? (
                <div className="border-t border-slate-100 p-3">
                  <button
                    type="submit"
                    formAction={proposalFormAction}
                    data-action="proposal"
                    onClick={() =>
                      setLastAction('proposal')
                    }
                    disabled={
                      proposalPending ||
                      term.length <
                        MINIMUM_QUERY_LENGTH
                    }
                    className="min-h-11 w-full rounded-xl border border-[#2F5D8C]/30 bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#1E3A5F] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    {proposalPending
                      ? 'Proponiendo...'
                      : `+ Proponer "${term}" como nueva actividad`}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          </div>

          <ReferenceListDialog
            buttonClassName="mt-2"
            title="Actividades"
            description="Consultá actividades canónicas activas y seleccioná una sin guardar el formulario todavía."
            items={availableReferenceActivities}
            loading={referenceLoading}
            errorMessage={
              referenceErrorMessage
            }
            searchPlaceholder="Filtrar por nombre o descripción..."
            emptyMessage={
              referenceLoaded
                ? 'No hay actividades disponibles para agregar.'
                : 'No se cargó la lista de actividades.'
            }
            getItemKey={(activity) =>
              activity.id
            }
            getItemSearchText={(activity) =>
              [
                activity.display_name,
                activity.search_name,
                activity.description ?? '',
              ].join(' ')
            }
            renderItem={(activity) => (
              <>
                <span className="block break-words text-sm font-semibold text-slate-950">
                  {activity.display_name}
                </span>

                <span className="mt-1 block break-words text-xs leading-5 text-slate-500">
                  {activity.description ??
                    'Sin descripción registrada.'}
                </span>

                <span className="mt-2 block break-words text-xs leading-5 text-slate-500">
                  {activityMetadata(activity)}
                </span>
              </>
            )}
            onOpen={loadActivityReferenceItems}
            onSelect={(activity) => {
              setSelectedActivity(activity)
              setQuery(activity.display_name)
              setResults([])
              setHasSearched(false)
              setErrorMessage(null)
            }}
          />
        </div>

        <input
          type="hidden"
          name="activity_id"
          value={selectedActivity?.id ?? ''}
        />

        <input
          type="hidden"
          name="activity_name"
          value={
            selectedActivity?.display_name ?? ''
          }
        />

        <input
          type="hidden"
          name="proposed_name"
          value={term}
        />

        {selectedActivity ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-11 max-w-full items-center break-words rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
              {selectedActivity.display_name}
            </span>

            <button
              type="button"
              onClick={() => {
                setSelectedActivity(null)
                setQuery('')
              }}
              className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-[#2F5D8C] hover:text-[#1E3A5F]"
            >
              Cambiar
            </button>
          </div>
        ) : null}

        <FieldError
          message={
            addState.fieldErrors.activityId ??
            proposalState.fieldErrors.proposedName
          }
        />
      </div>

      {hasActiveDuplicate ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La organización ya tiene esta actividad registrada.
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
            Boolean(addState.fieldErrors.notes)
          )} resize-y leading-6`}
        />

        <FieldError
          message={addState.fieldErrors.notes}
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          data-action="add"
          onClick={() => setLastAction('add')}
          disabled={
            addPending ||
            !selectedActivity ||
            hasActiveDuplicate
          }
          className="min-h-11 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {addPending
            ? 'Guardando...'
            : 'Agregar actividad'}
        </button>
      </div>
    </form>
  )
}
