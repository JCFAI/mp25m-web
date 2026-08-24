import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { getInternalAccess } from '../../../../../lib/auth/internal-access'
import {
  canManageOpportunity,
  getOpportunityDetail,
} from '../../../../../lib/opportunities/detail'
import {
  listOpportunityOrganizationTypes,
} from '../../../../../lib/opportunities/actors'
import { createClient } from '../../../../../lib/supabase/server'
import { OpportunityEditForm } from './edit-form'

export const dynamic = 'force-dynamic'

type EditOpportunityPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function EditOpportunityPage({
  params,
}: EditOpportunityPageProps) {
  const { id } = await params

  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const authUserId = claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  if (!canManageOpportunity(access)) {
    redirect(`/panel/oportunidades/${id}`)
  }

  const [
    detail,
    organizationTypes,
  ] = await Promise.all([
    getOpportunityDetail(id),
    listOpportunityOrganizationTypes(),
  ])

  if (!detail) {
    notFound()
  }

  const initialNodes =
    detail.opportunity.node_ids.map(
      (nodeId, index) => ({
        id: nodeId,
        display_name:
          detail.opportunity.node_names[index] ??
          'Nodo',
      })
    )

  const initialActors =
    detail.origins.map((origin) => ({
      actor_type: origin.actor_type,
      actor_id: origin.actor_id,
      display_name: origin.display_name,
      type_label: origin.type_label,
      node_ids: [],
      node_names: origin.node_names,
      role_names: origin.role_names,
      is_related_to_selected_node: false,
      is_provisional: origin.is_provisional,
    }))

  return (
    <div className="space-y-7">
      <div>
        <Link
          href={`/panel/oportunidades/${id}`}
          className="text-sm font-semibold text-[#2F5D8C] hover:text-[#1E3A5F]"
        >
          ← Volver al detalle
        </Link>
      </div>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100/70">
          Articulaciones
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Editar articulación
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-50/80">
          Modificá la información general, los nodos y los actores de origen.
          El estado y su seguimiento se administran desde la pantalla de detalle.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <OpportunityEditForm
          opportunity={detail.opportunity}
          organizationTypes={organizationTypes}
          initialNodes={initialNodes}
          initialActors={initialActors}
        />
      </section>
    </div>
  )
}