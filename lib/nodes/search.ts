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

const MINIMUM_QUERY_LENGTH = 2

function normalizeNodeSearchTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function searchNodes(
  query: string
): Promise<NodeSearchResult[]> {
  const term = normalizeNodeSearchTerm(query)

  if (term.length < MINIMUM_QUERY_LENGTH) {
    return []
  }

  const supabase = createAdminClient()

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
    .limit(10)

  if (error) {
    throw new Error(
      `Unable to search nodes: ${error.message}`
    )
  }

  return (data ?? []) as NodeSearchResult[]
}