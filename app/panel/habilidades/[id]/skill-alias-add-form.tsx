'use client'

import {
  useActionState,
  useEffect,
  useId,
  useRef,
} from 'react'
import { useRouter } from 'next/navigation'

import {
  addSkillAliasAction,
  type SkillAliasActionState,
} from './actions'

const initialState: SkillAliasActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

function fieldClass(hasError: boolean) {
  return hasError
    ? 'mt-2 min-h-12 w-full rounded-xl border border-red-300 bg-red-50/30 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100'
    : 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10'
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

export function SkillAliasAddForm({
  skillId,
  skillName,
}: {
  skillId: string
  skillName: string
}) {
  const router = useRouter()
  const aliasId = useId()
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, pending] =
    useActionState(
      addSkillAliasAction.bind(
        null,
        skillId,
        skillName
      ),
      initialState
    )

  useEffect(() => {
    if (state.status !== 'success') {
      return
    }

    formRef.current?.reset()
    router.refresh()
  }, [state.status, state.message, router])

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <label
        htmlFor={aliasId}
        className="block"
      >
        <span className="text-sm font-semibold text-slate-700">
          Agregar alias
        </span>

        <input
          id={aliasId}
          name="alias"
          maxLength={180}
          className={fieldClass(
            Boolean(state.fieldErrors.alias)
          )}
        />

        <FieldError
          message={state.fieldErrors.alias}
        />
      </label>

      {state.status !== 'idle' &&
      state.message ? (
        <div
          role="alert"
          className={
            state.status === 'success'
              ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'
              : 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {pending
            ? 'Agregando...'
            : 'Agregar alias'}
        </button>
      </div>
    </form>
  )
}
