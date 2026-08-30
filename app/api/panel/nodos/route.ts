import {
  NextRequest,
  NextResponse,
} from 'next/server'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { searchNodes } from '../../../../lib/nodes/search'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  const query =
    request.nextUrl.searchParams.get('q') ?? ''

  const excludeOrganizationId =
    request.nextUrl.searchParams.get(
      'exclude_organization_id'
    ) ?? null

  const results = await searchNodes(query, {
    excludeOrganizationId,
  })

  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
