'use client'

import Link from 'next/link'
import {
  useEffect,
  useId,
  useState,
} from 'react'

type ActorSearchResult = {
  actor_type:
    | 'person'
    | 'organization'
    | 'candidate'
  actor_id: string
  display_name: string
  type_label: string
  node_ids: string[]
  node_names: string[]
  role_names: string[]
  is_related_to_selected_node: boolean
  is_provisional: boolean
}

type PersonSearchResult =
  ActorSearchResult & {
    actor_type: 'person'
  }

const MINIMUM_QUERY_LENGTH = 3

function isCanonicalPerson(
  actor: ActorSearchResult
): actor is PersonSearchResult {
  return (
    actor.actor_type === 'person' &&
    !actor.is_provisional
  )
}

function personMetadata(
  person: PersonSearchResult
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
  const inputId = useId()
  const resultsId = useId()

  const [query, setQuery] = useState('')
  const [results, setResults] =
    useState<PersonSearchResult[]>([])
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
            `/api/panel/oportunidades/actores?q=${encodeURIComponent(currentTerm)}`,
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
            (await response.json()) as ActorSearchResult[]

          if (!controller.signal.aborted) {
            setResults(
              data.filter(isCanonicalPerson)
            )
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
        Buscar persona
      </label>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Buscá por el nombre actual o por un nombre
        informado anteriormente.
      </p>

      <div className="relative mt-4">
        <input
          id={inputId}
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Ej.: Omar, Santiago..."
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={searchIsOpen}
          aria-controls={resultsId}
          aria-busy={loading}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        />

        {searchIsOpen ? (
          <div
            id={resultsId}
            className="absolute z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {loading ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                Buscando personas...
              </p>
            ) : errorMessage ? (
              <p className="px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </p>
            ) : results.length > 0 ? (
              results.map((person) => (
                <Link
                  key={person.actor_id}
                  href={`/panel/personas/${person.actor_id}`}
                  prefetch={false}
                  className="block border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {person.display_name}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {personMetadata(person)}
                  </p>
                </Link>
              ))
            ) : hasSearched ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                No se encontraron personas coincidentes.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        Escribí al menos tres caracteres. Se muestran
        hasta diez coincidencias y no se carga el padrón
        completo.
      </p>
    </div>
  )
}