'use client'

import { type RefObject, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from 'react'

type RemoteListPaginationProps = {
  hasMore: boolean
  loadingMore: boolean
  error?: string | null
  onLoadMore: () => void
  autoLoad?: boolean
  rootRef?: RefObject<HTMLElement | null>
}

export function RemoteListPagination({
  hasMore, loadingMore, error, onLoadMore, autoLoad = true, rootRef,
}: RemoteListPaginationProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const completionRef = useRef<HTMLParagraphElement>(null)
  const restoreFocusRef = useRef(false)
  const [requestedPage, setRequestedPage] = useState(false)
  const errorId = useId()
  const complete = requestedPage && !hasMore && !loadingMore && !error

  // Callers key this component by the list session (query/context/retry).
  // Callback changes and loading transitions must not reset the observation.
  function requestMore() {
    if (!hasMore || loadingMore) return
    setRequestedPage(true)
    onLoadMore()
  }
  const requestAutomatically = useEffectEvent(() => {
    if (!error) requestMore()
  })

  useLayoutEffect(() => {
    if (loadingMore) {
      const onFocus = (event: FocusEvent) => {
        if (event.target !== buttonRef.current && event.target !== document.body) {
          restoreFocusRef.current = false
        }
      }
      document.addEventListener('focusin', onFocus)
      return () => document.removeEventListener('focusin', onFocus)
    }
    // Disabling/removing the focused button may already have moved focus to
    // BODY. Leave it alone if the user focused another control while waiting.
    if (restoreFocusRef.current && document.activeElement === document.body) {
      const target = hasMore ? buttonRef.current : complete ? completionRef.current : null
      target?.focus({ preventScroll: true })
    }
    restoreFocusRef.current = false
  }, [complete, hasMore, loadingMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !autoLoad || !hasMore ||
      typeof IntersectionObserver === 'undefined') return

    let active = true
    let inside = false
    const observer = new IntersectionObserver((entries) => {
      if (!active) return
      for (const entry of entries) {
        const entering = entry.isIntersecting && !inside
        inside = entry.isIntersecting
        if (entering) requestAutomatically()
      }
    }, { root: rootRef?.current ?? null, rootMargin: '0px 0px 200px 0px' })
    observer.observe(sentinel)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [autoLoad, hasMore, rootRef])

  return (
    <div className="mt-4 text-center">
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <p
        ref={completionRef}
        role="status"
        aria-atomic="true"
        tabIndex={-1}
        className={complete ? 'rounded text-sm text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2' : 'sr-only'}
      >
        {loadingMore ? 'Cargando más resultados...' : complete ? 'No hay más resultados.' : ''}
      </p>
      {error ? <p id={errorId} role="status" className="mb-3 text-sm text-red-700">{error}</p> : null}
      {hasMore ? (
        <button
          ref={buttonRef}
          type="button"
          onClick={(event) => {
            restoreFocusRef.current = document.activeElement === event.currentTarget
            requestMore()
          }}
          disabled={loadingMore}
          aria-describedby={error ? errorId : undefined}
          className="ux-button min-h-11 rounded-xl border border-[#2F5D8C]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] hover:bg-slate-50"
        >
          {loadingMore ? 'Cargando más...' : error ? 'Reintentar carga' : 'Cargar más'}
        </button>
      ) : null}
    </div>
  )
}
