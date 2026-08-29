'use client'

import {
  useActionState,
  useEffect,
  useRef,
} from 'react'

import {
  confirmOrganizationNodeLinkAction,
  type OrganizationNodeLinkActionState,
} from './actions'

const initialState: OrganizationNodeLinkActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

export function OrganizationNodeConfirmationForm({
  organizationId,
  nodeId,
}: {
  organizationId: string
  nodeId: string
}) {
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, pending] =
    useActionState(
      confirmOrganizationNodeLinkAction.bind(
        null,
        organizationId,
        nodeId
      ),
      initialState
    )

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset()
    }
  }, [state.status, state.message])

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-4 border-t border-amber-200 pt-4"
    >
      {state.status !== 'idle' &&
      state.message ? (
        <div
          role="alert"
          className={
            state.status === 'success'
              ? 'mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'
              : 'mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {state.message}
        </div>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Justificación de confirmación
        </span>

        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={2000}
          rows={3}
          className="mt-2 w-full resize-y rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          aria-invalid={Boolean(
            state.fieldErrors.reason
          )}
          placeholder="Motivo breve de la validación territorial."
        />
      </label>

      {state.fieldErrors.reason ? (
        <p className="mt-2 text-xs font-medium text-red-600">
          {state.fieldErrors.reason}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60"
        >
          {pending
            ? 'Confirmando...'
            : 'Confirmar vínculo'}
        </button>
      </div>
    </form>
  )
}
