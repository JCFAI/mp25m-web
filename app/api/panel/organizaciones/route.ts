import {
  NextRequest,
  NextResponse,
} from 'next/server'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { searchOrganizations } from '../../../../lib/organizations/search'
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

  const organizationTypeCode =
    request.nextUrl.searchParams.get('type') ??
    null

  const results =
    await searchOrganizations({
      query,
      organizationTypeCode,
    })

  const isGlobalReviewer = access.some(grant =>
    grant.scope_type === 'global' &&
    ['administrator', 'validator'].includes(grant.access_role_code)
  )

  // The canonical directory is shared, but cross-node aggregate counts are not.
  const visibleResults = isGlobalReviewer
    ? results
    : results.map(item => ({
        id: item.id,
        display_name: item.display_name,
        organization_type_code: item.organization_type_code,
        organization_type_name: item.organization_type_name,
        record_status: item.record_status,
      }))

  return NextResponse.json(visibleResults, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
