import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { listOpportunityAssigneeOptions } from '../../../../lib/opportunities/detail'
import { createClient } from '../../../../lib/supabase/server'
import { canGovernThemes } from '../../../../lib/themes/themes'
import { ThemeCreateForm } from '../theme-forms'

export const dynamic = 'force-dynamic'

export default async function NewThemePage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')
  const access = await getInternalAccess(data.claims.sub)
  if (!canGovernThemes(access)) redirect('/panel/temas')
  const users = await listOpportunityAssigneeOptions()
  return <div className="mx-auto max-w-4xl space-y-6">
    <section><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">Nuevo tema</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Registrar un asunto transversal</h1><p className="mt-2 text-sm leading-6 text-slate-600">El tema nace activo, con historial y fundamento. No crea oportunidades, articulaciones ni proyectos automáticamente.</p></section>
    <ThemeCreateForm users={users} />
  </div>
}
