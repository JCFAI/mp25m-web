'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import type {
  ProjectArticulationLink,
  ProjectOpportunityLink,
} from '../../../lib/projects/projects'
import {
  linkProjectArticulationAction,
  linkProjectOpportunityAction,
  unlinkProjectArticulationAction,
  unlinkProjectOpportunityAction,
  type ProjectActionState,
} from './actions'

type OpportunityOption = {
  id: string
  title: string
  status: string
}

type ArticulationOption = {
  articulation_id: string
  title: string
  status: string
}

const initialState: ProjectActionState = {
  status: 'idle',
  message: null,
}

const opportunityRelationLabels: Record<string, string> = {
  origin: 'Origen',
  context: 'Contexto',
  resource: 'Recurso',
  dependency: 'Dependencia',
  related: 'Relacionado',
}

const articulationRelationLabels: Record<string, string> = {
  origin: 'Origen',
  context: 'Contexto',
  coordination: 'Coordinación',
  resource: 'Recurso',
  related: 'Relacionado',
}

const opportunityStatusLabels: Record<string, string> = {
  draft: 'Borrador',
  open: 'Abierta',
  under_analysis: 'En análisis',
  in_progress: 'En curso',
  resolved: 'Resuelta',
  discarded: 'Descartada',
}

const articulationStatusLabels: Record<string, string> = {
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
  state: ProjectActionState
}) {
  if (!state.message) return null

  return (
    <p
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

function OpportunityUnlinkForm({
  onSubmit,
  projectId,
  opportunityId,
}: {
  onSubmit: () => void
  projectId: string
  opportunityId: string
}) {
  const [state, action, pending] = useActionState(
    unlinkProjectOpportunityAction.bind(
      null,
      projectId,
      opportunityId
    ),
    initialState
  )

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold text-red-700">
        Desvincular
      </summary>

      <form action={action} onSubmit={onSubmit} className="mt-3">
        <textarea
          name="rationale"
          required
          minLength={3}
          maxLength={10000}
          rows={2}
          placeholder="Motivo de la desvinculación..."
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />

        <Feedback state={state} />

        <button
          disabled={pending}
          className="ux-button mt-2 rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
        >
          {pending
            ? 'Desvinculando...'
            : 'Confirmar desvinculación'}
        </button>
      </form>
    </details>
  )
}

function ArticulationUnlinkForm({
  onSubmit,
  projectId,
  articulationId,
}: {
  onSubmit: () => void
  projectId: string
  articulationId: string
}) {
  const [state, action, pending] = useActionState(
    unlinkProjectArticulationAction.bind(
      null,
      projectId,
      articulationId
    ),
    initialState
  )

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold text-red-700">
        Desvincular
      </summary>

      <form action={action} onSubmit={onSubmit} className="mt-3">
        <textarea
          name="rationale"
          required
          minLength={3}
          maxLength={10000}
          rows={2}
          placeholder="Motivo de la desvinculación..."
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />

        <Feedback state={state} />

        <button
          disabled={pending}
          className="ux-button mt-2 rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
        >
          {pending
            ? 'Desvinculando...'
            : 'Confirmar desvinculación'}
        </button>
      </form>
    </details>
  )
}

