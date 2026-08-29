'use client'

import Link from 'next/link'
import {
  useEffect,
  useId,
  useState,
} from 'react'

type OrganizationSearchResult = {
  id: string
  display_name: string
  organization_type_code: string
  organization_type_name: string
  record_status: string
  confirmed_node_count: number
  capability_count: number
}

const MINIMUM_QUERY_LENGTH = 3

function organizationMetadata(
  organization: OrganizationSearchResult
) {
  const nodeText =
    organization.confirmed_node_count === 1
      ? '1 nodo confirmado'
      : `${organization.confirmed_node_count} nodos confirmados`

  const capabilityText =
    organization.capability_count === 1
      ? '1 capacidad'
      : `${organization.capability_count} capacidades`

  return [
    organization.organization_type_name,
    nodeText,
    capabilityText,
  ].join(' · ')
}

export function OrganizationSearch() {
  const inputId = useId()
  const resultsId = useId()

  const [query, setQuery] = useState('')
  const [results, setResults] =
    useState<OrganizationSearchResult[]>([])
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
            `/api/panel/organizaciones?q=${encodeURIComponent(currentTerm)}`,
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
            (await response.json()) as OrganizationSearchResult[]

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
        Buscar organización
      </label>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Buscá empresas, cooperativas, universidades,
        sindicatos, instituciones y otras organizaciones
        incorporadas al registro canónico.
      </p>

      <div className="relative mt-4">
        <input
          id={inputId}
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Ej.: universidad, cooperativa..."
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
                Buscando organizaciones...
              </p>
            ) : errorMessage ? (
              <p className="px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </p>
            ) : results.length > 0 ? (
              results.map((organization) => (
                <Link
                  key={organization.id}
                  href={`/panel/organizaciones/${organization.id}`}
                  prefetch={false}
                  className="block border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {organization.display_name}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {organizationMetadata(
                      organization
                    )}
                  </p>
                </Link>
              ))
            ) : hasSearched ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                No se encontraron organizaciones coincidentes.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-400">
        Escribí al menos tres caracteres. Se muestran
        hasta diez coincidencias y no se carga el
        directorio completo.
      </p>
    </div>
  )
}