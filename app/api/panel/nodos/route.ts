import {
  NextRequest,
  NextResponse,
} from 'next/server'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  listNodeReferencePage,
  listNodeReferenceOptions,
  searchNodes,
} from '../../../../lib/nodes/search'
import {
  parseReferenceLimit,
  ReferenceRequestError,
} from '../../../../lib/reference-pagination'
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

  const mode =
    request.nextUrl.searchParams.get('mode')

  const usesPagedReferenceContract =
    mode === 'reference' &&
    (
      request.nextUrl.searchParams.has('q') ||
      request.nextUrl.searchParams.has('cursor') ||
      request.nextUrl.searchParams.has('limit')
    )

  if (usesPagedReferenceContract) {
    try {
      const page = await listNodeReferencePage({
        query,
        cursor:
          request.nextUrl.searchParams.get('cursor'),
        limit: parseReferenceLimit(
          request.nextUrl.searchParams.get('limit')
        ),
        excludeOrganizationId,
      })

      return NextResponse.json(page, {
        headers: {
          'Cache-Control': 'no-store',
        },
      })
    } catch (error) {
      if (error instanceof ReferenceRequestError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
          },
          { status: 400 }
        )
      }

      throw error
    }
  }

  const results =
    mode === 'reference'
      ? await listNodeReferenceOptions({
          excludeOrganizationId,
        })
      : await searchNodes(query, {
          excludeOrganizationId,
        })

  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
