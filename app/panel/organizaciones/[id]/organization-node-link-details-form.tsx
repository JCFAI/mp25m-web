'use client'

import {
  useActionState,
  useEffect,
  useId,
  useState,
} from 'react'

import {
  updateOrganizationNodeLinkDetailsAction,
  type OrganizationNodeLinkActionState,
} from './actions'

const initialState: OrganizationNodeLinkActionState = {
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

export function OrganizationNodeLinkDetailsForm({
  organizationId,
  nodeId,
  initialEvidenceText,
  initialStartedOn,
}: {
  organizationId: string
  nodeId: string
  initialEvidenceText: string | null
  initialStartedOn: string | null
}) {
  const evidenceId = useId()
  const startedOnId = useId()

  const [open, setOpen] =
    useState(false)
  const [evidenceText, setEvidenceText] =
    useState(initialEvidenceText ?? '')
  const [startedOn, setStartedOn] =
    useState(initialStartedOn ?? '')

  const [state, formAction, pending] =
    useActionState(
      updateOrganizationNodeLinkDetailsAction.bind(
        null,
        organizationId,
        nodeId
      ),
      initialState
    )

  useEffect(() => {
    setEvidenceText(initialEvidenceText ?? '')
    setStartedOn(initialStartedOn ?? '')
  }, [initialEvidenceText, initialStartedOn])

  useEffect(() => {
    if (state.status === 'success') {
      setOpen(false)
    }
  }, [state.status, state.message])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 min-h-11 w-full rounded-xl border border-[#2F5D8C]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] transition hover:bg-slate-50 sm:w-auto"
      >
        Editar evidencia
      </button>
    )
  }

  return (
    <form
      action={formAction}
      className="mt-4 border-t border-amber-200 pt-4"
    >
      {state.status !== 'idle' &&
      state.message ? (
        <div
          role="alert"
          className={
            state.status === 'success'
              ? 'mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'
              : 'mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {state.message}
        </div>
      ) : null}

      <label
        htmlFor={evidenceId}
        className="block"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Evidencia o justificación
        </span>

        <textarea
          id={evidenceId}
          name="evidence_text"
          value={evidenceText}
          onChange={(event) =>
            setEvidenceText(event.target.value)
          }
          rows={4}
          maxLength={2000}
          className={`${fieldClass(
            Boolean(
              state.fieldErrors.evidenceText
            )
          )} resize-y leading-6`}
          aria-invalid={Boolean(
            state.fieldErrors.evidenceText
          )}
        />

        <FieldError
          message={
            state.fieldErrors.evidenceText
          }
        />
      </label>

      <label
        htmlFor={startedOnId}
        className="mt-4 block sm:max-w-xs"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Fecha de inicio
        </span>

        <input
          id={startedOnId}
          type="date"
          name="started_on"
          value={startedOn}
          onChange={(event) =>
            setStartedOn(event.target.value)
          }
          className={fieldClass(
            Boolean(state.fieldErrors.startedOn)
          )}
          aria-invalid={Boolean(
            state.fieldErrors.startedOn
          )}
        />

        <FieldError
          message={state.fieldErrors.startedOn}
        />
      </label>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setEvidenceText(
              initialEvidenceText ?? ''
            )
            setStartedOn(initialStartedOn ?? '')
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
