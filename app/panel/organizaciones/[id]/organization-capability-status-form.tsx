'use client'

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import {
  confirmOrganizationCapabilityAction,
  deactivateOrganizationCapabilityAction,
  rejectOrganizationCapabilityAction,
  type OrganizationCapabilityActionState,
} from './actions'

type OrganizationCapabilityStatusAction =
  | 'confirm'
  | 'reject'
  | 'deactivate'

const initialState: OrganizationCapabilityActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

const ACTION_COPY: Record<
  OrganizationCapabilityStatusAction,
  {
    buttonLabel: string
    heading: string
    fieldLabel: string
    placeholder: string
    submitLabel: string
    pendingLabel: string
    borderClass: string
    buttonClass: string
  }
> = {
  confirm: {
    buttonLabel: 'Confirmar',
    heading: 'Confirmar capacidad',
    fieldLabel: 'Justificación de confirmación',
    placeholder:
      'Motivo breve de la validación de esta capacidad.',
    submitLabel: 'Confirmar capacidad',
    pendingLabel: 'Confirmando...',
    borderClass: 'border-emerald-200',
    buttonClass:
      'border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50',
  },
  reject: {
    buttonLabel: 'Rechazar',
    heading: 'Rechazar capacidad',
    fieldLabel: 'Motivo de rechazo',
    placeholder:
      'Motivo breve. El registro se conserva para trazabilidad, pero deja de figurar como capacidad activa.',
    submitLabel: 'Rechazar capacidad',
    pendingLabel: 'Rechazando...',
    borderClass: 'border-red-200',
    buttonClass:
      'border-red-300 bg-white text-red-700 hover:bg-red-50',
  },
  deactivate: {
    buttonLabel: 'Desactivar',
    heading: 'Desactivar capacidad',
    fieldLabel: 'Motivo de desactivación',
    placeholder:
      'Motivo breve. La capacidad deja de representar la situación actual, sin borrar el registro ni cambiar su estado de validación.',
    submitLabel: 'Desactivar capacidad',
    pendingLabel: 'Desactivando...',
    borderClass: 'border-slate-200',
    buttonClass:
      'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
  },
}

function actionForType(
  actionType: OrganizationCapabilityStatusAction
) {
  if (actionType === 'confirm') {
    return confirmOrganizationCapabilityAction
  }

  if (actionType === 'reject') {
    return rejectOrganizationCapabilityAction
  }

  return deactivateOrganizationCapabilityAction
}

export function OrganizationCapabilityStatusForm({
  organizationId,
  organizationCapabilityId,
  skillId,
  scopeNodeId,
  actionType,
}: {
  organizationId: string
  organizationCapabilityId: string
  skillId: string
  scopeNodeId: string | null
  actionType: OrganizationCapabilityStatusAction
}) {
  const router = useRouter()
  const reasonId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [open, setOpen] =
    useState(false)

  const copy = ACTION_COPY[actionType]
  const action = actionForType(actionType)

  const [state, formAction, pending] =
    useActionState(
      action.bind(
        null,
        organizationId,
        organizationCapabilityId,
        skillId,
        scopeNodeId
      ),
      initialState
    )

  useEffect(() => {
    if (state.status !== 'success') {
      return
    }

    formRef.current?.reset()
    setOpen(false)
    router.refresh()
  }, [state.status, state.message, router])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          'min-h-11 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition sm:w-auto',
          copy.buttonClass,
        ].join(' ')}
      >
        {copy.buttonLabel}
      </button>
    )
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className={[
        'mt-4 border-t pt-4',
        copy.borderClass,
      ].join(' ')}
    >
      <h4 className="text-sm font-semibold text-slate-950">
        {copy.heading}
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

      <label
        htmlFor={reasonId}
        className="mt-4 block"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {copy.fieldLabel}
        </span>

        <textarea
          id={reasonId}
          name="reason"
          required
          minLength={3}
          maxLength={2000}
          rows={3}
          className="mt-2 min-h-12 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
          aria-invalid={Boolean(
            state.fieldErrors.reason
          )}
          placeholder={copy.placeholder}
        />
      </label>

      {state.fieldErrors.reason ? (
        <p className="mt-2 text-xs font-medium text-red-600">
          {state.fieldErrors.reason}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            formRef.current?.reset()
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
            ? copy.pendingLabel
            : copy.submitLabel}
        </button>
      </div>
    </form>
  )
}
