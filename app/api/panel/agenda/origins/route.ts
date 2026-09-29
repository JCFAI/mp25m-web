import {
  NextRequest,
  NextResponse,
} from 'next/server'

import type {
  AgendaSourceType,
} from '../../../../../lib/agenda/agenda'
import { getInternalAccess } from '../../../../../lib/auth/internal-access'
import { createAdminClient } from '../../../../../lib/supabase/admin'
import { createClient } from '../../../../../lib/supabase/server'

const sourceTypes =
  new Set<AgendaSourceType>([
    'opportunity',
    'articulation',
    'project',
    'theme',
    'need_offer',
  ])

function parseSourceType(
  value: string | null
): AgendaSourceType | null {
  if (
    value &&
    sourceTypes.has(
      value as AgendaSourceType
    )
  ) {
    return value as AgendaSourceType
  }

  return null
}

function parseQuery(
  value: string | null
) {
  const query =
    (value ?? '').trim()

  if (query.length > 100) {
    return null
  }

  return query
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

  const sourceType =
    parseSourceType(
      request.nextUrl.searchParams.get(
        'type'
      )
    )

  const query =
    parseQuery(
      request.nextUrl.searchParams.get(
        'q'
      )
    )

  if (
    !sourceType ||
    query === null
  ) {
    return NextResponse.json(
      {
        error:
          'El tipo de origen o la búsqueda no son válidos.',
      },
      { status: 400 }
    )
  }

  const admin =
    createAdminClient()

  try {
    switch (sourceType) {
      case 'opportunity': {
        let builder =
          admin
            .from('opportunity_list')
            .select(
              'id, title, status'
            )
            .order(
              'title',
              { ascending: true }
            )
            .limit(25)

        if (query) {
          builder =
            builder.ilike(
              'title',
              `%${query}%`
            )
        }

        const {
          data: rows,
          error: queryError,
        } = await builder

        if (queryError) {
          throw queryError
        }

        return NextResponse.json({
          items:
            (rows ?? []).map(
              (row) => ({
                id: row.id,
                label: row.title,
                status: row.status,
              })
            ),
        })
      }

      case 'articulation': {
        let builder =
          admin
            .from(
              'opportunity_articulation_list'
            )
            .select(
              'articulation_id, title, status'
            )
            .order(
              'title',
              { ascending: true }
            )
            .limit(25)

        if (query) {
          builder =
            builder.ilike(
              'title',
              `%${query}%`
            )
        }

        const {
          data: rows,
          error: queryError,
        } = await builder

        if (queryError) {
          throw queryError
        }

        return NextResponse.json({
          items:
            (rows ?? []).map(
              (row) => ({
                id:
                  row.articulation_id,
                label:
                  row.title,
                status:
                  row.status,
              })
            ),
        })
      }

      case 'project': {
        let builder =
          admin
            .from('project_list')
            .select(
              'project_id, title, status'
            )
            .order(
              'title',
              { ascending: true }
            )
            .limit(25)

        if (query) {
          builder =
            builder.ilike(
              'title',
              `%${query}%`
            )
        }

        const {
          data: rows,
          error: queryError,
        } = await builder

        if (queryError) {
          throw queryError
        }

        return NextResponse.json({
          items:
            (rows ?? []).map(
              (row) => ({
                id:
                  row.project_id,
                label:
                  row.title,
                status:
                  row.status,
              })
            ),
        })
      }

      case 'theme': {
        let builder =
          admin
            .from('theme_list')
            .select(
              'theme_id, name, status'
            )
            .order(
              'name',
              { ascending: true }
            )
            .limit(25)

        if (query) {
          builder =
            builder.ilike(
              'name',
              `%${query}%`
            )
        }

        const {
          data: rows,
          error: queryError,
        } = await builder

        if (queryError) {
          throw queryError
        }

        return NextResponse.json({
          items:
            (rows ?? []).map(
              (row) => ({
                id:
                  row.theme_id,
                label:
                  row.name,
                status:
                  row.status,
              })
            ),
        })
      }

      case 'need_offer': {
        let builder =
          admin
            .from(
              'need_offer_list'
            )
            .select(
              'need_offer_id, title, status, record_type'
            )
            .order(
              'title',
              { ascending: true }
            )
            .limit(25)

        if (query) {
          builder =
            builder.ilike(
              'title',
              `%${query}%`
            )
        }

        const {
          data: rows,
          error: queryError,
        } = await builder

        if (queryError) {
          throw queryError
        }

        return NextResponse.json({
          items:
            (rows ?? []).map(
              (row) => ({
                id:
                  row.need_offer_id,
                label:
                  row.title,
                status:
                  row.status,
                detail:
                  row.record_type ===
                  'need'
                    ? 'Necesidad'
                    : 'Oferta',
              })
            ),
        })
      }
    }
  } catch (caught) {
    console.error(
      '[MP25M] Agenda origin lookup failed:',
      caught
    )

    return NextResponse.json(
      {
        error:
          'No se pudieron cargar las entidades de origen.',
      },
      { status: 500 }
    )
  }
}
