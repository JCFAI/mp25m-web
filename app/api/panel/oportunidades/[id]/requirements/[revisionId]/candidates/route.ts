import { NextResponse } from 'next/server'

import {
  getInternalAccess,
} from '../../../../../../../../lib/auth/internal-access'
import {
  searchOpportunityRequirementMatchCandidates,
} from '../../../../../../../../lib/opportunities/analysis'
import {
  createClient,
} from '../../../../../../../../lib/supabase/server'

type RouteContext = {
  params: Promise<{
    id: string
    revisionId: string
  }>
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  const {
    revisionId,
  } = await context.params

  const supabase =
    await createClient()

  const {
    data,
    error,
  } = await supabase.auth.getClaims()

  const authUserId =
    data?.claims?.sub

  if (
    error ||
    !authUserId
  ) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const access =
    await getInternalAccess(
      authUserId
    )

  if (access.length === 0) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  try {
    const candidates =
      await searchOpportunityRequirementMatchCandidates(
        access,
        revisionId
      )

    return NextResponse.json(
      candidates,
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Requirement match candidate search failed:',
      error
    )

    return NextResponse.json(
      {
        error:
          'No se pudieron buscar actores para analizar.',
      },
      { status: 400 }
    )
  }
}
