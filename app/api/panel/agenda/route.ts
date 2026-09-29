import {
  NextRequest,
  NextResponse,
} from 'next/server'

import {
  listAgendaPage,
  type AgendaEntryType,
  type AgendaItemKind,
  type AgendaSourceType,
  type AgendaStatus,
} from '../../../../lib/agenda/agenda'
import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  parseReferenceLimit,
  ReferenceRequestError,
} from '../../../../lib/reference-pagination'
import { createClient } from '../../../../lib/supabase/server'

const itemKinds =
  new Set<AgendaItemKind>([
    'manual',
    'opportunity_due',
    'project_deliverable',
    'theme_next_due',
  ])

const entryTypes =
  new Set<AgendaEntryType>([
    'meeting',
    'visit',
    'training',
    'demonstration',
    'call',
    'follow_up',
    'deadline',
    'other',
  ])

const sourceTypes =
  new Set<AgendaSourceType>([
    'opportunity',
    'articulation',
    'project',
    'theme',
    'need_offer',
  ])

const statuses =
  new Set<AgendaStatus>([
    'scheduled',
    'completed',
    'cancelled',
  ])

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/

function parseList<T extends string>(
  value: string | null,
  allowed: Set<T>
) {
  if (!value) {
    return undefined
  }

  const rawValues =
    value.split(',')

  const values =
    rawValues.filter(
      (item): item is T =>
        allowed.has(item as T)
    )

  if (
    values.length === 0 ||
    values.length !==
      rawValues.length ||
    new Set(values).size !==
      values.length
  ) {
    throw new ReferenceRequestError(
      'invalid_query',
      'Los filtros no son válidos.'
    )
  }

  return values
}

function parseOptionalUuid(
  value: string | null
) {
  if (
    value === null ||
    value === ''
  ) {
    return undefined
  }

  if (!UUID_PATTERN.test(value)) {
    throw new ReferenceRequestError(
      'invalid_query',
      'El responsable no es válido.'
    )
  }

  return value
}

function parseOptionalDate(
  value: string | null
) {
  if (
    value === null ||
    value === ''
  ) {
    return undefined
  }

  if (!ISO_DATE_PATTERN.test(value)) {
    throw new ReferenceRequestError(
      'invalid_query',
      'La fecha no es válida.'
    )
  }

  const [year, month, day] =
    value.split('-').map(Number)

  const parsed =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    )

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !==
      month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ReferenceRequestError(
      'invalid_query',
      'La fecha no es válida.'
    )
  }

  return value
}

function parseQuery(
  value: string | null
) {
  const query =
    (value ?? '').trim()

  if (query.length > 100) {
    throw new ReferenceRequestError(
      'invalid_query',
      'La búsqueda es demasiado larga.'
    )
  }

  return query || undefined
}


function parseBoolean(
  value: string | null
) {
  if (
    value === null ||
    value === ''
  ) {
    return false
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  throw new ReferenceRequestError(
    'invalid_query',
    'El filtro sin responsable no es válido.'
  )
}

export async function GET(
  request: NextRequest
) {
  const supabase =
    await createClient()

  const { data, error } =
    await supabase.auth.getClaims()

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

  if (!access.length) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  try {
    const responsible =
      parseOptionalUuid(
        request.nextUrl.searchParams.get(
          'responsible'
        )
      )

    const unassignedOnly =
      parseBoolean(
        request.nextUrl.searchParams.get(
          'unassigned'
        )
      )

    if (
      responsible &&
      unassignedOnly
    ) {
      throw new ReferenceRequestError(
        'invalid_query',
        'No se puede filtrar por un responsable y por sin responsable al mismo tiempo.'
      )
    }

    const fromDate =
      parseOptionalDate(
        request.nextUrl.searchParams.get(
          'from'
        )
      )

    const toDate =
      parseOptionalDate(
        request.nextUrl.searchParams.get(
          'to'
        )
      )

    if (
      fromDate &&
      toDate &&
      fromDate > toDate
    ) {
      throw new ReferenceRequestError(
        'invalid_query',
        'La fecha desde no puede ser posterior a la fecha hasta.'
      )
    }

    const page =
      await listAgendaPage({
        query:
          parseQuery(
            request.nextUrl.searchParams.get(
              'q'
            )
          ),

        fromDate,
        toDate,

        itemKinds:
          parseList(
            request.nextUrl.searchParams.get(
              'kinds'
            ),
            itemKinds
          ),

        entryTypes:
          parseList(
            request.nextUrl.searchParams.get(
              'types'
            ),
            entryTypes
          ),

        sourceTypes:
          parseList(
            request.nextUrl.searchParams.get(
              'origins'
            ),
            sourceTypes
          ),

        responsibleInternalUserId:
          responsible,

        unassignedOnly,

        statuses:
          parseList(
            request.nextUrl.searchParams.get(
              'statuses'
            ),
            statuses
          ),

        cursor:
          request.nextUrl.searchParams.get(
            'cursor'
          ),

        limit:
          parseReferenceLimit(
            request.nextUrl.searchParams.get(
              'limit'
            )
          ),
      })

    return NextResponse.json(
      page,
      {
        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    )
  } catch (caught) {
    if (
      caught instanceof
        ReferenceRequestError
    ) {
      return NextResponse.json(
        {
          error:
            caught.message,
          code:
            caught.code,
        },
        { status: 400 }
      )
    }

    throw caught
  }
}
