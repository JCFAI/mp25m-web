'use client'

import { useActionState, type ReactNode } from 'react'
import type { OpportunityAssigneeOption } from '../../../lib/opportunities/detail'
import type {
  ArticulationOpportunityLink, OpportunityArticulation, OpportunityArticulationParticipant,
} from '../../../lib/opportunities/articulations'
import {
  addArticulationParticipantAction, createArticulationFollowupAction,
  linkArticulationOpportunityAction, removeArticulationParticipantAction,
  transitionArticulationAction, unlinkArticulationOpportunityAction,
  type ArticulationActionState,
} from './actions'
import { ArticulationReferencePicker } from './articulation-reference-picker'

const initialState: ArticulationActionState = { status: 'idle', message: null }
const inputClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm'
const statusLabels = { draft: 'Borrador', active: 'Activa', follow_up: 'En seguimiento', paused: 'Pausada', closed_with_result: 'Cerrada con resultado', closed_without_result: 'Cerrada sin resultado', cancelled: 'Cancelada' }
const followupLabels = { general: 'Novedad general', meeting: 'Reunión', commitment: 'Compromiso', contact: 'Contacto', result: 'Resultado' }

type Action = (state: ArticulationActionState, data: FormData) => Promise<ArticulationActionState>

function ActionForm({ action, label, children, tourId }: { action: Action; label: string; children: ReactNode; tourId?: string }) {
  const [state, submit, pending] = useActionState(action, initialState)
  return <form data-tour={tourId} action={submit} className="space-y-3 rounded-xl border border-slate-200 p-4">
    <fieldset disabled={pending} className="space-y-3">
      <legend className="mb-3 font-semibold text-slate-900">{label}</legend>
      {children}
      <button disabled={pending} className="ux-button rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? 'Guardando...' : label}
      </button>
    </fieldset>
    <p role="status" aria-live="polite" className={`text-sm ${state.status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>
      {pending ? 'Guardando...' : state.message}
    </p>
  </form>
}

function Reason() {
  return <label className="block text-sm">Motivo
    <textarea name="rationale" required minLength={3} maxLength={10000} rows={2} className={inputClass} />
  </label>
}

export function AutonomousArticulationControls({ articulation, participants, opportunityLinks, assigneeOptions }: {
  articulation: OpportunityArticulation
  participants: OpportunityArticulationParticipant[]
  opportunityLinks: ArticulationOpportunityLink[]
  assigneeOptions: OpportunityAssigneeOption[]
}) {
  const id = articulation.articulation_id
  return <section data-tour="articulation-management" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-semibold">Gestionar articulación</h2>
    <div className="grid gap-4 lg:grid-cols-2">
      <ActionForm
        key={`transition-${articulation.updated_at}`}
        action={transitionArticulationAction.bind(null, id)}
        tourId="articulation-status"
        label="Actualizar estado y responsable"
      >
        <label className="block text-sm">Estado<select name="status" defaultValue={articulation.status} className={inputClass}>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="block text-sm">Responsable<select name="responsible_internal_user_id" defaultValue={articulation.responsible_internal_user_id ?? ''} className={inputClass}>
          <option value="">Sin asignar</option>
          {assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.display_name}</option>)}
        </select></label>
        <Reason />
        <label className="block text-sm">Resumen de cierre (cuando corresponda)
          <textarea name="closing_summary" defaultValue={articulation.closing_summary ?? ''} maxLength={10000} rows={3} className={inputClass} />
        </label>
      </ActionForm>
      <ActionForm action={createArticulationFollowupAction.bind(null, id)} tourId="articulation-followup" label="Registrar seguimiento">
        <label className="block text-sm">Tipo<select name="followup_type" className={inputClass}>
          {Object.entries(followupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label className="block text-sm">Detalle<textarea name="detail" required minLength={3} maxLength={10000} rows={4} className={inputClass} /></label>
      </ActionForm>
      <ActionForm action={addArticulationParticipantAction.bind(null, id)} tourId="articulation-participant-action" label="Agregar participante">
        <ArticulationReferencePicker key={participants.map((item) => item.participant_id).join(',')} kind="actor" />
        <Reason />
      </ActionForm>
      <ActionForm key={opportunityLinks.map((link) => link.link_id).join(',')} action={linkArticulationOpportunityAction.bind(null, id)} label="Vincular oportunidad">
        <ArticulationReferencePicker kind="opportunity" excludedIds={opportunityLinks.map((link) => link.opportunity_id)} />
        <label className="block text-sm">Tipo de vínculo<select name="relation_type" defaultValue="related" className={inputClass}>
          <option value="origin">Origen</option><option value="context">Contexto</option><option value="related">Relacionada</option>
        </select></label>
        <label className="block text-sm">Nota del vínculo (opcional)<textarea name="relationship_note" maxLength={10000} rows={2} className={inputClass} /></label>
      </ActionForm>
    </div>
    {participants.map((participant) => <details key={participant.participant_id}>
      <summary className="cursor-pointer text-sm font-semibold">Retirar a {participant.display_name}</summary>
      <ActionForm action={removeArticulationParticipantAction.bind(null, id, participant.participant_id)} label="Confirmar retiro"><Reason /></ActionForm>
    </details>)}
    {opportunityLinks.map((link) => <details key={link.link_id}>
      <summary className="cursor-pointer text-sm font-semibold">Desvincular {link.opportunity_title}</summary>
      <ActionForm action={unlinkArticulationOpportunityAction.bind(null, id, link.opportunity_id)} label="Confirmar desvinculación"><Reason /></ActionForm>
    </details>)}
  </section>
}
