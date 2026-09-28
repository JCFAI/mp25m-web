'use client'

import { useActionState } from 'react'

import type {
  ResultContribution,
  ResultContributorCandidate,
  ResultRecord,
  ResultSourceType,
  ResultType,
} from '../../../lib/results/results'
import {
  addResultContributionAction,
  createResultAction,
  removeResultContributionAction,
  updateResultAction,
  updateResultContributionAction,
  voidResultAction,
  type ResultActionState,
} from './actions'
import { ResultActorPicker } from './result-actor-picker'

const initialState: ResultActionState = {
  status: 'idle',
  message: null,
}

const resultTypeLabels:
  Record<ResultType, string> = {
    productive: 'Productivo',
    economic: 'Económico',
    territorial: 'Territorial',
    organizational: 'Organizacional',
    strategic: 'Estratégico',
    institutional: 'Institucional',
    communication: 'Comunicación',
    learning: 'Aprendizaje',
    other: 'Otro',
  }

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm'

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    'es-AR',
  ).format(
    new Date(`${value}T12:00:00`),
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(
    'es-AR',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(new Date(value))
}

function Feedback({
  state,
}: {
  state: ResultActionState
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

function ResultTypeSelect({
  defaultValue = 'productive',
}: {
  defaultValue?: ResultType
}) {
  return (
    <select
      name="result_type"
      defaultValue={defaultValue}
      className={inputClass}
    >
      {Object.entries(
        resultTypeLabels,
      ).map(([value, label]) => (
        <option
          key={value}
          value={value}
        >
          {label}
        </option>
      ))}
    </select>
  )
}

function ContributionItem({
  sourceType,
  sourceId,
  contribution,
  canManage,
}: {
  sourceType: ResultSourceType
  sourceId: string
  contribution: ResultContribution
  canManage: boolean
}) {
  const [
    updateState,
    updateAction,
    updatePending,
  ] = useActionState(
    updateResultContributionAction.bind(
      null,
      sourceType,
      sourceId,
      contribution.contribution_id,
    ),
    initialState,
  )

  const [
    removeState,
    removeAction,
    removePending,
  ] = useActionState(
    removeResultContributionAction.bind(
      null,
      sourceType,
      sourceId,
      contribution.contribution_id,
    ),
    initialState,
  )

  const removed =
    contribution.removed_at !== null

  return (
    <li
      className={`rounded-xl border p-3 text-sm ${
        removed
          ? 'border-slate-200 bg-slate-50 text-slate-500'
          : 'border-slate-200 bg-white text-slate-700'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <strong>
            {contribution.display_name}
          </strong>

          <span className="ml-2 text-xs text-slate-500">
            {contribution.actor_type ===
            'person'
              ? 'Persona'
              : 'Organización'}
          </span>
        </div>

        {removed ? (
          <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">
            Retirada
          </span>
        ) : null}
      </div>

      <p className="mt-2 whitespace-pre-line">
        {contribution.contribution_summary}
      </p>

      {contribution.evidence_reference ? (
        <p className="mt-2 break-words text-xs text-slate-500">
          <strong>Evidencia:</strong>{' '}
          {contribution.evidence_reference}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-slate-500">
        Registrada por{' '}
        {contribution.added_by_display_name}
        {' · '}
        {formatDateTime(
          contribution.added_at,
        )}
      </p>

      {removed ? (
        <div className="mt-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-600">
          <p>
            Retirada por{' '}
            {contribution.removed_by_display_name ??
              'Usuario'}

            {contribution.removed_at
              ? ` · ${formatDateTime(
                  contribution.removed_at,
                )}`
              : ''}
          </p>

          {contribution.removal_rationale ? (
            <p className="mt-1">
              Motivo:{' '}
              {contribution.removal_rationale}
            </p>
          ) : null}
        </div>
      ) : null}

      {canManage && !removed ? (
        <div className="mt-3 space-y-2">
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-[#1E3A5F]">
              Corregir contribución
            </summary>

            <form
              action={updateAction}
              className="mt-3 space-y-2"
            >
              <textarea
                name="contribution_summary"
                defaultValue={
                  contribution.contribution_summary
                }
                required
                minLength={3}
                maxLength={10000}
                rows={3}
                className={inputClass}
              />

              <input
                name="evidence_reference"
                defaultValue={
                  contribution.evidence_reference ??
                  ''
                }
                minLength={3}
                maxLength={2000}
                placeholder="Evidencia o referencia (opcional)"
                className={inputClass}
              />

              <textarea
                name="rationale"
                required
                minLength={3}
                maxLength={10000}
                rows={2}
                placeholder="Motivo de la corrección"
                className={inputClass}
              />

              <Feedback state={updateState} />

              <button
                disabled={updatePending}
                className="rounded-lg border border-[#2F5D8C] px-3 py-2 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50"
              >
                {updatePending
                  ? 'Guardando...'
                  : 'Guardar corrección'}
              </button>
            </form>
          </details>

          <details>
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">
              Retirar contribución
            </summary>

            <form
              action={removeAction}
              className="mt-3"
            >
              <textarea
                name="rationale"
                required
                minLength={3}
                maxLength={10000}
                rows={2}
                placeholder="Motivo del retiro"
                className={inputClass}
              />

              <Feedback state={removeState} />

              <button
                disabled={removePending}
                className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {removePending
                  ? 'Retirando...'
                  : 'Confirmar retiro'}
              </button>
            </form>
          </details>
        </div>
      ) : null}
    </li>
  )
}

function ResultItem({
  sourceType,
  sourceId,
  result,
  contributions,
  candidates,
  canManage,
}: {
  sourceType: ResultSourceType
  sourceId: string
  result: ResultRecord
  contributions: ResultContribution[]
  candidates: ResultContributorCandidate[]
  canManage: boolean
}) {
  const [
    updateState,
    updateAction,
    updatePending,
  ] = useActionState(
    updateResultAction.bind(
      null,
      sourceType,
      sourceId,
      result.result_id,
    ),
    initialState,
  )

  const [
    voidState,
    voidAction,
    voidPending,
  ] = useActionState(
    voidResultAction.bind(
      null,
      sourceType,
      sourceId,
      result.result_id,
    ),
    initialState,
  )

  const [
    contributionState,
    contributionAction,
    contributionPending,
  ] = useActionState(
    addResultContributionAction.bind(
      null,
      sourceType,
      sourceId,
      result.result_id,
    ),
    initialState,
  )

  const activeContributions =
    contributions.filter(
      (item) =>
        item.removed_at === null,
    )

  const historicalContributions =
    contributions.filter(
      (item) =>
        item.removed_at !== null,
    )

  const excludedActorKeys =
    activeContributions.map(
      (item) =>
        `${item.actor_type}:${item.actor_id}`,
    )

  const voided =
    result.voided_at !== null

  return (
    <article
      className={`rounded-2xl border p-4 ${
        voided
          ? 'border-slate-200 bg-slate-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {
              resultTypeLabels[
                result.result_type
              ]
            }
            {' · '}
            {formatDate(
              result.result_date,
            )}
          </p>

          <h3 className="mt-1 text-base font-semibold text-slate-950">
            {result.title}
          </h3>
        </div>

        {voided ? (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
            Anulado
          </span>
        ) : null}
      </div>

      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">
        {result.description}
      </p>

      {result.evidence_reference ? (
        <p className="mt-3 break-words text-xs text-slate-500">
          <strong>Evidencia:</strong>{' '}
          {result.evidence_reference}
        </p>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        Registrado por{' '}
        {result.created_by_display_name}
        {' · '}
        {formatDateTime(
          result.created_at,
        )}
      </p>

      {voided ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
          <p>
            Anulado por{' '}
            {result.voided_by_display_name ??
              'Usuario'}

            {result.voided_at
              ? ` · ${formatDateTime(
                  result.voided_at,
                )}`
              : ''}
          </p>

          {result.void_rationale ? (
            <p className="mt-1">
              Motivo:{' '}
              {result.void_rationale}
            </p>
          ) : null}
        </div>
      ) : null}

      {canManage && !voided ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-[#1E3A5F]">
              Corregir resultado
            </summary>

            <form
              action={updateAction}
              className="mt-3 space-y-3"
            >
              <label className="block text-sm">
                Tipo
                <ResultTypeSelect
                  defaultValue={
                    result.result_type
                  }
                />
              </label>

              <label className="block text-sm">
                Título
                <input
                  name="title"
                  defaultValue={
                    result.title
                  }
                  required
                  minLength={3}
                  maxLength={200}
                  className={inputClass}
                />
              </label>

              <label className="block text-sm">
                Descripción
                <textarea
                  name="description"
                  defaultValue={
                    result.description
                  }
                  required
                  minLength={3}
                  maxLength={10000}
                  rows={4}
                  className={inputClass}
                />
              </label>

              <label className="block text-sm">
                Fecha
                <input
                  type="date"
                  name="result_date"
                  defaultValue={
                    result.result_date
                  }
                  required
                  className={inputClass}
                />
              </label>

              <label className="block text-sm">
                Evidencia o referencia
                <input
                  name="evidence_reference"
                  defaultValue={
                    result.evidence_reference ??
                    ''
                  }
                  minLength={3}
                  maxLength={2000}
                  className={inputClass}
                />
              </label>

              <label className="block text-sm">
                Motivo de la corrección
                <textarea
                  name="rationale"
                  required
                  minLength={3}
                  maxLength={10000}
                  rows={2}
                  className={inputClass}
                />
              </label>

              <Feedback state={updateState} />

              <button
                disabled={updatePending}
                className="rounded-xl border border-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50"
              >
                {updatePending
                  ? 'Guardando...'
                  : 'Guardar corrección'}
              </button>
            </form>
          </details>

          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Anular resultado
            </summary>

            <form
              action={voidAction}
              className="mt-3"
            >
              <textarea
                name="rationale"
                required
                minLength={3}
                maxLength={10000}
                rows={3}
                placeholder="Motivo de la anulación"
                className={inputClass}
              />

              <Feedback state={voidState} />

              <button
                disabled={voidPending}
                className="mt-3 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {voidPending
                  ? 'Anulando...'
                  : 'Confirmar anulación'}
              </button>
            </form>
          </details>
        </div>
      ) : null}

      <div className="mt-5 border-t border-slate-200 pt-4">
        <h4 className="text-sm font-semibold text-slate-900">
          Contribuciones (
          {activeContributions.length})
        </h4>

        {activeContributions.length ? (
          <ul className="mt-3 space-y-3">
            {activeContributions.map(
              (contribution) => (
                <ContributionItem
                  key={
                    contribution.contribution_id
                  }
                  sourceType={sourceType}
                  sourceId={sourceId}
                  contribution={
                    contribution
                  }
                  canManage={
                    canManage
                  }
                />
              ),
            )}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Todavía no hay
            contribuciones activas
            registradas.
          </p>
        )}

        {canManage && !voided ? (
          <details className="mt-4 rounded-xl border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-[#1E3A5F]">
              Registrar contribución
            </summary>

            <form
              action={
                contributionAction
              }
              className="mt-3 space-y-3"
            >
              <ResultActorPicker
                candidates={candidates}
                excludedActorKeys={
                  excludedActorKeys
                }
              />

              <label className="block text-sm">
                Contribución realizada
                <textarea
                  name="contribution_summary"
                  required
                  minLength={3}
                  maxLength={10000}
                  rows={3}
                  className={inputClass}
                />
              </label>

              <label className="block text-sm">
                Evidencia o referencia
                <input
                  name="evidence_reference"
                  minLength={3}
                  maxLength={2000}
                  className={inputClass}
                />
              </label>

              <Feedback
                state={
                  contributionState
                }
              />

              <button
                disabled={
                  contributionPending
                }
                className="rounded-xl border border-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50"
              >
                {contributionPending
                  ? 'Registrando...'
                  : 'Registrar contribución'}
              </button>
            </form>
          </details>
        ) : null}

        {historicalContributions.length ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">
              Ver contribuciones
              retiradas (
              {
                historicalContributions.length
              }
              )
            </summary>

            <ul className="mt-3 space-y-3">
              {historicalContributions.map(
                (contribution) => (
                  <ContributionItem
                    key={
                      contribution.contribution_id
                    }
                    sourceType={
                      sourceType
                    }
                    sourceId={sourceId}
                    contribution={
                      contribution
                    }
                    canManage={
                      canManage
                    }
                  />
                ),
              )}
            </ul>
          </details>
        ) : null}
      </div>
    </article>
  )
}

export function ResultSection({
  sourceType,
  sourceId,
  results,
  contributions,
  candidates,
  canManage,
}: {
  sourceType: ResultSourceType
  sourceId: string
  results: ResultRecord[]
  contributions: ResultContribution[]
  candidates: ResultContributorCandidate[]
  canManage: boolean
}) {
  const [
    createState,
    createAction,
    createPending,
  ] = useActionState(
    createResultAction.bind(
      null,
      sourceType,
      sourceId,
    ),
    initialState,
  )

  const activeResults =
    results.filter(
      (result) =>
        result.voided_at === null,
    )

  const voidedResults =
    results.filter(
      (result) =>
        result.voided_at !== null,
    )

  const contributionsByResult =
    new Map<
      string,
      ResultContribution[]
    >()

  for (
    const contribution
    of contributions
  ) {
    const current =
      contributionsByResult.get(
        contribution.result_id,
      ) ?? []

    current.push(contribution)

    contributionsByResult.set(
      contribution.result_id,
      current,
    )
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          Resultados
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Registra efectos observados o
          documentados de esta{' '}
          {sourceType === 'articulation'
            ? 'articulación'
            : 'ejecución del proyecto'}
          . Un resultado no reemplaza el
          cierre, un seguimiento ni un
          entregable.
        </p>
      </div>

      {canManage ? (
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#1E3A5F]">
            Registrar resultado
          </summary>

          <form
            action={createAction}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <label className="block text-sm">
              Tipo
              <ResultTypeSelect />
            </label>

            <label className="block text-sm">
              Fecha
              <input
                type="date"
                name="result_date"
                required
                className={inputClass}
              />
            </label>

            <label className="block text-sm sm:col-span-2">
              Título
              <input
                name="title"
                required
                minLength={3}
                maxLength={200}
                className={inputClass}
              />
            </label>

            <label className="block text-sm sm:col-span-2">
              Descripción
              <textarea
                name="description"
                required
                minLength={3}
                maxLength={10000}
                rows={4}
                className={inputClass}
              />
            </label>

            <label className="block text-sm sm:col-span-2">
              Evidencia o referencia
              <input
                name="evidence_reference"
                minLength={3}
                maxLength={2000}
                placeholder="Opcional"
                className={inputClass}
              />
            </label>

            <div className="sm:col-span-2">
              <Feedback state={createState} />

              <button
                disabled={createPending}
                className="mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {createPending
                  ? 'Registrando...'
                  : 'Registrar resultado'}
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {activeResults.length ? (
        <div className="space-y-4">
          {activeResults.map(
            (result) => (
              <ResultItem
                key={result.result_id}
                sourceType={sourceType}
                sourceId={sourceId}
                result={result}
                contributions={
                  contributionsByResult.get(
                    result.result_id,
                  ) ?? []
                }
                candidates={candidates}
                canManage={canManage}
              />
            ),
          )}
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          Todavía no hay resultados
          estructurados activos.
        </p>
      )}

      {voidedResults.length ? (
        <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Ver resultados anulados (
            {voidedResults.length})
          </summary>

          <div className="mt-4 space-y-4">
            {voidedResults.map(
              (result) => (
                <ResultItem
                  key={result.result_id}
                  sourceType={sourceType}
                  sourceId={sourceId}
                  result={result}
                  contributions={
                    contributionsByResult.get(
                      result.result_id,
                    ) ?? []
                  }
                  candidates={candidates}
                  canManage={canManage}
                />
              ),
            )}
          </div>
        </details>
      ) : null}
    </section>
  )
}
