'use client'

import {
  useActionState,
} from 'react'

import type {
  NeedOffer,
  NeedOfferFollowup,
  NeedOfferFollowupType,
  NeedOfferNodeOption,
  NeedOfferRecordType,
  NeedOfferStatus,
  NeedOfferUserOption,
} from '../../../lib/needs-offers/needs-offers'
import {
  createNeedOfferAction,
  createNeedOfferFollowupAction,
  transitionNeedOfferAction,
  updateNeedOfferAction,
  type NeedOfferActionState,
} from './actions'

const initialState: NeedOfferActionState = {
  status: 'idle',
  message: null,
}

const typeLabels: Record<
  NeedOfferRecordType,
  string
> = {
  need: 'Necesidad',
  offer: 'Oferta',
}

const statusLabels: Record<
  NeedOfferStatus,
  string
> = {
  draft: 'Borrador',
  active: 'Vigente',
  paused: 'Pausada',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
}

const followupLabels: Record<
  NeedOfferFollowupType,
  string
> = {
  general: 'Novedad general',
  observation: 'Observación',
  update: 'Actualización',
  next_step: 'Próximo paso',
  result: 'Resultado',
}

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm'

function Feedback({
  state,
}: {
  state: NeedOfferActionState
}) {
  if (!state.message) {
    return null
  }

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

function nodeLabel(
  node: NeedOfferNodeOption
) {
  return node.jurisdiction_name
    ? `${node.display_name} · ${node.jurisdiction_name}`
    : node.display_name
}

function localDateTimeToIso(
  value: string
) {
  const date = new Date(value)

  if (
    !value ||
    Number.isNaN(date.getTime())
  ) {
    throw new Error(
      'Invalid local date/time'
    )
  }

  return date.toISOString()
}

async function createFollowupWithLocalTime(
  needOfferId: string,
  state: NeedOfferActionState,
  formData: FormData
) {
  const value = String(
    formData.get('occurred_at') ?? ''
  ).trim()

  if (value) {
    try {
      formData.set(
        'occurred_at',
        localDateTimeToIso(value)
      )
    } catch {
      return {
        status: 'error',
        message:
          'Revisá la fecha y hora de la novedad.',
      } satisfies NeedOfferActionState
    }
  }

  return createNeedOfferFollowupAction(
    needOfferId,
    state,
    formData
  )
}

export function NeedOfferCreateForm({
  users,
  nodes,
}: {
  users: NeedOfferUserOption[]
  nodes: NeedOfferNodeOption[]
}) {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    createNeedOfferAction,
    initialState
  )

  return (
    <form
      action={action}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Tipo
          <select
            name="record_type"
            defaultValue="need"
            className={inputClass}
          >
            {Object.entries(
              typeLabels
            ).map(
              ([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700">
          Responsable
          <select
            name="responsible_internal_user_id"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="">
              Elegir responsable...
            </option>

            {users.map(
              (user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {
                    user.display_name
                  }
                </option>
              )
            )}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Título
          <input
            name="title"
            required
            minLength={3}
            maxLength={200}
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Descripción
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={10000}
            rows={5}
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold text-slate-700">
          Nodo territorial
          <select
            name="node_id"
            defaultValue=""
            className={inputClass}
          >
            <option value="">
              Sin nodo específico
            </option>

            {nodes.map(
              (node) => (
                <option
                  key={node.id}
                  value={node.id}
                >
                  {nodeLabel(node)}
                </option>
              )
            )}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700">
          Fundamento inicial
          <textarea
            name="rationale"
            required
            minLength={3}
            maxLength={10000}
            rows={3}
            placeholder="Por qué se registra..."
            className={inputClass}
          />
        </label>
      </div>

      <Feedback state={state} />

      <button
        disabled={pending}
        className="mt-5 rounded-xl bg-[#1E3A5F] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending
          ? 'Registrando...'
          : 'Registrar'}
      </button>
    </form>
  )
}

export function NeedOfferEditForm({
  needOffer,
  users,
  nodes,
  canGovern,
}: {
  needOffer: NeedOffer
  users: NeedOfferUserOption[]
  nodes: NeedOfferNodeOption[]
  canGovern: boolean
}) {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    updateNeedOfferAction.bind(
      null,
      needOffer.need_offer_id
    ),
    initialState
  )

  const availableNodes =
    needOffer.node_id &&
    !nodes.some(
      (node) =>
        node.id ===
        needOffer.node_id
    )
      ? [
          {
            id: needOffer.node_id,
            display_name:
              needOffer.node_name ??
              'Nodo actual',
            status: 'current',
            jurisdiction_name: null,
          },
          ...nodes,
        ]
      : nodes

  const availableUsers =
    canGovern &&
    !users.some(
      (user) =>
        user.id ===
        needOffer.responsible_internal_user_id
    )
      ? [
          {
            id:
              needOffer.responsible_internal_user_id,
            display_name:
              `${needOffer.responsible_display_name} (actual)`,
          },
          ...users,
        ]
      : users

  return (
    <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-[#1E3A5F]">
        Editar datos
      </summary>

      <form
        action={action}
        className="grid gap-4 border-t border-slate-200 p-5 sm:grid-cols-2"
      >
        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Título
          <input
            name="title"
            required
            minLength={3}
            maxLength={200}
            defaultValue={
              needOffer.title
            }
            className={inputClass}
          />
        </label>

        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Descripción
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={10000}
            rows={5}
            defaultValue={
              needOffer.description
            }
            className={inputClass}
          />
        </label>

        {canGovern ? (
          <label className="text-sm font-semibold text-slate-700">
            Responsable
            <select
              name="responsible_internal_user_id"
              required
              defaultValue={
                needOffer.responsible_internal_user_id
              }
              className={inputClass}
            >
              {availableUsers.map(
                (user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {
                      user.display_name
                    }
                  </option>
                )
              )}
            </select>
          </label>
        ) : (
          <input
            type="hidden"
            name="responsible_internal_user_id"
            value={
              needOffer.responsible_internal_user_id
            }
          />
        )}

        <label className="text-sm font-semibold text-slate-700">
          Nodo territorial
          <select
            name="node_id"
            defaultValue={
              needOffer.node_id ?? ''
            }
            className={inputClass}
          >
            <option value="">
              Sin nodo específico
            </option>

            {availableNodes.map(
              (node) => (
                <option
                  key={node.id}
                  value={node.id}
                >
                  {nodeLabel(node)}
                </option>
              )
            )}
          </select>
        </label>

        <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
          Fundamento del cambio
          <textarea
            name="rationale"
            required
            minLength={3}
            maxLength={10000}
            rows={3}
            placeholder="Explicá qué se modifica y por qué..."
            className={inputClass}
          />
        </label>

        <div className="sm:col-span-2">
          <Feedback state={state} />

          <button
            disabled={pending}
            className="mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending
              ? 'Guardando...'
              : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </details>
  )
}

export function NeedOfferStatusForm({
  needOffer,
}: {
  needOffer: NeedOffer
}) {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    transitionNeedOfferAction.bind(
      null,
      needOffer.need_offer_id
    ),
    initialState
  )

  const terminal =
    needOffer.status === 'closed' ||
    needOffer.status === 'cancelled'

  const options = terminal
    ? ([
        'active',
      ] as NeedOfferStatus[])
    : (
        Object.keys(
          statusLabels
        ) as NeedOfferStatus[]
      ).filter(
        (status) =>
          status !==
          needOffer.status
      )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">
        Estado
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Actual:{' '}
        <strong>
          {
            statusLabels[
              needOffer.status
            ]
          }
        </strong>
      </p>

      <form
        action={action}
        className="mt-4"
      >
        <select
          name="status"
          defaultValue={
            options[0]
          }
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          {options.map(
            (status) => (
              <option
                key={status}
                value={status}
              >
                {
                  statusLabels[
                    status
                  ]
                }
              </option>
            )
          )}
        </select>

        <textarea
          name="rationale"
          required
          minLength={3}
          maxLength={10000}
          rows={3}
          placeholder="Motivo del cambio..."
          className={`${inputClass} mt-3`}
        />

        <Feedback state={state} />

        <button
          disabled={pending}
          className="mt-3 rounded-xl border border-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50"
        >
          {pending
            ? 'Actualizando...'
            : terminal
              ? 'Reabrir'
              : 'Actualizar estado'}
        </button>
      </form>
    </section>
  )
}

export function NeedOfferFollowups({
  needOfferId,
  followups,
  canFollowup,
}: {
  needOfferId: string
  followups: NeedOfferFollowup[]
  canFollowup: boolean
}) {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    createFollowupWithLocalTime.bind(
      null,
      needOfferId
    ),
    initialState
  )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">
        Novedades y seguimiento
      </h2>

      {followups.length ? (
        <ul className="mt-4 space-y-3">
          {followups.map(
            (item) => (
              <li
                key={
                  item.followup_id
                }
                className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>
                    {
                      followupLabels[
                        item
                          .followup_type
                      ]
                    }
                  </strong>

                  <time className="text-xs text-slate-500">
                    {new Intl.DateTimeFormat(
                      'es-AR',
                      {
                        dateStyle:
                          'short',
                        timeStyle:
                          'short',
                      }
                    ).format(
                      new Date(
                        item.occurred_at
                      )
                    )}
                  </time>
                </div>

                <p className="mt-2 whitespace-pre-line">
                  {item.detail}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Registró:{' '}
                  {
                    item.created_by_display_name
                  }
                </p>
              </li>
            )
          )}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Todavía no hay novedades registradas.
        </p>
      )}

      {canFollowup ? (
        <form
          action={action}
          className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2"
        >
          <label className="text-sm font-semibold text-slate-700">
            Tipo
            <select
              name="followup_type"
              defaultValue="general"
              className={inputClass}
            >
              {Object.entries(
                followupLabels
              ).map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Fecha del hecho
            <input
              name="occurred_at"
              type="datetime-local"
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Detalle
            <textarea
              name="detail"
              required
              minLength={3}
              maxLength={10000}
              rows={4}
              placeholder="Describí la novedad..."
              className={inputClass}
            />
          </label>

          <div className="sm:col-span-2">
            <Feedback state={state} />

            <button
              disabled={pending}
              className="mt-3 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending
                ? 'Registrando...'
                : 'Registrar novedad'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

export {
  statusLabels as needOfferStatusLabels,
  typeLabels as needOfferTypeLabels,
}
