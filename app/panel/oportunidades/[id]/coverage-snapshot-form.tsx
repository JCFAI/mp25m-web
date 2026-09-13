'use client'

import { useActionState, useEffect, useState } from 'react'

import {
  createOpportunityCoverageSnapshotAction,
  type AnalysisActionState,
} from './analysis-actions'

const initialState: AnalysisActionState = {
  status: 'idle',
  message: null,
}

export function CoverageSnapshotForm({
  opportunityId,
}: {
  opportunityId: string
}) {
  const action = createOpportunityCoverageSnapshotAction.bind(null, opportunityId)
  const [state, formAction, pending] = useActionState(action, initialState)
  const [messageDismissed, setMessageDismissed] = useState(false)

  useEffect(() => {
    setMessageDismissed(false)
  }, [state])

  return (
    <form action={formAction} className="mt-4">
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-[#2F5D8C] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#24496E] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Guardando snapshot...' : 'Crear snapshot histórico'}
      </button>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Guarda una copia inmutable del cálculo y de los requerimientos analizados hoy.
      </p>
      {state.message && !messageDismissed ? (
        <div
          className={
            state.status === 'success'
              ? 'mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800'
              : 'mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800'
          }
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          <span>{state.message}</span>
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setMessageDismissed(true)}
          >
            Cerrar
          </button>
        </div>
      ) : null}
    </form>
  )
}
