import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type CapabilityMapNode = {
  id: string
  node_number: number | null
  display_name: string
  jurisdiction_name: string | null
  jurisdiction_type_name: string | null
}

export type NodeVector = {
  node_id: string
  vector_id: string
  vector_name: string
  vector_search_name: string
  verification_status: string
  evidence_text: string | null
  source_id: string | null
  source_name: string | null
  created_at: string
  updated_at: string
}

export type NodePersonCapability = {
  node_id: string
  person_id: string
  display_name: string
  person_skill_id: string
  skill_id: string
  skill_name: string
  skill_search_name: string
  category_code: string | null
  category_name: string | null
  proficiency_level: number | null
  verification_status: string
  experience_range: string | null
  experience_notes: string | null
  notes: string | null
  last_self_reported_at: string | null
  other_node_ids: string[]
  other_node_names: string[]
}

export type NodeOrganizationCapability = {
  node_id: string
  organization_id: string
  organization_name: string
  organization_type_code: string
  organization_type_name: string
  organization_capability_id: string
  skill_id: string
  capability_name: string
  capability_search_name: string
  category_code: string | null
  category_name: string | null
  verification_status: string
  notes: string | null
  source_id: string | null
  source_name: string | null
  ingestion_record_id: number | null
  last_self_reported_at: string | null
  evidence_count: number
  created_at: string
  updated_at: string
}

export type NodeCapabilityMap = {
  node: CapabilityMapNode
  vectors: NodeVector[]
  personCapabilities: NodePersonCapability[]
  organizationCapabilities: NodeOrganizationCapability[]
}

export async function getNodeCapabilityMap(
  nodeId: string
): Promise<NodeCapabilityMap | null> {
  const supabase = createAdminClient()

  const [
    nodeResult,
    vectorResult,
    personCapabilityResult,
    organizationCapabilityResult,
  ] = await Promise.all([
    supabase
      .from('node_profile')
      .select(`
        id,
        node_number,
        display_name,
        jurisdiction_name,
        jurisdiction_type_name
      `)
      .eq('id', nodeId)
      .eq('status', 'active')
      .maybeSingle(),

    supabase
      .from('node_vector_list')
      .select('*')
      .eq('node_id', nodeId)
      .order('vector_name', {
        ascending: true,
      }),

    supabase
      .from('node_person_capability_list')
      .select('*')
      .eq('node_id', nodeId)
      .order('skill_name', {
        ascending: true,
      })
      .order('display_name', {
        ascending: true,
      }),

    supabase
      .from('node_organization_capability_list')
      .select('*')
      .eq('node_id', nodeId)
      .order('capability_name', {
        ascending: true,
      })
      .order('organization_name', {
        ascending: true,
      }),
  ])

  if (nodeResult.error) {
    throw new Error(
      `Unable to load capability map node: ${nodeResult.error.message}`
    )
  }

  if (!nodeResult.data) {
    return null
  }

  if (vectorResult.error) {
    throw new Error(
      `Unable to load node vectors: ${vectorResult.error.message}`
    )
  }

  if (personCapabilityResult.error) {
    throw new Error(
      `Unable to load person capabilities: ${personCapabilityResult.error.message}`
    )
  }

  if (organizationCapabilityResult.error) {
    throw new Error(
      `Unable to load organization capabilities: ${organizationCapabilityResult.error.message}`
    )
  }

  return {
    node: nodeResult.data as CapabilityMapNode,
    vectors:
      (vectorResult.data ?? []) as NodeVector[],
    personCapabilities:
      (personCapabilityResult.data ??
        []) as NodePersonCapability[],
    organizationCapabilities:
      (organizationCapabilityResult.data ??
        []) as NodeOrganizationCapability[],
  }
}