import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getInternalAccess } from '../../../lib/auth/internal-access'
import { listCommunicationPage } from '../../../lib/communications/communications'
import { createClient } from '../../../lib/supabase/server'
import { CommunicationsDirectory } from './communications-directory'
export const dynamic = 'force-dynamic'
export default async function CommunicationsPage() {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) redirect('/login')
  const access = await getInternalAccess(data.claims.sub); if (!access.length) redirect('/sin-acceso')
  const initial = await listCommunicationPage(access, {})
  return <div className="space-y-6"><section className="rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">Incremento 12B.A</p><div className="mt-3 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">Comunicaciones</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-100/85">Prepará el mensaje, definí y resolvé la audiencia, revisá destinatarios y confirmalos. Este módulo no envía comunicaciones externas.</p></div><Link href="/panel/comunicaciones/nueva" className="ux-button inline-flex min-h-11 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#1E3A5F] hover:bg-slate-100">Nueva comunicación</Link></div></section><CommunicationsDirectory initialItems={initial.items} initialNextCursor={initial.nextCursor ? Buffer.from(JSON.stringify(initial.nextCursor)).toString('base64url') : null} /></div>
}
