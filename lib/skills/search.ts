import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type SkillApplicationFilter =
  | 'all'
  | 'person'
  | 'people'
  | 'organization'
  | 'organizations'
  | 'both'

type CanonicalSkillApplicationFilter =
  | 'all'
  | 'people'
  | 'organizations'
  | 'both'

export type SkillSearchResult = {
  id: string
  display_name: string
  search_name: string
  category_code: string | null
  category_name: string | null
  description: string | null
  applies_to_person: boolean
  applies_to_organization: boolean
  person_count: number
  organization_count: number
  node_count: number
  alias_count: number
}

export type SkillCategoryOption = {
  code: string
  name: string
  description: string | null
  sort_order: number
  skill_count: number
}

export type SearchSkillsInput = {
  query: string
  categoryCode?: string | null
  application?: string | null
}

const MINIMUM_QUERY_LENGTH = 2
const NAME_SEARCH_LIMIT = 10
const FILTERED_SEARCH_LIMIT = 20
const REFERENCE_LIST_LIMIT = 50

const CODE_PATTERN = /^[a-z0-9_-]+$/i

function normalizeSkillSearchTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeApplicationFilter(
  value: string | null | undefined
): CanonicalSkillApplicationFilter | null {
  if (!value || value === 'all') {
    return 'all'
  }

  if (value === 'person' || value === 'people') {
    return 'people'
  }

  if (
    value === 'organization' ||
    value === 'organizations'
  ) {
    return 'organizations'
  }

  if (value === 'both') {
    return 'both'
  }

  return null
}

export async function listSkillCategoryOptions(): Promise<
  SkillCategoryOption[]
> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('skill_category_options')
    .select(
      `
      code,
      name,
      description,
      sort_order,
      skill_count
    `
    )
    .order('sort_order', {
      ascending: true,
    })
    .order('name', {
      ascending: true,
    })

  if (error) {
    throw new Error(
      `Unable to load skill categories: ${error.message}`
    )
  }

  return (data ?? []) as SkillCategoryOption[]
}

export async function searchSkills(
  input: SearchSkillsInput
): Promise<SkillSearchResult[]> {
  const term =
    normalizeSkillSearchTerm(input.query)

  const categoryCode =
    input.categoryCode?.trim() || null

  const application =
    normalizeApplicationFilter(
      input.application?.trim()
    )

  if (
    categoryCode &&
    !CODE_PATTERN.test(categoryCode)
  ) {
    return []
  }

  if (!application) {
    return []
  }

  const hasCategoryFilter =
    Boolean(categoryCode)
  const hasApplicationFilter =
    application !== 'all'
  const hasFilter =
    hasCategoryFilter || hasApplicationFilter

  if (
    !hasFilter &&
    term.length < MINIMUM_QUERY_LENGTH
  ) {
    return []
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('skill_directory')
    .select(
      `
      id,
      display_name,
      search_name,
      category_code,
      category_name,
      description,
      applies_to_person,
      applies_to_organization,
      person_count,
      organization_count,
      node_count,
      alias_count
    `
    )
    .order('display_name', {
      ascending: true,
    })

  if (categoryCode) {
    query = query.eq(
      'category_code',
      categoryCode
    )
  }

  if (application === 'people') {
    query = query.eq(
      'applies_to_person',
      true
    )
  }

  if (application === 'organizations') {
    query = query.eq(
      'applies_to_organization',
      true
    )
  }

  if (application === 'both') {
    query = query
      .eq('applies_to_person', true)
      .eq('applies_to_organization', true)
  }

  if (term.length >= MINIMUM_QUERY_LENGTH) {
    query = query.ilike(
      'search_text',
      `%${term}%`
    )
  }

  const { data, error } = await query.limit(
    hasFilter
      ? FILTERED_SEARCH_LIMIT
      : NAME_SEARCH_LIMIT
  )

  if (error) {
    throw new Error(
      `Unable to search skills: ${error.message}`
    )
  }

  return (data ?? []) as SkillSearchResult[]
}

export async function listSkillReferenceOptions({
  application,
}: {
  application?: string | null
}): Promise<SkillSearchResult[]> {
  const normalizedApplication =
    normalizeApplicationFilter(
      application?.trim()
    )

  if (!normalizedApplication) {
    return []
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('skill_directory')
    .select(
      `
      id,
      display_name,
      search_name,
      category_code,
      category_name,
      description,
      applies_to_person,
      applies_to_organization,
      person_count,
      organization_count,
      node_count,
      alias_count
    `
    )
    .order('display_name', {
      ascending: true,
    })

  if (normalizedApplication === 'people') {
    query = query.eq(
      'applies_to_person',
      true
    )
  }

  if (
    normalizedApplication === 'organizations'
  ) {
    query = query.eq(
      'applies_to_organization',
      true
    )
  }

  if (normalizedApplication === 'both') {
    query = query
      .eq('applies_to_person', true)
      .eq('applies_to_organization', true)
  }

  const { data, error } = await query.limit(
    REFERENCE_LIST_LIMIT
  )

  if (error) {
    throw new Error(
      `Unable to list skills: ${error.message}`
    )
  }

  return (data ?? []) as SkillSearchResult[]
}
