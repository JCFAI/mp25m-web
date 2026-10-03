import { NextRequest, NextResponse } from 'next/server'
import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { listCommunicationPage, type CommunicationStatus } from '../../../../lib/communications/communications'
import { createClient } from '../../../../lib/supabase/server'
const statuses = new Set<CommunicationStatus>(['draft', 'audience_resolved', 'recipients_confirmed', 'cancelled'])
export async function GET(request: NextRequest) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getInternalAccess(data.claims.sub); if (!access.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rawCursor = request.nextUrl.searchParams.get('cursor'); let cursor: { updatedAt: string; id: string } | null = null
  if (rawCursor) { try { cursor = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) } catch { return NextResponse.json({ error: 'Cursor inválido.' }, { status: 400 }) } }
  const status = request.nextUrl.searchParams.get('status'); const selected = status && statuses.has(status as CommunicationStatus) ? [status as CommunicationStatus] : undefined
  try { const page = await listCommunicationPage(access, { query: request.nextUrl.searchParams.get('q') ?? '', statuses: selected, cursor }); return NextResponse.json({ items: page.items, nextCursor: page.nextCursor ? Buffer.from(JSON.stringify(page.nextCursor)).toString('base64url') : null }, { headers: { 'Cache-Control': 'no-store' } }) } catch (error) { console.error('[MP25M] Communications page failed:', error); return NextResponse.json({ error: 'No se pudo cargar comunicaciones.' }, { status: 500 }) }
}
