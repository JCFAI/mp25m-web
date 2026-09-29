'use client'

import {
  useActionState,
  useEffect,
} from 'react'

import {
  transitionAgendaEntryAction,
  type AgendaActionState,
} from './actions'

const initialState:
AgendaActionState = {
  status: 'idle',
  message: null,
}

export function AgendaLifecycleControls({
  agendaEntryId,
  onChanged,
}: {
  agendaEntryId: string
  onChanged: () => void
}) {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    transitionAgendaEntryAction.bind(
      null,
      agendaEntryId
    ),
    initialState
  )

  useEffect(() => {
    if (
      state.status ===
      'success'
    ) {
      onChanged()
    }
  }, [
    onChanged,
    state,
  ])

  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#1E3A5F]">
        Cambiar estado
      </summary>

      <form
        action={action}
        className="border-t border-slate-200 p-4"
      >
        <label className="text-sm font-semibold text-slate-700">
          Fundamento
          <textarea
            name="rationale"
            required
            minLength={3}
            maxLength={10000}
            rows={2}
            placeholder="Indicá qué ocurrió..."
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
          />
        </label>

        {state.message ? (
          <p
            role="status"
            className={`mt-3 text-sm ${
              state.status ===
              'error'
                ? 'text-red-700'
                : 'text-emerald-700'
            }`}
          >
            {state.message}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            name="status"
            value="completed"
            disabled={pending}
            className="ux-button rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending
              ? 'Actualizando...'
              : 'Completar'}
          </button>

          <button
            type="submit"
            name="status"
            value="cancelled"
            disabled={pending}
            className="ux-button rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </details>
  )
}
