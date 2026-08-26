'use client'

import {
  useActionState,
  useEffect,
  useState,
} from 'react'

import {
  type AssigneeActionState,
  updateOpportunityAssigneeAction,
} from './actions'

type AssigneeOption = {
  id: string
  display_name: string
  role_names: string[]
  scope_names: string[]
}

const initialState: AssigneeActionState = {
  status: 'idle',
  message: null,
}

export function OpportunityAssigneeForm({
  opportunityId,
  currentAssigneeId,
  options,
}: {
  opportunityId: string
  currentAssigneeId: string | null
  options: AssigneeOption[]
}) {
  const action =
    updateOpportunityAssigneeAction.bind(
      null,
      opportunityId,
      currentAssigneeId
    )

  const [state, formAction, pending] =
    useActionState(
      action,
      initialState
    )

  const [assigneeId, setAssigneeId] =
    useState(currentAssigneeId ?? '')

  const [reason, setReason] =
    useState('')

  useEffect(() => {
    setAssigneeId(
      currentAssigneeId ?? ''
    )

    if (state.status === 'success') {
      setReason('')
    }
  }, [
    currentAssigneeId,
    state.status,
  ])

  return (
    <form
      action={formAction}
      className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-950">
        Responsable
      </h2>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Persona del equipo interno encargada del seguimiento.
      </p>

      {state.message ? (
        <div
          className={
            state.status === 'success'
              ? 'mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
              : 'mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
          }
        >
          {state.message}
        </div>
      ) : null}

      <label className="mt-5 block">
        <span className="text-sm font-semibold text-slate-700">
          Responsable actual
        </span>

        <select
          name="assignee_id"
          value={assigneeId}
          onChange={(event) =>
            setAssigneeId(
              event.target.value
            )
          }
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#2F5D8C]"
        >
          <option value="">
            Sin responsable
          </option>

          {options.map((option) => (
            <option
              key={option.id}
              value={option.id}
            >
              {option.display_name}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-slate-700">
          Motivo / comentario
        </span>

        <textarea
          name="reason"
          rows={2}
          value={reason}
          onChange={(event) =>
            setReason(
              event.target.value
            )
          }
          className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#2F5D8C]"
          placeholder="Ej.: queda a cargo del seguimiento con el comedor."
        />
      </label>

      <button
        type="submit"
        disabled={
          pending ||
          assigneeId ===
            (currentAssigneeId ?? '')
        }
        className="mt-4 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending
          ? 'Actualizando...'
          : 'Actualizar responsable'}
      </button>
    </form>
  )
}