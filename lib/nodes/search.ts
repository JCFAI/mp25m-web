import 'server-only'

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

const MINIMUM_QUERY_LENGTH = 2
const NODE_SEARCH_LIMIT = 10
const FILTERED_NODE_SEARCH_LIMIT = 50
const REFERENCE_NODE_LIST_LIMIT = 50

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
