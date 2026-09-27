'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useId,
  useRef,
  useState,
} from 'react'

import { ReferenceListDialog } from '../../../components/reference-list-dialog'
import { RemoteListPagination } from '../../../components/remote-list-pagination'
import { useRemoteReferenceList } from '../../../hooks/use-remote-reference-list'

type PersonReferenceResult = {
  id: string
  display_name: string
  node_names: string[]
  role_names: string[]
}

function personMetadata(
  person: PersonReferenceResult
) {
  const parts: string[] = []

  if (person.node_names.length > 0) {
    parts.push(person.node_names.join(', '))
  }

  if (person.role_names.length > 0) {
    parts.push(person.role_names.join(', '))
  }

  return parts.length > 0
    ? parts.join(' · ')
    : 'Sin participación territorial confirmada'
}

export function PersonSearch() {
  const router = useRouter()
  const inputId = useId()
  const resultsId = useId()
  const inlineListRef =
    useRef<HTMLDivElement>(null)

  const [inputFocused, setInputFocused] =
    useState(false)

  const fetchReferencePage = useCallback(
    async ({
      query,
      cursor,
      signal,
    }: {
      query: string
      cursor: string | null
      signal: AbortSignal
    }) => {
      const params = new URLSearchParams({
        mode: 'reference',
        q: query,
        limit: '50',
      })

      if (cursor) {
        params.set('cursor', cursor)
      }

      const response = await fetch(
        `/api/panel/personas?${params.toString()}`,
        {
          signal,
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        throw new Error(
          'No se pudo cargar la lista.'
        )
      }

      return (await response.json()) as {
        items: PersonReferenceResult[]
        nextCursor: string | null
      }
    },
    []
  )

  const referenceList =
    useRemoteReferenceList({
      contextKey: 'person-directory',
      getItemKey: (
        person: PersonReferenceResult
      ) => person.id,
      fetchPage: fetchReferencePage,
      minimumQueryLength: 1,
      enabledInitially: true,
    })

  const query = referenceList.query
  const term = query.trim()

  return (
    <div>
      <label
        htmlFor={inputId}
        className="text-sm font-semibold text-slate-700"
      >
        Buscar persona
      </label>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Explorá el padrón o escribí desde el primer
        carácter para buscar en todo el directorio.
      </p>

      <div
        className="relative mt-4"
        onFocusCapture={() =>
          setInputFocused(true)
        }
        onBlurCapture={(event) => {
          const nextTarget =
            event.relatedTarget as Node | null

          if (
            !nextTarget ||
            !event.currentTarget.contains(
              nextTarget
            )
          ) {
            setInputFocused(false)
          }
        }}
      >
        <input
          id={inputId}
          value={query}
          onChange={(event) =>
            referenceList.setQuery(
              event.target.value
            )
          }
          placeholder="Ej.: Omar, Santiago..."
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={inputFocused}
          aria-controls={resultsId}
          aria-busy={
            referenceList.initialLoading ||
            referenceList.loadingMore
          }
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        />

        {inputFocused ? (
          <div
            ref={inlineListRef}
            id={resultsId}
            className="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <p className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs leading-5 text-slate-500">
              {term
                ? `Buscando “${term}” en todo el padrón. Desplazate para cargar más resultados.`
                : 'Explorá la lista: desplazate para cargar más o escribí desde el primer carácter para buscar.'}
            </p>

            {referenceList.initialLoading ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                {term
                  ? 'Buscando personas...'
                  : 'Cargando personas...'}
              </p>
            ) : referenceList.initialError ? (
              <div className="px-4 py-3 text-sm text-red-600">
                <p>
                  {referenceList.initialError}
                </p>

                <button
                  type="button"
                  onClick={referenceList.retry}
                  className="ux-button mt-3 min-h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Reintentar
                </button>
              </div>
            ) : referenceList.items.length > 0 ? (
              <>
                {referenceList.items.map(
                  (person) => (
                    <Link
                      key={person.id}
                      href={`/panel/personas/${person.id}`}
                      prefetch={false}
                      className="block min-h-14 border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                    >
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {person.display_name}
                      </p>

                      <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                        {personMetadata(person)}
                      </p>
                    </Link>
                  )
                )}

                <RemoteListPagination
                  key={
                    referenceList.paginationKey
                  }
                  hasMore={
                    referenceList.hasMore
                  }
                  loadingMore={
                    referenceList.loadingMore
                  }
                  error={
                    referenceList.loadMoreError
                  }
                  onLoadMore={
                    referenceList.loadMore
                  }
                  autoLoad={inputFocused}
                  rootRef={inlineListRef}
                />
              </>
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">
                {term
                  ? 'No se encontraron personas coincidentes.'
                  : 'No hay personas disponibles.'}
              </p>
            )}
          </div>
        ) : null}
      </div>

      <ReferenceListDialog
        buttonClassName="mt-3"
        title="Directorio de personas"
        description="Explorá personas canónicas activas o buscá desde el primer carácter."
        items={referenceList.items}
        searchPlaceholder="Buscar persona..."
        emptyMessage="No se encontraron personas para esta búsqueda."
        getItemKey={(person) => person.id}
        getItemSearchText={(person) =>
          [
            person.display_name,
            ...person.node_names,
            ...person.role_names,
          ].join(' ')
        }
        renderItem={(person) => (
          <div>
            <p className="break-words text-sm font-semibold text-slate-900">
              {person.display_name}
            </p>

            <p className="mt-1 break-words text-xs leading-5 text-slate-500">
              {personMetadata(person)}
            </p>
          </div>
        )}
        onOpen={referenceList.open}
        onSelect={(person) => {
          router.push(
            `/panel/personas/${person.id}`
          )
        }}
        remote={{
          paginationKey:
            referenceList.paginationKey,
          status: referenceList.status,
          minimumQueryLength:
            referenceList.minimumQueryLength,
          autoLoad: true,
          query: referenceList.query,
          onQueryChange:
            referenceList.setQuery,
          initialLoading:
            referenceList.initialLoading,
          loadingMore:
            referenceList.loadingMore,
          hasMore: referenceList.hasMore,
          initialError:
            referenceList.initialError,
          loadMoreError:
            referenceList.loadMoreError,
          onRetry: referenceList.retry,
          onLoadMore:
            referenceList.loadMore,
        }}
      />

      <p className="mt-3 text-xs leading-5 text-slate-400">
        La lista se precarga al entrar. Podés
        recorrerla con el mouse o teclado y seguir
        cargando resultados, o escribir desde el
        primer carácter para filtrar todo el padrón.
      </p>
    </div>
  )
}
