'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useReducer,
  useState,
} from 'react'

export type RemoteReferencePage<Item> = {
  items: Item[]
  nextCursor: string | null
}

type FetchRemoteReferencePage<Item> = (
  input: {
    query: string
    cursor: string | null
    signal: AbortSignal
  }
) => Promise<RemoteReferencePage<Item>>

type UseRemoteReferenceListOptions<Item> = {
  contextKey: string
  getItemKey: (item: Item) => string
  fetchPage: FetchRemoteReferencePage<Item>
}

type RemoteReferenceListState<Item> = {
  items: Item[]
  nextCursor: string | null
  initialLoading: boolean
  loadingMore: boolean
  initialError: string | null
  loadMoreError: string | null
}

type RemoteReferenceListAction<Item> =
  | { type: 'reset' }
  | { type: 'initial-start' }
  | {
      type: 'initial-success'
      items: Item[]
      nextCursor: string | null
    }
  | { type: 'initial-error'; message: string }
  | { type: 'initial-finish' }
  | { type: 'more-start' }
  | {
      type: 'more-success'
      items: Item[]
      nextCursor: string | null
    }
  | { type: 'more-error'; message: string }
  | { type: 'more-finish' }

function createInitialState<Item>(): RemoteReferenceListState<Item> {
  return {
    items: [],
    nextCursor: null,
    initialLoading: false,
    loadingMore: false,
    initialError: null,
    loadMoreError: null,
  }
}

function remoteReferenceListReducer<Item>(
  state: RemoteReferenceListState<Item>,
  action: RemoteReferenceListAction<Item>
): RemoteReferenceListState<Item> {
  switch (action.type) {
    case 'reset':
      return createInitialState()
    case 'initial-start':
      return {
        ...createInitialState(),
        initialLoading: true,
      }
    case 'initial-success':
      return {
        ...state,
        items: action.items,
        nextCursor: action.nextCursor,
      }
    case 'initial-error':
      return {
        ...state,
        initialError: action.message,
      }
    case 'initial-finish':
      return {
        ...state,
        initialLoading: false,
      }
    case 'more-start':
      return {
        ...state,
        loadingMore: true,
        loadMoreError: null,
      }
    case 'more-success':
      return {
        ...state,
        items: action.items,
        nextCursor: action.nextCursor,
      }
    case 'more-error':
      return {
        ...state,
        loadMoreError: action.message,
      }
    case 'more-finish':
      return {
        ...state,
        loadingMore: false,
      }
  }
}

function deduplicateItems<Item>(
  items: Item[],
  getItemKey: (item: Item) => string
) {
  const seen = new Set<string>()

  return items.filter((item) => {
    const key = getItemKey(item)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException &&
    error.name === 'AbortError'
  )
}

export function useRemoteReferenceList<Item>({
  contextKey,
  getItemKey,
  fetchPage,
}: UseRemoteReferenceListOptions<Item>) {
  const [query, setQuery] = useState('')
  const [state, dispatch] = useReducer(
    remoteReferenceListReducer<Item>,
    undefined,
    createInitialState<Item>
  )
  const fetchControllerRef = useRef<AbortController | null>(null)
  const hasLoadedRef = useRef(false)
  const queryRef = useRef(query)
  const getItemKeyRef = useRef(getItemKey)
  const fetchPageRef = useRef(fetchPage)

  useEffect(() => {
    getItemKeyRef.current = getItemKey
    fetchPageRef.current = fetchPage
  }, [fetchPage, getItemKey])

  useEffect(() => {
    queryRef.current = query
  }, [query])

  const reset = useCallback(() => {
    fetchControllerRef.current?.abort()
    fetchControllerRef.current = null
    dispatch({ type: 'reset' })
  }, [])

  const loadInitial = useCallback(
    async (nextQuery: string) => {
      fetchControllerRef.current?.abort()

      const controller = new AbortController()
      fetchControllerRef.current = controller
      dispatch({ type: 'initial-start' })

      try {
        const page = await fetchPageRef.current({
          query: nextQuery,
          cursor: null,
          signal: controller.signal,
        })

        if (!controller.signal.aborted) {
          dispatch({
            type: 'initial-success',
            items: deduplicateItems(
              page.items,
              getItemKeyRef.current
            ),
            nextCursor: page.nextCursor,
          })
        }
      } catch (error) {
        if (!controller.signal.aborted && !isAbortError(error)) {
          dispatch({
            type: 'initial-error',
            message: 'No se pudo cargar la lista. Intentá nuevamente.',
          })
        }
      } finally {
        if (!controller.signal.aborted) {
          dispatch({ type: 'initial-finish' })
        }
      }
    },
    []
  )

  const loadMore = useCallback(async () => {
    if (
      !state.nextCursor ||
      state.initialLoading ||
      state.loadingMore
    ) {
      return
    }

    const controller = new AbortController()
    fetchControllerRef.current?.abort()
    fetchControllerRef.current = controller
    dispatch({ type: 'more-start' })

    try {
      const page = await fetchPageRef.current({
        query,
        cursor: state.nextCursor,
        signal: controller.signal,
      })

      if (!controller.signal.aborted) {
        dispatch({
          type: 'more-success',
          items: deduplicateItems(
            [...state.items, ...page.items],
            getItemKeyRef.current
          ),
          nextCursor: page.nextCursor,
        })
      }
      } catch (error) {
        if (!controller.signal.aborted && !isAbortError(error)) {
          dispatch({
            type: 'more-error',
            message: 'No se pudo cargar más resultados. Intentá nuevamente.',
          })
        }
      } finally {
        if (!controller.signal.aborted) {
          dispatch({ type: 'more-finish' })
        }
      }
  }, [query, state.initialLoading, state.items, state.loadingMore, state.nextCursor])

  const open = useCallback(() => {
    if (!hasLoadedRef.current && !state.initialLoading) {
      hasLoadedRef.current = true
      void loadInitial(query)
    }
  }, [loadInitial, query, state.initialLoading])

  const retry = useCallback(() => {
    void loadInitial(query)
  }, [loadInitial, query])

  useEffect(() => {
    if (!hasLoadedRef.current) {
      return
    }

    fetchControllerRef.current?.abort()
    dispatch({ type: 'reset' })

    const timeout = window.setTimeout(() => {
      void loadInitial(query)
    }, 250)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [loadInitial, query])

  useEffect(() => {
    reset()

    if (hasLoadedRef.current) {
      void loadInitial(queryRef.current)
    }
  }, [contextKey, loadInitial, reset])

  useEffect(() => {
    return () => {
      fetchControllerRef.current?.abort()
    }
  }, [])

  return {
    query,
    setQuery,
    items: state.items,
    initialLoading: state.initialLoading,
    loadingMore: state.loadingMore,
    hasMore: state.nextCursor !== null,
    initialError: state.initialError,
    loadMoreError: state.loadMoreError,
    open,
    retry,
    loadMore,
  }
}
