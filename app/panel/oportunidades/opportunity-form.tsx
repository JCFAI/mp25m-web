'use client'

import { useActionState, useState } from 'react'

import {
  createOpportunityAction,
  type CreateOpportunityActionState,
} from './actions'
import { OpportunityRelations } from './opportunity-relations'

type OrganizationTypeOption = {
  code: string
  name: string
  display_order: number
}

const initialState: CreateOpportunityActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

function fieldClass(hasError: boolean) {
  return hasError
    ? 'mt-2 w-full rounded-xl border border-red-300 bg-red-50/30 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100'
    : 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10'
}

function FieldError({
  message,
}: {
  message?: string
}) {
  if (!message) {
    return null
  }

  return (
    <p className="mt-2 text-xs font-medium text-red-600">
      {message}
    </p>
  )
}

export function OpportunityForm({
  organizationTypes,
}: {
  organizationTypes: OrganizationTypeOption[]
}) {
  const [state, formAction, pending] =
    useActionState(
      createOpportunityAction,
      initialState
    )

  const [title, setTitle] = useState('')
  const [description, setDescription] =
    useState('')
  const [kind, setKind] =
    useState('opportunity')
  const [priority, setPriority] =
    useState('normal')
  const [dueDate, setDueDate] = useState('')
  const [sourceText, setSourceText] =
    useState('')

  return (
    <form
      action={formAction}
      className="mt-6 grid gap-5 lg:grid-cols-2"
    >
      {state.status === 'error' &&
      state.message ? (
        <div
          role="alert"
          className="lg:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
        >
          <p className="text-sm font-semibold text-red-800">
            No se pudo registrar la oportunidad
          </p>

          <p className="mt-1 text-sm leading-6 text-red-700">
            {state.message}
          </p>
        </div>
      ) : null}

      <label className="block lg:col-span-2">
        <span className="text-sm font-semibold text-slate-700">
          Título
        </span>

        <input
          name="title"
          required
          minLength={3}
          maxLength={200}
          value={title}
          onChange={(event) =>
            setTitle(event.target.value)
          }
          aria-invalid={
            Boolean(state.fieldErrors.title)
          }
          className={fieldClass(
            Boolean(state.fieldErrors.title)
          )}
          placeholder="Ej.: Empresa busca proveedor nacional de..."
        />

        <FieldError
          message={state.fieldErrors.title}
        />
      </label>

      <label className="block lg:col-span-2">
        <span className="text-sm font-semibold text-slate-700">
          Descripción
        </span>

        <textarea
          name="description"
          required
          minLength={10}
          maxLength={10000}
          rows={5}
          value={description}
          onChange={(event) =>
            setDescription(event.target.value)
          }
          aria-invalid={
            Boolean(
              state.fieldErrors.description
            )
          }
          className={`${fieldClass(
            Boolean(
              state.fieldErrors.description
            )
          )} resize-y leading-6`}
          placeholder="Describí la oportunidad, la necesidad identificada y cualquier información relevante."
        />

        <FieldError
          message={
            state.fieldErrors.description
          }
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Tipo
        </span>

        <select
          name="kind"
          value={kind}
          onChange={(event) =>
            setKind(event.target.value)
          }
          aria-invalid={
            Boolean(state.fieldErrors.kind)
          }
          className={fieldClass(
            Boolean(state.fieldErrors.kind)
          )}
        >
          <option value="opportunity">
            Oportunidad
          </option>

          <option value="need">
            Necesidad
          </option>
        </select>

        <FieldError
          message={state.fieldErrors.kind}
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Prioridad
        </span>

        <select
          name="priority"
          value={priority}
          onChange={(event) =>
            setPriority(event.target.value)
          }
          aria-invalid={
            Boolean(
              state.fieldErrors.priority
            )
          }
          className={fieldClass(
            Boolean(
              state.fieldErrors.priority
            )
          )}
        >
          <option value="low">Baja</option>
          <option value="normal">
            Normal
          </option>
          <option value="high">Alta</option>
          <option value="urgent">
            Urgente
          </option>
        </select>

        <FieldError
          message={
            state.fieldErrors.priority
          }
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Fecha límite
        </span>

        <input
          type="date"
          name="due_date"
          value={dueDate}
          onChange={(event) =>
            setDueDate(event.target.value)
          }
          aria-invalid={
            Boolean(
              state.fieldErrors.dueDate
            )
          }
          className={fieldClass(
            Boolean(
              state.fieldErrors.dueDate
            )
          )}
        />

        <FieldError
          message={state.fieldErrors.dueDate}
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Nota sobre el origen
        </span>

        <input
          name="source_text"
          value={sourceText}
          onChange={(event) =>
            setSourceText(event.target.value)
          }
          className={fieldClass(false)}
          placeholder="Ej.: surge de la reunión del 21/8..."
        />
      </label>

      {state.fieldErrors.relations ? (
        <div className="lg:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.fieldErrors.relations}
        </div>
      ) : null}

      <OpportunityRelations
        organizationTypes={organizationTypes}
      />

      <div className="flex justify-end lg:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60"
        >
          {pending
            ? 'Registrando...'
            : 'Registrar'}
        </button>
      </div>
    </form>
  )
}