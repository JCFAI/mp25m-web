'use client'

import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

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
  renderItem: (item: Item) => ReactNode
  onOpen?: () => void
  onSelect?: (item: Item) => void
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
  renderItem,
  onOpen,
  onSelect,
}: ReferenceListDialogProps<Item>) {
  const dialogRef =
    useRef<HTMLDialogElement>(null)
  const filterInputRef =
    useRef<HTMLInputElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const filterId = useId()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')

  const normalizedFilter =
    normalizeReferenceSearch(filter)

  const visibleItems = useMemo(() => {
    if (!normalizedFilter) {
      return items
    }

    return items.filter((item) =>
      normalizeReferenceSearch(
        getItemSearchText(item)
      ).includes(normalizedFilter)
    )
  }, [getItemSearchText, items, normalizedFilter])

  function openDialog() {
    setFilter('')
    onOpen?.()
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
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
        type="button"
        onClick={openDialog}
        className={[
          'inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#2F5D8C]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] transition hover:bg-slate-50 sm:w-auto',
          buttonClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {buttonLabel}
      </button>

      <dialog
        ref={dialogRef}
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
                className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
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
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value)
                }
                placeholder={searchPlaceholder}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {loading ? (
              <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Cargando lista...
              </p>
            ) : errorMessage ? (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
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
