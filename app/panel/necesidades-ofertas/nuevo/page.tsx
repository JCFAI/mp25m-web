import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  canGovernNeedsOffers,
  listNeedOfferNodeOptions,
  listNeedOfferUserOptions,
} from '../../../../lib/needs-offers/needs-offers'
import { createClient } from '../../../../lib/supabase/server'
import { NeedOfferCreateForm } from '../need-offer-forms'

export const dynamic = 'force-dynamic'

export default async function NewNeedOfferPage() {
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

  if (
    !canGovernNeedsOffers(access)
  ) {
    redirect(
      '/panel/necesidades-ofertas'
    )
  }

  const [users, nodes] =
    await Promise.all([
      listNeedOfferUserOptions(),
      listNeedOfferNodeOptions(),
    ])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/panel/necesidades-ofertas"
        className="text-sm font-semibold text-[#2F5D8C]"
      >
        ← Volver a necesidades y ofertas
      </Link>

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
          Incremento 10A
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          Registrar necesidad u oferta
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          El registro nace como borrador, con responsable e historial. No crea oportunidades, articulaciones, proyectos ni contactos automáticamente.
        </p>
      </section>

      <NeedOfferCreateForm
        users={users}
        nodes={nodes}
      />
    </div>
  )
}
