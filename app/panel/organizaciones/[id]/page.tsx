import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { getCanonicalOrganizationProfile } from '../../../../lib/organizations/profile'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function verificationLabel(value: string) {
  const labels: Record<string, string> = {
    self_reported: 'Autodeclarada',
    candidate: 'Candidata',
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    rejected: 'Rechazada',
  }

  return labels[value] ?? value
}

function articulationKindLabel(
  kind: 'opportunity' | 'need'
) {
  return kind === 'need'
    ? 'Necesidad'
    : 'Oportunidad / oferta'
}

export default async function OrganizationProfilePage({
  params,
}: PageProps) {
  const { id } = await params

  if (!UUID_PATTERN.test(id)) {
    notFound()
  }

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

  const profile =
    await getCanonicalOrganizationProfile(id)

  if (!profile) {
    notFound()
  }

  const {
    organization,
    nodes,
    capabilities,
    articulations,
  } = profile

  return (
    <div className="space-y-7">
      <Link
        href="/panel/organizaciones"
        className="inline-flex text-sm font-medium text-[#2F5D8C] transition hover:text-[#1E3A5F]"
      >
        ← Volver a Organizaciones
      </Link>

      <section className="rounded-3xl bg-gradient-to-br from-[#12648d] via-[#124f75] to-[#14263D] px-7 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
          Organización
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {organization.display_name}
          </h1>

          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-blue-50">
            {organization.organization_type_name}
          </span>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
          Registro canónico de la organización. Sus
          vínculos territoriales y capacidades conservan
          estados de validación independientes.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-slate-950">
            {organization.confirmed_node_count}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Nodos confirmados
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-slate-950">
            {organization.capability_count}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Capacidades relevadas
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-slate-950">
            {organization.confirmed_capability_count}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Capacidades confirmadas
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-slate-950">
            {organization.articulation_count}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Articulaciones
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Identidad institucional
        </h2>

        <dl className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nombre
            </dt>
            <dd className="mt-1 font-semibold text-slate-900">
              {organization.display_name}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tipo
            </dt>
            <dd className="mt-1 text-sm text-slate-700">
              {organization.organization_type_name}
            </dd>
          </div>
        </dl>

        {organization.notes ? (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Observaciones
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {organization.notes}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Presencia territorial
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Una organización puede estar vinculada con más
          de un nodo. Cada vínculo conserva su propio
          estado de validación.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {nodes.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No hay vínculos territoriales vigentes
              registrados.
            </div>
          ) : (
            nodes.map((node) => (
              <article
                key={node.node_id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/panel/nodos/${node.node_id}`}
                      className="font-semibold text-[#2F5D8C] hover:underline"
                    >
                      {node.node_name}
                    </Link>

                    {node.node_number !== null ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Nodo {node.node_number}
                      </p>
                    ) : null}
                  </div>

                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {verificationLabel(
                      node.verification_status
                    )}
                  </span>
                </div>

                {node.evidence_text ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {node.evidence_text}
                  </p>
                ) : null}

                {node.source_name ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Fuente: {node.source_name}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Capacidades
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Capacidades institucionales generales o
          específicas de un nodo.
        </p>

        <div className="mt-5 space-y-3">
          {capabilities.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Capacidades organizacionales pendientes de
              registrar.
            </div>
          ) : (
            capabilities.map((capability) => (
              <article
                key={
                  capability.organization_capability_id
                }
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {capability.capability_name}
                    </p>

                    {capability.category_name ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {capability.category_name}
                      </p>
                    ) : null}
                  </div>

                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#2F5D8C]">
                    {verificationLabel(
                      capability.verification_status
                    )}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-600">
                  Alcance:{' '}
                  {capability.scope_node_name
                    ? capability.scope_node_name
                    : 'Institucional / general'}
                </p>

                {capability.notes ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {capability.notes}
                  </p>
                ) : null}

                <p className="mt-2 text-xs text-slate-500">
                  Evidencias registradas:{' '}
                  {capability.evidence_count}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Articulaciones
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Oportunidades o necesidades donde la
          organización figura como actor de origen.
        </p>

        <div className="mt-5 space-y-3">
          {articulations.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Articulaciones pendientes de registrar.
            </div>
          ) : (
            articulations.map((articulation) => (
              <Link
                key={articulation.opportunity_id}
                href={`/panel/oportunidades/${articulation.opportunity_id}`}
                className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#2F5D8C]/40 hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {articulation.title}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-[#2F5D8C]">
                      {articulationKindLabel(
                        articulation.kind
                      )}
                    </p>
                  </div>

                  <span className="text-sm font-medium text-[#2F5D8C]">
                    Ver articulación →
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {articulation.description}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}