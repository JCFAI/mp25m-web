import Link from 'next/link'
import { notFound } from 'next/navigation'
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
  listProjectSourceParticipants,
} from '../../../../lib/projects/projects'
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
  const project = await getProject(id)

  if (!project) {
    notFound()
  }

  const [
    assigneeOptions,
    followups,
    participants,
    sourceParticipants,
    deliverables,
    opportunityLinks,
    articulationLinks,
    opportunities,
    articulations,
  ] = await Promise.all([
    listOpportunityAssigneeOptions(),
    listProjectFollowups(id),
    listProjectParticipants(id),
    listProjectSourceParticipants(id),
    listProjectDeliverables(id),
    listProjectOpportunityLinks(id),
    listProjectArticulationLinks(id),
    listOpportunities(),
    listArticulations(),
  ])

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
        opportunityOptions={opportunities.map(
          (opportunity) => ({
            id: opportunity.id,
            title: opportunity.title,
            status: opportunity.status,
          })
        )}
        articulationOptions={articulations.map(
          (articulation) => ({
            articulation_id:
              articulation.articulation_id,
            title: articulation.title,
            status: articulation.status,
          })
        )}
      />

      <ProjectOperationForms
        projectId={id}
        participants={participants}
        sourceParticipants={sourceParticipants}
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