export function ProjectLinks({
  projectId,
  opportunityLinks,
  articulationLinks,
  opportunityOptions,
  articulationOptions,
}: {
  projectId: string
  opportunityLinks: ProjectOpportunityLink[]
  articulationLinks: ProjectArticulationLink[]
  opportunityOptions: OpportunityOption[]
  articulationOptions: ArticulationOption[]
}) {
  const [
    opportunityState,
    opportunityAction,
    opportunityPending,
  ] = useActionState(
    linkProjectOpportunityAction.bind(
      null,
      projectId
    ),
    initialState
  )

  const [
    articulationState,
    articulationAction,
    articulationPending,
  ] = useActionState(
    linkProjectArticulationAction.bind(
      null,
      projectId
    ),
    initialState
  )

  const [activeFeedback, setActiveFeedback] = useState<'opportunity' | 'articulation' | null>(null)

  const linkedOpportunityIds = new Set(
    opportunityLinks.map(
      (link) => link.opportunity_id
    )
  )

  const linkedArticulationIds = new Set(
    articulationLinks.map(
      (link) => link.articulation_id
    )
  )

  const availableOpportunities =
    opportunityOptions.filter(
      (opportunity) =>
        !linkedOpportunityIds.has(opportunity.id)
    )

  const availableArticulations =
    articulationOptions.filter(
      (articulation) =>
        !linkedArticulationIds.has(
          articulation.articulation_id
        )
    )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          Vínculos del proyecto
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          El proyecto es una unidad de trabajo autónoma.
          Puede relacionarse con una o varias oportunidades
          y articulaciones en cualquier momento. Estos
          vínculos no son requisitos para que el proyecto
          exista ni avance.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-950">
            Oportunidades
          </h3>

          {opportunityLinks.length ? (
            <div className="mt-3 space-y-3">
              {opportunityLinks.map((link) => (
                <article
                  key={link.link_id}
                  className="rounded-xl bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`/panel/oportunidades/${link.opportunity_id}`}
                      className="font-semibold text-[#1E3A5F] hover:underline"
                    >
                      {link.opportunity_title}
                    </Link>

                    <span className="text-xs text-slate-500">
                      {opportunityStatusLabels[
                        link.opportunity_status
                      ] ?? link.opportunity_status}
                    </span>
                  </div>

                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {opportunityRelationLabels[
                      link.relation_type
                    ] ?? link.relation_type}
                  </p>

                  {link.relationship_note ? (
                    <p className="mt-2 text-sm text-slate-700">
                      {link.relationship_note}
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs text-slate-500">
                    Vinculada por{' '}
                    {link.added_by_display_name}
                  </p>

                  <OpportunityUnlinkForm
                    onSubmit={() => setActiveFeedback(null)}
                    projectId={projectId}
                    opportunityId={
                      link.opportunity_id
                    }
                  />
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Todavía no hay oportunidades vinculadas.
            </p>
          )}

          <form
            action={opportunityAction}
            onSubmit={() => setActiveFeedback('opportunity')}
            className="mt-4 border-t border-slate-200 pt-4"
          >
            <select
              name="opportunity_id"
              required
              defaultValue=""
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="" disabled>
                Elegir oportunidad...
              </option>

              {availableOpportunities.map(
                (opportunity) => (
                  <option
                    key={opportunity.id}
                    value={opportunity.id}
                  >
                    {opportunity.title} ·{' '}
                    {opportunityStatusLabels[
                      opportunity.status
                    ] ?? opportunity.status}
                  </option>
                )
              )}
            </select>

            <select
              name="relation_type"
              defaultValue="related"
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="related">
                Relacionada
              </option>
              <option value="context">
                Contexto
              </option>
              <option value="resource">
                Recurso
              </option>
              <option value="dependency">
                Dependencia
              </option>
              <option value="origin">
                Origen
              </option>
            </select>

            <textarea
              name="relationship_note"
              rows={2}
              maxLength={10000}
              placeholder="Nota sobre este vínculo (opcional)..."
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />

            {availableOpportunities.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No hay otras oportunidades disponibles
                para vincular.
              </p>
            ) : null}

            {activeFeedback === 'opportunity' && !opportunityPending ? <Feedback state={opportunityState} /> : null}

            <button
              disabled={
                opportunityPending ||
                availableOpportunities.length === 0
              }
              className="ux-button mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {opportunityPending
                ? 'Vinculando...'
                : 'Vincular oportunidad'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-950">
            Articulaciones
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Puede vincularse una articulación cualquiera
            sea su estado.
          </p>

          {articulationLinks.length ? (
            <div className="mt-3 space-y-3">
              {articulationLinks.map((link) => (
                <article
                  key={link.link_id}
                  className="rounded-xl bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`/panel/articulaciones/${link.articulation_id}`}
                      className="font-semibold text-[#1E3A5F] hover:underline"
                    >
                      {link.articulation_title}
                    </Link>

                    <span className="text-xs text-slate-500">
                      {articulationStatusLabels[
                        link.articulation_status
                      ] ?? link.articulation_status}
                    </span>
                  </div>



                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {articulationRelationLabels[
                      link.relation_type
                    ] ?? link.relation_type}
                  </p>

                  {link.relationship_note ? (
                    <p className="mt-2 text-sm text-slate-700">
                      {link.relationship_note}
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs text-slate-500">
                    Vinculada por{' '}
                    {link.added_by_display_name}
                  </p>

                  <ArticulationUnlinkForm
                    onSubmit={() => setActiveFeedback(null)}
                    projectId={projectId}
                    articulationId={
                      link.articulation_id
                    }
                  />
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Todavía no hay articulaciones vinculadas.
            </p>
          )}

          <form
            action={articulationAction}
            onSubmit={() => setActiveFeedback('articulation')}
            className="mt-4 border-t border-slate-200 pt-4"
          >
            <select
              name="articulation_id"
              required
              defaultValue=""
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="" disabled>
                Elegir articulación...
              </option>

              {availableArticulations.map(
                (articulation) => (
                  <option
                    key={articulation.articulation_id}
                    value={
                      articulation.articulation_id
                    }
                  >
                    {articulation.title} ·{' '}
                    {articulationStatusLabels[
                      articulation.status
                    ] ?? articulation.status}
                  </option>
                )
              )}
            </select>

            <select
              name="relation_type"
              defaultValue="related"
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="related">
                Relacionada
              </option>
              <option value="coordination">
                Coordinación
              </option>
              <option value="context">
                Contexto
              </option>
              <option value="resource">
                Recurso
              </option>
              <option value="origin">
                Origen
              </option>
            </select>

            <textarea
              name="relationship_note"
              rows={2}
              maxLength={10000}
              placeholder="Nota sobre este vínculo (opcional)..."
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />

            {availableArticulations.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No hay otras articulaciones disponibles
                para vincular.
              </p>
            ) : null}

            {activeFeedback === 'articulation' && !articulationPending ? <Feedback state={articulationState} /> : null}

            <button
              disabled={
                articulationPending ||
                availableArticulations.length === 0
              }
              className="ux-button mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {articulationPending
                ? 'Vinculando...'
                : 'Vincular articulación'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
