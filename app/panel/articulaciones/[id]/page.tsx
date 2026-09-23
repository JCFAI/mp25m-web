import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  getArticulation,
  listOpportunityArticulationFollowups,
  listOpportunityArticulationParticipants,
} from '../../../../lib/opportunities/articulations'
import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  canManageOpportunity,
  getOpportunityDetail,
  listOpportunityAssigneeOptions,
} from '../../../../lib/opportunities/detail'
import { getProjectBySourceArticulation } from '../../../../lib/projects/projects'
import { createClient } from '../../../../lib/supabase/server'
import { ArticulationControls } from '../../oportunidades/[id]/opportunity-articulations-section'

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
  const [supabase, opportunityDetail, assigneeOptions, derivedProject] = await Promise.all([
    createClient(),
    getOpportunityDetail(articulation.opportunity_id),
    listOpportunityAssigneeOptions(),
    getProjectBySourceArticulation(articulation.articulation_id),
  ])
  const { data: claimsData } = await supabase.auth.getClaims()
  const authUserId = claimsData?.claims?.sub
  const access = authUserId ? await getInternalAccess(authUserId) : []
  const participantOptions = (opportunityDetail?.origins ?? []).filter((origin) => !origin.is_provisional && origin.actor_status === 'active' && (origin.actor_type === 'person' || origin.actor_type === 'organization'))

  return <div className="space-y-6"><Link href="/panel/articulaciones" className="text-sm font-semibold text-[#2F5D8C] hover:underline">← Volver a articulaciones</Link><section className="rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100/75">Articulación</p><div className="mt-3 flex flex-wrap items-start justify-between gap-3"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{articulation.title}</h1><span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{statusLabels[articulation.status]}</span></div><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100">{articulation.objective}</p><p className="mt-4 text-sm text-sky-100">Responsable: {articulation.responsible_display_name ?? 'Sin asignar'}</p></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-950">Contexto</h2><p className="mt-2 text-sm leading-6 text-slate-600">Esta articulación conserva una oportunidad de origen, pero tiene participantes, seguimiento y cierre propios. Puede derivar en un proyecto sin dejar de existir como articulación autónoma.</p><div className="mt-4 flex flex-wrap gap-3"><Link href={`/panel/oportunidades/${articulation.opportunity_id}`} className="inline-flex rounded-xl border border-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] hover:bg-slate-50">Ver oportunidad de origen</Link>{derivedProject ? <Link href={`/panel/proyectos/${derivedProject.project_id}`} className="inline-flex rounded-xl border border-[#2F5D8C] bg-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#244d76]">Ver proyecto derivado: {derivedProject.title}</Link> : null}</div></section>{canManageOpportunity(access) ? <ArticulationControls opportunityId={articulation.opportunity_id} articulation={articulation} participants={articulationParticipants} followups={articulationFollowups} assigneeOptions={assigneeOptions} participantOptions={participantOptions} /> : null}<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-950">Participantes ({articulationParticipants.length})</h2>{articulationParticipants.length ? <ul className="mt-4 space-y-3">{articulationParticipants.map((participant) => <li key={participant.participant_id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>{participant.display_name}</strong> · {participant.participant_type === 'person' ? 'Persona' : 'Organización'}<p className="mt-1 text-slate-600">{participant.rationale}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Todavía no hay participantes incorporados.</p>}</section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-950">Novedades y seguimiento</h2>{articulationFollowups.length ? <ul className="mt-4 space-y-3">{articulationFollowups.map((followup) => <li key={followup.followup_id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>{followupLabels[followup.followup_type]}</strong><p className="mt-1 whitespace-pre-line">{followup.detail}</p><p className="mt-2 text-xs text-slate-500">{followup.created_by_display_name} · {formatDateTime(followup.created_at)}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Todavía no hay novedades registradas.</p>}{articulation.closing_summary ? <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">Resumen de cierre</p><p className="mt-1 whitespace-pre-line">{articulation.closing_summary}</p></div> : null}</section></div>
}
