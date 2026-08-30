'use client'

import {
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  createOrganizationNodeLinkAction,
  type OrganizationNodeLinkActionState,
} from './actions'

type NodeSearchResult = {
  id: string
  node_number: number | null
  display_name: string
  status: string
  jurisdiction_name: string | null
  jurisdiction_type_name: string | null
}

const MINIMUM_QUERY_LENGTH = 2

const initialState: OrganizationNodeLinkActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

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

function fieldClass(hasError: boolean) {
  return hasError
    ? 'mt-2 w-full rounded-xl border border-red-300 bg-red-50/30 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100'
    : 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10'
}

function FieldError({
  message,
}: {
  message?: string
}) {
  if (!message) {
    return null
  }

  return (
    <p className="mt-2 text-xs font-medium text-red-600">
      {message}
    </p>
  )
}

export function OrganizationNodeLinkForm({
  organizationId,
  linkedNodeIds,
}: {
  organizationId: string
  linkedNodeIds: string[]
}) {
  const inputId = useId()
  const resultsId = useId()
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, pending] =
    useActionState(
      createOrganizationNodeLinkAction.bind(
        null,
        organizationId
      ),
      initialState
    )

  const [query, setQuery] = useState('')
  const [results, setResults] =
    useState<NodeSearchResult[]>([])
  const [selectedNode, setSelectedNode] =
    useState<NodeSearchResult | null>(null)
  const [evidenceText, setEvidenceText] =
    useState('')
  const [startedOn, setStartedOn] =
    useState('')
  const [loading, setLoading] =
    useState(false)
  const [hasSearched, setHasSearched] =
    useState(false)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)

  const linkedNodeIdSet = useMemo(
    () => new Set(linkedNodeIds),
    [linkedNodeIds]
  )

  const term = query.trim()
  const searchIsOpen =
    term.length >= MINIMUM_QUERY_LENGTH &&
    !selectedNode

  useEffect(() => {
    if (state.status !== 'success') {
      return
    }

    formRef.current?.reset()
    setQuery('')
    setResults([])
    setSelectedNode(null)
    setEvidenceText('')
    setStartedOn('')
    setHasSearched(false)
    setErrorMessage(null)
  }, [state.status, state.message])

  useEffect(() => {
    const currentTerm = query.trim()

    setResults([])
    setHasSearched(false)
    setErrorMessage(null)

    if (
      selectedNode ||
      currentTerm.length < MINIMUM_QUERY_LENGTH
    ) {
      setLoading(false)
      return
    }

    const controller = new AbortController()

    setLoading(true)

    const timeout = window.setTimeout(
      async () => {
        try {
          const searchParams =
            new URLSearchParams()

          searchParams.set('q', currentTerm)
          searchParams.set(
            'exclude_organization_id',
            organizationId
          )

          const response = await fetch(
            `/api/panel/nodos?${searchParams.toString()}`,
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
            setResults(
              data.filter(
                (node) =>
                  !linkedNodeIdSet.has(node.id)
              )
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
  }, [
    query,
    selectedNode,
    organizationId,
    linkedNodeIdSet,
  ])

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-5 grid gap-5"
    >
      {state.status !== 'idle' &&
      state.message ? (
        <div
          role="alert"
          className={
            state.status === 'success'
              ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'
              : 'rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {state.message}
        </div>
      ) : null}

      <div>
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-slate-700"
        >
          Nodo
        </label>

        <div className="relative">
          <input
            id={inputId}
            value={query}
            onChange={(event) => {
              setSelectedNode(null)
              setQuery(event.target.value)
            }}
            placeholder="Ej.: Avellaneda, Comuna 3..."
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchIsOpen}
            aria-controls={resultsId}
            aria-busy={loading}
            className={fieldClass(
              Boolean(state.fieldErrors.nodeId)
            )}
          />

          {searchIsOpen ? (
            <div
              id={resultsId}
              className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
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
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      setSelectedNode(node)
                      setQuery(node.display_name)
                      setResults([])
                      setHasSearched(false)
                    }}
                    className="block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <span className="block text-sm font-semibold text-slate-900">
                      {node.display_name}
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {nodeMetadata(node)}
                    </span>
                  </button>
                ))
              ) : hasSearched ? (
                <p className="px-4 py-3 text-sm text-slate-500">
                  No se encontraron nodos coincidentes.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <input
          type="hidden"
          name="node_id"
          value={selectedNode?.id ?? ''}
        />

        {selectedNode ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
              {selectedNode.display_name}
            </span>

            <button
              type="button"
              onClick={() => {
                setSelectedNode(null)
                setQuery('')
              }}
              className="text-xs font-semibold text-[#2F5D8C] hover:text-[#1E3A5F]"
            >
              Cambiar
            </button>
          </div>
        ) : null}

        <FieldError
          message={state.fieldErrors.nodeId}
        />
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-slate-700">
          Evidencia o justificación
        </span>

        <textarea
          name="evidence_text"
          value={evidenceText}
          onChange={(event) =>
            setEvidenceText(event.target.value)
          }
          rows={4}
          maxLength={2000}
          className={`${fieldClass(
            Boolean(
              state.fieldErrors.evidenceText
            )
          )} resize-y leading-6`}
          aria-invalid={Boolean(
            state.fieldErrors.evidenceText
          )}
          placeholder="Ej.: surge de una reunión, documentación interna o referencia verificada."
        />

        <FieldError
          message={
            state.fieldErrors.evidenceText
          }
        />
      </label>

      <label className="block max-w-xs">
        <span className="text-sm font-semibold text-slate-700">
          Fecha de inicio
        </span>

        <input
          type="date"
          name="started_on"
          value={startedOn}
          onChange={(event) =>
            setStartedOn(event.target.value)
          }
          className={fieldClass(
            Boolean(state.fieldErrors.startedOn)
          )}
          aria-invalid={Boolean(
            state.fieldErrors.startedOn
          )}
        />

        <FieldError
          message={state.fieldErrors.startedOn}
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60"
        >
          {pending
            ? 'Guardando...'
            : 'Guardar como pendiente'}
        </button>
      </div>
    </form>
  )
}
