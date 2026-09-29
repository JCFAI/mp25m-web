'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import { RemoteListPagination } from '../../../components/remote-list-pagination'
import { AgendaEditForm } from './agenda-edit-form'
import { AgendaLifecycleControls } from './agenda-lifecycle-controls'
import { useRemoteReferenceList } from '../../../hooks/use-remote-reference-list'
import type {
  AgendaEntryType,
  AgendaItem,
  AgendaSourceType,
  AgendaStatus,
  AgendaUserOption,
} from '../../../lib/agenda/agenda'

type AgendaView =
  | 'upcoming'
  | 'today'
  | 'overdue'
  | 'completed'
  | 'cancelled'

const viewLabels:
Record<AgendaView, string> = {
  upcoming: 'Próximos',
  today: 'Hoy',
  overdue: 'Vencidos',
  completed: 'Completados',
  cancelled: 'Cancelados',
}

const entryTypeLabels:
Record<AgendaEntryType, string> = {
  meeting: 'Reunión',
  visit: 'Visita',
  training: 'Capacitación',
  demonstration: 'Demostración',
  call: 'Llamada',
  follow_up: 'Seguimiento',
  deadline: 'Vencimiento',
  other: 'Otro',
}

const statusLabels:
Record<AgendaStatus, string> = {
  scheduled: 'Programada',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const sourceLabels:
Record<AgendaSourceType, string> = {
  opportunity: 'Oportunidad',
  articulation: 'Articulación',
  project: 'Proyecto',
  theme: 'Tema',
  need_offer: 'Necesidad / oferta',
}

type OriginFilter =
  | ''
  | 'manual'
  | AgendaSourceType

function shiftIsoDate(
  value: string,
  days: number
) {
  const [year, month, day] =
    value.split('-').map(Number)

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + days
      )
    )

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getUTCDate()
    ).padStart(2, '0'),
  ].join('-')
}

function formatDate(
  value: string
) {
  const [year, month, day] =
    value.split('-')

  return `${day}/${month}/${year}`
}

function formatTime(
  value: string | null
) {
  return value
    ? value.slice(0, 5)
    : null
}

function sourceHref(
  item: AgendaItem
) {
  if (
    !item.source_type ||
    !item.source_id
  ) {
    return null
  }

  switch (item.source_type) {
    case 'opportunity':
      return `/panel/oportunidades/${item.source_id}`

    case 'articulation':
      return `/panel/articulaciones/${item.source_id}`

    case 'project':
      return `/panel/proyectos/${item.source_id}`

    case 'theme':
      return `/panel/temas/${item.source_id}`

    case 'need_offer':
      return `/panel/necesidades-ofertas/${item.source_id}`
  }
}

function defaultStatusForView(
  view: AgendaView
): AgendaStatus {
  if (view === 'completed') {
    return 'completed'
  }

  if (view === 'cancelled') {
    return 'cancelled'
  }

  return 'scheduled'
}

