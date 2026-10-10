import { NextRequest, NextResponse } from 'next/server'
import { getInternalAccess } from '../../../../../lib/auth/internal-access'
import { isBasicParticipantAccess } from '../../../../../lib/auth/basic-participant'
import { listCommunicationRecipientPage } from '../../../../../lib/communications/communications'
import { createClient } from '../../../../../lib/supabase/server'
export async function GET(request: NextRequest) {
  const resolutionId = request.nextUrl.searchParams.get('resolution_id') ?? ''
  if (!resolutionId) return NextResponse.json({ error: 'Falta la resolución.' }, { status: 400 })
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getInternalAccess(data.claims.sub); if (!access.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (isBasicParticipantAccess(access)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }
  let cursor: { displayName: string; id: string } | null = null; const raw = request.nextUrl.searchParams.get('cursor')
  if (raw) { try { cursor = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) } catch { return NextResponse.json({ error: 'Cursor inválido.' }, { status: 400 }) } }
  try { const page = await listCommunicationRecipientPage(access, resolutionId, { query: request.nextUrl.searchParams.get('q') ?? '', cursor }); return NextResponse.json({ items: page.items, nextCursor: page.nextCursor ? Buffer.from(JSON.stringify(page.nextCursor)).toString('base64url') : null }, { headers: { 'Cache-Control': 'no-store' } }) } catch (error) { console.error('[MP25M] Communication recipients failed:', error); return NextResponse.json({ error: 'No se pudieron cargar los destinatarios.' }, { status: 500 }) }
}
