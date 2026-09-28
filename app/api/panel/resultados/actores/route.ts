import { NextRequest, NextResponse } from 'next/server'

import { getInternalAccess } from '../../../../../lib/auth/internal-access'
import { listResultContributorReferencePage } from '../../../../../lib/results/contributor-references'
import {
  parseReferenceLimit,
  ReferenceRequestError,
} from '../../../../../lib/reference-pagination'
import { createClient } from '../../../../../lib/supabase/server'

export async function GET(
  request: NextRequest,
) {
  const supabase =
    await createClient()

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  if (
    claimsError ||
    !authUserId
  ) {
    return NextResponse.json(
      {
        error:
          'Unauthorized',
      },
      {
        status: 401,
      },
    )
  }

  const access =
    await getInternalAccess(
      authUserId,
    )

  if (
    access.length === 0
  ) {
    return NextResponse.json(
      {
        error:
          'Forbidden',
      },
      {
        status: 403,
      },
    )
  }

  const query =
    request.nextUrl.searchParams.get(
      'q',
    ) ?? ''

  try {
    const page =
      await listResultContributorReferencePage({
        query,

        cursor:
          request.nextUrl.searchParams.get(
            'cursor',
          ),

        limit:
          parseReferenceLimit(
            request.nextUrl.searchParams.get(
              'limit',
            ),
          ),
      })

    return NextResponse.json(
      page,
      {
        headers: {
          'Cache-Control':
            'no-store',
        },
      },
    )
  } catch (error) {
    if (
      error instanceof
      ReferenceRequestError
    ) {
      return NextResponse.json(
        {
          error:
            error.message,
          code:
            error.code,
        },
        {
          status: 400,
        },
      )
    }

    throw error
  }
}
