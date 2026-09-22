'use client'

import { type RefObject, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { PasswordInput } from '../../components/password-input'
import { login } from './actions'

function LoginSubmitButton({ submittingRef }: { submittingRef: RefObject<boolean> }) {
  const { pending } = useFormStatus()

  useEffect(() => {
    if (!pending) submittingRef.current = false
  }, [pending, submittingRef])

  return (
    <>
      <button
        type="submit" disabled={pending} aria-busy={pending}
        className="ux-button w-full rounded-lg bg-[#1E3A5F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#14263D]"
      >
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>
      <p role="status" className="sr-only">{pending ? 'Ingresando…' : ''}</p>
    </>
  )
}

export function LoginForm() {
  const submittingRef = useRef(false)

  return (
    <form
      action={login}
      onSubmit={(event) => {
        // Covers a second submit in the same frame, before pending renders.
        if (submittingRef.current) {
          event.preventDefault()
          return
        }
        submittingRef.current = true
      }}
      className="space-y-5"
    >
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Email</label>
        <input
          id="email" name="email" type="email" autoComplete="email" required
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Contraseña</label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>
      <LoginSubmitButton submittingRef={submittingRef} />
    </form>
  )
}
