'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import type {
  OpportunityArticulation,
  OpportunityArticulationFollowup,
  OpportunityArticulationParticipant,
} from '../../../../lib/opportunities/articulations'
import type {
  OpportunityAssigneeOption,
  OpportunityOrigin,
} from '../../../../lib/opportunities/detail'
import {
  addOpportunityArticulationParticipantAction,
  createOpportunityArticulationAction,
  createOpportunityArticulationFollowupAction,
  removeOpportunityArticulationParticipantAction,
  transitionOpportunityArticulationAction,
  type ArticulationActionState,
} from './articulation-actions'

const initialState: ArticulationActionState = { status: 'idle', message: null }

const statusLabels = {
  draft: 'Borrador', active: 'Activa', follow_up: 'En seguimiento', paused: 'Pausada',
  closed_with_result: 'Cerrada con resultado', closed_without_result: 'Cerrada sin resultado', cancelled: 'Cancelada',
}

const followupLabels = {
  general: 'Novedad general', meeting: 'Reunión', commitment: 'Compromiso', contact: 'Contacto', result: 'Resultado',
}

function Feedback({ state }: { state: ArticulationActionState }) {
  return state.message ? <p className={`mt-3 text-sm ${state.status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{state.message}</p> : null
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function ParticipantRemovalForm({ opportunityId, articulationId, participant }: { opportunityId: string; articulationId: string; participant: OpportunityArticulationParticipant }) {
  const [state, formAction, pending] = useActionState(removeOpportunityArticulationParticipantAction.bind(null, opportunityId, articulationId, participant.participant_id), initialState)

  return <details className="mt-2">
    <summary className="cursor-pointer text-xs font-semibold text-slate-600">Retirar participante</summary>
    <form action={formAction} className="mt-2 flex flex-wrap gap-2">
      <input name="rationale" required minLength={3} maxLength={10000} placeholder="Motivo del retiro..." className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <button disabled={pending} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{pending ? 'Retirando...' : 'Retirar'}</button>
    </form>
    <Feedback state={state} />
  </details>
}

export function ArticulationControls({ opportunityId, articulation, participants, followups, assigneeOptions, participantOptions }: {
  opportunityId: string; articulation: OpportunityArticulation; participants: OpportunityArticulationParticipant[]; followups: OpportunityArticulationFollowup[]; assigneeOptions: OpportunityAssigneeOption[]; participantOptions: OpportunityOrigin[]
}) {
  const [transitionState, transitionAction, transitionPending] = useActionState(transitionOpportunityArticulationAction.bind(null, opportunityId, articulation.articulation_id), initialState)
  const [participantState, participantAction, participantPending] = useActionState(addOpportunityArticulationParticipantAction.bind(null, opportunityId, articulation.articulation_id), initialState)
  const [followupState, followupAction, followupPending] = useActionState(createOpportunityArticulationFollowupAction.bind(null, opportunityId, articulation.articulation_id), initialState)

  return <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-[#1E3A5F]">Actualizar estado y responsable</summary>
      <form action={transitionAction} className="border-t border-slate-200 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="status" defaultValue={articulation.status} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select name="responsible_internal_user_id" defaultValue={articulation.responsible_internal_user_id ?? ''} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Sin responsable</option>{assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.display_name}</option>)}</select>
        </div>
        <textarea name="rationale" required minLength={3} maxLength={10000} rows={2} placeholder="Motivo del cambio..." className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <textarea name="closing_summary" minLength={3} maxLength={10000} rows={2} defaultValue={articulation.closing_summary ?? ''} placeholder="Resumen de cierre (obligatorio al cerrar)..." className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <Feedback state={transitionState} />
        <button disabled={transitionPending} className="mt-3 rounded-lg bg-[#1E3A5F] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{transitionPending ? 'Actualizando...' : 'Actualizar articulación'}</button>
      </form>
    </details>

    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-[#1E3A5F]">Participantes ({participants.length})</summary>
      <div className="border-t border-slate-200 p-3">
        {participants.length ? <ul className="space-y-2">{participants.map((participant) => <li key={participant.participant_id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><strong>{participant.display_name}</strong> · {participant.participant_type === 'person' ? 'Persona' : 'Organización'}<p className="mt-1 text-xs text-slate-500">Incorporado por {participant.added_by_display_name} · {formatDateTime(participant.added_at)}</p><ParticipantRemovalForm opportunityId={opportunityId} articulationId={articulation.articulation_id} participant={participant} /></li>)}</ul> : <p className="text-sm text-slate-500">Todavía no hay participantes activos.</p>}
        <form action={participantAction} className="mt-3 border-t border-slate-200 pt-3">
          <select name="actor" required defaultValue="" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="" disabled>Elegir actor ya vinculado a la oportunidad...</option>{participantOptions.map((origin) => <option key={origin.origin_id} value={`${origin.actor_type}:${origin.actor_id}`}>{origin.display_name} · {origin.actor_type === 'person' ? 'Persona' : 'Organización'}</option>)}</select>
          <input name="rationale" required minLength={3} maxLength={10000} placeholder="Por qué participa..." className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <Feedback state={participantState} />
          <button disabled={participantPending || participantOptions.length === 0} className="mt-3 rounded-lg border border-[#2F5D8C] px-3 py-2 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50">{participantPending ? 'Incorporando...' : 'Incorporar participante'}</button>
        </form>
      </div>
    </details>

    <details className="rounded-lg border border-slate-200 bg-white">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-[#1E3A5F]">Novedades y seguimiento ({followups.length})</summary>
      <div className="border-t border-slate-200 p-3">
        {followups.length ? <ul className="space-y-2">{followups.map((followup) => <li key={followup.followup_id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><strong>{followupLabels[followup.followup_type]}</strong><p className="mt-1 whitespace-pre-line">{followup.detail}</p><p className="mt-1 text-xs text-slate-500">{followup.created_by_display_name} · {formatDateTime(followup.created_at)}</p></li>)}</ul> : <p className="text-sm text-slate-500">Todavía no hay novedades registradas.</p>}
        <form action={followupAction} className="mt-3 border-t border-slate-200 pt-3">
          <select name="followup_type" defaultValue="general" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{Object.entries(followupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <textarea name="detail" required minLength={3} maxLength={10000} rows={3} placeholder="Detalle de la novedad..." className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <Feedback state={followupState} />
          <button disabled={followupPending} className="mt-3 rounded-lg border border-[#2F5D8C] px-3 py-2 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50">{followupPending ? 'Registrando...' : 'Registrar novedad'}</button>
        </form>
      </div>
    </details>
  </div>
}

export function OpportunityArticulationsSection({ opportunityId, articulations, participants, followups, origins, canOperate, assigneeOptions }: {
  opportunityId: string; articulations: OpportunityArticulation[]; participants: OpportunityArticulationParticipant[]; followups: OpportunityArticulationFollowup[]; origins: OpportunityOrigin[]; canOperate: boolean; assigneeOptions: OpportunityAssigneeOption[]
}) {
  const [state, formAction, pending] = useActionState(createOpportunityArticulationAction.bind(null, opportunityId), initialState)
  const participantOptions = origins.filter((origin) => !origin.is_provisional && origin.actor_status === 'active' && (origin.actor_type === 'person' || origin.actor_type === 'organization'))

  return <section id="articulaciones" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-[#2F5D8C]">Articulaciones</p>
    <h2 className="mt-2 text-lg font-semibold text-slate-950">Coordinación posterior al análisis</h2>
    <p className="mt-2 text-sm text-slate-600">Registrar una articulación no confirma disponibilidad ni crea un proyecto.</p>
    {articulations.length ? <div className="mt-4 space-y-3">{articulations.map((articulation) => <article key={articulation.articulation_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="text-slate-900">{articulation.title}</strong><span className="text-sm text-slate-600">{statusLabels[articulation.status]}</span></div><p className="mt-2 text-sm text-slate-700">{articulation.objective}</p><p className="mt-2 text-xs text-slate-500">Responsable: {articulation.responsible_display_name ?? 'Sin asignar'} · Participantes: {articulation.participant_count}</p>{articulation.latest_followup_detail ? <p className="mt-2 text-xs text-slate-600">Última novedad: {articulation.latest_followup_detail}</p> : null}{articulation.status === 'closed_with_result' ? <Link href={`/panel/proyectos?articulation=${articulation.articulation_id}`} className="mt-3 inline-flex rounded-lg border border-[#2F5D8C] px-3 py-2 text-sm font-semibold text-[#1E3A5F]">Crear proyecto de ejecución</Link> : null}{canOperate ? <ArticulationControls opportunityId={opportunityId} articulation={articulation} participants={participants.filter((item) => item.articulation_id === articulation.articulation_id)} followups={followups.filter((item) => item.articulation_id === articulation.articulation_id)} assigneeOptions={assigneeOptions} participantOptions={participantOptions} /> : null}</article>)}</div> : <p className="mt-4 text-sm text-slate-500">Aún no hay articulaciones registradas.</p>}
    {canOperate ? <details id="iniciar-articulacion" open={articulations.length === 0} className="mt-5 scroll-mt-6 rounded-xl border border-slate-200"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#1E3A5F]">Iniciar articulación</summary><form action={formAction} className="border-t border-slate-200 p-4"><input name="title" required minLength={3} maxLength={200} placeholder="Título" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><textarea name="objective" required minLength={3} maxLength={10000} rows={3} placeholder="Objetivo de la articulación..." className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><select name="responsible_internal_user_id" className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">Sin responsable inicial</option>{assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.display_name}</option>)}</select><Feedback state={state} /><button disabled={pending} className="mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Guardando...' : 'Guardar borrador'}</button></form></details> : null}
  </section>
}
