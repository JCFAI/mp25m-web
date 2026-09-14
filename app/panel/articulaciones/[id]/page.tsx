import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  getArticulation,
  listOpportunityArticulationFollowups,
  listOpportunityArticulationParticipants,
} from '../../../../lib/opportunities/articulations'

const statusLabels = { draft: 'Borrador', active: 'Activa', follow_up: 'En seguimiento', paused: 'Pausada', closed_with_result: 'Cerrada con resultado', closed_without_result: 'Cerrada sin resultado', cancelled: 'Cancelada' }
const followupLabels = { general: 'Novedad general', meeting: 'Reunión', commitment: 'Compromiso', contact: 'Contacto', result: 'Resultado' }

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default async function ArticulationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const articulation = await getArticulation(id)
  if (!articulation) notFound()

  const [participants, followups] = await Promise.all([
    listOpportunityArticulationParticipants(articulation.opportunity_id),
    listOpportunityArticulationFollowups(articulation.opportunity_id),
  ])
  const articulationParticipants = participants.filter((participant) => participant.articulation_id === articulation.articulation_id)
  const articulationFollowups = followups.filter((followup) => followup.articulation_id === articulation.articulation_id)

  return <div className="space-y-6"><Link href="/panel/articulaciones" className="text-sm font-semibold text-[#2F5D8C] hover:underline">← Volver a articulaciones</Link><section className="rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100/75">Articulación</p><div className="mt-3 flex flex-wrap items-start justify-between gap-3"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{articulation.title}</h1><span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{statusLabels[articulation.status]}</span></div><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100">{articulation.objective}</p><p className="mt-4 text-sm text-sky-100">Responsable: {articulation.responsible_display_name ?? 'Sin asignar'}</p></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-950">Contexto y gestión</h2><p className="mt-2 text-sm leading-6 text-slate-600">Esta articulación conserva una oportunidad de origen, pero tiene participantes, seguimiento y cierre propios. Gestionarla no modifica automáticamente el análisis ni el estado de esa oportunidad.</p><Link href={`/panel/oportunidades/${articulation.opportunity_id}`} className="mt-4 inline-flex rounded-xl border border-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] hover:bg-slate-50">Gestionar en la oportunidad de origen</Link></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-950">Participantes ({articulationParticipants.length})</h2>{articulationParticipants.length ? <ul className="mt-4 space-y-3">{articulationParticipants.map((participant) => <li key={participant.participant_id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>{participant.display_name}</strong> · {participant.participant_type === 'person' ? 'Persona' : 'Organización'}<p className="mt-1 text-slate-600">{participant.rationale}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Todavía no hay participantes incorporados.</p>}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-950">Novedades y seguimiento</h2>{articulationFollowups.length ? <ul className="mt-4 space-y-3">{articulationFollowups.map((followup) => <li key={followup.followup_id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>{followupLabels[followup.followup_type]}</strong><p className="mt-1 whitespace-pre-line">{followup.detail}</p><p className="mt-2 text-xs text-slate-500">{followup.created_by_display_name} · {formatDateTime(followup.created_at)}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Todavía no hay novedades registradas.</p>}{articulation.closing_summary ? <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">Resumen de cierre</p><p className="mt-1 whitespace-pre-line">{articulation.closing_summary}</p></div> : null}</section></div>
}
