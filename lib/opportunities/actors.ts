import 'server-only'

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