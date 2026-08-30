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

export type SearchOrganizationsInput = {
  query: string
  organizationTypeCode?: string | null
}

const MINIMUM_QUERY_LENGTH = 3
const NAME_SEARCH_LIMIT = 10
const TYPE_SEARCH_LIMIT = 20

const ORGANIZATION_TYPE_CODE_PATTERN =
  /^[a-z0-9_]+$/i

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
  input: SearchOrganizationsInput
): Promise<OrganizationSearchResult[]> {
  const term =
    normalizeOrganizationSearchTerm(input.query)

  const organizationTypeCode =
    input.organizationTypeCode?.trim() || null

  if (
    organizationTypeCode &&
    !ORGANIZATION_TYPE_CODE_PATTERN.test(
      organizationTypeCode
    )
  ) {
    return []
  }

  if (
    !organizationTypeCode &&
    term.length < MINIMUM_QUERY_LENGTH
  ) {
    return []
  }

  const supabase = createAdminClient()

  let query = supabase
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
    .order('display_name', {
      ascending: true,
    })

  if (organizationTypeCode) {
    query = query.eq(
      'organization_type_code',
      organizationTypeCode
    )
  }

  if (term.length > 0) {
    query = query.ilike(
      'search_name',
      `%${term}%`
    )
  }

  const { data, error } = await query.limit(
    organizationTypeCode
      ? TYPE_SEARCH_LIMIT
      : NAME_SEARCH_LIMIT
  )

  if (error) {
    throw new Error(
      `Unable to search organizations: ${error.message}`
    )
  }

  return (
    data ?? []
  ) as OrganizationSearchResult[]
}
