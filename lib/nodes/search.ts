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

export type NodeSearchResult = {
  id: string
  node_number: number | null
  display_name: string
  status: string
  jurisdiction_name: string | null
  jurisdiction_type_name: string | null
}

export type SearchNodesOptions = {
  excludeOrganizationId?: string | null
}

type ListNodeReferencePageInput =
  SearchNodesOptions & {
    query: string
    cursor?: string | null
    limit: number
  }

type NodeReferenceRow = NodeSearchResult & {
  search_name: string
}

type NodeReferenceCursor = {
  searchName: string
  id: string
}

const MINIMUM_QUERY_LENGTH = 2
const NODE_SEARCH_LIMIT = 10
const FILTERED_NODE_SEARCH_LIMIT = 50
const REFERENCE_NODE_LIST_LIMIT = 50

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isNodeReferenceCursor(
  value: unknown
): value is NodeReferenceCursor {
  if (!value || typeof value !== 'object') {
    return false
  }

  const cursor = value as Partial<NodeReferenceCursor>

  return (
    typeof cursor.searchName === 'string' &&
    typeof cursor.id === 'string' &&
    UUID_PATTERN.test(cursor.id)
  )
}

function normalizeNodeSearchTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function loadExcludedOrganizationNodeIds(
  excludeOrganizationId: string | null
) {
  const excludedNodeIds = new Set<string>()

  if (
    excludeOrganizationId &&
    UUID_PATTERN.test(excludeOrganizationId)
  ) {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('organization_node_list')
      .select('node_id')
      .eq(
        'organization_id',
        excludeOrganizationId
      )

    if (error) {
      throw new Error(
        `Unable to load organization linked nodes: ${error.message}`
      )
    }

    for (const row of data ?? []) {
      if (row.node_id) {
        excludedNodeIds.add(row.node_id)
      }
    }
  }

  return excludedNodeIds
}

export async function searchNodes(
  query: string,
  options: SearchNodesOptions = {}
): Promise<NodeSearchResult[]> {
  const term = normalizeNodeSearchTerm(query)

  if (term.length < MINIMUM_QUERY_LENGTH) {
    return []
  }

  const supabase = createAdminClient()

  const excludeOrganizationId =
    options.excludeOrganizationId?.trim() ||
    null
  const excludedNodeIds =
    await loadExcludedOrganizationNodeIds(
      excludeOrganizationId
    )

  const { data, error } = await supabase
    .from('node_directory')
    .select(`
      id,
      node_number,
      display_name,
      status,
      jurisdiction_name,
      jurisdiction_type_name
    `)
    .ilike('search_name', `%${term}%`)
    .order('display_name', {
      ascending: true,
    })
    .limit(
      excludedNodeIds.size > 0
        ? FILTERED_NODE_SEARCH_LIMIT
        : NODE_SEARCH_LIMIT
    )

  if (error) {
    throw new Error(
      `Unable to search nodes: ${error.message}`
    )
  }

  const rows =
    (data ?? []) as NodeSearchResult[]

  if (excludedNodeIds.size === 0) {
    return rows
  }

  return rows
    .filter(
      (node) => !excludedNodeIds.has(node.id)
    )
    .slice(0, NODE_SEARCH_LIMIT)
}

export async function listNodeReferenceOptions(
  options: SearchNodesOptions = {}
): Promise<NodeSearchResult[]> {
  const supabase = createAdminClient()
  const excludeOrganizationId =
    options.excludeOrganizationId?.trim() ||
    null
  const excludedNodeIds =
    await loadExcludedOrganizationNodeIds(
      excludeOrganizationId
    )

  const { data, error } = await supabase
    .from('node_directory')
    .select(`
      id,
      node_number,
      display_name,
      status,
      jurisdiction_name,
      jurisdiction_type_name
    `)
    .order('display_name', {
      ascending: true,
    })
    .limit(REFERENCE_NODE_LIST_LIMIT)

  if (error) {
    throw new Error(
      `Unable to list nodes: ${error.message}`
    )
  }

  const rows =
    (data ?? []) as NodeSearchResult[]

  if (excludedNodeIds.size === 0) {
    return rows
  }

  return rows.filter(
    (node) => !excludedNodeIds.has(node.id)
  )
}

export async function listNodeReferencePage({
  query,
  cursor = null,
  limit,
  excludeOrganizationId,
}: ListNodeReferencePageInput): Promise<
  ReferencePage<NodeSearchResult>
