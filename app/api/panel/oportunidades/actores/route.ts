import { NextRequest, NextResponse } from 'next/server'

import { getInternalAccess } from '../../../../../lib/auth/internal-access'
import { searchOpportunityActors } from '../../../../../lib/opportunities/actors'
import { createClient } from '../../../../../lib/supabase/server'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const authUserId = claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const access = await getInternalAccess(authUserId)

  if (access.length === 0) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  const query =
    request.nextUrl.searchParams.get('q') ?? ''

  const nodeIds =
    request.nextUrl.searchParams
      .getAll('node_id')
      .filter((value) => UUID_PATTERN.test(value))

  const actors = await searchOpportunityActors(
    query,
    nodeIds
  )

  return NextResponse.json(actors, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}