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

export type OpportunityActorType =
  | 'person'
  | 'organization'
  | 'candidate'

export type OpportunityActorSearchResult = {
  actor_type: OpportunityActorType
  actor_id: string
  display_name: string
  type_label: string
  node_ids: string[]
  node_names: string[]
  role_names: string[]
  is_related_to_selected_node: boolean
  is_provisional: boolean
}

export type CanonicalActorType =
  | 'person'
  | 'organization'

export type CanonicalActorReference = {
  actor_type: CanonicalActorType
  actor_id: string
  display_name: string
  type_label: string
  node_ids: string[]
  node_names: string[]
  role_names: string[]
  is_related_to_selected_node: boolean
  is_provisional: false
}

type CanonicalActorReferenceRow =
  CanonicalActorReference & {
    cursor_name: string
  }

type CanonicalActorCursor = {
  related: boolean
  name: string
  actorType: CanonicalActorType
  id: string
}

type ListCanonicalActorReferencesInput = {
  query: string
  actorTypes: CanonicalActorType[]
  nodeIds?: string[]
  cursor?: string | null
  limit: number
  minimumQueryLength?: number
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isCanonicalActorCursor(
  value: unknown
): value is CanonicalActorCursor {
  if (!value || typeof value !== 'object') {
    return false
  }

  const cursor = value as Partial<CanonicalActorCursor>

  return (
    typeof cursor.related === 'boolean' &&
    typeof cursor.name === 'string' &&
    (cursor.actorType === 'person' ||
      cursor.actorType === 'organization') &&
    typeof cursor.id === 'string' &&
    UUID_PATTERN.test(cursor.id)
  )
}

export async function listCanonicalActorReferencePage({
  query,
  actorTypes,
  nodeIds = [],
  cursor = null,
  limit,
  minimumQueryLength = 2,
}: ListCanonicalActorReferencesInput): Promise<
  ReferencePage<CanonicalActorReference>
> {
  const normalizedQuery =
    normalizeReferenceQuery(
      query,
      minimumQueryLength
    )
  const normalizedActorTypes = [
    ...new Set(actorTypes),
  ].sort()
  const normalizedNodeIds = [
    ...new Set(
      nodeIds.filter((nodeId) =>
        UUID_PATTERN.test(nodeId)
      )
    ),
  ].sort()

  if (normalizedActorTypes.length === 0) {
    return {
      items: [],
      nextCursor: null,
    }
  }

  const context = createReferenceContext({
    query: normalizedQuery,
    actorTypes: normalizedActorTypes,
    nodeIds: normalizedNodeIds,
  })
  const decodedCursor = decodeReferenceCursor(
    cursor,
    'canonical-actors',
    context
  )

  if (
    decodedCursor !== null &&
    !isCanonicalActorCursor(decodedCursor)
  ) {
    throw new ReferenceRequestError(
      'invalid_cursor',
      'El cursor no contiene una posición válida.'
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    'canonical_actor_reference_page',
    {
      p_query: normalizedQuery,
      p_actor_types: normalizedActorTypes,
      p_node_ids: normalizedNodeIds,
      p_after_related:
        decodedCursor?.related ?? null,
      p_after_name:
        decodedCursor?.name ?? null,
      p_after_actor_type:
        decodedCursor?.actorType ?? null,
      p_after_actor_id:
        decodedCursor?.id ?? null,
      p_limit: limit,
    }
  )

  if (error) {
    throw new Error(
      `Unable to list canonical actor references: ${error.message}`
    )
  }

  const rows = (data ?? []) as CanonicalActorReferenceRow[]
  const hasMore = rows.length > limit
  const visibleRows = rows.slice(0, limit)
  const lastRow = visibleRows.at(-1)

  return {
    items: visibleRows.map((row) => ({
      actor_type: row.actor_type,
      actor_id: row.actor_id,
      display_name: row.display_name,
      type_label: row.type_label,
      node_ids: row.node_ids,
      node_names: row.node_names,
      role_names: row.role_names,
      is_related_to_selected_node: row.is_related_to_selected_node,
      is_provisional: row.is_provisional,
    })),
    nextCursor:
      hasMore && lastRow
        ? encodeReferenceCursor(
            'canonical-actors',
            context,
            {
              related:
                lastRow.is_related_to_selected_node,
              name: lastRow.cursor_name,
              actorType: lastRow.actor_type,
              id: lastRow.actor_id,
            } satisfies CanonicalActorCursor
          )
        : null,
  }
}

export type OpportunityOrganizationTypeOption = {
  code: string
  name: string
  display_order: number
}

export async function searchOpportunityActors(
  query: string,
  nodeIds: string[] = []
): Promise<OpportunityActorSearchResult[]> {
  const term = query.trim()

  if (term.length < 2) {
    return []
  }

  const uniqueNodeIds = [...new Set(nodeIds)]

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'search_opportunity_actors',
    {
      p_query: term,
      p_node_ids: uniqueNodeIds,
      p_limit: 10,
    }
  )

  if (error) {
    throw new Error(
      `Unable to search opportunity actors: ${error.message}`
    )
  }

  return (data ?? []) as OpportunityActorSearchResult[]
}

export async function listOpportunityOrganizationTypes():
Promise<OpportunityOrganizationTypeOption[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('opportunity_organization_type_options')
    .select(`
      code,
      name,
      display_order
    `)
    .order('display_order', {
      ascending: true,
    })
    .order('name', {
      ascending: true,
    })

  if (error) {
    throw new Error(
      `Unable to list organization types: ${error.message}`
    )
  }

  return (data ?? []) as OpportunityOrganizationTypeOption[]
}
