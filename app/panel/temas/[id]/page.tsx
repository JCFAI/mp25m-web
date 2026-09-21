import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { createClient } from '../../../../lib/supabase/server'
import {
  canFollowupTheme,
  canGovernThemes,
  canManageTheme,
  getTheme,
  listThemeFollowups,
  listThemeResponsibilities,
  listThemeStatusHistory,
  listThemeUserOptions,
  type ThemePriority,
  type ThemeStatus,
} from '../../../../lib/themes/themes'
import { ThemeFollowups, ThemeGovernanceForms, ThemeResponsibilities } from '../theme-forms'

export const dynamic = 'force-dynamic'

const statusLabels: Record<ThemeStatus, string> = { active: 'Activo', monitoring: 'En seguimiento', paused: 'Pausado', closed: 'Cerrado' }
const priorityLabels: Record<ThemePriority, string> = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' }

export default async function ThemeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')
  const access = await getInternalAccess(data.claims.sub)
  if (!access.length) redirect('/sin-acceso')

  const [theme, responsibilities, followups, history] = await Promise.all([
    getTheme(id), listThemeResponsibilities(id), listThemeFollowups(id), listThemeStatusHistory(id),
  ])
  if (!theme) notFound()
  const canGovern = canGovernThemes(access)
  const canManage = canManageTheme(access, responsibilities)
  const canFollowup = canFollowupTheme(access, responsibilities)
  const users = canGovern || (canFollowup && theme.status !== 'closed')
    ? await listThemeUserOptions()
    : []

  return <div className="space-y-6">
    <Link href="/panel/temas" className="text-sm font-semibold text-[#2F5D8C]">← Volver a temas</Link>
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">Tema transversal</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{theme.name}</h1><p className="mt-3 max-w-4xl text-sm leading-6 text-slate-100/85">{theme.description}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{statusLabels[theme.status]}</span><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Prioridad {priorityLabels[theme.priority]}</span><span className="rounded-full bg-white/10 px-3 py-1 text-xs">Desde {new Intl.DateTimeFormat('es-AR').format(new Date(`${theme.start_date}T00:00:00`))}</span></div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]"><div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-950">Propósito</h2><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{theme.purpose}</p>{theme.current_summary ? <><h3 className="mt-5 text-sm font-semibold text-slate-950">Situación actual</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{theme.current_summary}</p></> : null}{theme.territorial_scope_summary ? <><h3 className="mt-5 text-sm font-semibold text-slate-950">Alcance territorial</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{theme.territorial_scope_summary}</p></> : null}{theme.closing_summary ? <><h3 className="mt-5 text-sm font-semibold text-slate-950">Síntesis de cierre</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{theme.closing_summary}</p></> : null}</section>
      <ThemeResponsibilities themeId={id} responsibilities={responsibilities} users={users} canGovern={canGovern} />
      <ThemeFollowups themeId={id} followups={followups} users={users} canFollowup={canFollowup} isClosed={theme.status === 'closed'} />
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-slate-950">Historial de estado</h2><ol className="mt-4 space-y-3">{history.map((item) => <li key={item.history_id} className="border-l-2 border-slate-200 pl-4 text-sm text-slate-700"><strong>{statusLabels[item.status]} · prioridad {priorityLabels[item.priority]}</strong><p className="mt-1">{item.rationale}</p>{item.status === 'closed' && item.closing_summary ? <div className="mt-2 rounded-lg bg-slate-100 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Síntesis de cierre</p><p className="mt-1 whitespace-pre-line">{item.closing_summary}</p></div> : null}<p className="mt-1 text-xs text-slate-500">{item.changed_by_display_name} · {new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.changed_at))}</p></li>)}</ol></section>
    </div><aside>{canManage || canGovern ? <ThemeGovernanceForms theme={theme} canManage={canManage} canGovern={canGovern} /> : <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">Tu acceso actual permite consultar el tema y su memoria institucional.</section>}</aside></div>
  </div>
}
