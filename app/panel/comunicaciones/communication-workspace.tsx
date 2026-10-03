'use client'

import { useActionState, useCallback, useEffect, useState } from 'react'
import { ReferenceListDialog } from '../../../components/reference-list-dialog'
import { RemoteListPagination } from '../../../components/remote-list-pagination'
import { useRemoteReferenceList, type RemoteReferencePage } from '../../../hooks/use-remote-reference-list'
import type { CanonicalActorReference } from '../../../lib/opportunities/actors'
import type { Communication, CommunicationCriterion, CommunicationRecipient, CommunicationResolution, CriterionOperation, CriterionType } from '../../../lib/communications/communications'
import { addManualPersonAction, confirmRecipientsAction, replaceAudienceAction, resolveAudienceAction, setRecipientIncludedAction, updateCommunicationAction, type CommunicationActionState } from './actions'
import { CommunicationCriterionLabelsContext, CommunicationMultiReferencePicker, CommunicationReferencePicker, type CommunicationReferenceKind } from './reference-picker'

const initial: CommunicationActionState = { status: 'idle', message: null }
const labels: Record<CriterionType, string> = { person: 'Persona explícita', organization: 'Organización explícita', node_participants: 'Participantes directos de Nodo', articulation_participants: 'Participantes directos de Articulación', project_participants: 'Participantes directos de Proyecto', person_skill: 'Personas por habilidad', organization_capability: 'Organizaciones por capacidad', theme_responsibles: 'Responsables de Tema' }
type Draft = { group_no: number; criterion_type: CriterionType; criterion_operation: CriterionOperation; person_id?: string; organization_id?: string; node_id?: string; articulation_id?: string; project_id?: string; skill_id?: string; theme_id?: string; verification_statuses?: string[] }
const field = (type: CriterionType) => type === 'person' ? 'person_id' : type === 'organization' ? 'organization_id' : type === 'node_participants' ? 'node_id' : type === 'articulation_participants' ? 'articulation_id' : type === 'project_participants' ? 'project_id' : type === 'theme_responsibles' ? 'theme_id' : 'skill_id'
const kind = (type: CriterionType): CommunicationReferenceKind => type === 'person' ? 'person' : type === 'organization' ? 'organization' : type === 'node_participants' ? 'node' : type === 'articulation_participants' ? 'articulation' : type === 'project_participants' ? 'project' : type === 'theme_responsibles' ? 'theme' : type === 'person_skill' ? 'person_skill' : 'organization_capability'
function toDraft(item: CommunicationCriterion): Draft { return { group_no: item.group_no, criterion_type: item.criterion_type, criterion_operation: item.criterion_operation, person_id: item.person_id ?? undefined, organization_id: item.organization_id ?? undefined, node_id: item.node_id ?? undefined, articulation_id: item.articulation_id ?? undefined, project_id: item.project_id ?? undefined, skill_id: item.skill_id ?? undefined, theme_id: item.theme_id ?? undefined, verification_statuses: item.verification_statuses ?? undefined } }


function nextGroup(items: Draft[]) {
  return items.reduce(
    (maximum, item) => Math.max(maximum, item.group_no),
    0
  ) + 1
}

function selectedIds(
  items: Draft[],
  type: CriterionType,
  key: keyof Draft
) {
  return items
    .filter(
      (item) =>
        item.criterion_type === type &&
        item.criterion_operation === 'include'
    )
    .map((item) => item[key])
    .filter((value): value is string => typeof value === 'string')
}

function replaceUnionSelections(
  items: Draft[],
  type: CriterionType,
  key: keyof Draft,
  values: string[]
) {
  const retained = items.filter(
    (item) =>
      !(
        item.criterion_type === type &&
        item.criterion_operation === 'include'
      )
  )

  let group = nextGroup(retained)

  const added = values.map((value) => {
    const item: Draft = {
      group_no: group++,
      criterion_type: type,
      criterion_operation: 'include',
    }

    ;(item as Record<string, unknown>)[key] = value

    return item
  })

  return [...retained, ...added]
}

function addAudienceRule(
  items: Draft[],
  type: CriterionType
) {
  const item: Draft = {
    group_no: nextGroup(items),
    criterion_type: type,
    criterion_operation: 'include',
  }

  if (
    type === 'person_skill' ||
    type === 'organization_capability'
  ) {
    item.verification_statuses = ['confirmed']
  }

  return [...items, item]
}

