import { NextRequest, NextResponse } from 'next/server'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { parseReferenceLimit, ReferenceRequestError } from '../../../../lib/reference-pagination'
import { createClient } from '../../../../lib/supabase/server'
import { listThemePage, type ThemePriority, type ThemeStatus } from '../../../../lib/themes/themes'

const statuses = new Set<ThemeStatus>(['active', 'monitoring', 'paused', 'closed'])
const priorities = new Set<ThemePriority>(['low', 'normal', 'high', 'urgent'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseList<T extends string>(value: string | null, allowed: Set<T>) {
  if (!value) return undefined
  const values = [...new Set(value.split(',').filter((item): item is T => allowed.has(item as T)))]
  if (values.length === 0 || values.length !== value.split(',').length) throw new ReferenceRequestError('invalid_query', 'Los filtros no son válidos.')
  return values
}

function parseOptionalUuid(value: string | null) {
  if (value === null || value === '') return undefined
  if (!UUID_PATTERN.test(value)) throw new ReferenceRequestError('invalid_query', 'El responsable no es válido.')
  return value
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const authUserId = data?.claims?.sub
  if (error || !authUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getInternalAccess(authUserId)
  if (!access.length) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const page = await listThemePage({
      query: request.nextUrl.searchParams.get('q') ?? '',
      statuses: parseList(request.nextUrl.searchParams.get('statuses'), statuses),
      priorities: parseList(request.nextUrl.searchParams.get('priorities'), priorities),
      responsibleInternalUserId: parseOptionalUuid(request.nextUrl.searchParams.get('responsible')),
      cursor: request.nextUrl.searchParams.get('cursor'),
      limit: parseReferenceLimit(request.nextUrl.searchParams.get('limit')),
    })
    return NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } })
  } catch (caught) {
    if (caught instanceof ReferenceRequestError) {
      return NextResponse.json({ error: caught.message, code: caught.code }, { status: 400 })
    }
    throw caught
  }
}