> {
  const normalizedQuery =
    normalizeReferenceQuery(query)
  const normalizedExcludeOrganizationId =
    excludeOrganizationId &&
    UUID_PATTERN.test(excludeOrganizationId)
      ? excludeOrganizationId
      : null
  const context = createReferenceContext({
    query: normalizedQuery,
    excludeOrganizationId:
      normalizedExcludeOrganizationId,
  })
  const decodedCursor = decodeReferenceCursor(
    cursor,
    'nodes',
    context
  )

  if (
    decodedCursor !== null &&
    !isNodeReferenceCursor(decodedCursor)
  ) {
    throw new ReferenceRequestError(
      'invalid_cursor',
      'El cursor no contiene una posición válida.'
    )
  }

  const excludedNodeIds =
    await loadExcludedOrganizationNodeIds(
      normalizedExcludeOrganizationId
    )
  const excludedIds = [...excludedNodeIds]
  const excludedFilter =
    excludedIds.length > 0
      ? `(${excludedIds.join(',')})`
      : null
  const supabase = createAdminClient()
  const requestedRowCount = limit + 1
  let rows: NodeReferenceRow[] = []

  if (!decodedCursor) {
    let referenceQuery = supabase
      .from('node_directory')
      .select(`
        id,
        node_number,
        display_name,
        search_name,
        status,
        jurisdiction_name,
        jurisdiction_type_name
      `)

    if (normalizedQuery) {
      referenceQuery = referenceQuery.ilike(
        'search_name',
        `%${normalizedQuery}%`
      )
    }

    if (excludedFilter) {
      referenceQuery = referenceQuery.not(
        'id',
        'in',
        excludedFilter
      )
    }

    const { data, error } = await referenceQuery
      .order('search_name', { ascending: true })
      .order('id', { ascending: true })
      .limit(requestedRowCount)

    if (error) {
      throw new Error(
        `Unable to list node references: ${error.message}`
      )
    }

    rows = (data ?? []) as NodeReferenceRow[]
  } else {
    let sameNameQuery = supabase
      .from('node_directory')
      .select(`
        id,
        node_number,
        display_name,
        search_name,
        status,
        jurisdiction_name,
        jurisdiction_type_name
      `)
      .eq('search_name', decodedCursor.searchName)
      .gt('id', decodedCursor.id)

    if (normalizedQuery) {
      sameNameQuery = sameNameQuery.ilike(
        'search_name',
        `%${normalizedQuery}%`
      )
    }

    if (excludedFilter) {
      sameNameQuery = sameNameQuery.not(
        'id',
        'in',
        excludedFilter
      )
    }

    const sameNameResult = await sameNameQuery
      .order('id', { ascending: true })
      .limit(requestedRowCount)

    if (sameNameResult.error) {
      throw new Error(
        `Unable to continue node references: ${sameNameResult.error.message}`
      )
    }

    rows = (sameNameResult.data ?? []) as NodeReferenceRow[]

    if (rows.length < requestedRowCount) {
      let laterNamesQuery = supabase
        .from('node_directory')
        .select(`
          id,
          node_number,
          display_name,
          search_name,
          status,
          jurisdiction_name,
          jurisdiction_type_name
        `)
        .gt('search_name', decodedCursor.searchName)

      if (normalizedQuery) {
        laterNamesQuery = laterNamesQuery.ilike(
          'search_name',
          `%${normalizedQuery}%`
        )
      }

      if (excludedFilter) {
        laterNamesQuery = laterNamesQuery.not(
          'id',
          'in',
          excludedFilter
        )
      }

      const laterNamesResult = await laterNamesQuery
        .order('search_name', { ascending: true })
        .order('id', { ascending: true })
        .limit(requestedRowCount - rows.length)

      if (laterNamesResult.error) {
        throw new Error(
          `Unable to continue node references: ${laterNamesResult.error.message}`
        )
      }

      rows = [
        ...rows,
        ...((laterNamesResult.data ?? []) as NodeReferenceRow[]),
      ]
    }
  }

  const hasMore = rows.length > limit
  const visibleRows = rows.slice(0, limit)
  const lastRow = visibleRows.at(-1)

  return {
    items: visibleRows.map((row) => ({
      id: row.id,
      node_number: row.node_number,
      display_name: row.display_name,
      status: row.status,
      jurisdiction_name: row.jurisdiction_name,
      jurisdiction_type_name:
        row.jurisdiction_type_name,
    })),
    nextCursor:
      hasMore && lastRow
        ? encodeReferenceCursor(
            'nodes',
            context,
            {
              searchName: lastRow.search_name,
              id: lastRow.id,
            } satisfies NodeReferenceCursor
          )
        : null,
  }
}
