import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { getCommunication, listCommunicationCriteria, listCommunicationCriterionLabels, listCommunicationResolutions } from '../../../../lib/communications/communications'
import { createClient } from '../../../../lib/supabase/server'
import { CommunicationWorkspace } from '../communication-workspace'
export const dynamic = 'force-dynamic'
export default async function CommunicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) redirect('/login')
  const access = await getInternalAccess(data.claims.sub); if (!access.length) redirect('/sin-acceso')
  const communication = await getCommunication(access, id); if (!communication) notFound()
  const [criteria, resolutions] = await Promise.all([listCommunicationCriteria(access, id), listCommunicationResolutions(access, id)])
  const criterionLabels = await listCommunicationCriterionLabels(criteria)
  const current = resolutions.find((resolution) => resolution.is_current) ?? null
  return <div className="space-y-4 pt-1"><nav aria-label="Volver" className="flex min-h-11 items-center"><Link href="/panel/comunicaciones" className="ux-button inline-flex min-h-11 items-center rounded-xl border border-[#2F5D8C]/40 bg-white px-4 py-2 text-base font-semibold text-[#1E3A5F] shadow-sm hover:bg-slate-50">← Volver a comunicaciones</Link></nav><div className="pt-0"><CommunicationWorkspace communication={communication} criteria={criteria} criterionLabels={criterionLabels} resolution={current} /></div></div>
}
