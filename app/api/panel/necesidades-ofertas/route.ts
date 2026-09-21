import {
  NextRequest,
  NextResponse,
} from 'next/server'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  listNeedOfferPage,
  type NeedOfferRecordType,
  type NeedOfferStatus,
} from '../../../../lib/needs-offers/needs-offers'
import {
  parseReferenceLimit,
  ReferenceRequestError,
} from '../../../../lib/reference-pagination'
import { createClient } from '../../../../lib/supabase/server'

const types = new Set<NeedOfferRecordType>([
  'need',
  'offer',
])

const statuses = new Set<NeedOfferStatus>([
  'draft',
  'active',
  'paused',
  'closed',
  'cancelled',
])

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseList<T extends string>(
  value: string | null,
  allowed: Set<T>
) {
  if (!value) return undefined

  const rawValues = value.split(',')

  const values = [
    ...new Set(
      rawValues.filter(
        (item): item is T =>
          allowed.has(item as T)
      )
    ),
  ]

  if (
    values.length === 0 ||
    values.length !== rawValues.length
  ) {
    throw new ReferenceRequestError(
      'invalid_query',
      'Los filtros no son válidos.'
    )
  }

  return values
}

function parseOptionalUuid(
  value: string | null,
  message: string
) {
  if (value === null || value === '') {
    return undefined
  }

  if (!UUID_PATTERN.test(value)) {
    throw new ReferenceRequestError(
      'invalid_query',
      message
    )
  }

  return value
}

export async function GET(
  request: NextRequest
) {
  const supabase = await createClient()

  const { data, error } =
    await supabase.auth.getClaims()

  const authUserId = data?.claims?.sub

  if (error || !authUserId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const access =
    await getInternalAccess(authUserId)

  if (!access.length) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  try {
    const page = await listNeedOfferPage({
      query:
        request.nextUrl.searchParams.get('q') ?? '',

      types: parseList(
        request.nextUrl.searchParams.get('types'),
        types
      ),

      statuses: parseList(
        request.nextUrl.searchParams.get('statuses'),
        statuses
      ),

      responsibleInternalUserId:
        parseOptionalUuid(
          request.nextUrl.searchParams.get(
            'responsible'
          ),
          'El responsable no es válido.'
        ),

      nodeId:
        parseOptionalUuid(
          request.nextUrl.searchParams.get('node'),
          'El nodo no es válido.'
        ),

      cursor:
        request.nextUrl.searchParams.get('cursor'),

      limit:
        parseReferenceLimit(
          request.nextUrl.searchParams.get('limit')
        ),
    })

    return NextResponse.json(page, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (caught) {
    if (
      caught instanceof ReferenceRequestError
    ) {
      return NextResponse.json(
        {
          error: caught.message,
          code: caught.code,
        },
        { status: 400 }
      )
    }

    throw caught
  }
}
