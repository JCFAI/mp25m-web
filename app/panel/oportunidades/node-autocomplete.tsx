'use client'

import { useEffect, useState } from 'react'

type NodeResult = {
  id: string
  display_name: string
}

export function NodeAutocomplete() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NodeResult[]>([])
  const [selected, setSelected] = useState<NodeResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = query.trim()

    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const timeout = window.setTimeout(async () => {
      setLoading(true)

      try {
        const response = await fetch(
          `/api/panel/oportunidades/nodos?q=${encodeURIComponent(term)}`,
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        )

        if (!response.ok) {
          setResults([])
          return
        }

        const data = (await response.json()) as NodeResult[]

        const selectedIds = new Set(
          selected.map((node) => node.id)
        )

        setResults(
          data.filter(
            (node) => !selectedIds.has(node.id)
          )
        )
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return
        }

        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query, selected])

  function addNode(node: NodeResult) {
    setSelected((current) => [...current, node])
    setQuery('')
    setResults([])
  }

  function removeNode(id: string) {
    setSelected((current) =>
      current.filter((node) => node.id !== id)
    )
  }

  return (
    <div className="mt-2">
      {selected.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((node) => (
            <span
              key={node.id}
              className="inline-flex items-center gap-2 rounded-full bg-[#EAF0F7] px-3 py-1.5 text-sm font-medium text-[#1E3A5F]"
            >
              {node.display_name}

              <button
                type="button"
                onClick={() => removeNode(node.id)}
                className="text-[#2F5D8C] hover:text-[#14263D]"
                aria-label={`Quitar ${node.display_name}`}
              >
                ×
              </button>

              <input
                type="hidden"
                name="node_ids"
                value={node.id}
              />
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <input
          value={query}
          onChange={(event) =>
            setQuery(event.target.value)
          }
          placeholder="Buscar nodo por nombre..."
          autoComplete="off"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        />

        {query.trim().length >= 2 ? (
          <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {loading ? (
              <p className="px-4 py-3 text-sm text-slate-500">
                Buscando...
              </p>
            ) : results.length > 0 ? (
              results.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => addNode(node)}
                  className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                >
                  {node.display_name}
                </button>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">
                No se encontraron coincidencias.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-400">
        Escribí al menos dos caracteres. Podés agregar más de un nodo.
      </p>
    </div>
  )
}