'use client'

import {
  useActionState,
  useState,
} from 'react'

import { OpportunityRelations } from '../../opportunity-relations'
import {
  editOpportunityAction,
  type EditOpportunityActionState,
} from './actions'

type NodeValue = {
  id: string
  display_name: string
}

type ActorValue = {
  actor_type: 'person' | 'organization' | 'candidate'
  actor_id: string
  display_name: string
  type_label: string
  node_ids: string[]
  node_names: string[]
  role_names: string[]
  is_related_to_selected_node: boolean
  is_provisional: boolean
}

type OrganizationTypeOption = {
  code: string
  name: string
  display_order: number
}

type OpportunityValue = {
  id: string
  title: string
  description: string
  kind: 'opportunity' | 'need'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  source_text: string | null
  due_date: string | null
}

const initialState: EditOpportunityActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

function fieldClass(hasError: boolean) {
  return hasError
    ? 'mt-2 w-full rounded-xl border border-red-300 bg-red-50/30 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100'
    : 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10'
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

export function OpportunityEditForm({
  opportunity,
  organizationTypes,
  initialNodes,
  initialActors,
}: {
  opportunity: OpportunityValue
  organizationTypes: OrganizationTypeOption[]
  initialNodes: NodeValue[]
  initialActors: ActorValue[]
}) {
  const action =
    editOpportunityAction.bind(
      null,
      opportunity.id
    )

  const [state, formAction, pending] =
    useActionState(
      action,
      initialState
    )

  const [title, setTitle] =
    useState(opportunity.title)

  const [description, setDescription] =
    useState(opportunity.description)

  const [kind, setKind] =
    useState(opportunity.kind)

  const [priority, setPriority] =
    useState(opportunity.priority)

  const [dueDate, setDueDate] =
    useState(opportunity.due_date ?? '')

  const [sourceText, setSourceText] =
    useState(opportunity.source_text ?? '')

  return (
    <form
      action={formAction}
      className="grid gap-5 lg:grid-cols-2"
    >
      {state.status === 'error' &&
      state.message ? (
        <div
          role="alert"
          className="lg:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
        >
          <p className="text-sm font-semibold text-red-800">
            No se pudieron guardar los cambios
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
          className={fieldClass(
            Boolean(state.fieldErrors.title)
          )}
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
          className={`${fieldClass(
            Boolean(
              state.fieldErrors.description
            )
          )} resize-y leading-6`}
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
            setKind(
              event.target.value as
                | 'opportunity'
                | 'need'
            )
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
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Prioridad
        </span>

        <select
          name="priority"
          value={priority}
          onChange={(event) =>
            setPriority(
              event.target.value as
                | 'low'
                | 'normal'
                | 'high'
                | 'urgent'
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
          className={fieldClass(
            Boolean(
              state.fieldErrors.dueDate
            )
          )}
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
        />
      </label>

      {state.fieldErrors.relations ? (
        <div className="lg:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.fieldErrors.relations}
        </div>
      ) : null}

      <OpportunityRelations
        organizationTypes={organizationTypes}
        initialNodes={initialNodes}
        initialActors={initialActors}
      />

      <div className="flex flex-wrap justify-end gap-3 lg:col-span-2">
        <a
          href={`/panel/oportunidades/${opportunity.id}`}
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </a>

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60"
        >
          {pending
            ? 'Guardando...'
            : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}