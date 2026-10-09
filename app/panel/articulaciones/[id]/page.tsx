import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  canManageEconomicSource,
  getEconomicProfileCurrent,
  listEconomicProfileRevisions,
} from '../../../../lib/economics/economics'
import {
  canManageArticulation,
  getArticulation,
  listArticulationFollowups,
  listArticulationOpportunityLinks,
  listArticulationParticipants,
  listArticulationStatusHistory,
} from '../../../../lib/opportunities/articulations'
import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  listOpportunityAssigneeOptions,
} from '../../../../lib/opportunities/detail'
import { listProjectsByArticulation } from '../../../../lib/projects/projects'
import {
  listResultContributions,
  listResultContributorCandidates,
  listResultsForSource,
} from '../../../../lib/results/results'
import { createClient } from '../../../../lib/supabase/server'
import { EconomicSection } from '../../economia/economic-section'
import { ResultSection } from '../../resultados/result-section'
import { AutonomousArticulationControls } from '../articulation-controls'

const statusLabels = { draft: 'Borrador', active: 'Activa', follow_up: 'En seguimiento', paused: 'Pausada', closed_with_result: 'Cerrada con resultado', closed_without_result: 'Cerrada sin resultado', cancelled: 'Cancelada' }
const followupLabels = { general: 'Novedad general', meeting: 'Reunión', commitment: 'Compromiso', contact: 'Contacto', result: 'Resultado' }

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export default async function ArticulationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const articulation = await getArticulation(id)
  if (!articulation) notFound()

  const [
    articulationParticipants,
    articulationFollowups,
    articulationStatusHistory,
    opportunityLinks,
    supabase,
    assigneeOptions,
    linkedProjects,
    results,
    resultCandidates,
  ] = await Promise.all([
    listArticulationParticipants(id),
    listArticulationFollowups(id),
    listArticulationStatusHistory(id),
    listArticulationOpportunityLinks(id),
    createClient(),
    listOpportunityAssigneeOptions(),
    listProjectsByArticulation(id),
    listResultsForSource('articulation', id),
    listResultContributorCandidates('articulation', id),
  ])

  const resultContributions =
    await listResultContributions(
      results.map((result) => result.result_id),
    )
  const { data: claimsData } = await supabase.auth.getClaims()
  const authUserId = claimsData?.claims?.sub
  const access = authUserId ? await getInternalAccess(authUserId) : []

  const canManage = await canManageArticulation(
    access,
    articulation.articulation_id,
  )

  const canManageEconomics =
    await canManageEconomicSource(
      access,
      'articulation',
      id,
    )

  const economicData =
    canManageEconomics
      ? await Promise.all([
          getEconomicProfileCurrent(
            'articulation',
            id,
          ),
          listEconomicProfileRevisions(
            'articulation',
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
      <Link href="/panel/articulaciones" className="text-sm font-semibold text-[#2F5D8C] hover:underline">
        ← Volver a articulaciones
      </Link>
      <section data-tour="articulation-summary" className="rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100/75">Articulación</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{articulation.title}</h1>
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{statusLabels[articulation.status]}</span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-100">{articulation.objective}</p>
        <p className="mt-4 text-sm text-sky-100">Responsable: {articulation.responsible_display_name ?? 'Sin asignar'}</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Contexto y vínculos</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Esta articulación tiene participantes, seguimiento y cierre propios. Puede existir de forma
          independiente y vincularse con ninguna, una o varias oportunidades y proyectos.
          La articulación no necesita estar cerrada para vincularse.
        </p>
        <Link href="/panel/proyectos" className="mt-4 inline-flex rounded-xl border border-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] hover:bg-slate-50">
          Ir a proyectos
        </Link>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">Oportunidades vinculadas ({opportunityLinks.length})</h3>
          {opportunityLinks.length ? (
            <ul className="mt-3 space-y-2">
              {opportunityLinks.map((link) => (
                <li key={link.link_id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Link href={`/panel/oportunidades/${link.opportunity_id}`} className="text-sm font-semibold text-[#1E3A5F] hover:underline">
                    {link.opportunity_title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">{{ origin: 'Origen', context: 'Contexto', related: 'Relacionada' }[link.relation_type]}</p>
                  {link.relationship_note ? <p className="mt-1 text-sm text-slate-600">{link.relationship_note}</p> : null}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-slate-500">No hay oportunidades vinculadas. La articulación puede gestionarse de forma independiente.</p>}
        </div>
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">Proyectos vinculados ({linkedProjects.length})</h3>
          {linkedProjects.length ? (
            <div className="mt-3 grid gap-2">
              {linkedProjects.map((project) => (
                <Link key={project.project_id} href={`/panel/proyectos/${project.project_id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-[#1E3A5F] hover:border-[#2F5D8C]/40">
                  {project.title}
                </Link>
              ))}
            </div>
          ) : <p className="mt-4 text-sm text-slate-500">Todavía no hay proyectos vinculados a esta articulación.</p>}
        </div>
      </section>
      <section data-tour="articulation-history" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Historial de estados
        </h2>
        {articulationStatusHistory.length ? (
          <ol className="mt-4 space-y-3">
            {articulationStatusHistory.map((item) => (
              <li
                key={item.history_id}
                className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{statusLabels[item.status]}</strong>
                  <time className="text-xs text-slate-500">
                    {formatDateTime(item.changed_at)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Transición {item.transition_no}
                  {' · '}
                  Responsable:{' '}
                  {item.responsible_display_name ?? 'Sin asignar'}
                  {' · '}
                  Registró:{' '}
                  {item.changed_by_display_name}
                </p>
                <p className="mt-2 whitespace-pre-line">
                  {item.rationale}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Todavía no hay cambios de estado registrados.
          </p>
        )}
      </section>
      {canManage ? (
        <AutonomousArticulationControls
          articulation={articulation}
          participants={articulationParticipants}
          opportunityLinks={opportunityLinks}
          assigneeOptions={assigneeOptions}
        />
      ) : null}
      {canManageEconomics ? (
      <EconomicSection
        sourceType="articulation"
        sourceId={id}
        profile={economicProfile}
        history={economicHistory}
        canManage={canManageEconomics}
      />
      ) : null}

      <ResultSection
        sourceType="articulation"
        sourceId={id}
        results={results}
        contributions={resultContributions}
        candidates={resultCandidates}
        canManage={canManage}
      />

      <section data-tour="articulation-participants" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Participantes ({articulationParticipants.length})</h2>
        {articulationParticipants.length ? (
          <ul className="mt-4 space-y-3">
            {articulationParticipants.map((participant) => (
              <li key={participant.participant_id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                {participant.participant_type === 'person' && participant.person_id ? (
                  <Link
                    href={`/panel/personas/${participant.person_id}`}
                    className="font-semibold text-[#1E3A5F] hover:underline"
                  >
                    {participant.display_name}
                  </Link>
                ) : participant.participant_type === 'organization' && participant.organization_id ? (
                  <Link
                    href={`/panel/organizaciones/${participant.organization_id}`}
                    className="font-semibold text-[#1E3A5F] hover:underline"
                  >
                    {participant.display_name}
                  </Link>
                ) : (
                  <strong>{participant.display_name}</strong>
                )}{' · '}
                {participant.participant_type === 'person' ? 'Persona' : 'Organización'}
                <p className="mt-1 text-slate-600">{participant.rationale}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-slate-500">Todavía no hay participantes incorporados.</p>}
      </section>
      <section data-tour="articulation-followups" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Novedades y seguimiento</h2>
        {articulationFollowups.length ? (
          <ul className="mt-4 space-y-3">
            {articulationFollowups.map((followup) => (
              <li key={followup.followup_id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <strong>{followupLabels[followup.followup_type]}</strong>
                <p className="mt-1 whitespace-pre-line">{followup.detail}</p>
                <p className="mt-2 text-xs text-slate-500">{followup.created_by_display_name} · {formatDateTime(followup.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-slate-500">Todavía no hay novedades registradas.</p>}
        {articulation.closing_summary ? (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-semibold">Resumen de cierre</p>
            <p className="mt-1 whitespace-pre-line">{articulation.closing_summary}</p>
          </div>
        ) : null}
      </section>
    </div>
  )
}
