import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createClient } from '../../../lib/supabase/server'
import { canGovernThemes } from '../../../lib/themes/themes'
import { ThemeDirectory } from './theme-directory'

export const dynamic = 'force-dynamic'

export default async function ThemesPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')
  const access = await getInternalAccess(data.claims.sub)
  return <div className="space-y-6">
    <section className="flex flex-col gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">Incremento 10B</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Temas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-100/80">Asuntos transversales y persistentes que el Movimiento necesita sostener, independientemente de una oportunidad, articulación o proyecto particular.</p></div>
      {canGovernThemes(access) ? <Link href="/panel/temas/nuevo" className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F]">Crear tema</Link> : null}
    </section>
    <ThemeDirectory />
  </div>
}
