import 'server-only'

import {
  createReferenceContext, decodeReferenceCursor, encodeReferenceCursor,
  normalizeReferenceQuery, parseReferenceLimit, ReferenceRequestError,
} from '../reference-pagination'
import { createAdminClient } from '../supabase/admin'

export type OpportunityReference = { id: string; title: string; status: string }

export async function listOpportunityReferencePage(input: {
  query: string; cursor: string | null; limit: number
}) {
  const query = normalizeReferenceQuery(input.query)
  const limit = parseReferenceLimit(String(input.limit))
  const context = createReferenceContext({ query, limit })
  const cursor = decodeReferenceCursor(input.cursor, 'opportunities', context)
  if (cursor !== null && (typeof cursor !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor))) {
    throw new ReferenceRequestError('invalid_cursor', 'El cursor no es válido.')
  }

  // UUID order provides a stable, unique keyset without relying on mutable titles.
  let request = createAdminClient().from('opportunity_list')
    .select('id,title,status')
    .neq('status', 'discarded')
    .order('id', { ascending: true })
    .limit(limit + 1)
  if (query) request = request.ilike('title', `%${query}%`)
  if (cursor) request = request.gt('id', cursor)
  const { data, error } = await request
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as OpportunityReference[]
  const items = rows.slice(0, limit)
  return {
    items,
    nextCursor: rows.length > limit
      ? encodeReferenceCursor('opportunities', context, items[items.length - 1].id)
      : null,
  }
}
