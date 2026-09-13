'use client'

import { useActionState } from 'react'

import type { OpportunityGap, OpportunityGapAction } from '../../../../lib/opportunities/analysis'
import type { OpportunityAssigneeOption } from '../../../../lib/opportunities/detail'
import type { OpportunityRequirement } from '../../../../lib/opportunities/requirements'
import {
  openOpportunityGapAction,
  createOpportunityGapActionAction,
  transitionOpportunityGapActionAction,
  transitionOpportunityGapAction,
  type AnalysisActionState,
} from './analysis-actions'

const initialState: AnalysisActionState = { status: 'idle', message: null }

const typeLabels = {
  capacity: 'Capacidad', scale: 'Escala', availability: 'Disponibilidad',
  resource_equipment: 'Recurso / equipamiento', certification_authorization: 'Certificación / habilitación',
  knowledge: 'Conocimiento', articulation: 'Articulación', financing: 'Financiamiento',
  logistics: 'Logística', deadline: 'Plazo', other: 'Otro',
} as const

const statusLabels = {
  open: 'Abierta', in_treatment: 'En tratamiento', blocked: 'Bloqueada',
  resolved: 'Resuelta', closed_unresolved: 'Cerrada sin resolver', cancelled: 'Cancelada',
} as const

export function OpportunityGapsSection({
  opportunityId,
  requirements,
  gaps,
  actions,
  canOperate,
  assigneeOptions,
}: {
  opportunityId: string
  requirements: OpportunityRequirement[]
  gaps: OpportunityGap[]
  actions: OpportunityGapAction[]
  canOperate: boolean
  assigneeOptions: OpportunityAssigneeOption[]
}) {
  const action = openOpportunityGapAction.bind(null, opportunityId)
  const [state, formAction, pending] = useActionState(action, initialState)
  const eligibleRequirements = requirements.filter((requirement) =>
    requirement.record_status === 'active' &&
    requirement.validation_status === 'validated' &&
    requirement.revision_id
  )

  return (
    <section className="mt-5 rounded-2xl border border-[#C8D6E5] bg-slate-50 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#2F5D8C]">Brechas</p>
      <h3 className="mt-2 text-lg font-semibold text-slate-950">Faltantes que requieren una decisión</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Abrir una brecha no crea una acción, no contacta actores y no modifica la cobertura del requerimiento.
      </p>

      {canOperate && eligibleRequirements.length > 0 ? (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#1E3A5F]">+ Abrir brecha</summary>
          <form action={formAction} className="border-t border-slate-200 p-4">
            <label className="block text-sm font-medium text-slate-700">Requerimiento
              <select name="requirement_revision_id" required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                <option value="">Elegir requerimiento...</option>
                {eligibleRequirements.map((requirement) => (
                  <option key={requirement.revision_id} value={requirement.revision_id!}>{requirement.name}</option>
                ))}
              </select>
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Capa de cobertura
                <select name="coverage_layer" required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                  <option value="">Elegir capa...</option>
                  <option value="network_mp25m">Red MP25M</option>
                  <option value="expanded_argentina">Ampliada Argentina</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">Tipo
                <select name="gap_type" required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                  <option value="">Elegir tipo...</option>
                  {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium text-slate-700">Responsable inicial <span className="font-normal text-slate-500">(opcional)</span>
              <select name="responsible_internal_user_id" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
                <option value="">Sin responsable</option>
                {assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.display_name}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-700">Fundamento
              <textarea name="rationale" required minLength={3} maxLength={10000} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" placeholder="Explicá por qué este faltante requiere atención..." />
            </label>
            <p className="mt-2 text-xs leading-5 text-slate-500">Sólo puede abrirse sobre una cobertura actual parcial o faltante.</p>
            {state.message ? <p role="alert" className={`mt-3 text-sm font-medium ${state.status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{state.message}</p> : null}
            <button disabled={pending} className="mt-4 rounded-xl bg-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Abriendo...' : 'Abrir brecha'}</button>
          </form>
        </details>
      ) : null}

      {gaps.length === 0 ? <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-slate-600">No hay brechas abiertas explícitamente para esta oportunidad.</p> : (
        <div className="mt-4 space-y-3">{gaps.map((gap) => <GapCard key={gap.gap_id} opportunityId={opportunityId} gap={gap} actions={actions.filter((action) => action.gap_id === gap.gap_id)} canOperate={canOperate} assigneeOptions={assigneeOptions} />)}</div>
      )}
    </section>
  )
}

function GapCard({
  opportunityId,
  gap,
  actions,
  canOperate,
  assigneeOptions,
}: {
  opportunityId: string
  gap: OpportunityGap
  actions: OpportunityGapAction[]
  canOperate: boolean
  assigneeOptions: OpportunityAssigneeOption[]
}) {
  const action = transitionOpportunityGapAction.bind(null, opportunityId, gap.gap_id)
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-slate-900">{gap.requirement_name}</h4><span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">{statusLabels[gap.status]}</span></div>
      <p className="mt-2 text-sm text-slate-600">{typeLabels[gap.gap_type]} · {gap.coverage_layer === 'network_mp25m' ? 'Red MP25M' : 'Ampliada Argentina'} · cobertura actual: {gap.current_coverage_status === 'missing' ? 'Faltante' : gap.current_coverage_status === 'partial' ? 'Parcial' : 'Sin dato'}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{gap.rationale}</p>
      <p className="mt-2 text-xs text-slate-500">Responsable: {gap.responsible_display_name ?? 'Sin asignar'}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones ({actions.length})</p>
      {actions.map((action) => <GapActionCard key={action.action_id} opportunityId={opportunityId} action={action} assigneeOptions={assigneeOptions} canOperate={canOperate} />)}
      {canOperate ? <GapActionForm opportunityId={opportunityId} gapId={gap.gap_id} assigneeOptions={assigneeOptions} /> : null}
      {canOperate ? <details className="mt-3 rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-[#1E3A5F]">Actualizar seguimiento</summary>
        <form key={`${gap.status}-${gap.responsible_internal_user_id ?? 'unassigned'}-${gap.updated_at}`} action={formAction} className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Estado
              <select name="status" defaultValue={gap.status} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            </label>
            <label className="text-sm font-medium text-slate-700">Responsable
              <select name="responsible_internal_user_id" defaultValue={gap.responsible_internal_user_id ?? ''} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Sin responsable</option>{assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.display_name}</option>)}</select>
            </label>
          </div>
          <label className="mt-3 block text-sm font-medium text-slate-700">Fundamento
            <textarea name="rationale" required minLength={3} maxLength={10000} rows={2} defaultValue={gap.rationale} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
          </label>
          <p className="mt-2 text-xs text-slate-500">Resolver o cerrar una brecha exige un responsable.</p>
          {state.message ? <p role="alert" className={`mt-3 text-sm font-medium ${state.status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{state.message}</p> : null}
          <button disabled={pending} className="mt-3 rounded-xl border border-[#2F5D8C] px-4 py-2 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50">{pending ? 'Guardando...' : 'Actualizar brecha'}</button>
        </form>
      </details> : null}
    </article>
  )
}

const actionTypeLabels = {
  search_mp25m: 'Buscar en MP25M', search_argentina: 'Buscar actor argentino', search_international: 'Buscar actor internacional', contact_actor: 'Contactar actor', request_information: 'Solicitar información', request_quote: 'Solicitar presupuesto', verify_capacity: 'Verificar capacidad', verify_availability: 'Verificar disponibilidad', verify_certification: 'Verificar certificación', call_for_participants: 'Generar convocatoria', develop_capacity: 'Desarrollar capacidad', acquire_equipment: 'Conseguir equipamiento', seek_financing: 'Buscar financiamiento', coordinate_meeting: 'Coordinar reunión', reanalyze_requirement: 'Reanalizar requerimiento', other: 'Otra acción',
} as const

function GapActionForm({ opportunityId, gapId, assigneeOptions }: { opportunityId: string; gapId: string; assigneeOptions: OpportunityAssigneeOption[] }) {
  const action = createOpportunityGapActionAction.bind(null, opportunityId, gapId)
  const [state, formAction, pending] = useActionState(action, initialState)
  return <details className="mt-3 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-[#1E3A5F]">+ Planificar acción</summary><form action={formAction} className="mt-3"><label className="block text-sm font-medium text-slate-700">Acción<select name="action_type" required className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Elegir acción...</option>{Object.entries(actionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="mt-3 block text-sm font-medium text-slate-700">Responsable <span className="font-normal text-slate-500">(opcional)</span><select name="responsible_internal_user_id" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Sin responsable</option>{assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.display_name}</option>)}</select></label><label className="mt-3 block text-sm font-medium text-slate-700">Fundamento<textarea name="rationale" required minLength={3} maxLength={10000} rows={2} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" placeholder="Explicá qué se intentará hacer..." /></label><p className="mt-2 text-xs text-slate-500">Planificar no ejecuta la acción ni contacta a terceros.</p>{state.message ? <p role="alert" className={`mt-3 text-sm font-medium ${state.status === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{state.message}</p> : null}<button disabled={pending} className="mt-3 rounded-xl border border-[#2F5D8C] px-4 py-2 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50">{pending ? 'Guardando...' : 'Registrar acción'}</button></form></details>
}

function GapActionCard({ opportunityId, action, assigneeOptions, canOperate }: { opportunityId: string; action: OpportunityGapAction; assigneeOptions: OpportunityAssigneeOption[]; canOperate: boolean }) {
  const transition = transitionOpportunityGapActionAction.bind(null, opportunityId, action.action_id)
  const [state, formAction, pending] = useActionState(transition, initialState)
  const labels = { planned: 'Planificada', in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' }
  return <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><p>{actionTypeLabels[action.action_type]} · {labels[action.status]}{action.responsible_display_name ? ` · ${action.responsible_display_name}` : ''}</p>{canOperate ? <details className="mt-2"><summary className="cursor-pointer font-semibold text-[#1E3A5F]">Actualizar acción</summary><form key={`${action.status}-${action.responsible_internal_user_id ?? 'unassigned'}-${action.updated_at}`} action={formAction} className="mt-2"><select name="status" defaultValue={action.status} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select name="responsible_internal_user_id" defaultValue={action.responsible_internal_user_id ?? ''} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Sin responsable</option>{assigneeOptions.map((option) => <option key={option.id} value={option.id}>{option.display_name}</option>)}</select><textarea name="rationale" required minLength={3} rows={2} defaultValue={action.rationale} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />{state.message ? <p className="mt-2">{state.message}</p> : null}<button disabled={pending} className="mt-2 rounded-lg border border-[#2F5D8C] px-3 py-2 font-semibold text-[#1E3A5F]">{pending ? 'Guardando...' : 'Guardar acción'}</button></form></details> : null}</div>
}
