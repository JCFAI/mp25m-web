'use client'

import {
  useActionState,
  useEffect,
  useRef,
} from 'react'

import {
  createPilotFeedbackAction,
  type PilotFeedbackActionState,
} from './actions'

const initialState: PilotFeedbackActionState = {
  status: 'idle',
  message: null,
}

export function PilotFeedbackForm() {
  const formRef =
    useRef<HTMLFormElement>(null)

  const [state, formAction, pending] =
    useActionState(
      createPilotFeedbackAction,
      initialState
    )

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <form
      ref={formRef}
      action={formAction}
      data-tour-focus="feedback-form"
      className="mt-6 space-y-5"
    >
      {state.status === 'success' ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
        >
          ✓ Comentario enviado correctamente.
          Gracias por ayudarnos a mejorar MP25M.
        </p>
      ) : null}

      {state.status === 'error' ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.message}
        </p>
      ) : null}

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">
          Tipo de comentario (Obligatorio)
        </span>

        <select
          name="feedback_type"
          defaultValue="difficulty"
          required
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
        >
          <option value="difficulty">
            Dificultad
          </option>
          <option value="suggestion">
            Sugerencia
          </option>
          <option value="error">
            Error
          </option>
          <option value="other">
            Otro
          </option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">
          Comentario (Obligatorio)
        </span>

        <textarea
          name="detail"
          required
          minLength={3}
          maxLength={5000}
          rows={6}
          placeholder="Contanos qué pasó, qué te resultó difícil o qué mejorarías."
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">
          Pantalla o contexto
        </span>

        <input
          name="context_path"
          maxLength={500}
          placeholder="Ej.: Personas, Articulaciones, versión móvil..."
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-xl bg-[#1E3A5F] px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? 'Registrando...'
          : 'Registrar comentario'}
      </button>
    </form>
  )
}
