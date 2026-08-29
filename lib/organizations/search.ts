import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type OrganizationSearchResult = {
  id: string
  display_name: string
  organization_type_code: string
  organization_type_name: string
  record_status: string
  confirmed_node_count: number
  capability_count: number
}

const MINIMUM_QUERY_LENGTH = 3

function normalizeOrganizationSearchTerm(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function searchOrganizations(
  query: string
): Promise<OrganizationSearchResult[]> {
  const term =
    normalizeOrganizationSearchTerm(query)

  if (term.length < MINIMUM_QUERY_LENGTH) {
    return []
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('organization_directory')
    .select(`
      id,
      display_name,
      organization_type_code,
      organization_type_name,
      record_status,
      confirmed_node_count,
      capability_count
    `)
    .ilike('search_name', `%${term}%`)
    .order('display_name', {
      ascending: true,
    })
    .limit(10)

  if (error) {
    throw new Error(
      `Unable to search organizations: ${error.message}`
    )
  }

  return (
    data ?? []
  ) as OrganizationSearchResult[]
}