function MessageEditor({ communication }: { communication: Communication }) {
  const [state, action, pending] = useActionState(
    updateCommunicationAction.bind(null, communication.communication_id),
    initial
  )

  const editable = communication.status === 'draft'
  const channelLabels = communication.planned_channels.map((channel) =>
    channel === 'email' ? 'Email' : 'WhatsApp'
  )

  if (!editable) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Mensaje</h2>
            <p className="mt-1 text-sm text-slate-500">
              El contenido queda en sólo lectura una vez resuelta la audiencia.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Sólo lectura
          </span>
        </div>

        <dl className="mt-4 space-y-4">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Asunto
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {communication.subject}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cuerpo
            </dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
              {communication.body}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Canales previstos
            </dt>
            <dd className="mt-1 text-sm text-slate-700">
              {channelLabels.length > 0
                ? channelLabels.join(' · ')
                : 'Sin canales previstos'}
            </dd>
          </div>
        </dl>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Mensaje</h2>
      <p className="mt-2 text-sm text-slate-600">
        Revisá el contenido y los canales previstos antes de resolver la audiencia.
        Guardar cambios no realiza ningún envío.
      </p>

      <form action={action} className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Asunto</span>
          <input
            name="subject"
            required
            minLength={3}
            maxLength={500}
            defaultValue={communication.subject}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Cuerpo</span>
          <textarea
            name="body"
            required
            minLength={3}
            rows={8}
            defaultValue={communication.body}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm leading-6"
          />
        </label>

        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-700">
            Canales previstos
          </legend>

          <p className="mt-1 text-xs text-slate-500">
            Indican una intención futura. No disparan ningún envío.
          </p>

          <label className="mt-3 mr-5 inline-flex items-center gap-2 text-sm">
            <input
              name="channel_email"
              type="checkbox"
              defaultChecked={communication.planned_channels.includes('email')}
            />
            Email
          </label>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              name="channel_whatsapp"
              type="checkbox"
              defaultChecked={communication.planned_channels.includes('whatsapp')}
            />
            WhatsApp
          </label>
        </fieldset>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Motivo del cambio
          </span>
          <input
            name="rationale"
            placeholder="Opcional"
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
          />
        </label>

        {state.message ? (
          <p
            role={state.status === 'error' ? 'alert' : 'status'}
            className={
              state.status === 'error'
                ? 'rounded-xl bg-red-50 p-3 text-sm text-red-700'
                : 'rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800'
            }
          >
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="ux-button min-h-11 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </section>
  )
}

function Audience({
  communication,
  criteria,
  criterionLabels,
}: {
  communication: Communication
  criteria: CommunicationCriterion[]
  criterionLabels: Record<string, string>
}) {
  const criterionLabelsForReadOnly = (id: string) =>
    criterionLabels[id] ?? (id || 'Referencia no disponible')

  const [items, setItems] = useState<Draft[]>(criteria.map(toDraft))
  const [error, setError] = useState<string | null>(null)
  const [autoOpenGroup, setAutoOpenGroup] =
    useState<number | null>(null)

  const [state, action, pending] = useActionState(
    replaceAudienceAction.bind(null, communication.communication_id),
    initial
  )

  const editable =
    communication.status !== 'recipients_confirmed' &&
    communication.status !== 'cancelled'

  const update = (
    index: number,
    values: Partial<Draft>
  ) =>
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, ...values }
          : item
      )
    )

  const validate = () => {
    if (!items.length) {
      return 'Agregá al menos un destinatario o criterio de audiencia.'
    }

    const missing = items.find(
      (item) =>
        !String(
          (item as Record<string, unknown>)[
            field(item.criterion_type)
          ] ?? ''
        )
    )

    if (missing) {
      return `Completá la selección de ${labels[missing.criterion_type]}.`
    }

    const invalidSkill = items.find(
      (item) =>
        (
          item.criterion_type === 'person_skill' ||
          item.criterion_type === 'organization_capability'
        ) &&
        !(item.verification_statuses?.length)
    )

    if (invalidSkill) {
      return 'Seleccioná al menos un estado de verificación para cada habilidad o capacidad.'
    }

    return null
  }

  const message = error ?? state.message
  const isError =
    Boolean(error) ||
    state.status === 'error'

  if (!editable) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              Audiencia
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              La audiencia queda en sólo lectura una vez confirmados los destinatarios.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Sólo lectura
          </span>
        </div>

        {criteria.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
            No hay criterios registrados.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {criteria.map((item) => {
              const source = field(item.criterion_type)
              const referenceId = String(
                (item as unknown as Record<string, unknown>)[source] ?? ''
              )

              return (
                <article
                  key={item.criterion_id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <span>
                      <strong>
                        {item.criterion_operation === 'include'
                          ? 'Incluye'
                          : 'Excluye'}:
                      </strong>{' '}
                      {labels[item.criterion_type]}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-600">
                    <strong>Referencia:</strong>{' '}
                    {criterionLabelsForReadOnly(referenceId)}
                  </p>

                  {item.node_id &&
                  (
                    item.criterion_type === 'person_skill' ||
                    item.criterion_type === 'organization_capability'
                  ) ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Nodo:{' '}
                      {criterionLabelsForReadOnly(item.node_id)}
                    </p>
                  ) : null}

                  {item.verification_statuses?.length ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Estados:{' '}
                      {item.verification_statuses
                        .map((status) =>
                          status === 'confirmed'
                            ? 'Confirmada'
                            : status === 'candidate'
                              ? 'Candidata'
                              : status === 'self_reported'
                                ? 'Autodeclarada'
                                : status
                        )
                        .join(' · ')}
                    </p>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>
    )
  }

  const people = selectedIds(
    items,
    'person',
    'person_id'
  )

  const organizations = selectedIds(
    items,
    'organization',
    'organization_id'
  )

  const nodes = selectedIds(
    items,
    'node_participants',
    'node_id'
  )

  const skillRules = items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.criterion_type === 'person_skill' &&
        item.criterion_operation === 'include'
    )

  const capabilityRules = items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.criterion_type === 'organization_capability' &&
        item.criterion_operation === 'include'
    )

  const additionalRules = items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        item.criterion_operation === 'include' &&
        (
          item.criterion_type === 'articulation_participants' ||
          item.criterion_type === 'project_participants' ||
          item.criterion_type === 'theme_responsibles'
        )
    )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">
        Audiencia
      </h2>

      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        Elegí quiénes deben formar parte de esta comunicación.
        Podés combinar Personas, Organizaciones, Nodos,
        habilidades, capacidades y otros ámbitos. Las selecciones
        se suman entre sí.
      </p>

      {message ? (
        <p
          role={isError ? 'alert' : 'status'}
          className={
            isError
              ? 'mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700'
              : 'mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800'
          }
        >
          {message}
        </p>
      ) : null}

      <form
        action={action}
        noValidate
        onSubmit={(event) => {
          const validation = validate()
          setError(validation)

          if (validation) {
            event.preventDefault()
          }
        }}
        className="mt-5 space-y-6"
      >
        <input
          type="hidden"
          name="criteria_json"
          value={JSON.stringify(items)}
        />

        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">
            Personas específicas
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Elegí una o varias Personas canónicas.
          </p>

          <CommunicationMultiReferencePicker
            kind="person"
            values={people}
            onChange={(values) =>
              setItems((current) =>
                replaceUnionSelections(
                  current,
                  'person',
                  'person_id',
                  values
                )
              )
            }
          />
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">
            Organizaciones específicas
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Elegí una o varias Organizaciones canónicas.
          </p>

          <CommunicationMultiReferencePicker
            kind="organization"
            values={organizations}
            onChange={(values) =>
              setItems((current) =>
                replaceUnionSelections(
                  current,
                  'organization',
                  'organization_id',
                  values
                )
              )
            }
          />
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">
            Personas por Nodo
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Incluye las Personas con participación directa,
            activa y confirmada en uno o varios Nodos.
          </p>

          <CommunicationMultiReferencePicker
            kind="node"
            values={nodes}
            onChange={(values) =>
              setItems((current) =>
                replaceUnionSelections(
                  current,
                  'node_participants',
                  'node_id',
                  values
                )
              )
            }
          />
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">
                Personas por habilidad
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                La búsqueda puede abarcar todo MP25M o limitarse a un Nodo.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const groupNo = nextGroup(items)
                setAutoOpenGroup(groupNo)
                setItems(
                  addAudienceRule(
                    items,
                    'person_skill'
                  )
                )
              }}
              className="ux-button rounded-xl border border-[#2F5D8C]/30 px-3 py-2 text-sm font-semibold text-[#1E3A5F]"
            >
              Agregar habilidad
            </button>
          </div>

          {skillRules.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No agregaste filtros por habilidad.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {skillRules.map(({ item, index }) => (
                <div
                  key={`${item.group_no}-${index}`}
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Habilidad
                  </p>

                  <CommunicationReferencePicker
                    kind="person_skill"
                    value={item.skill_id ?? ''}
                    openOnMount={
                      autoOpenGroup === item.group_no
                    }
                    onChange={(value) => {
                      update(index, {
                        skill_id: value,
                      })
                      setAutoOpenGroup(null)
                    }}
                  />

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Alcance territorial
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      Sin Nodo seleccionado = todo MP25M.
                    </p>

                    <CommunicationReferencePicker
                      kind="node"
                      value={item.node_id ?? ''}
                      onChange={(value) =>
                        update(index, {
                          node_id: value || undefined,
                        })
                      }
                    />

                    {item.node_id ? (
                      <button
                        type="button"
                        onClick={() =>
                          update(index, {
                            node_id: undefined,
                          })
                        }
                        className="ux-button mt-2 text-sm font-semibold text-[#1E3A5F]"
                      >
                        Usar todo MP25M
                      </button>
                    ) : null}
                  </div>

                  <fieldset className="mt-4">
                    <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Estados admitidos
                    </legend>

                    {[
                      ['confirmed', 'Confirmada'],
                      ['candidate', 'Candidata'],
                      ['self_reported', 'Autodeclarada'],
                    ].map(([value, label]) => {
                      const current =
                        item.verification_statuses ??
                        ['confirmed']

                      return (
                        <label
                          key={value}
                          className="mr-4 mt-2 inline-flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={current.includes(value)}
                            onChange={() =>
                              update(index, {
                                verification_statuses:
                                  current.includes(value)
                                    ? current.filter(
                                        (status) =>
                                          status !== value
                                      )
                                    : [...current, value],
                              })
                            }
                          />
                          {label}
                        </label>
                      )
                    })}
                  </fieldset>

                  <button
                    type="button"
                    onClick={() =>
                      setItems((current) =>
                        current.filter(
                          (_, itemIndex) =>
                            itemIndex !== index
                        )
                      )
                    }
                    className="ux-button mt-4 text-sm font-semibold text-red-700"
                  >
                    Quitar habilidad
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">
                Organizaciones por capacidad
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Podés buscar en toda la organización o limitar
                la capacidad a un Nodo.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                const groupNo = nextGroup(items)
                setAutoOpenGroup(groupNo)
                setItems(
                  addAudienceRule(
                    items,
                    'organization_capability'
                  )
                )
              }}
              className="ux-button rounded-xl border border-[#2F5D8C]/30 px-3 py-2 text-sm font-semibold text-[#1E3A5F]"
            >
              Agregar capacidad
            </button>
          </div>

          {capabilityRules.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No agregaste filtros por capacidad.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {capabilityRules.map(({ item, index }) => (
                <div
                  key={`${item.group_no}-${index}`}
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Capacidad
                  </p>

                  <CommunicationReferencePicker
                    kind="organization_capability"
                    value={item.skill_id ?? ''}
                    openOnMount={
                      autoOpenGroup === item.group_no
                    }
                    onChange={(value) => {
                      update(index, {
                        skill_id: value,
                      })
                      setAutoOpenGroup(null)
                    }}
                  />

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Alcance territorial
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      Sin Nodo seleccionado = todo MP25M.
                    </p>

                    <CommunicationReferencePicker
                      kind="node"
                      value={item.node_id ?? ''}
                      onChange={(value) =>
                        update(index, {
                          node_id: value || undefined,
                        })
                      }
                    />

                    {item.node_id ? (
                      <button
                        type="button"
                        onClick={() =>
                          update(index, {
                            node_id: undefined,
                          })
                        }
                        className="ux-button mt-2 text-sm font-semibold text-[#1E3A5F]"
                      >
                        Usar todo MP25M
                      </button>
                    ) : null}
                  </div>

                  <fieldset className="mt-4">
                    <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Estados admitidos
                    </legend>

                    {[
                      ['confirmed', 'Confirmada'],
                      ['candidate', 'Candidata'],
                      ['self_reported', 'Autodeclarada'],
                    ].map(([value, label]) => {
                      const current =
                        item.verification_statuses ??
                        ['confirmed']

                      return (
                        <label
                          key={value}
                          className="mr-4 mt-2 inline-flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={current.includes(value)}
                            onChange={() =>
                              update(index, {
                                verification_statuses:
                                  current.includes(value)
                                    ? current.filter(
                                        (status) =>
                                          status !== value
                                      )
                                    : [...current, value],
                              })
                            }
                          />
                          {label}
                        </label>
                      )
                    })}
                  </fieldset>

                  <button
                    type="button"
                    onClick={() =>
                      setItems((current) =>
                        current.filter(
                          (_, itemIndex) =>
                            itemIndex !== index
                        )
                      )
                    }
                    className="ux-button mt-4 text-sm font-semibold text-red-700"
                  >
                    Quitar capacidad
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">
                Otros ámbitos
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                También podés sumar participantes de una
                Articulación, Proyecto o responsables de un Tema.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setItems((current) =>
                  addAudienceRule(
                    current,
                    'articulation_participants'
                  )
                )
              }
              className="ux-button rounded-xl border px-3 py-2 text-sm"
            >
              + Articulación
            </button>

            <button
              type="button"
              onClick={() =>
                setItems((current) =>
                  addAudienceRule(
                    current,
                    'project_participants'
                  )
                )
              }
              className="ux-button rounded-xl border px-3 py-2 text-sm"
            >
              + Proyecto
            </button>

            <button
              type="button"
              onClick={() =>
                setItems((current) =>
                  addAudienceRule(
                    current,
                    'theme_responsibles'
                  )
                )
              }
              className="ux-button rounded-xl border px-3 py-2 text-sm"
            >
              + Tema
            </button>
          </div>

          {additionalRules.length > 0 ? (
            <div className="mt-4 space-y-3">
              {additionalRules.map(({ item, index }) => (
                <div
                  key={`${item.group_no}-${index}`}
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <p className="font-semibold">
                    {labels[item.criterion_type]}
                  </p>

                  <CommunicationReferencePicker
                    kind={kind(item.criterion_type)}
                    value={String(
                      (
                        item as Record<
                          string,
                          unknown
                        >
                      )[field(item.criterion_type)] ??
                        ''
                    )}
                    onChange={(value) =>
                      update(
                        index,
                        {
                          [field(item.criterion_type)]:
                            value,
                        } as Partial<Draft>
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setItems((current) =>
                        current.filter(
                          (_, itemIndex) =>
                            itemIndex !== index
                        )
                      )
                    }
                    className="ux-button mt-3 text-sm font-semibold text-red-700"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            disabled={pending}
            className="ux-button min-h-11 rounded-xl bg-[#1E3A5F] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending
              ? 'Guardando audiencia...'
              : 'Guardar audiencia'}
          </button>

          <p className="self-center text-xs text-slate-500">
            Guardar la audiencia no realiza ningún envío.
          </p>
        </div>
      </form>
    </section>
  )
}


function Recipients({ communication, resolution }: { communication: Communication; resolution: CommunicationResolution }) {
  const [revision, setRevision] = useState(0); const [state, confirm, confirming] = useActionState(confirmRecipientsAction.bind(null, communication.communication_id, resolution.resolution_id), initial)
  const fetchPage = useCallback(async ({ query, cursor, signal }: { query: string; cursor: string | null; signal: AbortSignal }) => { const params = new URLSearchParams({ resolution_id: resolution.resolution_id, q: query, limit: '50' }); if (cursor) params.set('cursor', cursor); const response = await fetch(`/api/panel/comunicaciones/recipients?${params}`, { signal }); if (!response.ok) throw new Error('No se pudieron cargar destinatarios.'); return await response.json() as RemoteReferencePage<CommunicationRecipient> }, [resolution.resolution_id])
  const list = useRemoteReferenceList({ contextKey: `${resolution.resolution_id}:${revision}`, getItemKey: (item) => item.recipient_id, fetchPage, enabledInitially: true }); const editable = communication.status === 'audience_resolved' && !resolution.confirmed_at
  const canConfirm = editable && !list.hasMore && !list.loadingMore && !list.query
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Destinatarios</h2><p className="mt-2 text-sm text-slate-600">Resolución {resolution.resolution_no}: {resolution.recipient_count} en total, {resolution.included_recipient_count} incluidos, {resolution.excluded_recipient_count} excluidos y {resolution.duplicate_recipient_count} duplicados.</p><p className="mt-1 text-xs text-slate-500">Sin Email: {resolution.person_email_unavailable_count} · sin WhatsApp: {resolution.person_whatsapp_unavailable_count} · organizaciones sin canal institucional: {resolution.unsupported_organization_count}</p><input type="search" value={list.query} onFocus={list.open} onChange={(e) => list.setQuery(e.target.value)} placeholder="Buscar destinatario..." className="mt-4 min-h-10 w-full rounded-lg border border-slate-300 px-3" />{list.items.map((recipient) => <Recipient key={recipient.recipient_id} communicationId={communication.communication_id} recipient={recipient} editable={editable} onChanged={() => setRevision((value) => value + 1)} />)}<RemoteListPagination key={list.paginationKey} hasMore={list.hasMore} loadingMore={list.loadingMore} error={list.loadMoreError} onLoadMore={list.loadMore} />{editable ? <ManualPersonForm communicationId={communication.communication_id} resolutionId={resolution.resolution_id} existingIds={list.items.flatMap((recipient) => recipient.person_id ? [recipient.person_id] : [])} onChanged={() => setRevision((value) => value + 1)} /> : null}{editable ? <form action={confirm} noValidate className="mt-5 rounded-xl bg-emerald-50 p-4"><p className="font-semibold text-emerald-950">La confirmación abarca la resolución completa. No realiza ningún envío.</p>{!canConfirm ? <p role="status" className="mt-2 text-sm text-emerald-900">Cargá todas las páginas y borrá la búsqueda antes de confirmar destinatarios.</p> : null}{state.message ? <p role="alert" className="mt-2 text-sm text-emerald-950">{state.message}</p> : null}<button disabled={confirming || !canConfirm} className="ux-button mt-3 min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{confirming ? 'Confirmando...' : 'Confirmar destinatarios'}</button></form> : <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">Destinatarios confirmados. El envío externo no está habilitado.</p>}</section>
}

function ManualPersonForm({ communicationId, resolutionId, existingIds, onChanged }: { communicationId: string; resolutionId: string; existingIds: string[]; onChanged: () => void }) { const [selected, setSelected] = useState<CanonicalActorReference | null>(null); const [reason, setReason] = useState(''); const [error, setError] = useState<string | null>(null); const [state, action, pending] = useActionState(addManualPersonAction.bind(null, communicationId, resolutionId), initial); useEffect(() => { if (state.status === 'success') onChanged() }, [onChanged, state.status]); const fetchPage = useCallback(async ({ query, cursor, signal }: { query: string; cursor: string | null; signal: AbortSignal }) => { const params = new URLSearchParams({ mode: 'reference', actor_type: 'person', q: query, limit: '50' }); if (cursor) params.set('cursor', cursor); const response = await fetch(`/api/panel/oportunidades/actores?${params}`, { signal }); if (!response.ok) throw new Error('No se pudo cargar Personas.'); return await response.json() as RemoteReferencePage<CanonicalActorReference> }, []); const people = useRemoteReferenceList({ contextKey: 'manual-communication-person', getItemKey: (item) => item.actor_id, fetchPage }); const excluded = new Set(existingIds); return <form action={action} noValidate onSubmit={(event) => { if (!selected || reason.trim().length < 3) { event.preventDefault(); setError('Elegí una Persona canónica e indicá un motivo de al menos 3 caracteres.') } }} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold">Agregar Persona canónica</p><p className="mt-1 text-sm text-slate-600">Sólo se agrega a esta resolución; no crea una Persona ni una relación de dominio.</p><input type="hidden" name="person_id" value={selected?.actor_id ?? ''} /><ReferenceListDialog buttonClassName="mt-3" title="Personas canónicas" description="Buscá o explorá Personas existentes." items={people.items.filter((person) => !excluded.has(person.actor_id))} getItemKey={(person) => person.actor_id} getItemSearchText={(person) => person.display_name} emptyMessage="No hay Personas disponibles." onOpen={people.open} onSelect={setSelected} renderItem={(person) => <strong>{person.display_name}</strong>} remote={{ ...people, autoLoad: true, onQueryChange: people.setQuery, onLoadMore: people.loadMore, onRetry: people.retry }} /><p role="status" className="mt-2 text-sm">{selected ? `Seleccionada: ${selected.display_name}` : 'Sin Persona seleccionada.'}</p><label className="mt-2 block text-sm">Motivo<input name="reason" value={reason} onChange={(event) => { setReason(event.target.value); setError(null) }} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3" /></label>{error || state.message ? <p role="alert" className="mt-2 text-sm text-red-700">{error ?? state.message}</p> : null}<button disabled={pending || !selected} className="ux-button mt-3 min-h-10 rounded-lg bg-[#1E3A5F] px-3 text-sm font-semibold text-white disabled:opacity-60">{pending ? 'Agregando...' : 'Agregar Persona'}</button></form> }

function Recipient({ communicationId, recipient, editable, onChanged }: { communicationId: string; recipient: CommunicationRecipient; editable: boolean; onChanged: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [state, action, pending] = useActionState(setRecipientIncludedAction.bind(null, communicationId, recipient.recipient_id, !recipient.included), initial)
  useEffect(() => { if (state.status === 'success') onChanged() }, [onChanged, state.status])

  const kindLabel =
    recipient.recipient_kind === 'person'
      ? 'Persona'
      : recipient.recipient_kind === 'organization'
        ? 'Organización'
        : recipient.recipient_kind === 'internal_user'
          ? 'Usuario interno'
          : 'Destinatario'

  const availabilityLabel = (status: string, channel: 'email' | 'whatsapp') => {
    if (status === 'available_verified') return 'Disponible verificado'
    if (status === 'available_unverified') return 'Disponible sin verificar'
    if (status === 'missing') return channel === 'email' ? 'Sin email' : 'Sin WhatsApp'
    if (status === 'restricted') return 'Restringido'
    if (status === 'unsupported_recipient') return 'No disponible para este destinatario'
    return 'Estado no disponible'
  }

  const emailLabel = availabilityLabel(recipient.email_availability_status, 'email')
  const whatsappLabel = availabilityLabel(recipient.whatsapp_availability_status, 'whatsapp')

  return <article className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><strong>{recipient.display_name_snapshot}</strong><p className="text-xs text-slate-500">{kindLabel} · Email: {emailLabel} · WhatsApp: {whatsappLabel}</p>{editable ? <form action={action} noValidate onSubmit={(e) => { if (reason.trim().length < 3) { e.preventDefault(); setError('Indicá un motivo de al menos 3 caracteres.') } }} className="mt-2 flex gap-2"><input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" className="min-h-9 flex-1 rounded-lg border border-slate-300 px-2 text-sm" /><button disabled={pending} className="ux-button rounded-lg border px-3 text-sm">{recipient.included ? 'Excluir' : 'Reincorporar'}</button></form> : null}{error || state.message ? <p role="alert" className="mt-1 text-xs text-red-700">{error ?? state.message}</p> : null}</article>
}

export function CommunicationWorkspace({ communication, criteria, criterionLabels, resolution }: { communication: Communication; criteria: CommunicationCriterion[]; criterionLabels: Record<string, string>; resolution: CommunicationResolution | null }) { const [state, resolve, resolving] = useActionState(resolveAudienceAction.bind(null, communication.communication_id), initial); return <CommunicationCriterionLabelsContext.Provider value={criterionLabels}><div className="space-y-6"><section className="rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">{communication.status === 'draft' ? 'Borrador' : communication.status === 'audience_resolved' ? 'Audiencia resuelta' : 'Destinatarios confirmados'}</p><h1 className="mt-2 text-2xl font-bold">{communication.subject}</h1><p className="mt-2 text-sm">Contexto: {communication.context_type === 'independent' ? 'Sin contexto' : communication.context_title ?? communication.context_type}</p></section><MessageEditor communication={communication} /><Audience key={`${communication.communication_id}:${communication.status}:${communication.audience_revision}`} communication={communication} criteria={criteria} criterionLabels={criterionLabels} />{communication.status === 'draft' ? <form action={resolve} noValidate className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-600">Resolver no envía ni modifica las entidades de origen.</p>{state.message ? <p role={state.status === 'error' ? 'alert' : 'status'} className={state.status === 'error' ? 'mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700' : 'mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800'}>{state.message}</p> : null}<button disabled={resolving || !criteria.length} className="ux-button mt-3 min-h-11 rounded-xl bg-[#1E3A5F] px-4 text-sm font-semibold text-white">{resolving ? 'Resolviendo...' : 'Resolver audiencia'}</button></form> : null}{resolution ? <Recipients communication={communication} resolution={resolution} /> : null}</div></CommunicationCriterionLabelsContext.Provider> }
