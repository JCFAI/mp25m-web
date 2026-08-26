'use client'

import {
  useActionState,
  useEffect,
  useState,
} from 'react'

import {
  updateInternalProfileAction,
  type InternalProfileActionState,
} from './actions'

const initialState: InternalProfileActionState = {
  status: 'idle',
  message: null,
}

export function InternalProfileForm({
  initialDisplayName,
}: {
  initialDisplayName: string
}) {
  const [state, formAction, pending] =
    useActionState(
      updateInternalProfileAction,
      initialState
    )

  const [displayName, setDisplayName] =
    useState(initialDisplayName)

  useEffect(() => {
    if (state.status === 'success') {
      setDisplayName((value) =>
        value.trim()
      )
    }
  }, [state.status])

  return (
    <form
      action={formAction}
      className="mt-6"
    >
      {state.message ? (
        <div
          className={
            state.status === 'success'
              ? 'mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
              : 'mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
          }
        >
          {state.message}
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Nombre visible
        </span>

        <input
          name="display_name"
          required
          minLength={2}
          maxLength={120}
          value={displayName}
          onChange={(event) =>
            setDisplayName(
              event.target.value
            )
          }
          placeholder="Ej.: Jorge Fossati"
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        />

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Este nombre identifica tu usuario dentro del
          panel y podrá mostrarse como responsable de
          articulaciones. No modifica los datos de
          participantes del MP25M.
        </p>
      </label>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60"
        >
          {pending
            ? 'Guardando...'
            : 'Guardar nombre'}
        </button>
      </div>
    </form>
  )
}