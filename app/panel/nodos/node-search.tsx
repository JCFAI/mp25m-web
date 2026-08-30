'use client'

import Link from 'next/link'
import {
  useEffect,
  useId,
  useState,
} from 'react'

type NodeSearchResult = {
  id: string
  node_number: number | null
  display_name: string
  status: string
  jurisdiction_name: string | null
  jurisdiction_type_name: string | null
}

const MINIMUM_QUERY_LENGTH = 2

function nodeMetadata(node: NodeSearchResult) {
  const parts: string[] = []

  if (node.node_number !== null) {
    parts.push(`Nodo ${node.node_number}`)
  }

  if (node.jurisdiction_name) {
    parts.push(
      node.jurisdiction_type_name
        ? `${node.jurisdiction_type_name}: ${node.jurisdiction_name}`
        : node.jurisdiction_name
    )
  }

  return parts.length > 0
    ? parts.join(' · ')
    : 'Cobertura territorial pendiente de completar'
}

export function NodeSearch() {
  const inputId = useId()
  const resultsId = useId()

  const [query, setQuery] = useState('')
  const [results, setResults] =
    useState<NodeSearchResult[]>([])
  const [loading, setLoading] =
    useState(false)
  const [hasSearched, setHasSearched] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const term = query.trim()
  const searchIsOpen =
    term.length >= MINIMUM_QUERY_LENGTH

  useEffect(() => {
    const currentTerm = query.trim()

    setResults([])
    setHasSearched(false)
    setErrorMessage(null)

    if (
      currentTerm.length <
      MINIMUM_QUERY_LENGTH
    ) {
      setLoading(false)
      return
    }

    const controller = new AbortController()

    setLoading(true)

    const timeout = window.setTimeout(
      async () => {
        try {
          const response = await fetch(
            `/api/panel/nodos?q=${encodeURIComponent(currentTerm)}`,
            {
              signal: controller.signal,
              cache: 'no-store',
            }
          )

          if (!response.ok) {
            throw new Error(
              'No se pudo completar la búsqueda.'
            )
          }

          const data =
            (await response.json()) as NodeSearchResult[]

          if (!controller.signal.aborted) {
            setResults(data)
          }
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === 'AbortError'
          ) {
            return
          }

          if (!controller.signal.aborted) {
            setResults([])
            setErrorMessage(
              'No se pudo completar la búsqueda. Intentá nuevamente.'
            )
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false)
            setHasSearched(true)
          }
        }
      },
      250
    )

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query])

  return (
    <div>
      <label
        htmlFor={inputId}
        className="text-sm font-semibold text-slate-700"
      >
        Buscar nodo
      </label>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Buscá por nombre o jurisdicción territorial.
      </p>

      <div className="relative mt-3 sm:mt-4">
        <input
          id={inputId}
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Ej.: Avellaneda, Comuna 3..."
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={searchIsOpen}
          aria-controls={resultsId}
          aria-busy={loading}
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        />

        {searchIsOpen ? (
          <div
            id={resultsId}
            className="absolute left-0 right-0 z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {loading ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                Buscando nodos...
              </p>
            ) : errorMessage ? (
              <p className="px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </p>
            ) : results.length > 0 ? (
              results.map((node) => (
                <Link
                  key={node.id}
                  href={`/panel/nodos/${node.id}`}
                  prefetch={false}
                  className="block min-h-14 border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <p className="break-words text-sm font-semibold text-slate-900">
                    {node.display_name}
                  </p>

                  <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                    {nodeMetadata(node)}
                  </p>
                </Link>
              ))
            ) : hasSearched ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                No se encontraron nodos coincidentes.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        Escribí al menos dos caracteres. Se muestran
        hasta diez coincidencias y no se carga el
        directorio completo.
      </p>
    </div>
  )
}
