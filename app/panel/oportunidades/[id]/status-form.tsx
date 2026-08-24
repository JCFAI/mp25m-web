'use client'

import {
  useActionState,
  useEffect,
  useState,
} from 'react'

import {
  type StatusActionState,
  updateOpportunityStatusAction,
} from './actions'

type Status =
  | 'open'
  | 'under_analysis'
  | 'in_progress'
  | 'resolved'
  | 'discarded'

const statusLabels: Record<Status, string> = {
  open: 'Abierta',
  under_analysis: 'En análisis',
  in_progress: 'En curso',
  resolved: 'Resuelta',
  discarded: 'Descartada',
}

const initialState: StatusActionState = {
  status: 'idle',
  message: null,
}

export function OpportunityStatusForm({
  opportunityId,
  currentStatus,
}: {
  opportunityId: string
  currentStatus: Status
}) {
  const action =
    updateOpportunityStatusAction.bind(
      null,
      opportunityId
    )

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    action,
    initialState
  )

  const [selectedStatus, setSelectedStatus] =
    useState<Status>(currentStatus)

  const [reason, setReason] =
    useState('')

  useEffect(() => {
    setSelectedStatus(currentStatus)

    if (state.status === 'success') {
      setReason('')
    }
  }, [currentStatus, state.status])

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-950">
        Estado y seguimiento
      </h2>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Cada cambio queda registrado en el historial.
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
          Estado
        </span>

        <select
          name="status"
          value={selectedStatus}
          onChange={(event) =>
            setSelectedStatus(
              event.target.value as Status
            )
          }
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#2F5D8C]"
        >
          {(
            Object.keys(
              statusLabels
            ) as Status[]
          ).map((status) => (
            <option
              key={status}
              value={status}
            >
              {statusLabels[status]}
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
          rows={3}
          value={reason}
          onChange={(event) =>
            setReason(event.target.value)
          }
          className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#2F5D8C]"
          placeholder="Ej.: se inició contacto con el proveedor..."
        />
      </label>

      <button
        type="submit"
        disabled={
          pending ||
          selectedStatus === currentStatus
        }
        className="mt-4 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending
          ? 'Actualizando...'
          : 'Actualizar estado'}
      </button>
    </form>
  )
}