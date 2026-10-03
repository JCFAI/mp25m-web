import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { canManagePeople } from '../../../../lib/people/manage'
import { createClient } from '../../../../lib/supabase/server'
import { NewPersonForm } from './new-person-form'

export const dynamic = 'force-dynamic'

export default async function NewPersonPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error || !data?.claims?.sub) redirect('/login')

  const access = await getInternalAccess(data.claims.sub)
  if (access.length === 0) redirect('/sin-acceso')

  return <div className="mx-auto max-w-3xl space-y-6">
    <Link
      href="/panel/personas"
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#2F5D8C] shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
    >
      <span aria-hidden="true">←</span>
      Volver al directorio de Personas
    </Link>
    <section className="rounded-3xl bg-gradient-to-br from-[#12648d] via-[#124f75] to-[#14263D] px-7 py-7 text-white shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Nueva persona</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Alta canónica</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50">Buscá primero en el directorio. Si la persona no existe, registrá sólo su identidad canónica.</p></section>
    {canManagePeople(access) ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-semibold text-slate-950">Registrar persona</h2><NewPersonForm /></section> : <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Tu usuario no tiene permisos para crear personas canónicas. Esta acción requiere rol global de administrador o validador.</section>}
  </div>
}
