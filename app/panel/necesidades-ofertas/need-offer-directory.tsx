'use client'

import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import { useRemoteReferenceList } from '../../../hooks/use-remote-reference-list'
import type {
  NeedOfferNodeOption,
  NeedOfferRecordType,
  NeedOfferReference,
  NeedOfferStatus,
  NeedOfferUserOption,
} from '../../../lib/needs-offers/needs-offers'

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

export function NeedOfferDirectory({
  users,
  nodes,
}: {
  users: NeedOfferUserOption[]
  nodes: NeedOfferNodeOption[]
}) {
  const [recordType, setRecordType] =
    useState<NeedOfferRecordType | ''>('')

  const [status, setStatus] =
    useState<NeedOfferStatus | ''>('')

  const [
    responsibleInternalUserId,
    setResponsibleInternalUserId,
  ] = useState('')

  const [nodeId, setNodeId] =
    useState('')

  const fetchPage = useCallback(
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
          q: query,
          limit: '25',
        })

      if (cursor) {
        params.set(
          'cursor',
          cursor
        )
      }

      if (recordType) {
        params.set(
          'types',
          recordType
        )
      }

      if (status) {
        params.set(
          'statuses',
          status
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

      if (nodeId) {
        params.set(
          'node',
          nodeId
        )
      }

      const response =
        await fetch(
          `/api/panel/necesidades-ofertas?${params.toString()}`,
          {
            signal,
            cache: 'no-store',
          }
        )

      if (!response.ok) {
        throw new Error(
          'No se pudo cargar el directorio de necesidades y ofertas.'
        )
      }

      return (
        await response.json()
      ) as {
        items:
          NeedOfferReference[]
        nextCursor:
          string | null
      }
    },
    [
      nodeId,
      recordType,
      responsibleInternalUserId,
      status,
    ]
  )

  const directory =
    useRemoteReferenceList({
      contextKey:
        `needs-offers:${recordType}:${status}:${responsibleInternalUserId}:${nodeId}`,
      getItemKey:
        (
          item:
            NeedOfferReference
        ) =>
          item.need_offer_id,
      fetchPage,
    })

  const openDirectory =
    directory.open

  useEffect(() => {
    openDirectory()
  }, [openDirectory])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Directorio
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Buscá por título o descripción y filtrá por tipo, estado, responsable o nodo.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-medium text-slate-700">
            Buscar
            <input
              value={
                directory.query
              }
              onChange={(event) =>
                directory.setQuery(
                  event.target.value
                )
              }
              placeholder="Ej.: logística..."
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Tipo
            <select
              value={recordType}
              onChange={(event) =>
                setRecordType(
                  event.target
                    .value as
                    | NeedOfferRecordType
                    | ''
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="">
                Todos
              </option>

              {Object.entries(
                typeLabels
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

          <label className="text-sm font-medium text-slate-700">
            Estado
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target
                    .value as
                    | NeedOfferStatus
                    | ''
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="">
                Todos
              </option>

              {Object.entries(
                statusLabels
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

          <label className="text-sm font-medium text-slate-700">
            Responsable
            <select
              value={
                responsibleInternalUserId
              }
              onChange={(event) =>
                setResponsibleInternalUserId(
                  event.target.value
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
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
                    {
                      user.display_name
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Nodo
            <select
              value={nodeId}
              onChange={(event) =>
                setNodeId(
                  event.target.value
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="">
                Todos
              </option>

              {nodes.map(
                (node) => (
                  <option
                    key={node.id}
                    value={node.id}
                  >
                    {
                      node.display_name
                    }
                  </option>
                )
              )}
            </select>
          </label>
        </div>
      </div>

      {directory.initialLoading ? (
        <p className="mt-5 text-sm text-slate-500">
          Cargando necesidades y ofertas...
        </p>
      ) : null}

      {directory.initialError ? (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {
            directory.initialError
          }

          <button
            onClick={
              directory.retry
            }
            className="ml-3 font-semibold underline"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {!directory.initialLoading &&
      !directory.initialError &&
      directory.items.length ===
        0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          No hay necesidades u ofertas que coincidan con los filtros.
        </p>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {directory.items.map(
          (item) => (
            <Link
              key={
                item.need_offer_id
              }
              href={`/panel/necesidades-ofertas/${item.need_offer_id}`}
              className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#2F5D8C]/40 hover:bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <strong className="text-slate-950">
                  {item.title}
                </strong>

                <div className="flex gap-2">
                  <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
                    {
                      typeLabels[
                        item
                          .record_type
                      ]
                    }
                  </span>

                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                    {
                      statusLabels[
                        item.status
                      ]
                    }
                  </span>
                </div>
              </div>

              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                {
                  item.description
                }
              </p>

              <p className="mt-3 text-xs text-slate-500">
                Responsable:{' '}
                {
                  item.responsible_display_name
                }

                {item.node_name
                  ? ` · Nodo: ${item.node_name}`
                  : ''}
              </p>

              {item.latest_followup_detail ? (
                <p className="mt-2 line-clamp-1 text-xs text-slate-500">
                  Última novedad:{' '}
                  {
                    item.latest_followup_detail
                  }
                </p>
              ) : null}

              <span className="mt-3 inline-flex text-xs font-semibold text-[#2F5D8C] transition group-hover:text-[#1E3A5F] group-hover:underline">
                Ver detalle →
              </span>
            </Link>
          )
        )}
      </div>

      {directory.hasMore ? (
        <div className="mt-5 text-center">
          <button
            onClick={
              directory.loadMore
            }
            disabled={
              directory.loadingMore
            }
            className="rounded-xl border border-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50"
          >
            {directory.loadingMore
              ? 'Cargando...'
              : 'Cargar más'}
          </button>

          {directory.loadMoreError ? (
            <p className="mt-2 text-sm text-red-700">
              {
                directory.loadMoreError
              }
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
