import Link from 'next/link'

import { listOpportunityAssigneeOptions } from '../../../lib/opportunities/detail'
import { listProjects } from '../../../lib/projects/projects'
import { ProjectCreationForm } from './project-forms'

export const dynamic = 'force-dynamic'

const statusLabels = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

export default async function ProjectsPage() {
  const [projects, assigneeOptions] =
    await Promise.all([
      listProjects(),
      listOpportunityAssigneeOptions(),
    ])

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
          Proyectos
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Proyectos
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Un proyecto es una unidad de trabajo autónoma.
          Puede comenzar por sí mismo y luego incorporar
          personas, organizaciones, oportunidades,
          articulaciones, capacidades y otros recursos.
        </p>
      </section>

      <ProjectCreationForm
        assigneeOptions={assigneeOptions}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">
            Proyectos registrados
          </h2>

          <span className="text-sm text-slate-500">
            {projects.length}
          </span>
        </div>

        {projects.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {projects.map((project) => (
              <Link
                key={project.project_id}
                href={`/panel/proyectos/${project.project_id}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#2F5D8C]/40 hover:bg-white"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-slate-950">
                    {project.title}
                  </strong>

                  <span className="text-sm text-slate-600">
                    {statusLabels[project.status]}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-slate-700">
                  {project.objective}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  Responsable:{' '}
                  {project.responsible_display_name ??
                    'Sin asignar'}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Los vínculos con oportunidades y articulaciones
                  se gestionan desde la ficha.
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Todavía no hay proyectos registrados.
          </p>
        )}
      </section>
    </div>
  )
}
