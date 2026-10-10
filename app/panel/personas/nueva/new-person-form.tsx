'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useActionState } from 'react'

import { ReferenceListDialog } from '../../../../components/reference-list-dialog'
import { useRemoteReferenceList } from '../../../../hooks/use-remote-reference-list'
import {
  createPersonAction,
  type CreatePersonActionState,
} from './actions'

type PersonReference = {
  id: string
  display_name: string
  node_names: string[]
  role_names: string[]
}

const initialState: CreatePersonActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

function personDescription(person: PersonReference) {
  const values = [...person.node_names, ...person.role_names]
  return values.length > 0
    ? values.join(' · ')
    : 'Sin participación territorial confirmada'
}

export function NewPersonForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    createPersonAction,
    initialState,
  )
  const [displayName, setDisplayName] = useState('')
  const [clientError, setClientError] =
    useState<string | null>(null)

  const fetchPage = useCallback(async ({ query, cursor, signal }: {
    query: string
    cursor: string | null
    signal: AbortSignal
  }) => {
    const params = new URLSearchParams({
      mode: 'reference',
      q: query,
      limit: '50',
    })

    if (cursor) params.set('cursor', cursor)

    const response = await fetch(`/api/panel/personas?${params}`, {
      signal,
      cache: 'no-store',
    })

    if (!response.ok) throw new Error('No se pudo cargar la lista.')
    return await response.json() as {
      items: PersonReference[]
      nextCursor: string | null
    }
  }, [])

  const matches = useRemoteReferenceList({
    contextKey: 'new-canonical-person',
    getItemKey: (person: PersonReference) => person.id,
    fetchPage,
    minimumQueryLength: 1,
  })

  return <form
    action={formAction}
    noValidate
    onSubmit={(event) => {
      const normalizedName = displayName.trim()

      if (!normalizedName) {
        event.preventDefault()
        setClientError(
          'Ingresá el nombre de la persona.',
        )
        return
      }

      if (normalizedName.length < 2) {
        event.preventDefault()
        setClientError(
          'El nombre debe tener al menos 2 caracteres.',
        )
        return
      }

      setClientError(null)
    }}
    className="mt-6 space-y-5"
  >
    {state.status === 'error' && state.message ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{state.message}</div> : null}
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">Nombre canónico (Obligatorio)</span>
      <input
        name="display_name"
        required
        minLength={2}
        maxLength={200}
        value={displayName}
        onChange={(event) => {
          const value = event.target.value
          setDisplayName(value)
          setClientError(null)
          matches.setQuery(value)

          if (value.trim()) {
            matches.open()
          }
        }}
        autoComplete="off"
        placeholder="Ej.: Ana María Pérez"
        className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        aria-invalid={Boolean(
          clientError ||
            state.fieldErrors.displayName,
        )}
      />
      {clientError ||
      state.fieldErrors.displayName ? (
        <p
          role="alert"
          className="mt-2 text-sm font-medium text-red-600"
        >
          {clientError ??
            state.fieldErrors.displayName}
        </p>
      ) : null}
    </label>

    {displayName.trim() ? <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <h2 className="text-sm font-semibold text-amber-950">Revisá personas existentes antes de crear otra</h2>
      <p className="mt-1 text-sm leading-6 text-amber-900">Si encontrás la misma persona, abrí su ficha y reutilizá su identidad canónica.</p>
      {matches.initialLoading ? <p className="mt-3 text-sm text-amber-900">Buscando coincidencias...</p> : matches.initialError ? <div className="mt-3 text-sm text-red-700"><p>{matches.initialError}</p><button type="button" onClick={matches.retry} className="ux-button mt-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold">Reintentar</button></div> : matches.items.length > 0 ? <ul className="mt-3 space-y-2">{matches.items.slice(0, 5).map((person) => <li key={person.id}><Link href={`/panel/personas/${person.id}`} className="block rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-amber-50"><strong>{person.display_name}</strong><span className="block mt-1 text-xs text-slate-500">{personDescription(person)}</span></Link></li>)}</ul> : <p className="mt-3 text-sm text-amber-900">No se encontraron coincidencias canónicas con esta búsqueda.</p>}
      <ReferenceListDialog buttonClassName="mt-3" buttonLabel="Ver coincidencias" title="Personas existentes" description="Explorá las coincidencias antes de crear una nueva persona." items={matches.items} getItemKey={(person) => person.id} getItemSearchText={(person) => person.display_name} emptyMessage="No se encontraron personas para esta búsqueda." onOpen={matches.open} onSelect={(person) => router.push(`/panel/personas/${person.id}`)} renderItem={(person) => <><strong>{person.display_name}</strong><p className="mt-1 text-xs text-slate-500">{personDescription(person)}</p></>} remote={{ paginationKey: matches.paginationKey, status: matches.status, minimumQueryLength: matches.minimumQueryLength, autoLoad: true, query: matches.query, onQueryChange: matches.setQuery, initialLoading: matches.initialLoading, loadingMore: matches.loadingMore, hasMore: matches.hasMore, initialError: matches.initialError, loadMoreError: matches.loadMoreError, onRetry: matches.retry, onLoadMore: matches.loadMore }} />
    </section> : null}

    <p className="text-sm leading-6 text-slate-500">La creación registra solamente una Persona canónica. No crea contactos, habilidades, pertenencias territoriales ni vínculos con oportunidades, articulaciones o proyectos.</p>
    <button type="submit" disabled={pending} className="ux-button min-h-11 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60 sm:w-auto">{pending ? 'Creando...' : 'Crear persona'}</button>
  </form>
}
