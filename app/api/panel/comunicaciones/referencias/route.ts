import { NextRequest, NextResponse } from 'next/server'
import { getInternalAccess } from '../../../../../lib/auth/internal-access'
import { isBasicParticipantAccess } from '../../../../../lib/auth/basic-participant'
import { listAgendaPage } from '../../../../../lib/agenda/agenda'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { createClient } from '../../../../../lib/supabase/server'
const kinds = new Set(['articulation', 'project', 'theme', 'need_offer', 'agenda_entry', 'skill'])
export async function GET(request: NextRequest) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const access = await getInternalAccess(data.claims.sub); if (!access.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (isBasicParticipantAccess(access)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
  const kind = request.nextUrl.searchParams.get('kind') ?? ''; const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''; if (!kinds.has(kind)) return NextResponse.json({ error: 'Referencia inválida.' }, { status: 400 })
  try {
    if (kind === 'agenda_entry') { const page = await listAgendaPage({ query, itemKinds: ['manual'], limit: 50 }); return NextResponse.json({ items: page.items.map((item) => ({ agenda_entry_id: item.agenda_entry_id, title: item.title, detail: item.scheduled_date })), nextCursor: null }, { headers: { 'Cache-Control': 'no-store' } }) }
    const source = kind === 'articulation' ? 'opportunity_articulation_list' : kind === 'project' ? 'project_list' : kind === 'theme' ? 'theme_list' : kind === 'need_offer' ? 'need_offer_list' : 'skill_directory'
    const idField = kind === 'articulation' ? 'articulation_id' : kind === 'project' ? 'project_id' : kind === 'theme' ? 'theme_id' : kind === 'need_offer' ? 'need_offer_id' : 'id'
    const labelField = kind === 'theme' ? 'name' : kind === 'skill' ? 'display_name' : 'title'
    let requestBuilder = createAdminClient().from(source).select(`${idField}, ${labelField}, status`).order(labelField, { ascending: true }).limit(50)
    if (query) requestBuilder = requestBuilder.ilike(labelField, `%${query}%`)
    const { data: rows, error } = await requestBuilder; if (error) throw error
    return NextResponse.json({ items: (rows ?? []).map((row: Record<string, unknown>) => ({ id: row[idField], label: row[labelField], status: row.status ?? null })), nextCursor: null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { console.error('[MP25M] Communication reference failed:', error); return NextResponse.json({ error: 'No se pudo cargar la lista.' }, { status: 500 }) }
}
