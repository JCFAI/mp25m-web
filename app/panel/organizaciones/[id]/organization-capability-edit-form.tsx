'use client'

import {
  useActionState,
  useEffect,
  useId,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import {
  type OrganizationCapabilityActionState,
  updateOrganizationCapabilityAction,
} from './actions'

type EditableOrganizationCapability = {
  organization_capability_id: string
  skill_id: string
  capability_name: string
  scope_node_id: string | null
  notes: string | null
}

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

export function OrganizationCapabilityEditForm({
  organizationId,
  capability,
}: {
  organizationId: string
  capability: EditableOrganizationCapability
}) {
  const router = useRouter()
  const notesId = useId()
  const evidenceId = useId()

  const [open, setOpen] =
    useState(false)
  const [notes, setNotes] =
    useState(capability.notes ?? '')
  const [evidenceText, setEvidenceText] =
    useState('')

  const [state, formAction, pending] =
    useActionState(
      updateOrganizationCapabilityAction.bind(
        null,
        organizationId,
        capability.organization_capability_id,
        capability.skill_id,
        capability.scope_node_id
      ),
      initialState
    )

  useEffect(() => {
    setNotes(capability.notes ?? '')
    setEvidenceText('')
  }, [capability.notes])

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
        Editar {capability.capability_name}
      </h4>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Esta acción sólo modifica observaciones y agrega evidencia nueva.
      </p>

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
            setNotes(capability.notes ?? '')
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
