'use client'

import {
  useActionState,
  useEffect,
  useState,
} from 'react'

import {
  createOpportunityFollowupAction,
  type FollowupActionState,
} from './actions'

type FollowupKind =
  | 'note'
  | 'contact'
  | 'meeting'
  | 'commitment'
  | 'delivery'
  | 'other'

const initialState: FollowupActionState = {
  status: 'idle',
  message: null,
}

export function OpportunityFollowupForm({
  opportunityId,
}: {
  opportunityId: string
}) {
  const action =
    createOpportunityFollowupAction.bind(
      null,
      opportunityId
    )

  const [state, formAction, pending] =
    useActionState(
      action,
      initialState
    )

  const [kind, setKind] =
    useState<FollowupKind>('note')

  const [body, setBody] =
    useState('')

  useEffect(() => {
    if (state.status === 'success') {
      setBody('')
      setKind('note')
    }
  }, [state.status])

  return (
    <form
      action={formAction}
      className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-950">
        Agregar novedad
      </h2>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Registrá contactos, reuniones, compromisos,
        entregas u otros avances de esta oportunidad.
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
          Tipo
        </span>

        <select
          name="kind"
          value={kind}
          onChange={(event) =>
            setKind(
              event.target.value as FollowupKind
            )
          }
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#2F5D8C]"
        >
          <option value="note">
            Novedad general
          </option>

          <option value="contact">
            Contacto
          </option>

          <option value="meeting">
            Reunión
          </option>

          <option value="commitment">
            Compromiso
          </option>

          <option value="delivery">
            Entrega
          </option>

          <option value="other">
            Otro
          </option>
        </select>
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-slate-700">
          Detalle
        </span>

        <textarea
          name="body"
          required
          minLength={3}
          maxLength={5000}
          rows={4}
          value={body}
          onChange={(event) =>
            setBody(event.target.value)
          }
          className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#2F5D8C]"
          placeholder="Ej.: Se habló con el comedor. Confirmaron que pueden recibir la entrega el jueves por la mañana."
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60"
      >
        {pending
          ? 'Registrando...'
          : 'Registrar novedad'}
      </button>
    </form>
  )
}