export function AgendaDirectory({
  users,
  today,
  revision,
}: {
  users: AgendaUserOption[]
  today: string
  revision: number
}) {
  const [view, setView] =
    useState<AgendaView>('upcoming')

  const [
    lifecycleRevision,
    setLifecycleRevision,
  ] =
    useState(0)

  const handleLifecycleChanged =
    useCallback(() => {
      setLifecycleRevision(
        (current) =>
          current + 1
      )
    }, [])

  const [fromDate, setFromDate] =
    useState('')

  const [toDate, setToDate] =
    useState('')

  const [entryType, setEntryType] =
    useState<AgendaEntryType | ''>('')

  const [origin, setOrigin] =
    useState<OriginFilter>('')

  const [
    responsibleInternalUserId,
    setResponsibleInternalUserId,
  ] = useState('')

  const [
    unassignedOnly,
    setUnassignedOnly,
  ] = useState(false)

  const [
    statusOverride,
    setStatusOverride,
  ] = useState<AgendaStatus | ''>('')

  const effectiveStatus =
    statusOverride ||
    defaultStatusForView(view)

  const presetFrom =
    view === 'upcoming' ||
    view === 'today'
      ? today
      : undefined

  const presetTo =
    view === 'today'
      ? today
      : view === 'overdue'
        ? shiftIsoDate(today, -1)
        : undefined

  const effectiveFrom =
    fromDate || presetFrom

  const effectiveTo =
    toDate || presetTo

  const contextKey =
    JSON.stringify({
      revision,
      lifecycleRevision,
      view,
      fromDate: effectiveFrom ?? '',
      toDate: effectiveTo ?? '',
      entryType,
      origin,
      responsibleInternalUserId,
      unassignedOnly,
      status: effectiveStatus,
    })

  const fetchPage =
    useCallback(
      async ({
        query,
        cursor,
        signal,
      }: {
        query: string
        cursor: string | null
        signal: AbortSignal
      }) => {
        const params =
          new URLSearchParams({
            limit: '25',
            statuses:
              effectiveStatus,
          })

        if (query) {
          params.set(
            'q',
            query
          )
        }

        if (effectiveFrom) {
          params.set(
            'from',
            effectiveFrom
          )
        }

        if (effectiveTo) {
          params.set(
            'to',
            effectiveTo
          )
        }

        if (entryType) {
          params.set(
            'types',
            entryType
          )
        }

        if (origin === 'manual') {
          params.set(
            'kinds',
            'manual'
          )
        } else if (origin) {
          params.set(
            'origins',
            origin
          )
        }

        if (
          responsibleInternalUserId
        ) {
          params.set(
            'responsible',
            responsibleInternalUserId
          )
        }

        if (unassignedOnly) {
          params.set(
            'unassigned',
            'true'
          )
        }

        if (cursor) {
          params.set(
            'cursor',
            cursor
          )
        }

        const response =
          await fetch(
            `/api/panel/agenda?${params.toString()}`,
            {
              signal,
              cache: 'no-store',
            }
          )

        if (!response.ok) {
          throw new Error(
            'No se pudo cargar la agenda.'
          )
        }

        return (
          await response.json()
        ) as {
          items: AgendaItem[]
          nextCursor: string | null
        }
      },
      [
        effectiveFrom,
        effectiveStatus,
        effectiveTo,
        entryType,
        origin,
        responsibleInternalUserId,
        unassignedOnly,
      ]
    )

  const directory =
    useRemoteReferenceList({
      contextKey,
      getItemKey:
        (item: AgendaItem) =>
          item.item_key,
      fetchPage,
      minimumQueryLength: 0,
    })

  const openDirectory =
    directory.open

  useEffect(() => {
    openDirectory()
  }, [openDirectory])

  function selectView(
    nextView: AgendaView
  ) {
    setView(nextView)
    setFromDate('')
    setToDate('')
    setStatusOverride('')
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-100 pb-5">
        <div className="flex flex-wrap gap-2">
          {(
            Object.entries(
              viewLabels
            ) as [
              AgendaView,
              string,
            ][]
          ).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  selectView(value)
                }
                className={
                  view === value
                    ? 'rounded-xl bg-[#1E3A5F] px-3.5 py-2 text-sm font-semibold text-white'
                    : 'rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50'
                }
              >
                {label}
              </button>
            )
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-4">
            Buscar
            <input
              type="search"
              value={directory.query}
              onChange={(event) =>
                directory.setQuery(
                  event.target.value
                )
              }
              placeholder="Título, detalle o entidad de origen..."
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Desde
            <input
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(
                  event.target.value
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Hasta
            <input
              type="date"
              value={toDate}
              onChange={(event) =>
                setToDate(
                  event.target.value
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Tipo
            <select
              value={entryType}
              onChange={(event) =>
                setEntryType(
                  event.target.value as
                    AgendaEntryType | ''
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="">
                Todos
              </option>

              {Object.entries(
                entryTypeLabels
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

          <label className="text-sm font-medium text-slate-700">
            Origen
            <select
              value={origin}
              onChange={(event) =>
                setOrigin(
                  event.target.value as
                    OriginFilter
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="">
                Todos
              </option>

              <option value="manual">
                Registros manuales
              </option>

              {Object.entries(
                sourceLabels
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

          <label className="text-sm font-medium text-slate-700">
            Estado
            <select
              value={statusOverride}
              onChange={(event) =>
                setStatusOverride(
                  event.target.value as
                    AgendaStatus | ''
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="">
                Según vista
              </option>

              {Object.entries(
                statusLabels
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

          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Responsable
            <select
              value={
                responsibleInternalUserId
              }
              disabled={unassignedOnly}
              onChange={(event) => {
                setResponsibleInternalUserId(
                  event.target.value
                )

                if (
                  event.target.value
                ) {
                  setUnassignedOnly(
                    false
                  )
                }
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-100"
            >
              <option value="">
                Todos
              </option>

              {users.map(
                (user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.display_name}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="flex min-h-[44px] items-center gap-3 self-end rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(event) => {
                const checked =
                  event.target.checked

                setUnassignedOnly(
                  checked
                )

                if (checked) {
                  setResponsibleInternalUserId(
                    ''
                  )
                }
              }}
            />

            Sin responsable
          </label>
        </div>
      </div>

      <p
        role="status"
        aria-atomic="true"
        className="mt-5 text-sm text-slate-500"
      >
        {directory.initialLoading
          ? 'Cargando agenda...'
          : directory.status ===
              'empty'
            ? 'No hay elementos que coincidan con los filtros.'
            : directory.initialError ??
              `${directory.items.length} elementos visibles.`}
      </p>

      {directory.initialError ? (
        <button
          type="button"
          onClick={directory.retry}
          className="ux-button mt-3 rounded-lg px-3 py-2 font-semibold text-red-700 underline"
        >
          Reintentar
        </button>
      ) : null}

      <div className="mt-5 space-y-3">
        {directory.items.map(
          (item) => {
            const href =
              sourceHref(item)

            const content = (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={
                        item.item_origin ===
                        'manual'
                          ? 'rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700'
                          : 'rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700'
                      }
                    >
                      {item.item_origin ===
                      'manual'
                        ? 'Manual'
                        : 'Derivada'}
                    </span>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {
                        entryTypeLabels[
                          item.entry_type
                        ]
                      }
                    </span>

                    <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500">
                      {
                        statusLabels[
                          item.agenda_status
                        ]
                      }
                    </span>
                  </div>

                  <div className="text-right text-sm font-semibold text-slate-700">
                    {formatDate(
                      item.scheduled_date
                    )}

                    {formatTime(
                      item.scheduled_time
                    )
                      ? ` · ${formatTime(
                          item.scheduled_time
                        )}`
                      : ' · Todo el día'}
                  </div>
                </div>

                <h3 className="mt-3 text-base font-semibold text-slate-950">
                  {item.title}
                </h3>

                <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                  {item.detail}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                  <span>
                    Responsable:{' '}
                    {item.responsible_display_name ??
                      'Sin asignar'}
                  </span>

                  {item.source_type ? (
                    <span>
                      Origen:{' '}
                      {
                        sourceLabels[
                          item.source_type
                        ]
                      }
                      {item.source_title
                        ? ` · ${item.source_title}`
                        : ''}
                    </span>
                  ) : (
                    <span>
                      Sin entidad de origen
                    </span>
                  )}

                  {item.location_text ? (
                    <span>
                      Lugar:{' '}
                      {item.location_text}
                    </span>
                  ) : null}

                  {item.meeting_mode ? (
                    <span>
                      Modalidad:{' '}
                      {item.meeting_mode ===
                      'in_person'
                        ? 'Presencial'
                        : item.meeting_mode ===
                            'virtual'
                          ? 'Virtual'
                          : 'Híbrida'}
                    </span>
                  ) : null}
                </div>
              </>
            )

            const canTransition =
              item.item_origin ===
                'manual' &&
              item.agenda_status ===
                'scheduled' &&
              Boolean(
                item.agenda_entry_id
              )

            if (canTransition) {
              return (
                <article
                  key={item.item_key}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  {content}

                  {href ? (
                    <Link
                      href={href}
                      className="mt-3 inline-flex text-sm font-semibold text-[#1E3A5F] underline decoration-[#2F5D8C]/30 underline-offset-4"
                    >
                      Abrir entidad de origen
                    </Link>
                  ) : null}

                  <AgendaEditForm
                    item={item}
                    agendaEntryId={
                      item.agenda_entry_id!
                    }
                    users={users}
                    onChanged={
                      handleLifecycleChanged
                    }
                  />

                  <AgendaLifecycleControls
                    agendaEntryId={
                      item.agenda_entry_id!
                    }
                    onChanged={
                      handleLifecycleChanged
                    }
                  />
                </article>
              )
            }

            return href ? (
              <Link
                key={item.item_key}
                href={href}
                className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#2F5D8C]/40 hover:bg-white"
              >
                {content}
              </Link>
            ) : (
              <article
                key={item.item_key}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                {content}
              </article>
            )
          }
        )}
      </div>

      <RemoteListPagination
        key={
          directory.paginationKey
        }
        hasMore={
          directory.hasMore
        }
        loadingMore={
          directory.loadingMore
        }
        error={
          directory.loadMoreError
        }
        onLoadMore={
          directory.loadMore
        }
      />
    </section>
  )
}
