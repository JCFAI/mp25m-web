'use client'

import Link from 'next/link'
import {
  useEffect,
  useId,
  useState,
} from 'react'


type SkillSearchResult = {
  id: string
  display_name: string
  category_code: string | null
  category_name: string | null
  description: string | null
  applies_to_person: boolean
  applies_to_organization: boolean
  person_count: number
  organization_count: number
  node_count: number
  alias_count: number
}

type SkillCategoryOption = {
  code: string
  name: string
  description: string | null
  sort_order: number
  skill_count: number
}

const MINIMUM_QUERY_LENGTH = 2

function countLabel(
  value: number,
  singular: string,
  plural: string
) {
  return value === 1
    ? `1 ${singular}`
    : `${value} ${plural}`
}

function skillMetadata(skill: SkillSearchResult) {
  return [
    skill.category_name ??
      'Categoría pendiente',
    countLabel(
      skill.person_count,
      'persona',
      'personas'
    ),
    countLabel(
      skill.organization_count,
      'organización',
      'organizaciones'
    ),
    countLabel(
      skill.node_count,
      'nodo',
      'nodos'
    ),
  ].join(' · ')
}

export function SkillSearch({
  categories,
}: {
  categories: SkillCategoryOption[]
}) {
  const inputId = useId()
  const categoryId = useId()
  const applicationId = useId()
  const resultsId = useId()

  const [query, setQuery] = useState('')
  const [selectedSkill, setSelectedSkill] =
    useState<SkillSearchResult | null>(null)
  const [showFullList, setShowFullList] =
    useState(false)
  const [categoryCode, setCategoryCode] =
    useState('')
  const [application, setApplication] =
    useState('all')
  const [results, setResults] =
    useState<SkillSearchResult[]>([])
  const [loading, setLoading] =
    useState(false)
  const [hasSearched, setHasSearched] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const term = query.trim()
  const hasCategoryFilter =
    categoryCode.length > 0
  const hasApplicationFilter =
    application !== 'all'
  const hasFilter =
    hasCategoryFilter || hasApplicationFilter
  const termCanFilter =
    term.length === 0 ||
    term.length >= MINIMUM_QUERY_LENGTH
  const canSearch =
    selectedSkill === null &&
    (
      showFullList ||
      (hasFilter && termCanFilter) ||
      term.length >= MINIMUM_QUERY_LENGTH
    )
  const hasActiveFilters =
    term.length > 0 || hasFilter

  function clearFilters() {
    setQuery('')
    setSelectedSkill(null)
    setShowFullList(false)
    setCategoryCode('')
    setApplication('all')
    setResults([])
    setHasSearched(false)
    setErrorMessage(null)
    setLoading(false)
  }

  useEffect(() => {
    if (selectedSkill) {
      return
    }

    const currentTerm = query.trim()
    const currentCategory =
      categoryCode.trim()
    const currentApplication = application
    const hasCurrentFilter =
      currentCategory.length > 0 ||
      currentApplication !== 'all'
    const currentTermCanFilter =
      currentTerm.length === 0 ||
      currentTerm.length >=
        MINIMUM_QUERY_LENGTH

    if (
      !showFullList &&
      (
        (!hasCurrentFilter &&
          currentTerm.length <
            MINIMUM_QUERY_LENGTH) ||
        (hasCurrentFilter &&
          !currentTermCanFilter)
      )
    ) {
      return
    }

    const controller = new AbortController()

    const timeout = window.setTimeout(
      async () => {
        setResults([])
        setHasSearched(false)
        setErrorMessage(null)
        setLoading(true)

        try {
          const searchParams =
            new URLSearchParams()

          searchParams.set(
            'q',
            showFullList ? '' : currentTerm
          )
          searchParams.set(
            'application',
            showFullList
              ? 'all'
              : currentApplication
          )

          if (
            !showFullList &&
            currentCategory
          ) {
            searchParams.set(
              'category',
              currentCategory
            )
          }

          if (showFullList) {
            searchParams.set(
              'mode',
              'reference'
            )
          }

          const response = await fetch(
            `/api/panel/habilidades?${searchParams.toString()}`,
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
            (await response.json()) as SkillSearchResult[]

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
  }, [
    query,
    categoryCode,
    application,
    selectedSkill,
    showFullList,
  ])




  return (
    <div>
      <label
        htmlFor={inputId}
        className="text-sm font-semibold text-slate-700"
      >
        Buscar habilidad o capacidad
      </label>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        Buscá por nombre canónico o alias, y acotá por
        categoría o a quién aplica.
      </p>

      <div className="mt-3 grid gap-3 sm:mt-4 lg:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_minmax(180px,240px)] lg:gap-4">
        <div>
          <label
            htmlFor={inputId}
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            Nombre
          </label>

          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <input
              id={inputId}
              value={query}
              onChange={(event) => {
                setSelectedSkill(null)
                setShowFullList(false)
                setQuery(event.target.value)
              }}
              placeholder="Ej.: programación, soldadura..."
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={canSearch}
              aria-controls={resultsId}
              aria-busy={loading}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            />

            <button
              type="button"
              onClick={() => {
                setSelectedSkill(null)
                setQuery('')
                setCategoryCode('')
                setApplication('all')
                setShowFullList(true)
              }}
              className="ux-button inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#2F5D8C]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] hover:bg-slate-50 sm:w-auto"
            >
              Ver lista
            </button>
          </div>
        </div>

        <label
          htmlFor={categoryId}
          className="block"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Categoría
          </span>

          <select
            id={categoryId}
            value={categoryCode}
            onChange={(event) =>
              setCategoryCode(event.target.value)
            }
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
          >
            <option value="">
              Todas las categorías
            </option>

            {categories.map((category) => (
              <option
                key={category.code}
                value={category.code}
              >
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label
          htmlFor={applicationId}
          className="block"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Aplica a
          </span>

          <select
            id={applicationId}
            value={application}
            onChange={(event) =>
              setApplication(
                event.target.value
              )
            }
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
          >
            <option value="all">
              Todos
            </option>
            <option value="people">
              Personas
            </option>
            <option value="organizations">
              Organizaciones
            </option>
            <option value="both">
              Personas y organizaciones
            </option>
          </select>
        </label>
      </div>

      {selectedSkill ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
              Seleccionada
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {selectedSkill.display_name}
            </p>
          </div>

          <Link
            href={`/panel/habilidades/${selectedSkill.id}`}
            prefetch={false}
            className="inline-flex min-h-10 items-center rounded-lg border border-[#2F5D8C]/30 bg-white px-3 text-sm font-semibold text-[#1E3A5F] hover:bg-slate-50"
          >
            Ver ficha
          </Link>
        </div>
      ) : null}

      <div className="relative">
        {canSearch ? (
          <div
            id={resultsId}
            className="absolute left-0 right-0 z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {loading ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                {showFullList
                  ? 'Cargando lista de habilidades...'
                  : 'Buscando habilidades...'}
              </p>
            ) : errorMessage ? (
              <p className="px-4 py-3 text-sm text-red-600">
                {errorMessage}
              </p>
            ) : results.length > 0 ? (
              results.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => {
                    setSelectedSkill(skill)
                    setShowFullList(false)
                    setQuery(skill.display_name)
                    setResults([])
                    setHasSearched(false)
                    setErrorMessage(null)
                  }}
                  className="block min-h-14 w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-slate-900">
                        {skill.display_name}
                      </p>

                      <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                        {skillMetadata(skill)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {skill.applies_to_person ? (
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
                          Personas
                        </span>
                      ) : null}

                      {skill.applies_to_organization ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                          Organizaciones
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {skill.description ? (
                    <p className="mt-2 break-words text-xs leading-5 text-slate-500">
                      {skill.description}
                    </p>
                  ) : null}
                </button>
              ))
            ) : hasSearched ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                No se encontraron habilidades con estos
                filtros.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-slate-400">
          {hasActiveFilters
            ? 'Se muestran hasta veinte resultados. Podés ajustar el nombre, la categoría o a quién aplica.'
            : 'Buscá por nombre, elegí una categoría o indicá a quién aplica. También podés abrir la lista completa.'}
        </p>

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
