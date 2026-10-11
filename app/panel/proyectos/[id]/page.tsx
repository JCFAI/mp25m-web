import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { isBasicParticipantAccess } from '../../../../lib/auth/basic-participant'
import {
  canManageEconomicSource,
  getEconomicProfileCurrent,
  listEconomicProfileRevisions,
} from '../../../../lib/economics/economics'
import {
  listArticulations,
} from '../../../../lib/opportunities/articulations'
import {
  listOpportunityAssigneeOptions,
} from '../../../../lib/opportunities/detail'
import {
  listOpportunities,
} from '../../../../lib/opportunities/server'
import {
  getProject,
  listProjectArticulationLinks,
  listProjectDeliverables,
  listProjectFollowups,
  listProjectOpportunityLinks,
  listProjectParticipants,
} from '../../../../lib/projects/projects'
import {
  canManageResultSource,
  listResultContributions,
  listResultContributorCandidates,
  listResultsForSource,
} from '../../../../lib/results/results'
import { isReleaseModuleEnabled } from '../../../../lib/release-stage'
import { createClient } from '../../../../lib/supabase/server'
import { EconomicSection } from '../../economia/economic-section'
import { ResultSection } from '../../resultados/result-section'
import { ProjectDetailForms } from '../project-forms'
import { ProjectLinks } from '../project-links'
import { ProjectOperationForms } from '../project-operation-forms'

export const dynamic = 'force-dynamic'

const statusLabels = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // Authorize the profile before fetching any project data.
  const authClient = await createClient()
  const { data: initialClaims } = await authClient.auth.getClaims()
  if (!initialClaims?.claims?.sub) redirect('/login')
  const initialAccess = await getInternalAccess(initialClaims.claims.sub)
  if (isBasicParticipantAccess(initialAccess)) notFound()

  const project = await getProject(id)

  if (!project) {
    notFound()
  }

  const resultsEnabled = isReleaseModuleEnabled('results')
  const economicsEnabled = isReleaseModuleEnabled('economics')

  const [
    assigneeOptions,
    followups,
    participants,
    deliverables,
    opportunityLinks,
    articulationLinks,
    opportunities,
    articulations,
    results,
    resultCandidates,
    supabase,
  ] = await Promise.all([
    listOpportunityAssigneeOptions(),
    listProjectFollowups(id),
    listProjectParticipants(id),
    listProjectDeliverables(id),
    listProjectOpportunityLinks(id),
    listProjectArticulationLinks(id),
    listOpportunities(),
    listArticulations(),
    resultsEnabled ? listResultsForSource('project', id) : Promise.resolve([]),
    resultsEnabled ? listResultContributorCandidates('project', id) : Promise.resolve([]),
    createClient(),
  ])

  const resultContributions =
    resultsEnabled
      ? await listResultContributions(
          results.map((result) => result.result_id),
        )
      : []

  const { data: claimsData } =
    await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  const access =
    authUserId
      ? await getInternalAccess(authUserId)
      : []

  const canManageResults =
    resultsEnabled && await canManageResultSource(
      access,
      'project',
      id,
    )

  const canManageEconomics =
    economicsEnabled && await canManageEconomicSource(
      access,
      'project',
      id,
    )

  const economicData =
    canManageEconomics
      ? await Promise.all([
          getEconomicProfileCurrent(
            'project',
            id,
          ),
          listEconomicProfileRevisions(
            'project',
            id,
          ),
        ])
      : null

  const economicProfile =
    economicData?.[0] ?? null

  const economicHistory =
    economicData?.[1] ?? []

  return (
    <div className="space-y-6">
      <Link
        href="/panel/proyectos"
        className="text-sm font-semibold text-[#2F5D8C] hover:underline"
      >
        ← Volver a proyectos
      </Link>

      <section className="rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100/75">
          Proyecto
        </p>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {project.title}
          </h1>

          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
            {statusLabels[project.status]}
          </span>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100">
          {project.objective}
        </p>

        <div className="mt-4 space-y-1 text-sm text-sky-100">
          <p>
            Responsable:{' '}
            {project.responsible_display_name ??
              'Sin asignar'}
          </p>

          <p>
            Vínculos:{' '}
            {opportunityLinks.length}{' '}
            {opportunityLinks.length === 1
              ? 'oportunidad'
              : 'oportunidades'}
            {' · '}
            {articulationLinks.length}{' '}
            {articulationLinks.length === 1
              ? 'articulación'
              : 'articulaciones'}
          </p>

          {opportunityLinks.length === 0 &&
          articulationLinks.length === 0 ? (
            <p className="text-sky-100/80">
              Proyecto autónomo · todavía sin
              oportunidades ni articulaciones vinculadas.
            </p>
          ) : null}
        </div>
      </section>

      <ProjectLinks
        projectId={id}
        opportunityLinks={opportunityLinks}
        articulationLinks={articulationLinks}
        opportunityOptions={opportunities
          .filter(
            (opportunity) =>
              opportunity.status !== 'discarded'
          )
          .map((opportunity) => ({
            id: opportunity.id,
            title: opportunity.title,
            status: opportunity.status,
          }))}
        articulationOptions={articulations.map(
          (articulation) => ({
            articulation_id:
              articulation.articulation_id,
            title: articulation.title,
            status: articulation.status,
          })
        )}
      />

      {canManageEconomics ? (
      <EconomicSection
        sourceType="project"
        sourceId={id}
        profile={economicProfile}
        history={economicHistory}
        canManage={canManageEconomics}
      />
      ) : null}

      {resultsEnabled ? (
      <ResultSection
        sourceType="project"
        sourceId={id}
        results={results}
        contributions={resultContributions}
        candidates={resultCandidates}
        canManage={canManageResults}
      />
      ) : null}

      <ProjectOperationForms
        projectId={id}
        participants={participants}
        deliverables={deliverables}
        assigneeOptions={assigneeOptions}
      />

      <ProjectDetailForms
        project={project}
        followups={followups}
        assigneeOptions={assigneeOptions}
      />
    </div>
  )
}
