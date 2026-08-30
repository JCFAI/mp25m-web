'use client'

import {
  useActionState,
  useState,
} from 'react'

import {
  createOrganizationAction,
  type CreateOrganizationActionState,
} from './actions'

type OrganizationTypeOption = {
  code: string
  name: string
  display_order: number
}

const initialState: CreateOrganizationActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

const PROPOSE_NEW_TYPE_VALUE =
  '__propose_new_type__'

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

export function NewOrganizationForm({
  organizationTypes,
}: {
  organizationTypes: OrganizationTypeOption[]
}) {
  const [state, formAction, pending] =
    useActionState(
      createOrganizationAction,
      initialState
    )

  const [organizationTypeCode, setOrganizationTypeCode] =
    useState('')

  const isTypeProposal =
    organizationTypeCode ===
    PROPOSE_NEW_TYPE_VALUE

  return (
    <form
      action={formAction}
      className="mt-6 grid gap-5"
    >
      {state.status === 'error' &&
      state.message ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
        >
          <p className="text-sm font-semibold text-red-800">
            No se pudo crear la organización
          </p>

          <p className="mt-1 text-sm leading-6 text-red-700">
            {state.message}
          </p>
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Nombre
        </span>

        <input
          name="name"
          required
          minLength={2}
          maxLength={300}
          autoComplete="off"
          className={fieldClass(
            Boolean(state.fieldErrors.name)
          )}
          aria-invalid={Boolean(
            state.fieldErrors.name
          )}
          placeholder="Ej.: Cooperativa de trabajo..."
        />

        <FieldError
          message={state.fieldErrors.name}
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Tipo de organización
        </span>

        <select
          name="organization_type_code"
          required
          defaultValue=""
          onChange={(event) =>
            setOrganizationTypeCode(
              event.target.value
            )
          }
          className={fieldClass(
            Boolean(
              state.fieldErrors
                .organizationTypeCode
            )
          )}
          aria-invalid={Boolean(
            state.fieldErrors
              .organizationTypeCode
          )}
        >
          <option value="" disabled>
            Seleccionar tipo
          </option>

          {organizationTypes.map((type) => (
            <option
              key={type.code}
              value={type.code}
            >
              {type.name}
            </option>
          ))}

          <option value={PROPOSE_NEW_TYPE_VALUE}>
            Proponer un nuevo tipo...
          </option>
        </select>

        <FieldError
          message={
            state.fieldErrors
              .organizationTypeCode
          }
        />
      </label>

      {isTypeProposal ? (
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Nuevo tipo propuesto
          </span>

          <input
            name="proposed_type_name"
            required
            minLength={2}
            maxLength={120}
            autoComplete="off"
            className={fieldClass(
              Boolean(
                state.fieldErrors
                  .proposedTypeName
              )
            )}
            aria-invalid={Boolean(
              state.fieldErrors
                .proposedTypeName
            )}
            placeholder="Ej.: Centro tecnológico comunitario"
          />

          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            El tipo quedará pendiente de validación.
          </p>

          <FieldError
            message={
              state.fieldErrors
                .proposedTypeName
            }
          />
        </label>
      ) : null}

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Observaciones
        </span>

        <textarea
          name="notes"
          rows={5}
          maxLength={2000}
          className={`${fieldClass(
            Boolean(state.fieldErrors.notes)
          )} resize-y leading-6`}
          aria-invalid={Boolean(
            state.fieldErrors.notes
          )}
          placeholder="Información contextual o criterio usado para el alta."
        />

        <FieldError
          message={state.fieldErrors.notes}
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            pending ||
            organizationTypes.length === 0
          }
          className="rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60"
        >
          {pending
            ? 'Creando...'
            : 'Crear organización'}
        </button>
      </div>
    </form>
  )
}
