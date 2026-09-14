'use client'

import { useActionState } from 'react'
import type { OpportunityAssigneeOption } from '../../../lib/opportunities/detail'
import type { Project, ProjectFollowup, ProjectSourceArticulation } from '../../../lib/projects/projects'
import { createProjectAction, createProjectFollowupAction, transitionProjectAction, type ProjectActionState } from './actions'

const initialState: ProjectActionState = { status: 'idle', message: null }
const statusLabels = { draft: 'Borrador', active: 'Activo', paused: 'Pausado', completed: 'Completado', cancelled: 'Cancelado' }
const followupLabels = { general: 'Novedad general', meeting: 'Reunión', commitment: 'Compromiso', progress: 'Avance', result: 'Resultado' }

function Feedback({ state }: { state: ProjectActionState }) {
  return state.message ? <p className={`mt-3 text-sm ${state.status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{state.message}</p> : null
}

export function ProjectCreationForm({ sources, assigneeOptions, selectedSourceId }: { sources: ProjectSourceArticulation[]; assigneeOptions: OpportunityAssigneeOption[]; selectedSourceId?: string }) {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState)
  const availableSources = sources.filter((source) => !source.project_id)
  return <details className="rounded-2xl border border-slate-200 bg-white shadow-sm" open={Boolean(selectedSourceId)}>
    <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-[#1E3A5F]">+ Crear proyecto desde una articulación cerrada</summary>
    <form action={formAction} className="border-t border-slate-200 p-5">
      <p className="text-sm text-slate-600">La creación es manual y conserva el vínculo con la articulación que alcanzó un resultado. No genera presupuesto, pagos ni automatizaciones.</p>
      <select name="source_articulation_id" required defaultValue={selectedSourceId ?? ''} className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="" disabled>Elegir articulación cerrada...</option>{availableSources.map((source) => <option key={source.articulation_id} value={source.articulation_id}>{source.articulation_title} · {source.opportunity_title}</option>)}</select>
      {availableSources.length === 0 ? <p className="mt-3 text-sm text-slate-500">No hay articulaciones cerradas con resultado disponibles para iniciar un proyecto.</p> : null}
      <input name="title" required minLength={3} maxLength={200} placeholder="Nombre del proyecto" className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      <textarea name="objective" required minLength={3} maxLength={10000} rows={3} placeholder="Objetivo o alcance inicial..." className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      <select name="responsible_internal_user_id" className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">Sin responsable inicial</option>{assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.display_name}</option>)}</select>
      <Feedback state={state} />
      <button disabled={pending || availableSources.length === 0} className="mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Creando...' : 'Crear proyecto en borrador'}</button>
    </form>
  </details>
}

export function ProjectDetailForms({ project, followups, assigneeOptions }: { project: Project; followups: ProjectFollowup[]; assigneeOptions: OpportunityAssigneeOption[] }) {
  const [transitionState, transitionAction, transitionPending] = useActionState(transitionProjectAction.bind(null, project.project_id), initialState)
  const [followupState, followupAction, followupPending] = useActionState(createProjectFollowupAction.bind(null, project.project_id), initialState)
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Estado y responsable</h2>
      <form action={transitionAction} className="mt-4">
        <div className="grid gap-3 sm:grid-cols-2"><select name="status" defaultValue={project.status} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select name="responsible_internal_user_id" defaultValue={project.responsible_internal_user_id ?? ''} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">Sin responsable</option>{assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.display_name}</option>)}</select></div>
        <textarea name="rationale" required minLength={3} maxLength={10000} rows={2} placeholder="Motivo del cambio..." className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        <textarea name="completion_summary" minLength={3} maxLength={10000} rows={2} defaultValue={project.completion_summary ?? ''} placeholder="Resumen final (obligatorio al completar)..." className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
        <Feedback state={transitionState} /><button disabled={transitionPending} className="mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{transitionPending ? 'Actualizando...' : 'Actualizar proyecto'}</button>
      </form>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-950">Novedades y seguimiento</h2>{followups.length ? <ul className="mt-4 space-y-3">{followups.map((followup) => <li key={followup.followup_id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>{followupLabels[followup.followup_type]}</strong><p className="mt-1 whitespace-pre-line">{followup.detail}</p><p className="mt-2 text-xs text-slate-500">{followup.created_by_display_name} · {new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(followup.created_at))}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Todavía no hay novedades registradas.</p>}<form action={followupAction} className="mt-4 border-t border-slate-200 pt-4"><select name="followup_type" defaultValue="general" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm">{Object.entries(followupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><textarea name="detail" required minLength={3} maxLength={10000} rows={3} placeholder="Detalle de la novedad..." className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><Feedback state={followupState} /><button disabled={followupPending} className="mt-3 rounded-xl border border-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50">{followupPending ? 'Registrando...' : 'Registrar novedad'}</button></form></section>
  </div>
}
