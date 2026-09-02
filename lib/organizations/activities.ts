import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type ActivitySearchResult = {
  id: string
  display_name: string
  search_name: string
  description: string | null
  organization_count: number
  suggested_skill_count: number
}

const MINIMUM_QUERY_LENGTH = 2
const SEARCH_LIMIT = 10
const REFERENCE_LIST_LIMIT = 50

function normalizeActivitySearchTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function searchActivities(
  query: string
): Promise<ActivitySearchResult[]> {
  const term =
    normalizeActivitySearchTerm(query)

  if (term.length < MINIMUM_QUERY_LENGTH) {
    return []
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('activity_directory')
    .select(
      `
      id,
      display_name,
      search_name,
      description,
      organization_count,
      suggested_skill_count
    `
    )
    .ilike('search_text', `%${term}%`)
    .order('display_name', {
      ascending: true,
    })
    .limit(SEARCH_LIMIT)

  if (error) {
    throw new Error(
      `Unable to search activities: ${error.message}`
    )
  }

  return (data ?? []) as ActivitySearchResult[]
}

export async function listActivityReferenceOptions(): Promise<
  ActivitySearchResult[]
> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('activity_directory')
    .select(
      `
      id,
      display_name,
      search_name,
      description,
      organization_count,
      suggested_skill_count
    `
    )
    .order('display_name', {
      ascending: true,
    })
    .limit(REFERENCE_LIST_LIMIT)

  if (error) {
    throw new Error(
      `Unable to list activities: ${error.message}`
    )
  }

  return (data ?? []) as ActivitySearchResult[]
}
