import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { getInternalUserProfile } from '../../../lib/auth/internal-profile'
import { createClient } from '../../../lib/supabase/server'
import { InternalProfileForm } from './profile-form'

export const dynamic = 'force-dynamic'

export default async function InternalProfilePage() {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

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

  const profile =
    await getInternalUserProfile(access)

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100/70">
          Cuenta interna
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Mi perfil
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-50/80">
          Configurá cómo se identifica tu usuario dentro
          del panel interno del MP25M.
        </p>
      </section>

      <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Identidad en el panel
        </h2>

        {profile.role_names.length > 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Rol: {profile.role_names.join(', ')}
          </p>
        ) : null}

        <InternalProfileForm
          initialDisplayName={
            profile.display_name ?? ''
          }
        />
      </section>
    </div>
  )
}