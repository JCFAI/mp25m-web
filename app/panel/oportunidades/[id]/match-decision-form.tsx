'use client'

import {
  useActionState,
} from 'react'

import type {
  MatchStatus,
} from '../../../../lib/opportunities/analysis'
import {
  decideOpportunityRequirementMatchAction,
  type AnalysisActionState,
} from './analysis-actions'

const initialState: AnalysisActionState = {
  status: 'idle',
  message: null,
}

export function MatchDecisionForm({
  opportunityId,
  matchId,
  expectedStatus,
  decisionKind,
}: {
  opportunityId: string
  matchId: string
  expectedStatus: MatchStatus
  decisionKind: 'discard' | 'reconsider'
}) {
  const action =
    decideOpportunityRequirementMatchAction.bind(
      null,
      opportunityId,
      matchId,
      expectedStatus,
      decisionKind
    )

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    action,
    initialState
  )

  const isDiscard =
    decisionKind === 'discard'

  return (
    <form
      action={formAction}
      className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <label className="block text-xs font-medium text-slate-700">
        {isDiscard
          ? 'Motivo del descarte'
          : 'Motivo de la reconsideración'}

        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={4000}
          rows={2}
          placeholder={
            isDiscard
              ? 'Explicá brevemente por qué no corresponde continuar analizando este actor.'
              : 'Explicá brevemente por qué corresponde volver a incorporar este actor al análisis.'
          }
          className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className={
          isDiscard
            ? 'mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60'
            : 'mt-3 rounded-lg bg-[#1E3A5F] px-3 py-2 text-xs font-semibold text-white hover:bg-[#14263D] disabled:opacity-60'
        }
      >
        {pending
          ? 'Guardando…'
          : isDiscard
            ? 'Descartar del análisis'
            : 'Reincorporar al análisis'}
      </button>

      {state.message ? (
        <p
          role={
            state.status === 'error'
              ? 'alert'
              : 'status'
          }
          className={`mt-2 text-xs ${
            state.status === 'error'
              ? 'text-red-700'
              : 'text-emerald-700'
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
