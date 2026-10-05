'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useId,
  useState,
} from 'react'

import { ReferenceListDialog } from '../../../components/reference-list-dialog'

type OrganizationSearchResult = {
  id: string
  display_name: string
  organization_type_code: string
  organization_type_name: string
  record_status: string
  confirmed_node_count: number
  capability_count: number
}

type OrganizationTypeOption = {
  code: string
  name: string
  display_order: number
}

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

export function OrganizationSearch({
  organizationTypes,
}: {
  organizationTypes: OrganizationTypeOption[]
}) {
  const router = useRouter()
  const inputId = useId()
  const typeId = useId()
  const resultsId = useId()

  const [query, setQuery] = useState('')
  const [organizationTypeCode, setOrganizationTypeCode] =
    useState('')
  const [results, setResults] =
    useState<OrganizationSearchResult[]>([])
  const [loading, setLoading] =
    useState(false)
  const [hasSearched, setHasSearched] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [inputFocused, setInputFocused] =
    useState(false)

  const term = query.trim()
  const hasTypeFilter =
    organizationTypeCode.length > 0
  const hasActiveFilters =
    term.length > 0 || hasTypeFilter

  function clearFilters() {
    setQuery('')
    setOrganizationTypeCode('')
    setErrorMessage(null)
  }

  useEffect(() => {
    const currentTerm = query.trim()
    const currentType =
      organizationTypeCode.trim()

    const controller = new AbortController()

    const timeout = window.setTimeout(
      async () => {
        if (controller.signal.aborted) {
          return
        }

        setLoading(true)
        setErrorMessage(null)

        try {
          const searchParams =
            new URLSearchParams()

          searchParams.set('q', currentTerm)

          if (currentType) {
            searchParams.set(
              'type',
              currentType
            )
          }

          const response = await fetch(
            `/api/panel/organizaciones?${searchParams.toString()}`,
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
            setHasSearched(true)
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
            setHasSearched(true)
            setErrorMessage(
              'No se pudo completar la búsqueda. Intentá nuevamente.'
            )
          }
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false)
          }
        }
      },
      currentTerm ? 200 : 0
    )

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query, organizationTypeCode])

  return (
    <div>
      <label
        htmlFor={inputId}
        className="text-sm font-semibold text-slate-700"
      >
        Buscar organización
      </label>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Explorá el directorio o escribí desde el primer
        carácter para buscar empresas, cooperativas,
        universidades, sindicatos e instituciones.
      </p>

      <div className="mt-3 grid gap-3 sm:mt-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] md:gap-4">
        <div
          className="relative"
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
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Nombre
            </span>

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
              aria-expanded={inputFocused}
              aria-controls={resultsId}
              aria-busy={loading}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            />
          </label>

          {inputFocused ? (
            <div
              id={resultsId}
              className="absolute left-0 right-0 z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
            >
              <p className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs leading-5 text-slate-500">
                {term
                  ? `Buscando “${term}” en el directorio de organizaciones.`
                  : `${results.length} organización${results.length === 1 ? '' : 'es'} disponible${results.length === 1 ? '' : 's'}. Desplazate para explorar o escribí para filtrar.`}
              </p>

              {loading ? (
                <p className="px-4 py-3 text-sm text-slate-500">
                  {term
                    ? 'Buscando organizaciones...'
                    : 'Cargando organizaciones...'}
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
                    className="block min-h-14 border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <p className="break-words text-sm font-semibold text-slate-900">
                      {organization.display_name}
                    </p>

                    <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                      {organizationMetadata(
                        organization
                      )}
                    </p>
                  </Link>
                ))
              ) : hasSearched ? (
                <p className="px-4 py-3 text-sm text-slate-500">
                  No se encontraron organizaciones con estos filtros.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <label
          htmlFor={typeId}
          className="block"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Tipo de organización
          </span>

          <select
            id={typeId}
            value={organizationTypeCode}
            onChange={(event) =>
              setOrganizationTypeCode(
                event.target.value
              )
            }
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
          >
            <option value="">
              Todos los tipos
            </option>

            {organizationTypes.map((type) => (
              <option
                key={type.code}
                value={type.code}
              >
                {type.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <ReferenceListDialog
            buttonLabel="Ver lista"
            title="Directorio de organizaciones"
            description="Explorá organizaciones canónicas activas o filtrá la lista por nombre, tipo y datos asociados."
            items={results}
            loading={loading}
            errorMessage={errorMessage}
            searchPlaceholder="Filtrar organización..."
            emptyMessage="No se encontraron organizaciones para esta búsqueda."
            getItemKey={(organization) =>
              organization.id
            }
            getItemSearchText={(organization) =>
              [
                organization.display_name,
                organization.organization_type_name,
                organizationMetadata(
                  organization
                ),
              ].join(' ')
            }
            renderItem={(organization) => (
              <div>
                <p className="break-words text-sm font-semibold text-slate-900">
                  {organization.display_name}
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                  {organizationMetadata(
                    organization
                  )}
                </p>
              </div>
            )}
            onSelect={(organization) => {
              router.push(
                `/panel/organizaciones/${organization.id}`
              )
            }}
          />

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Podés explorar la lista completa o escribir
            desde el primer carácter. El tipo funciona como
            filtro adicional.
          </p>
        </div>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#2F5D8C] transition hover:border-[#2F5D8C]/40 hover:bg-slate-50 sm:w-auto"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </div>
  )
}
