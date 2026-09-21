'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { useRemoteReferenceList } from '../../../hooks/use-remote-reference-list'
import type { ThemePriority, ThemeReference, ThemeStatus } from '../../../lib/themes/themes'

const statusLabels: Record<ThemeStatus, string> = { active: 'Activo', monitoring: 'En seguimiento', paused: 'Pausado', closed: 'Cerrado' }
const priorityLabels: Record<ThemePriority, string> = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }

export function ThemeDirectory() {
  const [status, setStatus] = useState<ThemeStatus | ''>('')
  const [priority, setPriority] = useState<ThemePriority | ''>('')
  const fetchPage = useCallback(async ({ query, cursor, signal }: { query: string; cursor: string | null; signal: AbortSignal }) => {
    const params = new URLSearchParams({ q: query, limit: '25' })
    if (cursor) params.set('cursor', cursor)
    if (status) params.set('statuses', status)
    if (priority) params.set('priorities', priority)
    const response = await fetch(`/api/panel/temas?${params.toString()}`, { signal, cache: 'no-store' })
    if (!response.ok) throw new Error('No se pudo cargar el directorio de temas.')
    return (await response.json()) as { items: ThemeReference[]; nextCursor: string | null }
  }, [priority, status])
  const directory = useRemoteReferenceList({
    contextKey: `themes:${status}:${priority}`,
    getItemKey: (theme: ThemeReference) => theme.theme_id,
    fetchPage,
  })

  const openDirectory = directory.open

  useEffect(() => { openDirectory() }, [openDirectory])

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div><h2 className="text-lg font-semibold text-slate-950">Directorio de temas</h2><p className="mt-1 text-sm text-slate-500">Buscá por nombre, descripción o propósito. La lista carga por páginas.</p></div>
      <div className="grid gap-3 sm:grid-cols-3 lg:w-[46rem]">
        <label className="text-sm font-medium text-slate-700">Buscar<input value={directory.query} onChange={(event) => directory.setQuery(event.target.value)} placeholder="Ej.: logística, exportación..." className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium text-slate-700">Estado<select value={status} onChange={(event) => setStatus(event.target.value as ThemeStatus | '')} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-700">Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value as ThemePriority | '')} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">Todas</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
    </div>
    {directory.initialLoading ? <p className="mt-5 text-sm text-slate-500">Cargando temas...</p> : null}
    {directory.initialError ? <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{directory.initialError}<button onClick={directory.retry} className="ml-3 font-semibold underline">Reintentar</button></div> : null}
    {!directory.initialLoading && !directory.initialError && directory.items.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No hay temas que coincidan con los filtros.</p> : null}
    <div className="mt-5 grid gap-3 lg:grid-cols-2">{directory.items.map((theme) => <Link key={theme.theme_id} href={`/panel/temas/${theme.theme_id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#2F5D8C]/40 hover:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2"><strong className="text-slate-950">{theme.name}</strong><div className="flex gap-2"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{statusLabels[theme.status]}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{priorityLabels[theme.priority]}</span></div></div>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{theme.description}</p>
      <p className="mt-3 text-xs text-slate-500">Principal: {theme.principal_display_name ?? 'Sin asignar'}{theme.responsible_names.length ? ` · Responsables: ${theme.responsible_names.join(', ')}` : ''}</p>
    </Link>)}</div>
    {directory.hasMore ? <div className="mt-5 text-center"><button onClick={directory.loadMore} disabled={directory.loadingMore} className="rounded-xl border border-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] disabled:opacity-50">{directory.loadingMore ? 'Cargando...' : 'Cargar más'}</button>{directory.loadMoreError ? <p className="mt-2 text-sm text-red-700">{directory.loadMoreError}</p> : null}</div> : null}
  </section>
}
