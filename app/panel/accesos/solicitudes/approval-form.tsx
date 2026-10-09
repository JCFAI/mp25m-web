'use client'

import { useState, useTransition } from 'react'
import { approveAccessRequest } from './actions'

type Scope = { id: string; name: string; scope_type: string }
type Props = { authUserId: string; displayName: string; scopes: Scope[] }

const roles = [
  { code: 'participant', label: 'Participante' },
  { code: 'node_referent', label: 'Referente' },
  { code: 'founder_access', label: 'Fundador' },
  { code: 'local_administrator', label: 'Administrador Local' },
  { code: 'administrator', label: 'Administrador General' },
] as const

export function ApprovalForm({ authUserId, displayName, scopes }: Props) {
  const [roleCode, setRoleCode] = useState('participant')
  const [scopeId, setScopeId] = useState('')
  const [name, setName] = useState(displayName)
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [result, setResult] = useState('')
  const [pending, startTransition] = useTransition()

  const allowedScopes = scopes.filter(s =>
    roleCode === 'administrator' ? s.scope_type === 'global' : s.scope_type === 'node'
  )
  const effectiveScopeId = allowedScopes.some(s => s.id === scopeId)
    ? scopeId : (allowedScopes[0]?.id ?? '')
  const canSubmit = !!effectiveScopeId && acknowledged &&
    name.trim().length >= 2 && reason.trim().length >= 3 && !pending

  function submit(formData: FormData) {
    setResult('')
    startTransition(async () => {
      try {
        await approveAccessRequest({
          authUserId,
          displayName: String(formData.get('name') ?? ''),
          roleCode,
          scopeId: effectiveScopeId,
          reason: String(formData.get('reason') ?? ''),
        })
        setResult('Cuenta aprobada. Recargá la página para consultar su estado.')
      } catch {
        setResult('No se pudo aprobar la cuenta. Comprobá sus datos y permisos.')
      }
    })
  }

  return (
    <form action={submit} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-800">Aprobar cuenta</p>
      <label className="block text-sm">Nombre visible
        <input name="name" required minLength={2} maxLength={120}
          value={name} onChange={e => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" />
      </label>
      <label className="block text-sm">Rol inicial
        <select value={roleCode} onChange={e => { setRoleCode(e.target.value); setScopeId(''); setAcknowledged(false) }}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2">
          {roles.map(role => <option value={role.code} key={role.code}>{role.label}</option>)}
        </select>
      </label>
      <label className="block text-sm">Ámbito de autorización
        <select value={effectiveScopeId} onChange={e => { setScopeId(e.target.value); setAcknowledged(false) }}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
          disabled={!allowedScopes.length}>
          {!allowedScopes.length ? <option value="">No hay ámbitos disponibles</option> : null}
          {allowedScopes.map(scope =>
            <option key={scope.id} value={scope.id}>{scope.name}</option>
          )}
        </select>
      </label>
      <label className="block text-sm">Motivo de aprobación
        <textarea name="reason" required minLength={3} maxLength={2000}
          value={reason} onChange={e => setReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" rows={2} />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={acknowledged}
          onChange={e => setAcknowledged(e.target.checked)} />
        Confirmo que verifiqué la identidad y autorizo este rol y ámbito.
      </label>
      <button type="submit" disabled={!canSubmit}
        className="rounded-lg bg-[#1E3A5F] px-4 py-2 font-semibold text-white disabled:opacity-40">
        {pending ? 'Aprobando…' : 'Confirmar aprobación'}
      </button>
      {result ? <p role="status" className="text-sm text-slate-700">{result}</p> : null}
    </form>
  )
}
