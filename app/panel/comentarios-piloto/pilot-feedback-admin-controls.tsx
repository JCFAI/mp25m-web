'use client'

import { useActionState } from 'react'

import {
  archivePilotFeedbackAdminAction,
  updatePilotFeedbackAdminAction,
  type PilotFeedbackActionState,
} from './actions'

const initialState: PilotFeedbackActionState = {
  status: 'idle',
  message: null,
}

export function PilotFeedbackAdminControls({
  feedbackId,
  status,
  response,
}: {
  feedbackId: string
  status: string
  response: string | null
}) {
  const [updateState, updateAction, updating] =
    useActionState(
      updatePilotFeedbackAdminAction.bind(
        null,
        feedbackId
      ),
      initialState
    )

  const [archiveState, archiveAction, archiving] =
    useActionState(
      archivePilotFeedbackAdminAction.bind(
        null,
        feedbackId
      ),
      initialState
    )

  const message =
    updateState.message ??
    archiveState.message

  const isError =
    updateState.status === 'error' ||
    archiveState.status === 'error'

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      {message ? (
        <p
          role={isError ? 'alert' : 'status'}
          className={
            isError
              ? 'mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700'
              : 'mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800'
          }
        >
          {message}
        </p>
      ) : null}

      <form
        action={updateAction}
        className="space-y-3"
      >
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">
            Estado
          </span>

          <select
            name="status"
            defaultValue={status}
            className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="new">
              Nuevo
            </option>
            <option value="in_review">
              En revisión
            </option>
            <option value="resolved">
              Resuelto
            </option>
            <option value="dismissed">
              Descartado
            </option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-slate-700">
            Respuesta al usuario
          </span>

          <textarea
            name="admin_response"
            defaultValue={response ?? ''}
            maxLength={5000}
            rows={3}
            placeholder="Escribí una devolución. Es obligatoria al resolver o descartar."
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={updating}
          className="min-h-10 rounded-lg bg-[#1E3A5F] px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {updating
            ? 'Guardando...'
            : 'Guardar seguimiento'}
        </button>
      </form>

      <form
        action={archiveAction}
        className="mt-3"
      >
        <button
          type="submit"
          disabled={archiving}
          className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          {archiving
            ? 'Archivando...'
            : 'Archivar'}
        </button>
      </form>
    </div>
  )
}
