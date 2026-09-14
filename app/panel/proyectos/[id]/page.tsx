import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listOpportunityAssigneeOptions } from '../../../../lib/opportunities/detail'
import { getProject, listProjectFollowups } from '../../../../lib/projects/projects'
import { ProjectDetailForms } from '../project-forms'

export const dynamic = 'force-dynamic'
const statusLabels = { draft: 'Borrador', active: 'Activo', paused: 'Pausado', completed: 'Completado', cancelled: 'Cancelado' }

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [project, assigneeOptions] = await Promise.all([getProject(id), listOpportunityAssigneeOptions()])
  if (!project) notFound()
  const followups = await listProjectFollowups(id)
  return <div className="space-y-6"><Link href="/panel/proyectos" className="text-sm font-semibold text-[#2F5D8C] hover:underline">← Volver a proyectos</Link><section className="rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100/75">Proyecto de ejecución</p><div className="mt-3 flex flex-wrap items-start justify-between gap-3"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{project.title}</h1><span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{statusLabels[project.status]}</span></div><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100">{project.objective}</p><p className="mt-4 text-sm text-sky-100">Responsable: {project.responsible_display_name ?? 'Sin asignar'} · Fuente: <Link href={`/panel/oportunidades/${project.opportunity_id}`} className="font-semibold underline">{project.source_articulation_title}</Link></p></section><ProjectDetailForms project={project} followups={followups} assigneeOptions={assigneeOptions} /></div>
}
