import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import {
  canGovernNeedsOffers,
  listNeedOfferNodeOptions,
  listNeedOfferUserOptions,
} from '../../../lib/needs-offers/needs-offers'
import { createClient } from '../../../lib/supabase/server'
import { NeedOfferDirectory } from './need-offer-directory'

export const dynamic = 'force-dynamic'

export default async function NeedsOffersPage() {
  const supabase = await createClient()

  const { data } =
    await supabase.auth.getClaims()

  if (!data?.claims?.sub) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(
      data.claims.sub
    )

  if (!access.length) {
    redirect('/sin-acceso')
  }

  const [users, nodes] =
    await Promise.all([
      listNeedOfferUserOptions(),
      listNeedOfferNodeOptions(),
    ])

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
            Incremento 10A
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Necesidades y ofertas
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-100/80">
            Registro manual y trazable de necesidades y ofertas. No implica disponibilidad, compromiso, contacto ni creación automática de oportunidades.
          </p>
        </div>

        {canGovernNeedsOffers(access) ? (
          <Link
            href="/panel/necesidades-ofertas/nuevo"
            className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F]"
          >
            Registrar
          </Link>
        ) : null}
      </section>

      <NeedOfferDirectory
        users={users}
        nodes={nodes}
      />
    </div>
  )
}
