import Link from 'next/link'
import { listArticulations } from '../../../lib/opportunities/articulations'

export const dynamic = 'force-dynamic'

const statusLabels = {
  draft: 'Borrador',
  active: 'Activa',
  follow_up: 'En seguimiento',
  paused: 'Pausada',
  closed_with_result: 'Cerrada con resultado',
  closed_without_result: 'Cerrada sin resultado',
  cancelled: 'Cancelada',
}

export default async function ArticulationsPage() {
  const articulations = await listArticulations()

  return <div className="space-y-6"><section><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">Articulaciones</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Coordinación operativa</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Las articulaciones organizan actores, acuerdos y seguimiento posteriores al análisis de una oportunidad. No son la oportunidad ni crean proyectos automáticamente.</p></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-baseline justify-between gap-3"><h2 className="text-lg font-semibold text-slate-950">Articulaciones registradas</h2><span className="text-sm text-slate-500">{articulations.length}</span></div>{articulations.length ? <div className="mt-4 grid gap-3 lg:grid-cols-2">{articulations.map((articulation) => <article key={articulation.articulation_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold text-slate-950">{articulation.title}</h3><span className="text-sm text-slate-600">{statusLabels[articulation.status]}</span></div><p className="mt-2 line-clamp-2 text-sm text-slate-700">{articulation.objective}</p><p className="mt-3 text-xs text-slate-500">Responsable: {articulation.responsible_display_name ?? 'Sin asignar'} · Participantes: {articulation.participant_count}</p><Link href={`/panel/articulaciones/${articulation.articulation_id}`} className="mt-3 inline-flex text-sm font-semibold text-[#2F5D8C] hover:underline">Ver articulación →</Link></article>)}</div> : <p className="mt-4 text-sm text-slate-500">Aún no hay articulaciones registradas. Podés crear una desde la ficha de una oportunidad analizada.</p>}</section></div>
}
