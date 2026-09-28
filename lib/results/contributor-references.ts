import 'server-only'

import {
  createReferenceContext,
  decodeReferenceCursor,
  encodeReferenceCursor,
  normalizeReferenceQuery,
  type ReferencePage,
  ReferenceRequestError,
} from '../reference-pagination'
import { createAdminClient } from '../supabase/admin'

export type ResultContributorReference = {
  actor_type: 'person' | 'organization'
  actor_id: string
  display_name: string
  type_label: string
  record_status: 'active' | 'archived'
}

type ResultContributorReferenceRow =
  ResultContributorReference & {
    cursor_name: string
  }

type ResultContributorCursor = {
  name: string
  actorType: 'person' | 'organization'
  id: string
}

type ListResultContributorReferencesInput = {
  query: string
  cursor?: string | null
  limit: number
  minimumQueryLength?: number
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isResultContributorCursor(
  value: unknown,
): value is ResultContributorCursor {
  if (!value || typeof value !== 'object') {
    return false
  }

  const cursor =
    value as Partial<ResultContributorCursor>

  return (
    typeof cursor.name === 'string' &&
    (
      cursor.actorType === 'person' ||
      cursor.actorType === 'organization'
    ) &&
    typeof cursor.id === 'string' &&
    UUID_PATTERN.test(cursor.id)
  )
}

export async function listResultContributorReferencePage({
  query,
  cursor = null,
  limit,
  minimumQueryLength = 2,
}: ListResultContributorReferencesInput): Promise<
  ReferencePage<ResultContributorReference>
> {
  const normalizedQuery =
    normalizeReferenceQuery(
      query,
      minimumQueryLength,
    )

  const context =
    createReferenceContext({
      query: normalizedQuery,
    })

  const decodedCursor =
    decodeReferenceCursor(
      cursor,
      'result-contributors',
      context,
    )

  if (
    decodedCursor !== null &&
    !isResultContributorCursor(
      decodedCursor,
    )
  ) {
    throw new ReferenceRequestError(
      'invalid_cursor',
      'El cursor no contiene una posición válida.',
    )
  }

  const { data, error } =
    await createAdminClient().rpc(
      'result_contributor_reference_page',
      {
        p_query:
          normalizedQuery,
        p_after_name:
          decodedCursor?.name ?? null,
        p_after_actor_type:
          decodedCursor?.actorType ?? null,
        p_after_actor_id:
          decodedCursor?.id ?? null,
        p_limit:
          limit,
      },
    )

  if (error) {
    throw new Error(
      `Unable to list Result contributor references: ${error.message}`,
    )
  }

  const rows =
    (data ?? []) as ResultContributorReferenceRow[]

  const hasMore =
    rows.length > limit

  const visibleRows =
    rows.slice(0, limit)

  const lastRow =
    visibleRows.at(-1)

  return {
    items:
      visibleRows.map(
        (row) => ({
          actor_type:
            row.actor_type,
          actor_id:
            row.actor_id,
          display_name:
            row.display_name,
          type_label:
            row.type_label,
          record_status:
            row.record_status,
        }),
      ),

    nextCursor:
      hasMore && lastRow
        ? encodeReferenceCursor(
            'result-contributors',
            context,
            {
              name:
                lastRow.cursor_name,
              actorType:
                lastRow.actor_type,
              id:
                lastRow.actor_id,
            } satisfies ResultContributorCursor,
          )
        : null,
  }
}
