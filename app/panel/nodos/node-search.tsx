'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'

import { ReferenceListDialog } from '../../../components/reference-list-dialog'

type NodeSearchResult = {
  id: string
  node_number: number | null
  display_name: string
  status: string
  jurisdiction_name: string | null
  jurisdiction_type_name: string | null
}

function nodeMetadata(
  node: NodeSearchResult
) {
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

function normalizeNodeFilter(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function NodeSearch() {
  const router = useRouter()
  const inputId = useId()
  const resultsId = useId()

  const [query, setQuery] = useState('')
  const [inputFocused, setInputFocused] =
    useState(false)
  const [nodes, setNodes] =
    useState<NodeSearchResult[]>([])
  const [loading, setLoading] =
    useState(true)
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null)
  const [reloadKey, setReloadKey] =
    useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadNodes() {
      try {
        const response = await fetch(
          '/api/panel/nodos?mode=reference',
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        )

        if (!response.ok) {
          throw new Error(
            'No se pudo cargar el directorio.'
          )
        }

        const data =
          (await response.json()) as NodeSearchResult[]

        if (!controller.signal.aborted) {
          setNodes(data)
          setErrorMessage(null)
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        if (!controller.signal.aborted) {
          setNodes([])
          setErrorMessage(
            'No se pudo cargar el directorio de nodos. Intentá nuevamente.'
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadNodes()

    return () => controller.abort()
  }, [reloadKey])

  const normalizedQuery =
    normalizeNodeFilter(query)

  const visibleNodes = useMemo(() => {
    if (!normalizedQuery) {
      return nodes
    }

    return nodes.filter((node) => {
      const searchable = normalizeNodeFilter(
        [
          node.display_name,
          node.node_number !== null
            ? String(node.node_number)
            : '',
          node.jurisdiction_name,
          node.jurisdiction_type_name,
        ]
          .filter(Boolean)
          .join(' ')
      )

      return searchable.includes(
        normalizedQuery
      )
    })
  }, [nodes, normalizedQuery])

  function retryLoad() {
    setLoading(true)
    setErrorMessage(null)
    setReloadKey((current) => current + 1)
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className="text-sm font-semibold text-slate-700"
      >
        Buscar nodo
      </label>

      <p className="mt-1 text-sm leading-6 text-slate-500">
        El directorio se carga al entrar. Explorá la
        lista o escribí desde el primer carácter para
        filtrar por nombre, número o jurisdicción.
      </p>

      <div
        className="relative mt-3 sm:mt-4"
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
            setQuery(event.target.value)
          }
          placeholder="Ej.: Avellaneda, Comuna 3..."
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={inputFocused}
          aria-controls={resultsId}
          aria-busy={loading}
          className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        />

        {inputFocused ? (
          <div
            id={resultsId}
            className="absolute left-0 right-0 z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            <p className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs leading-5 text-slate-500">
              {normalizedQuery
                ? `${visibleNodes.length} nodo${visibleNodes.length === 1 ? '' : 's'} coincide${visibleNodes.length === 1 ? '' : 'n'} con “${query.trim()}”.`
                : `${nodes.length} nodos disponibles. Desplazate para explorar o escribí para filtrar.`}
            </p>

            {loading ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                Cargando nodos...
              </p>
            ) : errorMessage ? (
              <div className="px-4 py-3">
                <p className="text-sm text-red-600">
                  {errorMessage}
                </p>

                <button
                  type="button"
                  onClick={retryLoad}
                  className="ux-button mt-3 min-h-10 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Reintentar
                </button>
              </div>
            ) : visibleNodes.length > 0 ? (
              visibleNodes.map((node) => (
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
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">
                No se encontraron nodos coincidentes.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <ReferenceListDialog
        buttonClassName="mt-3"
        title="Directorio de nodos"
        description="Explorá el directorio completo de nodos o filtralo localmente."
        items={nodes}
        loading={loading}
        errorMessage={errorMessage}
        searchPlaceholder="Filtrar nodo o jurisdicción..."
        emptyMessage="No se encontraron nodos para esta búsqueda."
        getItemKey={(node) => node.id}
        getItemSearchText={(node) =>
          [
            node.display_name,
            node.node_number,
            node.jurisdiction_name,
            node.jurisdiction_type_name,
          ]
            .filter(
              (value) =>
                value !== null &&
                value !== undefined
            )
            .join(' ')
        }
        renderItem={(node) => (
          <div>
            <p className="break-words text-sm font-semibold text-slate-900">
              {node.display_name}
            </p>

            <p className="mt-1 break-words text-xs leading-5 text-slate-500">
              {nodeMetadata(node)}
            </p>
          </div>
        )}
        onOpen={() => {
          if (errorMessage && !loading) {
            retryLoad()
          }
        }}
        onSelect={(node) => {
          router.push(
            `/panel/nodos/${node.id}`
          )
        }}
      />

      <p className="mt-3 text-xs leading-5 text-slate-400">
        Los nodos cambian con poca frecuencia, por eso
        el directorio completo se mantiene en memoria
        mientras permanecés en esta pantalla. El filtro
        es inmediato y no realiza una consulta por cada
        tecla.
      </p>
    </div>
  )
}
