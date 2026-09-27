'use client'

import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  normalizeRemoteReferenceQuery,
  type RemoteReferenceStatus,
} from '../hooks/use-remote-reference-list'
import { RemoteListPagination } from './remote-list-pagination'

type ReferenceListDialogProps<Item> = {
  buttonLabel?: string
  buttonClassName?: string
  title: string
  description: string
  items: Item[]
  loading?: boolean
  errorMessage?: string | null
  searchPlaceholder?: string
  emptyMessage: string
  getItemKey: (item: Item) => string
  getItemSearchText: (item: Item) => string
  matchesFilter?: (
    item: Item,
    normalizedFilter: string
  ) => boolean
  renderItem: (item: Item) => ReactNode
  onOpen?: () => void
  onSelect?: (item: Item) => void
  remote?: {
    paginationKey?: string
    status?: RemoteReferenceStatus
    minimumQueryLength?: number
    autoLoad?: boolean
    query: string
    onQueryChange: (value: string) => void
    initialLoading: boolean
    loadingMore: boolean
    hasMore: boolean
    initialError?: string | null
    loadMoreError?: string | null
    onRetry?: () => void
    onLoadMore?: () => void
  }
}

function normalizeReferenceSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function ReferenceListDialog<Item>({
  buttonLabel = 'Ver lista',
  buttonClassName = '',
  title,
  description,
  items,
  loading = false,
  errorMessage = null,
  searchPlaceholder = 'Filtrar lista...',
  emptyMessage,
  getItemKey,
  getItemSearchText,
  matchesFilter,
  renderItem,
  onOpen,
  onSelect,
  remote,
}: ReferenceListDialogProps<Item>) {
  const dialogRef =
    useRef<HTMLDialogElement>(null)
  const filterInputRef =
    useRef<HTMLInputElement>(null)
  const triggerRef =
    useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const filterId = useId()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')

  const normalizedFilter =
    normalizeReferenceSearch(filter)

  const visibleItems = useMemo(() => {
    if (remote || !normalizedFilter) {
      return items
    }

    return items.filter((item) => {
      if (matchesFilter) {
        return matchesFilter(
          item,
          normalizedFilter
        )
      }

      return normalizeReferenceSearch(
        getItemSearchText(item)
      ).includes(normalizedFilter)
    })
  }, [
    getItemSearchText,
    items,
    matchesFilter,
    normalizedFilter,
    remote,
  ])

  const searchValue = remote
    ? remote.query
    : filter
  const isInitialLoading = remote
    ? remote.initialLoading
    : loading
  const initialError = remote
    ? remote.initialError ?? null
    : errorMessage
  const minimumQueryLength = remote?.minimumQueryLength ?? 2
  const remoteQueryLength = remote
    ? normalizeRemoteReferenceQuery(remote.query).length : 0
  const needsMoreCharacters = remote?.status === 'minimum-query' ||
    (remoteQueryLength > 0 && remoteQueryLength < minimumQueryLength)
  const minimumQueryMessage =
    `Ingresá al menos ${minimumQueryLength} caracteres para buscar, o borrá el texto para explorar.`
  const isIdle = remote?.status === 'idle'

  function openDialog() {
    if (!remote) {
      setFilter('')
    }

    onOpen?.()
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus()
    })
  }

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) {
      return
    }

    if (!open) {
      if (dialog.open) {
        dialog.close()
      }

      return
    }

    if (!dialog.open) {
      dialog.showModal()
    }

    const frame = window.requestAnimationFrame(
      () => {
        filterInputRef.current?.focus()
      }
    )

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        className={[
          'ux-button inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#2F5D8C]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] hover:bg-slate-50 sm:w-auto',
          buttonClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {buttonLabel}
      </button>

      <dialog
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          event.preventDefault()
          closeDialog()
        }}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (
            event.target ===
            event.currentTarget
          ) {
            closeDialog()
          }
        }}
        className="m-auto max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-2xl rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40 sm:w-[min(42rem,calc(100vw-2rem))]"
      >
        <div className="flex max-h-[92vh] flex-col">
          <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="break-words text-base font-semibold text-slate-950"
                >
                  {title}
                </h2>

                <p
                  id={descriptionId}
                  className="mt-1 break-words text-sm leading-6 text-slate-500"
                >
                  {description}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDialog}
                className="ux-button inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              >
                Cerrar
              </button>
            </div>

            <label
              htmlFor={filterId}
              className="mt-4 block"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Buscar en la lista
              </span>

              <input
                ref={filterInputRef}
                id={filterId}
                value={searchValue}
                onChange={(event) => {
                  if (remote) {
                    remote.onQueryChange(event.target.value)
                    return
                  }

                  setFilter(event.target.value)
                }}
                placeholder={searchPlaceholder}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
              />
            </label>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <div
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {needsMoreCharacters ? minimumQueryMessage : isIdle ? 'Explorá la lista o ingresá una búsqueda.' : isInitialLoading
                ? 'Cargando lista'
                : initialError
                  ? initialError
                  : `${visibleItems.length} resultados disponibles`}
            </div>

            {needsMoreCharacters ? (
              <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                {minimumQueryMessage}
              </p>
            ) : isIdle ? (
              <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Explorá la lista o ingresá una búsqueda.
              </p>
            ) : isInitialLoading ? (
              <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Cargando lista...
              </p>
            ) : initialError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                <p>{initialError}</p>

                {remote?.onRetry ? (
                  <button
                    type="button"
                    onClick={remote.onRetry}
                    className="ux-button mt-3 min-h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Reintentar
                  </button>
                ) : null}
              </div>
            ) : visibleItems.length > 0 ? (
              <div className="grid gap-2">
                {visibleItems.map((item) => {
                  const content = renderItem(item)

                  if (!onSelect) {
                    return (
                      <article
                        key={getItemKey(item)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        {content}
                      </article>
                    )
                  }

                  return (
                    <button
                      key={getItemKey(item)}
                      type="button"
                      onClick={() => {
                        onSelect(item)
                        closeDialog()
                      }}
                      className="block min-h-14 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-[#2F5D8C]/40 hover:bg-slate-50 focus:border-[#2F5D8C]/40 focus:bg-slate-50 focus:outline-none"
                    >
                      {content}
                    </button>
                  )
                })}

                {remote?.onLoadMore ? (
                  <RemoteListPagination
                    key={remote.paginationKey ?? remote.query}
                    hasMore={remote.hasMore}
                    loadingMore={remote.loadingMore}
                    error={remote.loadMoreError}
                    onLoadMore={remote.onLoadMore}
                    autoLoad={open && remote.autoLoad === true}
                    rootRef={scrollRef}
                  />
                ) : null}
              </div>
            ) : (
              <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                {emptyMessage}
              </p>
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}
