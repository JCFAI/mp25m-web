'use client'

import { useActionState } from 'react'

import type { OpportunityAssigneeOption } from '../../../lib/opportunities/detail'

import {
  createArticulationAction,
  type ArticulationActionState,
} from './actions'

const initialState: ArticulationActionState = {
  status: 'idle',
  message: null,
}

function Feedback({
  state,
}: {
  state: ArticulationActionState
}) {
  if (!state.message) return null

  return (
    <p
      className={`mt-3 text-sm ${
        state.status === 'error'
          ? 'text-red-700'
          : 'text-emerald-700'
      }`}
    >
      {state.message}
    </p>
  )
}

export function ArticulationCreationForm({
  assigneeOptions,
}: {
  assigneeOptions: OpportunityAssigneeOption[]
}) {
  const [state, formAction, pending] =
    useActionState(
      createArticulationAction,
      initialState,
    )

  return (
    <details
      data-tour="articulation-create"
      className="rounded-2xl border border-slate-200 bg-white shadow-sm"
      open
    >
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-[#1E3A5F]">
        + Crear articulación
      </summary>

      <form
        action={formAction}
        data-tour-focus="articulation-create"
        className="border-t border-slate-200 p-5"
      >
        <p className="text-sm leading-6 text-slate-600">
          Una articulación puede comenzar de manera
          independiente. Después se le pueden vincular
          oportunidades, proyectos, personas,
          organizaciones y otros actores o recursos.
        </p>

        <input
          name="title"
          required
          minLength={3}
          maxLength={200}
          placeholder="Nombre de la articulación (Obligatorio)"
          className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        />

        <textarea
          name="objective"
          required
          minLength={3}
          maxLength={10000}
          rows={3}
          placeholder="Objetivo o propósito inicial (Obligatorio)..."
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        />

        <select
          name="responsible_internal_user_id"
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="">
            Sin responsable inicial
          </option>

          {assigneeOptions.map((option) => (
            <option
              key={option.id}
              value={option.id}
            >
              {option.display_name}
            </option>
          ))}
        </select>

        <Feedback state={state} />

        <button
          disabled={pending}
          className="ux-button mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending
            ? 'Creando...'
            : 'Crear articulación'}
        </button>
      </form>
    </details>
  )
}
