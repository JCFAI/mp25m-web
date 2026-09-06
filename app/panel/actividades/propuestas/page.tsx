import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { canManageOrganizationActivities } from '../../../../lib/organizations/activities-manage'
import { listPendingActivityProposals, countPendingActivityProposals } from '../../../../lib/organizations/activity-proposals'

import { createClient } from '../../../../lib/supabase/server'
import { ActivityProposalReviewList } from './activity-proposal-review-list'

export const dynamic = 'force-dynamic'

export default async function ActivityProposalsPage() {
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

  if (!canManageOrganizationActivities(access)) {
    redirect('/sin-acceso')
  }

  const [proposals, count] = await Promise.all([listPendingActivityProposals(access), countPendingActivityProposals(access)])

  return (
    <div className="space-y-5 sm:space-y-7">
      <Link
        href="/panel/organizaciones"
        className="inline-flex min-h-11 items-center text-sm font-medium text-[#2F5D8C] transition hover:text-[#1E3A5F]"
      >
        ← Volver a Organizaciones
      </Link>

      <section className="rounded-2xl border border-sky-100 bg-white px-4 py-5 text-slate-950 shadow-sm md:rounded-3xl md:border-0 md:bg-gradient-to-br md:from-[#12648d] md:via-[#124f75] md:to-[#14263D] md:px-7 md:py-7 md:text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C] md:text-blue-100">
          Gobernanza del catálogo
        </p>

        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl">
            Propuestas de actividades
          </h1>

          <span className="rounded-full bg-[#EAF0F7] px-3 py-1 text-xs font-semibold text-[#1E3A5F] md:bg-white/15 md:text-blue-50">
            {count === 1
              ? '1 pendiente'
              : `${count} pendientes`}
          </span>
        </div>

        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600 md:mt-3 md:text-blue-50">
          Las propuestas permiten revisar vocabulario nuevo
          antes de incorporarlo al catálogo canónico. Resolver
          una propuesta no registra actividades ni
          capacidades en organizaciones.
        </p>
      </section>

      {count > proposals.length && <p className="text-sm text-slate-600">Se muestran las 50 propuestas más antiguas. Al resolverlas aparecerán las siguientes.</p>}
      <ActivityProposalReviewList
        proposals={proposals}

      />
    </div>
  )
}
