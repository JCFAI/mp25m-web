import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type OrganizationProfile = {
  id: string
  display_name: string
  search_name: string
  organization_type_code: string
  organization_type_name: string
  notes: string | null
  record_status: string
  confirmed_node_count: number
  capability_count: number
  confirmed_capability_count: number
  articulation_count: number
  created_at: string
  updated_at: string
}

export type OrganizationNode = {
  organization_id: string
  node_id: string
  node_number: number | null
  node_name: string
  verification_status: string
  evidence_text: string | null
  source_id: string | null
  source_name: string | null
  ingestion_record_id: number | null
  notes: string | null
  started_on: string | null
  ended_on: string | null
  created_at: string
  updated_at: string
}

export type OrganizationCapability = {
  organization_id: string
  organization_capability_id: string
  skill_id: string
  capability_name: string
  capability_search_name: string
  category_code: string | null
  category_name: string | null
  scope_node_id: string | null
  scope_node_name: string | null
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

export type OrganizationActivity = {
  organization_id: string
  organization_activity_id: string
  activity_id: string
  activity_name: string
  activity_search_name: string
  verification_status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type ActivitySkillSuggestion = {
  activity_id: string
  activity_name: string
  skill_id: string
  skill_name: string
  skill_search_name: string
  category_code: string | null
  category_name: string | null
  description: string | null
  sort_order: number
}

export type OrganizationActivityProposal = {
  organization_id: string
  proposal_id: string
  proposed_name: string
  normalized_name: string
  status: string
  resolved_activity_id: string | null
  resolved_activity_name: string | null
  created_by_internal_user_id: string
  resolved_by_internal_user_id: string | null
  resolution_reason: string | null
  created_at: string
  resolved_at: string | null
}

export type OrganizationArticulation = {
  organization_id: string
  opportunity_id: string
  title: string
  description: string
  kind: 'opportunity' | 'need'
  status: string
  priority: string
  due_date: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type OrganizationTypeProposal = {
  id: string
  organization_id: string
  proposed_name: string
  normalized_name: string
  status: string
  resolved_organization_type_code: string | null
  resolved_organization_type_name: string | null
  created_by_internal_user_id: string
  resolved_by_internal_user_id: string | null
  resolution_reason: string | null
  created_at: string
  resolved_at: string | null
  suggested_organization_type_code: string | null
  suggested_organization_type_name: string | null
  suggested_match_kind: string | null
  suggested_similarity: number | null
}

export type CanonicalOrganizationProfile = {
  organization: OrganizationProfile
  nodes: OrganizationNode[]
  activities: OrganizationActivity[]
  activitySkillSuggestions: ActivitySkillSuggestion[]
  activityProposals: OrganizationActivityProposal[]
  capabilities: OrganizationCapability[]
  articulations: OrganizationArticulation[]
  typeProposals: OrganizationTypeProposal[]
}

export async function getCanonicalOrganizationProfile(
  organizationId: string
): Promise<CanonicalOrganizationProfile | null> {
  const supabase = createAdminClient()

  const [
    organizationResult,
    nodesResult,
    activitiesResult,
    activityProposalsResult,
    capabilitiesResult,
    articulationsResult,
    typeProposalsResult,
  ] = await Promise.all([
    supabase
      .from('organization_profile')
      .select('*')
      .eq('id', organizationId)
      .maybeSingle(),

    supabase
      .from('organization_node_list')
      .select('*')
      .eq('organization_id', organizationId)
      .order('node_name', {
        ascending: true,
      }),

    supabase
      .from('organization_activity_list')
      .select('*')
      .eq('organization_id', organizationId)
      .order('activity_name', {
        ascending: true,
      }),

    supabase
      .from('organization_activity_proposal_list')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', {
        ascending: false,
      }),

    supabase
      .from('organization_capability_list')
      .select('*')
      .eq('organization_id', organizationId)
      .order('capability_name', {
        ascending: true,
      }),

    supabase
      .from('organization_articulation_list')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', {
        ascending: false,
      }),

    supabase
      .from('organization_type_proposal_list')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', {
        ascending: false,
      }),
  ])

  if (organizationResult.error) {
    throw new Error(
      `Unable to load organization: ${organizationResult.error.message}`
    )
  }

  if (!organizationResult.data) {
    return null
  }

  if (nodesResult.error) {
    throw new Error(
      `Unable to load organization nodes: ${nodesResult.error.message}`
    )
  }

  if (activitiesResult.error) {
    throw new Error(
      `Unable to load organization activities: ${activitiesResult.error.message}`
    )
  }

  if (activityProposalsResult.error) {
    throw new Error(
      `Unable to load organization activity proposals: ${activityProposalsResult.error.message}`
    )
  }

  if (capabilitiesResult.error) {
    throw new Error(
      `Unable to load organization capabilities: ${capabilitiesResult.error.message}`
    )
  }

  if (articulationsResult.error) {
    throw new Error(
      `Unable to load organization articulations: ${articulationsResult.error.message}`
    )
  }

  if (typeProposalsResult.error) {
    throw new Error(
      `Unable to load organization type proposals: ${typeProposalsResult.error.message}`
    )
  }

  const activities =
    (
      activitiesResult.data ?? []
    ) as OrganizationActivity[]

  const activityIds = activities.map(
    (activity) => activity.activity_id
  )

  let activitySkillSuggestions:
    ActivitySkillSuggestion[] = []

  if (activityIds.length > 0) {
    const {
      data: suggestionData,
      error: suggestionError,
    } = await supabase
      .from('activity_skill_suggestion_list')
      .select('*')
      .in('activity_id', activityIds)
      .order('activity_name', {
        ascending: true,
      })
      .order('sort_order', {
        ascending: true,
      })
      .order('skill_name', {
        ascending: true,
      })

    if (suggestionError) {
      throw new Error(
        `Unable to load activity skill suggestions: ${suggestionError.message}`
      )
    }

    activitySkillSuggestions =
      (
        suggestionData ?? []
      ) as ActivitySkillSuggestion[]
  }

  return {
    organization:
      organizationResult.data as OrganizationProfile,

    nodes:
      (nodesResult.data ?? []) as OrganizationNode[],

    activities,

    activitySkillSuggestions,

    activityProposals:
      (
        activityProposalsResult.data ?? []
      ) as OrganizationActivityProposal[],

    capabilities:
      (
        capabilitiesResult.data ?? []
      ) as OrganizationCapability[],

    articulations:
      (
        articulationsResult.data ?? []
      ) as OrganizationArticulation[],

    typeProposals:
      (
        typeProposalsResult.data ?? []
      ) as OrganizationTypeProposal[],
  }
}
