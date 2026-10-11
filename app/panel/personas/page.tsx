import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { canManagePeople } from '../../../lib/people/manage'
import { createClient } from '../../../lib/supabase/server'
import { PersonSearch } from './person-search'

export const dynamic = 'force-dynamic'

export default async function PeoplePage() {
  const supabase = await createClient()

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  return (
    <div className="space-y-7">
      <section data-tour="s-people-intro" className="rounded-3xl bg-gradient-to-br from-[#12648d] via-[#124f75] to-[#14263D] px-7 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
          Personas
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Directorio de personas
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
          Accedé al registro canónico de cada persona,
          sus participaciones territoriales, habilidades
          y oportunidades.
        </p>
      </section>

      {canManagePeople(access) ? <Link href="/panel/personas/nueva" className="ux-button inline-flex min-h-11 items-center rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#14263D]">Nueva persona</Link> : null}

      <section data-tour="s-people-search" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <PersonSearch />
      </section>
    </div>
  )
}
