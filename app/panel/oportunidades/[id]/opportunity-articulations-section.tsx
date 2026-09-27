'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import type {
  OpportunityArticulation,
} from '../../../../lib/opportunities/articulations'
import type {
  OpportunityAssigneeOption,
} from '../../../../lib/opportunities/detail'
import {
  createOpportunityArticulationAction,
  type ArticulationActionState,
} from './articulation-actions'

const initialState: ArticulationActionState = {
  status: 'idle',
  message: null,
}

const statusLabels = {
  draft: 'Borrador',
  active: 'Activa',
  follow_up: 'En seguimiento',
  paused: 'Pausada',
  closed_with_result: 'Cerrada con resultado',
  closed_without_result: 'Cerrada sin resultado',
  cancelled: 'Cancelada',
}

function Feedback({
  state,
}: {
  state: ArticulationActionState
}) {
  if (!state.message) return null

  return (
    <p
      role="status"
      aria-live="polite"
      className={`mt-3 text-sm ${
        state.status === 'error'
          ? 'text-red-700'
          : 'text-emerald-700'
      }`}
    >
      {state.message}
    </p>
  )
}

export function OpportunityArticulationsSection({
  opportunityId,
  opportunityStatus,
  articulations,
  canOperate,
  assigneeOptions,
}: {
  opportunityId: string
  opportunityStatus: string
  articulations: OpportunityArticulation[]
  canOperate: boolean
  assigneeOptions: OpportunityAssigneeOption[]
}) {
  const [state, formAction, pending] = useActionState(
    createOpportunityArticulationAction.bind(
      null,
      opportunityId,
    ),
    initialState,
  )

  const isTerminal =
    opportunityStatus === 'resolved' ||
    opportunityStatus === 'discarded'

  const canCreateAndLink =
    canOperate && !isTerminal

  return (
    <section
      id="articulaciones"
      className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#2F5D8C]">
        Articulaciones
      </p>

      <h2 className="mt-2 text-lg font-semibold text-slate-950">
        Articulaciones vinculadas
      </h2>

      <p className="mt-2 text-sm text-slate-600">
        Las articulaciones son entidades autónomas. Esta
        sección muestra las que están vinculadas con esta
        oportunidad.
      </p>

      {articulations.length > 0 ? (
        <div className="mt-4 space-y-3">
          {articulations.map((articulation) => (
            <article
              key={articulation.articulation_id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <strong className="text-slate-900">
                    {articulation.title}
                  </strong>

                  <p className="mt-2 text-sm text-slate-700">
                    {articulation.objective}
                  </p>
                </div>

                <span className="text-sm text-slate-600">
                  {statusLabels[articulation.status]}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Responsable:{' '}
                {articulation.responsible_display_name ??
                  'Sin asignar'}
                {' · '}
                Participantes:{' '}
                {articulation.participant_count}
              </p>

              {articulation.latest_followup_detail ? (
                <p className="mt-2 text-xs text-slate-600">
                  Última novedad:{' '}
                  {articulation.latest_followup_detail}
                </p>
              ) : null}

              <Link
                href={`/panel/articulaciones/${articulation.articulation_id}`}
                className="ux-button mt-3 inline-flex min-h-10 items-center rounded-lg border border-[#2F5D8C] px-3 py-2 text-sm font-semibold text-[#1E3A5F]"
              >
                Ver articulación
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          No hay articulaciones vinculadas a esta oportunidad.
        </p>
      )}

      {canCreateAndLink ? (
        <details
          id="crear-vincular-articulacion"
          className="mt-5 scroll-mt-6 rounded-xl border border-slate-200"
        >
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#1E3A5F]">
            Crear y vincular articulación
          </summary>

          <form
            action={formAction}
            className="border-t border-slate-200 p-4"
          >
            <p className="mb-3 text-sm text-slate-600">
              Este atajo crea una nueva articulación autónoma
              y la vincula con esta oportunidad. También podés
              crearla desde Articulaciones y vincularla después.
            </p>

            <input
              name="title"
              required
              minLength={3}
              maxLength={200}
              placeholder="Título"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />

            <textarea
              name="objective"
              required
              minLength={3}
              maxLength={10000}
              rows={3}
              placeholder="Objetivo de la articulación..."
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />

            <select
              name="responsible_internal_user_id"
              defaultValue=""
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="">
                Sin responsable inicial
              </option>

              {assigneeOptions.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                >
                  {option.display_name}
                </option>
              ))}
            </select>

            <Feedback state={state} />

            <button
              disabled={pending}
              className="ux-button mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending
                ? 'Creando...'
                : 'Crear articulación y vincular'}
            </button>
          </form>
        </details>
      ) : isTerminal ? (
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Esta oportunidad está en un estado terminal. Se
          conservan sus vínculos históricos, pero no se crean
          nuevas articulaciones desde este registro.
        </p>
      ) : null}
    </section>
  )
}
