import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  canManageOrganizations,
  canValidateOrganizationNodeLinks,
  listOrganizationTypeOptions,
} from '../../../../lib/organizations/manage'
import {
  getCanonicalOrganizationProfile,
  type OrganizationNode,
} from '../../../../lib/organizations/profile'
import { createClient } from '../../../../lib/supabase/server'
import { OrganizationNodeConfirmationForm } from './organization-node-confirmation-form'
import { OrganizationNodeLinkForm } from './organization-node-link-form'
import { OrganizationNodeLinkDetailsForm } from './organization-node-link-details-form'
import { OrganizationTypeProposalResolutionForm } from './organization-type-proposal-resolution-form'

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
    candidate: 'Pendiente de validación',
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    rejected: 'Rechazada',
  }

  return labels[value] ?? value
}

function verificationBadgeClass(value: string) {
  const classes: Record<string, string> = {
    pending:
      'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    confirmed:
      'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
    rejected:
      'bg-red-100 text-red-700 ring-1 ring-red-200',
    self_reported:
      'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
    candidate:
      'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200',
  }

  return [
    'rounded-full px-2.5 py-1 text-xs font-semibold',
    classes[value] ??
      'bg-white text-slate-700 ring-1 ring-slate-200',
  ].join(' ')
}

function OrganizationNodeCard({
  organizationId,
  node,
  canEditDetails,
  canConfirm,
}: {
  organizationId: string
  node: OrganizationNode
  canEditDetails: boolean
  canConfirm: boolean
}) {
  const isPending =
    node.verification_status === 'pending'

  return (
    <article
      className={
        isPending
          ? 'rounded-xl border border-amber-200 bg-amber-50/70 p-3 shadow-sm sm:p-4 sm:shadow-none'
          : 'rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold text-slate-950">
            {node.node_name}
          </p>

          {node.node_number !== null ? (
            <p className="mt-1 text-xs text-slate-500">
              Nodo {node.node_number}
            </p>
          ) : null}

          <Link
            href={`/panel/nodos/${node.node_id}`}
            className="mt-2 inline-flex min-h-10 items-center text-xs font-semibold text-[#2F5D8C] hover:underline"
          >
            Ver nodo
          </Link>
        </div>

        <span
          className={verificationBadgeClass(
            node.verification_status
          )}
        >
          {verificationLabel(
            node.verification_status
          )}
        </span>
      </div>

      <dl className="mt-4 grid gap-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Evidencia o justificación
          </dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
            {node.evidence_text?.trim()
              ? node.evidence_text
              : 'Sin evidencia registrada.'}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Fecha de inicio
          </dt>
          <dd className="mt-1 text-sm text-slate-700">
            {node.started_on
              ? node.started_on
              : 'Fecha de inicio no informada.'}
          </dd>
        </div>
      </dl>

      {node.source_name ? (
        <p className="mt-2 break-words text-xs text-slate-500">
          Fuente: {node.source_name}
        </p>
      ) : null}

      {isPending && canEditDetails ? (
        <OrganizationNodeLinkDetailsForm
          organizationId={organizationId}
          nodeId={node.node_id}
          initialEvidenceText={
            node.evidence_text
          }
          initialStartedOn={node.started_on}
        />
      ) : null}

      {isPending && canConfirm ? (
        <OrganizationNodeConfirmationForm
          organizationId={organizationId}
          nodeId={node.node_id}
        />
      ) : null}
    </article>
  )
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
    typeProposals,
  } = profile

  const canManage =
    canManageOrganizations(access)

  const canConfirmLinks =
    canValidateOrganizationNodeLinks(access)

  const pendingNodes = nodes.filter(
    (node) =>
      node.verification_status === 'pending'
  )

  const confirmedNodes = nodes.filter(
    (node) =>
      node.verification_status === 'confirmed'
  )

  const otherNodes = nodes.filter(
    (node) =>
      node.verification_status !== 'pending' &&
      node.verification_status !== 'confirmed'
  )

  const pendingTypeProposal =
    typeProposals.find(
      (proposal) =>
        proposal.status === 'pending'
    ) ?? null

  const organizationTypes =
    canManage && pendingTypeProposal
      ? await listOrganizationTypeOptions()
      : []

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
          Organización
        </p>

        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl">
            {organization.display_name}
          </h1>

          <span className="rounded-full bg-[#EAF0F7] px-3 py-1 text-xs font-semibold text-[#1E3A5F] md:bg-white/15 md:text-blue-50">
            {organization.organization_type_name}
          </span>
        </div>

        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600 md:mt-3 md:text-blue-50">
          Registro canónico de la organización. Sus
          vínculos territoriales y capacidades conservan
          estados de validación independientes.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {organization.confirmed_node_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Nodos confirmados
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {organization.capability_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Capacidades relevadas
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {organization.confirmed_capability_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Capacidades confirmadas
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {organization.articulation_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Articulaciones
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="break-words text-lg font-semibold text-slate-950">
          Identidad institucional
        </h2>

        <dl className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nombre
            </dt>
            <dd className="mt-1 break-words font-semibold text-slate-900">
              {organization.display_name}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tipo
            </dt>
            <dd className="mt-1 break-words text-sm text-slate-700">
              {organization.organization_type_name}
            </dd>
          </div>
        </dl>

        {pendingTypeProposal ? (
          <div className="mt-4 border-l-4 border-amber-300 bg-amber-50/70 px-3 py-3 sm:mt-5 sm:rounded-2xl sm:border sm:border-amber-200 sm:px-5 sm:py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Tipo propuesto
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="break-words font-semibold text-slate-950">
                {pendingTypeProposal.proposed_name}
              </p>

              <span className={verificationBadgeClass('pending')}>
                Pendiente de validación
              </span>
            </div>

            <p className="mt-2 break-words text-sm leading-6 text-amber-900">
              El tipo canónico vigente sigue siendo{' '}
              <strong>
                {organization.organization_type_name}
              </strong>
              .
            </p>

            {canManage ? (
              <OrganizationTypeProposalResolutionForm
                organizationId={organization.id}
                proposalId={pendingTypeProposal.id}
                proposal={pendingTypeProposal}
                organizationTypes={organizationTypes}
              />
            ) : null}
          </div>
        ) : null}

        {organization.notes ? (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Observaciones
            </p>
            <p className="mt-1 break-words text-sm leading-6 text-slate-700">
              {organization.notes}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="break-words text-lg font-semibold text-slate-950">
          Presencia territorial
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Una organización puede estar vinculada con más
          de un nodo. Cada vínculo conserva su propio
          estado de validación.
        </p>

        {canManage ? (
          <div className="mt-4 border-t border-slate-200 pt-4 sm:mt-5 sm:rounded-2xl sm:border sm:border-dashed sm:border-slate-300 sm:bg-slate-50 sm:p-5">
            <h3 className="break-words text-base font-semibold text-slate-950">
              Agregar otro vínculo territorial
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Usá este formulario únicamente para
              vincular la organización con otro nodo.
              El vínculo nuevo queda pendiente hasta una
              confirmación explícita.
            </p>

            <OrganizationNodeLinkForm
              organizationId={organization.id}
              linkedNodeIds={nodes.map(
                (node) => node.node_id
              )}
            />
          </div>
        ) : null}

        <div className="mt-5 space-y-5 sm:mt-6 sm:space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-semibold text-slate-950">
                Vínculos pendientes
              </h3>

              <span className={verificationBadgeClass('pending')}>
                Pendiente
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:gap-4 md:grid-cols-2">
              {pendingNodes.length === 0 ? (
                <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
                  No hay vínculos territoriales pendientes.
                </div>
              ) : (
                pendingNodes.map((node) => (
                  <OrganizationNodeCard
                    key={node.node_id}
                    organizationId={organization.id}
                    node={node}
                    canEditDetails={canConfirmLinks}
                    canConfirm={canConfirmLinks}
                  />
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-semibold text-slate-950">
                Vínculos confirmados
              </h3>

              <span className={verificationBadgeClass('confirmed')}>
                Confirmada
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:gap-4 md:grid-cols-2">
              {confirmedNodes.length === 0 ? (
                <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
                  No hay vínculos territoriales confirmados.
                </div>
              ) : (
                confirmedNodes.map((node) => (
                  <OrganizationNodeCard
                    key={node.node_id}
                    organizationId={organization.id}
                    node={node}
                    canEditDetails={false}
                    canConfirm={false}
                  />
                ))
              )}
            </div>
          </div>

          {otherNodes.length > 0 ? (
            <div>
              <h3 className="break-words text-base font-semibold text-slate-950">
                Otros estados
              </h3>

              <div className="mt-3 grid gap-3 sm:gap-4 md:grid-cols-2">
                {otherNodes.map((node) => (
                  <OrganizationNodeCard
                    key={node.node_id}
                    organizationId={organization.id}
                    node={node}
                    canEditDetails={false}
                    canConfirm={false}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="break-words text-lg font-semibold text-slate-950">
          Capacidades
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Capacidades institucionales generales o
          específicas de un nodo.
        </p>

        <div className="mt-4 space-y-3 sm:mt-5">
          {capabilities.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
              Capacidades organizacionales pendientes de
              registrar.
            </div>
          ) : (
            capabilities.map((capability) => (
              <article
                key={
                  capability.organization_capability_id
                }
                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-950">
                      {capability.capability_name}
                    </p>

                    {capability.category_name ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {capability.category_name}
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#2F5D8C]">
                    {verificationLabel(
                      capability.verification_status
                    )}
                  </span>
                </div>

                <p className="mt-3 break-words text-sm text-slate-600">
                  Alcance:{' '}
                  {capability.scope_node_name
                    ? capability.scope_node_name
                    : 'Institucional / general'}
                </p>

                {capability.notes ? (
                  <p className="mt-2 break-words text-sm leading-6 text-slate-600">
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

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="break-words text-lg font-semibold text-slate-950">
          Articulaciones
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Oportunidades o necesidades donde la
          organización figura como actor de origen.
        </p>

        <div className="mt-4 space-y-3 sm:mt-5">
          {articulations.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
              Articulaciones pendientes de registrar.
            </div>
          ) : (
            articulations.map((articulation) => (
              <Link
                key={articulation.opportunity_id}
                href={`/panel/oportunidades/${articulation.opportunity_id}`}
                className="block rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-[#2F5D8C]/40 sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none sm:hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-950">
                      {articulation.title}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-[#2F5D8C]">
                      {articulationKindLabel(
                        articulation.kind
                      )}
                    </p>
                  </div>

                  <span className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-[#2F5D8C]">
                    Ver articulación →
                  </span>
                </div>

                <p className="mt-3 break-words text-sm leading-6 text-slate-600">
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
