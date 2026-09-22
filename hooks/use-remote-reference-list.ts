'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type RemoteReferencePage<Item> = {
  items: Item[]
  nextCursor: string | null
}

export type RemoteReferenceStatus =
  | 'idle' | 'minimum-query' | 'loading' | 'ready' | 'empty'
  | 'error' | 'loadingMore' | 'loadMoreError'

type UseRemoteReferenceListOptions<Item> = {
  contextKey: string
  getItemKey: (item: Item) => string
  fetchPage: (input: {
    query: string
    cursor: string | null
    signal: AbortSignal
  }) => Promise<RemoteReferencePage<Item>>
  minimumQueryLength?: number
}

type ListState<Item> = RemoteReferencePage<Item> & {
  requestKey: string
  status: RemoteReferenceStatus
  initialError: string | null
  loadMoreError: string | null
}

function emptyState<Item>(): ListState<Item> {
  return {
    requestKey: '', status: 'idle', items: [], nextCursor: null,
    initialError: null, loadMoreError: null,
  }
}

// Match normalization in the reference endpoints before checking the minimum:
// for example, "a!" is still a one-character query.
export function normalizeRemoteReferenceQuery(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ').trim()
}

function deduplicateItems<Item>(items: Item[], getItemKey: (item: Item) => string) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = getItemKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function useRemoteReferenceList<Item>({
  contextKey, getItemKey, fetchPage, minimumQueryLength = 2,
}: UseRemoteReferenceListOptions<Item>) {
  const [query, updateQuery] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [revision, setRevision] = useState(0)
  const [previousContextKey, setPreviousContextKey] = useState(contextKey)
  const [state, setState] = useState<ListState<Item>>(emptyState)
  const [moreRequest, setMoreRequest] = useState<{
    requestKey: string
    query: string
    cursor: string
    controller: AbortController
  } | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const completedCursorRef = useRef<string | null>(null)
  const configRef = useRef({ fetchPage, getItemKey })
  const normalizedQuery = normalizeRemoteReferenceQuery(query)
  const needsMoreCharacters = normalizedQuery.length > 0 &&
    normalizedQuery.length < minimumQueryLength
  const requestKey = JSON.stringify([contextKey, normalizedQuery, revision])
  const activeKeyRef = useRef<string | null>(requestKey)

  // A -> B -> A must not revive A's previous cursor while the new request waits.
  // React rerenders this component before committing its children.
  if (previousContextKey !== contextKey) {
    setPreviousContextKey(contextKey)
    setRevision((currentRevision) => currentRevision + 1)
  }

  useEffect(() => {
    configRef.current = { fetchPage, getItemKey }
  }, [fetchPage, getItemKey])

  useEffect(() => {
    activeKeyRef.current = requestKey
    completedCursorRef.current = null
    controllerRef.current?.abort()
    controllerRef.current = null
    if (!enabled || needsMoreCharacters) return

    const controller = new AbortController()
    controllerRef.current = controller
    // One effect owns initial requests, including changes of query AND filters.
    // Cleanup cancels the debounce before it can issue a stale request.
    const timeout = window.setTimeout(async () => {
      try {
        const page = await configRef.current.fetchPage({
          query: normalizedQuery, cursor: null, signal: controller.signal,
        })
        if (controller.signal.aborted) return
        const items = deduplicateItems(page.items, configRef.current.getItemKey)
        setState({
          requestKey, items, nextCursor: page.nextCursor,
          status: items.length ? 'ready' : 'empty',
          initialError: null, loadMoreError: null,
        })
      } catch {
        if (!controller.signal.aborted) {
          setState({
            ...emptyState<Item>(), requestKey, status: 'error',
            initialError: 'No se pudo cargar la lista. Intentá nuevamente.',
          })
        }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
      }
    }, normalizedQuery ? 250 : 0)

    return () => {
      window.clearTimeout(timeout)
      // The current request may be a subsequent page of this same list.
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [enabled, needsMoreCharacters, normalizedQuery, requestKey])

  const setQuery = useCallback((value: string) => {
    // Invalidate immediately, before debounce or an observer callback.
    activeKeyRef.current = null
    controllerRef.current?.abort()
    completedCursorRef.current = null
    updateQuery(value)
    setRevision((current) => current + 1)
  }, [])

  const open = useCallback(() => setEnabled(true), [])
  // Retry an initial error from page one. Additional-page errors are retried
  // through loadMore(), which keeps the existing items and failed cursor.
  const retry = useCallback(() => {
    activeKeyRef.current = null
    controllerRef.current?.abort()
    setEnabled(true)
    setRevision((current) => current + 1)
  }, [])

  const current = state.requestKey === requestKey ? state : emptyState<Item>()
  const status: RemoteReferenceStatus = needsMoreCharacters ? 'minimum-query'
    : !enabled ? 'idle'
      : state.requestKey !== requestKey ? 'loading' : state.status

  const loadMore = useCallback(() => {
    const cursor = state.nextCursor
    if (!enabled || needsMoreCharacters || state.requestKey !== requestKey ||
      activeKeyRef.current !== requestKey || !cursor || controllerRef.current ||
      state.status === 'loadingMore' || completedCursorRef.current === cursor) return

    // Synchronous lock: observer and manual clicks can arrive in the same frame.
    const controller = new AbortController()
    controllerRef.current = controller
    setState((currentState) => ({ ...currentState, status: 'loadingMore', loadMoreError: null }))
    // Queue intent, not network work: an external filter setter in this same
    // event has not rendered its new contextKey yet. The lock above is immediate.
    setMoreRequest({ requestKey, query: normalizedQuery, cursor, controller })
  }, [enabled, needsMoreCharacters, normalizedQuery, requestKey, state])

  useEffect(() => {
    if (!moreRequest || moreRequest.requestKey !== requestKey ||
      activeKeyRef.current !== requestKey || moreRequest.controller.signal.aborted) return
    const { query, cursor, controller } = moreRequest

    // A changed context discards the queued intent before fetchPage is called.
    async function fetchMore() {
      try {
        const page = await configRef.current.fetchPage({ query, cursor, signal: controller.signal })
        if (controller.signal.aborted) return
        if (page.nextCursor === cursor) throw new Error('The cursor did not advance')
        completedCursorRef.current = cursor
        setState((currentState) => ({
          ...currentState,
          items: deduplicateItems([...currentState.items, ...page.items], configRef.current.getItemKey),
          nextCursor: page.nextCursor,
          status: 'ready',
          loadMoreError: null,
        }))
      } catch {
        if (!controller.signal.aborted) {
          setState((currentState) => ({
            ...currentState, status: 'loadMoreError',
            loadMoreError: 'No se pudo cargar más resultados. Intentá nuevamente.',
          }))
        }
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null
      }
    }
    void fetchMore()
    return () => controller.abort()
  }, [moreRequest, requestKey])

  return {
    // Key the pagination UI by this identity so query/filter changes rearm it.
    paginationKey: requestKey,
    query, setQuery, status, minimumQueryLength,
    minimumQueryMessage: needsMoreCharacters
      ? `Ingresá al menos ${minimumQueryLength} caracteres para buscar, o borrá el texto para explorar.` : null,
    items: current.items,
    initialLoading: status === 'loading',
    loadingMore: status === 'loadingMore',
    hasMore: !needsMoreCharacters && status !== 'loading' && current.nextCursor !== null,
    initialError: current.initialError,
    loadMoreError: current.loadMoreError,
    open, retry, loadMore,
  }
}
