'use client'

import {
  useActionState,
  useEffect,
  useState,
} from 'react'

import {
  reactivateOpportunityRequirementAction,
  resolveOpportunityRequirementValidationAction,
  submitOpportunityRequirementValidationAction,
  withdrawOpportunityRequirementAction,
  type RequirementActionState,
} from './requirement-actions'

type ValidationStatus =
  | 'declared'
  | 'pending'
  | 'validated'
  | 'rejected'

type RecordStatus =
  | 'active'
  | 'withdrawn'

const initialState:
RequirementActionState = {
  status: 'idle',
  message: null,
}

function ActionMessage({
  state,
}: {
  state: RequirementActionState
}) {
  if (!state.message) {
    return null
  }

  return (
    <div
      className={
        state.status === 'success'
          ? 'mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
          : 'mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
      }
    >
      {state.message}
    </div>
  )
}

export function OpportunityRequirementWorkflowControls({
  opportunityId,
  requirementId,
  revisionId,
  validationStatus,
  recordStatus,
  canFormulate,
  canValidate,
  canLifecycle,
}: {
  opportunityId: string
  requirementId: string
  revisionId: string
  validationStatus: ValidationStatus
  recordStatus: RecordStatus
  canFormulate: boolean
  canValidate: boolean
  canLifecycle: boolean
}) {
  const submitAction =
    submitOpportunityRequirementValidationAction.bind(
      null,
      opportunityId,
      requirementId,
      revisionId
    )

  const resolveAction =
    resolveOpportunityRequirementValidationAction.bind(
      null,
      opportunityId,
      requirementId,
      revisionId
    )

  const withdrawAction =
    withdrawOpportunityRequirementAction.bind(
      null,
      opportunityId,
      requirementId,
      revisionId
    )

  const reactivateAction =
    reactivateOpportunityRequirementAction.bind(
      null,
      opportunityId,
      requirementId,
      revisionId
    )

  const [
    submitState,
    submitFormAction,
    submitPending,
  ] = useActionState(
    submitAction,
    initialState
  )

  const [
    resolveState,
    resolveFormAction,
    resolvePending,
  ] = useActionState(
    resolveAction,
    initialState
  )

  const [
    withdrawState,
    withdrawFormAction,
    withdrawPending,
  ] = useActionState(
    withdrawAction,
    initialState
  )

  const [
    reactivateState,
    reactivateFormAction,
    reactivatePending,
  ] = useActionState(
    reactivateAction,
    initialState
  )

  const [
    validationReason,
    setValidationReason,
  ] = useState('')

  const [
    lifecycleReason,
    setLifecycleReason,
  ] = useState('')

  useEffect(() => {
    if (
      resolveState.status === 'success'
    ) {
      setValidationReason('')
    }
  }, [resolveState.status])

  useEffect(() => {
    if (
      withdrawState.status === 'success' ||
      reactivateState.status === 'success'
    ) {
      setLifecycleReason('')
    }
  }, [
    withdrawState.status,
    reactivateState.status,
  ])

  const showSubmit =
    recordStatus === 'active' &&
    validationStatus === 'declared' &&
    canFormulate

  const showValidation =
    recordStatus === 'active' &&
    validationStatus === 'pending' &&
    canValidate

  const showWithdraw =
    recordStatus === 'active' &&
    canLifecycle

  const showReactivate =
    recordStatus === 'withdrawn' &&
    canLifecycle

  if (
    !showSubmit &&
    !showValidation &&
    !showWithdraw &&
    !showReactivate
  ) {
    return null
  }

  return (
    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
      {showSubmit ? (
        <form action={submitFormAction}>
          <button
            type="submit"
            disabled={submitPending}
            className="rounded-xl border border-[#2F5D8C] bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitPending
              ? 'Enviando...'
              : 'Enviar a validación'}
          </button>

          <ActionMessage
            state={submitState}
          />
        </form>
      ) : null}

      {showValidation ? (
        <form
          action={resolveFormAction}
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <p className="text-sm font-semibold text-amber-900">
            Decisión de validación
          </p>

          <p className="mt-1 text-xs leading-5 text-amber-800">
            Validar confirma esta revisión. Rechazar exige explicar el motivo.
          </p>

          <textarea
            name="reason"
            rows={2}
            maxLength={2000}
            value={validationReason}
            onChange={(event) =>
              setValidationReason(
                event.target.value
              )
            }
            className="mt-3 w-full resize-y rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            placeholder="Comentario de validación o motivo del rechazo..."
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              name="resolution"
              value="validated"
              disabled={resolvePending}
              className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resolvePending
                ? 'Guardando...'
                : 'Validar'}
            </button>

            <button
              type="submit"
              name="resolution"
              value="rejected"
              disabled={
                resolvePending ||
                validationReason.trim().length < 3
              }
              className="rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>

          <ActionMessage
            state={resolveState}
          />
        </form>
      ) : null}

      {showWithdraw ? (
        <form
          action={withdrawFormAction}
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <p className="text-sm font-semibold text-slate-800">
            Retirar requerimiento
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            El retiro no elimina el historial ni cambia el estado de validación de la revisión actual.
          </p>

          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={2000}
            rows={2}
            value={lifecycleReason}
            onChange={(event) =>
              setLifecycleReason(
                event.target.value
              )
            }
            className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            placeholder="Motivo del retiro..."
          />

          <button
            type="submit"
            disabled={
              withdrawPending ||
              lifecycleReason.trim().length < 3
            }
            className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {withdrawPending
              ? 'Retirando...'
              : 'Retirar'}
          </button>

          <ActionMessage
            state={withdrawState}
          />
        </form>
      ) : null}

      {showReactivate ? (
        <form
          action={reactivateFormAction}
          className="rounded-xl border border-sky-200 bg-sky-50 p-4"
        >
          <p className="text-sm font-semibold text-sky-900">
            Reactivar requerimiento
          </p>

          <p className="mt-1 text-xs leading-5 text-sky-700">
            La reactivación conserva la revisión y su estado de validación.
          </p>

          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={2000}
            rows={2}
            value={lifecycleReason}
            onChange={(event) =>
              setLifecycleReason(
                event.target.value
              )
            }
            className="mt-3 w-full resize-y rounded-xl border border-sky-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            placeholder="Motivo de la reactivación..."
          />

          <button
            type="submit"
            disabled={
              reactivatePending ||
              lifecycleReason.trim().length < 3
            }
            className="mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reactivatePending
              ? 'Reactivando...'
              : 'Reactivar'}
          </button>

          <ActionMessage
            state={reactivateState}
          />
        </form>
      ) : null}
    </div>
  )
}