'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  CollectionStatus,
  EconomicNumericValue,
  EconomicProfileCurrent,
  EconomicProfileRevision,
  EconomicSourceType,
} from '../../../lib/economics/economics'
import {
  saveEconomicProfileAction,
  type EconomicActionState,
} from './actions'

const initialState:
  EconomicActionState = {
    status: 'idle',
    message: null,
  }

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm'

const collectionLabels:
  Record<CollectionStatus, string> = {
    pending: 'Pendiente',
    partial: 'Cobro parcial',
    collected: 'Cobrado',
    uncollectible: 'Incobrable',
    cancelled: 'Cancelado',
    not_applicable: 'No corresponde',
  }

const sourceLabels:
  Record<EconomicSourceType, string> = {
    opportunity: 'oportunidad',
    articulation: 'articulación',
    project: 'proyecto',
  }

function decimalText(
  value: EconomicNumericValue,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null
  }

  return String(value).replace(
    '.',
    ',',
  )
}

function inputDecimal(
  value: EconomicNumericValue,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return ''
  }

  return String(value)
}

function restoreFormValues(
  form: HTMLFormElement,
  data: FormData,
) {
  for (
    const [name, value] of data.entries()
  ) {
    const control =
      form.elements.namedItem(name)

    if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLSelectElement ||
      control instanceof HTMLTextAreaElement
    ) {
      control.value = String(value)
    }
  }
}

function moneyText(
  value: EconomicNumericValue,
  currencyCode: string | null,
) {
  const decimal =
    decimalText(value)

  if (decimal === null) {
    return 'No informado'
  }

  return [
    currencyCode,
    decimal,
  ]
    .filter(Boolean)
    .join(' ')
}

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'es-AR',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(
    new Date(value),
  )
}

function Feedback({
  state,
}: {
  state: EconomicActionState
}) {
  if (!state.message) {
    return null
  }

  const isError =
    state.status === 'error' ||
    state.status === 'conflict'

  return (
    <p
      role={
        isError
          ? 'alert'
          : 'status'
      }
      aria-live="polite"
      className={`mt-3 text-sm ${
        isError
          ? 'text-red-700'
          : 'text-emerald-700'
      }`}
    >
      {state.message}
    </p>
  )
}

function DataItem({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>

      <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
        {value}
      </dd>
    </div>
  )
}

function RevisionSummary({
  revision,
}: {
  revision:
    | EconomicProfileCurrent
    | EconomicProfileRevision
}) {
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <DataItem
        label="Valor estimado"
        value={moneyText(
          revision.estimated_value,
          revision.currency_code,
        )}
      />

      <DataItem
        label="Costos estimados"
        value={moneyText(
          revision.estimated_costs,
          revision.currency_code,
        )}
      />

      <DataItem
        label="Margen estimado"
        value={
          revision.estimated_margin ===
          null
            ? 'No calculable'
            : moneyText(
                revision.estimated_margin,
                revision.currency_code,
              )
        }
      />

      <DataItem
        label="Probabilidad"
        value={
          revision.probability_percent ===
          null
            ? 'No informada'
            : `${decimalText(
                revision.probability_percent,
              )} %`
        }
      />

      <DataItem
        label="Ingreso potencial participantes"
        value={moneyText(
          revision.participant_income_potential,
          revision.currency_code,
        )}
      />

      <DataItem
        label="Aporte potencial MP25M"
        value={moneyText(
          revision.mp25m_contribution_potential,
          revision.currency_code,
        )}
      />

      <DataItem
        label="Valor acordado"
        value={moneyText(
          revision.agreed_value,
          revision.currency_code,
        )}
      />

      <DataItem
        label="Estado de cobro"
        value={
          revision.collection_status
            ? collectionLabels[
                revision.collection_status
              ]
            : 'No informado'
        }
      />

      <DataItem
        label="Importe cobrado"
        value={moneyText(
          revision.collected_amount,
          revision.currency_code,
        )}
      />

      <DataItem
        label="Costos finales"
        value={moneyText(
          revision.final_costs,
          revision.currency_code,
        )}
      />

      <DataItem
        label="Ingreso final participantes"
        value={moneyText(
          revision.participant_income_final,
          revision.currency_code,
        )}
      />

      <DataItem
        label="Aporte final MP25M"
        value={moneyText(
          revision.mp25m_contribution_final,
          revision.currency_code,
        )}
      />

      <DataItem
        label="Resultado económico final"
        value={moneyText(
          revision.final_result_amount,
          revision.currency_code,
        )}
      />
    </div>
  )
}

