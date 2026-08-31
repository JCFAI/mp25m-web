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
  addPersonSkillAction,
  type PersonSkillActionState,
} from './actions'

type SkillSearchResult = {
  id: string
  display_name: string
  category_name: string | null
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

  const activeSkillIdSet = useMemo(
    () => new Set(activeSkillIds),
    [activeSkillIds]
  )

  const term = query.trim()
  const searchIsOpen =
    term.length >= MINIMUM_QUERY_LENGTH &&
    !selectedSkill

  useEffect(() => {
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
  }, [state.status, state.message, router])

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
  ])

  return (
    <form
      ref={formRef}
      action={formAction}
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

      <div>
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-slate-700"
        >
          Habilidad
        </label>

        <div className="relative">
          <input
            id={inputId}
            value={query}
            onChange={(event) => {
              setSelectedSkill(null)
              setQuery(event.target.value)
            }}
            placeholder="Ej.: soldadura, programación..."
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
                    onClick={() => {
                      setSelectedSkill(skill)
                      setQuery(skill.display_name)
                      setResults([])
                      setHasSearched(false)
                    }}
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
                  No se encontraron habilidades disponibles.
                </p>
              ) : null}
            </div>
          ) : null}
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
          disabled={pending || !selectedSkill}
          className="min-h-11 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {pending
            ? 'Guardando...'
            : 'Agregar habilidad'}
        </button>
      </div>
    </form>
  )
}
