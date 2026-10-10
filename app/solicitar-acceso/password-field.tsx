'use client'

import { useState } from 'react'

export function PasswordField() {
  const [visible, setVisible] = useState(false)

  return (
    <label className="block text-sm font-medium">
      Contraseña
      <div className="mt-1 flex overflow-hidden rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-[#2F5D8C]">
        <input
          type={visible ? 'text' : 'password'}
          name="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          className="min-w-0 flex-1 bg-white p-3 outline-none"
        />
        <button
          type="button"
          onClick={() => setVisible(current => !current)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="shrink-0 border-l border-slate-300 bg-slate-50 px-3 text-sm font-medium text-[#2F5D8C] hover:bg-slate-100"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
    </label>
  )
}