function EconomicForm({
  sourceType,
  sourceId,
  profile,
}: {
  sourceType: EconomicSourceType
  sourceId: string
  profile:
    | EconomicProfileCurrent
    | null
}) {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    saveEconomicProfileAction.bind(
      null,
      sourceType,
      sourceId,
      profile?.revision_no ?? 0,
    ),
    initialState,
  )

  const formRef =
    useRef<HTMLFormElement>(null)

  const submittedValues =
    useRef<FormData | null>(null)

  useEffect(() => {
    if (
      state.status === 'idle' ||
      state.status === 'success' ||
      !formRef.current ||
      !submittedValues.current
    ) {
      return
    }

    restoreFormValues(
      formRef.current,
      submittedValues.current,
    )
  }, [state])

  const [
    dismissedFeedback,
    setDismissedFeedback,
  ] = useState<string | null>(null)

  const feedbackVisible =
    Boolean(
      state.message &&
      dismissedFeedback !== state.message,
    )

  const nextRevisionNo =
    (profile?.revision_no ?? 0) + 1

  return (
    <details className="rounded-xl border border-slate-200 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#1E3A5F]">
        {profile
          ? `Actualizar ficha económica · crea la revisión #${nextRevisionNo}`
          : 'Registrar ficha económica'}
      </summary>

      {profile ? (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          La revisión vigente se conserva. Completá o corregí los datos y,
          al guardar, se registrará la revisión #{nextRevisionNo}.
        </p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Podés completar la ficha gradualmente. Cada guardado posterior
          conservará esta primera revisión y creará una nueva.
        </p>
      )}

      <form
        ref={formRef}
        key={`${sourceType}:${sourceId}:${profile?.revision_no ?? 0}`}
        action={action}
        noValidate
        onChange={() => {
          if (state.message) {
            setDismissedFeedback(
              state.message,
            )
          }
        }}
        onSubmit={(event) => {
          submittedValues.current =
            new FormData(event.currentTarget)

          setDismissedFeedback(null)
        }}
        className="mt-4 space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block text-sm">
            Moneda
            <input
              name="currency_code"
              defaultValue={
                profile?.currency_code ??
                ''
              }
              maxLength={3}
              placeholder="Ej. ARS"
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Obligatoria si cargás algún importe.
            </span>
          </label>

          <label className="block text-sm">
            Valor estimado
            <input
              type="number"
              name="estimated_value"
              min="0"
              step="0.0001"
              defaultValue={inputDecimal(
                profile?.estimated_value ??
                null,
              )}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Costos estimados
            <input
              type="number"
              name="estimated_costs"
              min="0"
              step="0.0001"
              defaultValue={inputDecimal(
                profile?.estimated_costs ??
                null,
              )}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Probabilidad (%)
            <input
              type="number"
              name="probability_percent"
              min="0"
              max="100"
              step="0.01"
              defaultValue={inputDecimal(
                profile?.probability_percent ??
                null,
              )}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Ingreso potencial participantes
            <input
              type="number"
              name="participant_income_potential"
              min="0"
              step="0.0001"
              defaultValue={inputDecimal(
                profile?.participant_income_potential ??
                null,
              )}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Aporte potencial MP25M
            <input
              type="number"
              name="mp25m_contribution_potential"
              min="0"
              step="0.0001"
              defaultValue={inputDecimal(
                profile?.mp25m_contribution_potential ??
                null,
              )}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Valor acordado
            <input
              type="number"
              name="agreed_value"
              min="0"
              step="0.0001"
              defaultValue={inputDecimal(
                profile?.agreed_value ??
                null,
              )}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Estado de cobro
            <select
              name="collection_status"
              defaultValue={
                profile?.collection_status ??
                ''
              }
              className={inputClass}
            >
              <option value="">
                No informado
              </option>

              {Object.entries(
                collectionLabels,
              ).map(
                ([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="block text-sm">
            Importe cobrado
            <input
              type="number"
              name="collected_amount"
              min="0"
              step="0.0001"
              defaultValue={inputDecimal(
                profile?.collected_amount ??
                null,
              )}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Costos finales
            <input
              type="number"
              name="final_costs"
              min="0"
              step="0.0001"
              defaultValue={inputDecimal(
                profile?.final_costs ??
                null,
              )}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Ingreso final participantes
            <input
              type="number"
              name="participant_income_final"
              min="0"
              step="0.0001"
              defaultValue={inputDecimal(
                profile?.participant_income_final ??
                null,
              )}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Aporte final MP25M
            <input
              type="number"
              name="mp25m_contribution_final"
              min="0"
              step="0.0001"
              defaultValue={inputDecimal(
                profile?.mp25m_contribution_final ??
                null,
              )}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Resultado económico final
            <input
              type="number"
              name="final_result_amount"
              step="0.0001"
              defaultValue={inputDecimal(
                profile?.final_result_amount ??
                null,
              )}
              className={inputClass}
            />

            <span className="mt-1 block text-xs text-slate-500">
              Puede ser positivo, cero o negativo.
            </span>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block text-sm">
            Distribución acordada
            <textarea
              name="distribution_notes"
              rows={4}
              minLength={3}
              maxLength={10000}
              defaultValue={
                profile?.distribution_notes ??
                ''
              }
              placeholder="Opcional. Descripción textual; 14A no distribuye automáticamente."
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            Resumen económico
            <textarea
              name="economic_summary"
              rows={4}
              minLength={3}
              maxLength={10000}
              defaultValue={
                profile?.economic_summary ??
                ''
              }
              placeholder="Opcional"
              className={inputClass}
            />
          </label>
        </div>

        <label className="block text-sm">
          Evidencia o referencia
          <input
            name="evidence_reference"
            minLength={3}
            maxLength={2000}
            defaultValue={
              profile?.evidence_reference ??
              ''
            }
            placeholder="Documento, expediente, presupuesto, factura u otra referencia verificable"
            className={inputClass}
          />
        </label>

        <label className="block text-sm">
          <span>
            Motivo de esta revisión (Campo Obligatorio)
          </span>

          <textarea
            name="rationale"
            required
            aria-required="true"
            minLength={3}
            maxLength={2000}
            rows={3}
            className={inputClass}
          />

          <span className="mt-1 block text-xs text-slate-500">
            Indicá brevemente por qué se registra o modifica esta información.
          </span>
        </label>

        <p className="text-xs leading-5 text-slate-500">
          Los campos vacíos se guardan como
          no informados. El cero sólo se
          registra cuando se escribe
          explícitamente 0.
        </p>

        <Feedback
          state={
            feedbackVisible
              ? state
              : initialState
          }
        />

        <button
          disabled={pending}
          className="rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending
            ? 'Guardando...'
            : profile
              ? `Guardar actualización (revisión #${nextRevisionNo})`
              : 'Registrar ficha económica'}
        </button>
      </form>
    </details>
  )
}

export function EconomicSection({
  sourceType,
  sourceId,
  profile,
  history,
  canManage,
}: {
  sourceType: EconomicSourceType
  sourceId: string
  profile:
    | EconomicProfileCurrent
    | null
  history: EconomicProfileRevision[]
  canManage: boolean
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
          Incremento 14A
        </p>

        <h2 className="mt-2 text-lg font-semibold text-slate-950">
          Economía operativa
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Información monetaria manual y
          trazable de esta{' '}
          {sourceLabels[sourceType]}.
          No se hereda de otras entidades,
          no distribuye importes
          automáticamente y no ejecuta
          pagos ni facturación.
        </p>
      </div>

      {profile ? (
        <>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Revisión vigente{' '}
                  #{profile.revision_no}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {profile.changed_by_display_name ??
                    'Usuario interno'}
                  {' · '}
                  {formatDateTime(
                    profile.changed_at,
                  )}
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {profile.currency_code ??
                  'Sin moneda'}
              </span>
            </div>

            <RevisionSummary
              revision={profile}
            />

            {profile.distribution_notes ? (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                <strong>
                  Distribución acordada:
                </strong>{' '}
                {profile.distribution_notes}
              </div>
            ) : null}

            {profile.economic_summary ? (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                <strong>
                  Resumen:
                </strong>{' '}
                {profile.economic_summary}
              </div>
            ) : null}

            {profile.evidence_reference ? (
              <p className="mt-3 break-words text-sm text-slate-600">
                <strong>
                  Evidencia o referencia:
                </strong>{' '}
                {profile.evidence_reference}
              </p>
            ) : null}

            <p className="mt-3 text-xs text-slate-500">
              Motivo de la revisión:{' '}
              {profile.rationale}
            </p>
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          Todavía no hay una ficha
          económica registrada para esta{' '}
          {sourceLabels[sourceType]}.
          La ausencia de información no se
          interpreta como cero.
        </div>
      )}

      {canManage ? (
        <EconomicForm
          key={`${sourceType}:${sourceId}:${profile?.revision_no ?? 0}`}
          sourceType={sourceType}
          sourceId={sourceId}
          profile={profile}
        />
      ) : null}

      {history.length > 0 ? (
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            Historial económico (
            {history.length}{' '}
            {history.length === 1
              ? 'revisión'
              : 'revisiones'}
            )
          </summary>

          <div className="mt-4 space-y-4">
            {history.map(
              (revision) => (
                <article
                  key={
                    revision.revision_id
                  }
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Revisión{' '}
                        #{revision.revision_no}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {revision.changed_by_display_name ??
                          'Usuario interno'}
                        {' · '}
                        {formatDateTime(
                          revision.changed_at,
                        )}
                      </p>
                    </div>

                    <span className="text-xs font-semibold text-slate-600">
                      {revision.currency_code ??
                        'Sin moneda'}
                    </span>
                  </div>

                  <RevisionSummary
                    revision={revision}
                  />

                  {revision.distribution_notes ? (
                    <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
                      <strong>
                        Distribución:
                      </strong>{' '}
                      {
                        revision.distribution_notes
                      }
                    </p>
                  ) : null}

                  {revision.economic_summary ? (
                    <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
                      <strong>
                        Resumen:
                      </strong>{' '}
                      {
                        revision.economic_summary
                      }
                    </p>
                  ) : null}

                  {revision.evidence_reference ? (
                    <p className="mt-3 break-words text-sm text-slate-600">
                      <strong>
                        Evidencia:
                      </strong>{' '}
                      {
                        revision.evidence_reference
                      }
                    </p>
                  ) : null}

                  <p className="mt-3 text-xs text-slate-500">
                    Motivo:{' '}
                    {revision.rationale}
                  </p>
                </article>
              ),
            )}
          </div>
        </details>
      ) : null}
    </section>
  )
}
