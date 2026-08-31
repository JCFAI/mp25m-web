'use client'

import {
  useActionState,
  useEffect,
  useId,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import {
  updatePersonSkillAction,
  type PersonSkillActionState,
} from './actions'

type EditablePersonSkill = {
  person_skill_id: string
  skill_id: string
  skill_name: string
  proficiency_level: number | null
  experience_range: string | null
  experience_notes: string | null
  notes: string | null
}

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

export function PersonSkillEditForm({
  personId,
  skill,
}: {
  personId: string
  skill: EditablePersonSkill
}) {
  const router = useRouter()
  const proficiencyId = useId()
  const experienceRangeId = useId()
  const experienceNotesId = useId()
  const notesId = useId()
  const evidenceId = useId()

  const [open, setOpen] =
    useState(false)
  const [proficiencyLevel, setProficiencyLevel] =
    useState(
      skill.proficiency_level?.toString() ?? ''
    )
  const [experienceRange, setExperienceRange] =
    useState(skill.experience_range ?? '')
  const [experienceNotes, setExperienceNotes] =
    useState(skill.experience_notes ?? '')
  const [notes, setNotes] =
    useState(skill.notes ?? '')
  const [evidenceText, setEvidenceText] =
    useState('')

  const [state, formAction, pending] =
    useActionState(
      updatePersonSkillAction.bind(
        null,
        personId,
        skill.person_skill_id,
        skill.skill_id
      ),
      initialState
    )

  useEffect(() => {
    setProficiencyLevel(
      skill.proficiency_level?.toString() ?? ''
    )
    setExperienceRange(
      skill.experience_range ?? ''
    )
    setExperienceNotes(
      skill.experience_notes ?? ''
    )
    setNotes(skill.notes ?? '')
    setEvidenceText('')
  }, [
    skill.proficiency_level,
    skill.experience_range,
    skill.experience_notes,
    skill.notes,
  ])

  useEffect(() => {
    if (state.status !== 'success') {
      return
    }

    setOpen(false)
    setEvidenceText('')
    router.refresh()
  }, [state.status, state.message, router])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 w-full rounded-xl border border-[#2F5D8C]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] transition hover:bg-slate-50 sm:w-auto"
      >
        Editar
      </button>
    )
  }

  return (
    <form
      action={formAction}
      className="mt-4 border-t border-slate-200 pt-4"
    >
      <h4 className="text-sm font-semibold text-slate-950">
        Editar {skill.skill_name}
      </h4>

      {state.status !== 'idle' &&
      state.message ? (
        <div
          role="alert"
          className={
            state.status === 'success'
              ? 'mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'
              : 'mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label
          htmlFor={proficiencyId}
          className="block"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Nivel
          </span>

          <select
            id={proficiencyId}
            name="proficiency_level"
            value={proficiencyLevel}
            onChange={(event) =>
              setProficiencyLevel(
                event.target.value
              )
            }
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
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Experiencia
          </span>

          <select
            id={experienceRangeId}
            name="experience_range"
            value={experienceRange}
            onChange={(event) =>
              setExperienceRange(
                event.target.value
              )
            }
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
        className="mt-4 block"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Notas de experiencia
        </span>

        <textarea
          id={experienceNotesId}
          name="experience_notes"
          value={experienceNotes}
          onChange={(event) =>
            setExperienceNotes(
              event.target.value
            )
          }
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
        className="mt-4 block"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Observaciones
        </span>

        <textarea
          id={notesId}
          name="notes"
          value={notes}
          onChange={(event) =>
            setNotes(event.target.value)
          }
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
        className="mt-4 block"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Nueva evidencia
        </span>

        <textarea
          id={evidenceId}
          name="evidence_text"
          value={evidenceText}
          onChange={(event) =>
            setEvidenceText(
              event.target.value
            )
          }
          rows={3}
          maxLength={2000}
          className={`${fieldClass(
            Boolean(
              state.fieldErrors.evidenceText
            )
          )} resize-y leading-6`}
          placeholder="Opcional. Se agrega como evidencia nueva, sin borrar registros anteriores."
        />

        <FieldError
          message={
            state.fieldErrors.evidenceText
          }
        />
      </label>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setProficiencyLevel(
              skill.proficiency_level?.toString() ??
                ''
            )
            setExperienceRange(
              skill.experience_range ?? ''
            )
            setExperienceNotes(
              skill.experience_notes ?? ''
            )
            setNotes(skill.notes ?? '')
            setEvidenceText('')
            setOpen(false)
          }}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60"
        >
          {pending
            ? 'Guardando...'
            : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
