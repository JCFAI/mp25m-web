import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createClient } from '../../../lib/supabase/server'
import { NodeSearch } from './node-search'

export const dynamic = 'force-dynamic'

export default async function NodesPage() {
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
      <section className="rounded-3xl bg-gradient-to-br from-[#12648d] via-[#124f75] to-[#14263D] px-7 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
          Nodos
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Directorio territorial
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
          Consultá la composición confirmada, las
          capacidades relevadas y las articulaciones
          vinculadas con cada nodo.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <NodeSearch />
      </section>
    </div>
  )
}