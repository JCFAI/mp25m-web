import { NextRequest, NextResponse } from 'next/server'

import { getInternalAccess } from '../../../../../lib/auth/internal-access'
import {
  listCanonicalActorReferencePage,
  searchOpportunityActors,
} from '../../../../../lib/opportunities/actors'
import {
  parseReferenceLimit,
  ReferenceRequestError,
} from '../../../../../lib/reference-pagination'
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

  const mode =
    request.nextUrl.searchParams.get('mode')

  const nodeIds =
    request.nextUrl.searchParams
      .getAll('node_id')
      .filter((value) => UUID_PATTERN.test(value))

  if (mode === 'reference') {
    try {
      const page = await listCanonicalActorReferencePage({
        query,
        actorTypes: ['person', 'organization'],
        nodeIds,
        cursor:
          request.nextUrl.searchParams.get('cursor'),
        limit: parseReferenceLimit(
          request.nextUrl.searchParams.get('limit')
        ),
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
