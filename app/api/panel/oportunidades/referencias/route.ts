import { NextRequest, NextResponse } from 'next/server'
import { getInternalAccess } from '../../../../../lib/auth/internal-access'
import { isBasicParticipantAccess } from '../../../../../lib/auth/basic-participant'
import { listOpportunityReferencePage } from '../../../../../lib/opportunities/reference'
import { parseReferenceLimit, ReferenceRequestError } from '../../../../../lib/reference-pagination'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getInternalAccess(data.claims.sub)
  if (!access.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (isBasicParticipantAccess(access)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const params = request.nextUrl.searchParams
    const page = await listOpportunityReferencePage({
      query: params.get('q') ?? '', cursor: params.get('cursor'),
      limit: parseReferenceLimit(params.get('limit')),
    })
    return NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof ReferenceRequestError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error('[MP25M] Opportunity references failed:', error)
    return NextResponse.json({ error: 'No se pudo cargar la lista.' }, { status: 500 })
  }
}
