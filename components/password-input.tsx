'use client'

import { useState } from 'react'

type PasswordInputProps = {
  id: string
  name: string
  autoComplete?: string
  minLength?: number
  required?: boolean
}

export function PasswordInput({
  id,
  name,
  autoComplete,
  minLength,
  required = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-24 text-slate-900 outline-none focus:border-slate-500"
      />

      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  )
}
