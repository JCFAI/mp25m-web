import {
  NextRequest,
  NextResponse,
} from 'next/server'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  listSkillReferenceOptions,
  searchSkills,
} from '../../../../lib/skills/search'
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

  const categoryCode =
    request.nextUrl.searchParams.get(
      'category'
    ) ?? null

  const application =
    request.nextUrl.searchParams.get(
      'application'
    ) ?? 'all'

  const mode =
    request.nextUrl.searchParams.get('mode')

  const results =
    mode === 'reference'
      ? await listSkillReferenceOptions({
          application,
        })
      : await searchSkills({
          query,
          categoryCode,
          application,
        })

  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
