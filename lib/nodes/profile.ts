import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type NodeProfile = {
  id: string
  node_number: number | null
  display_name: string
  slug: string
  description: string | null
  status: string
  started_on: string | null
  jurisdiction_name: string | null
  jurisdiction_type_name: string | null
  confirmed_people_count: number
  people_with_skills_count: number
  reported_skill_count: number
  confirmed_skill_count: number
  articulation_count: number
  organization_count: number
  created_at: string
  updated_at: string
}

export type NodeJurisdiction = {
  node_id: string
  jurisdiction_id: string
  jurisdiction_name: string
  jurisdiction_type_code: string
  jurisdiction_type_name: string
  parent_id: string | null
  parent_jurisdiction_name: string | null
  official_code: string | null
  latitude: number | null
  longitude: number | null
  is_primary: boolean
  coverage_notes: string | null
}

export type NodeParticipant = {
  node_id: string
  participation_id: string
  person_id: string
  display_name: string
  search_name: string
  primary_activity_text: string | null
  profession_text: string | null
  started_on: string | null
  ended_on: string | null
  participation_notes: string | null
  role_codes: string[]
  role_names: string[]
  role_verification_statuses: string[]
}

export type NodeSkillSummary = {
  node_id: string
  skill_id: string
  skill_name: string
  skill_search_name: string
  category_code: string | null
  category_name: string | null
  person_count: number
  confirmed_person_count: number
  pending_person_count: number
}

export type NodeArticulation = {
  node_id: string
  opportunity_id: string
  title: string
  description: string
  kind: 'opportunity' | 'need'
  status: string
  priority: string
  source_text: string | null
  due_date: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type NodeOrganization = {
  node_id: string
  organization_id: string
  organization_name: string
  organization_type_code: string
  organization_type_name: string
  notes: string | null
  record_status: string
}

export type CanonicalNodeProfile = {
  node: NodeProfile
  jurisdictions: NodeJurisdiction[]
  participants: NodeParticipant[]
  skills: NodeSkillSummary[]
  articulations: NodeArticulation[]
  organizations: NodeOrganization[]
}

export async function getCanonicalNodeProfile(
  nodeId: string
): Promise<CanonicalNodeProfile | null> {
  const supabase = createAdminClient()

  const [
    nodeResult,
    jurisdictionsResult,
    participantsResult,
    skillsResult,
    articulationsResult,
    organizationsResult,
  ] = await Promise.all([
    supabase
      .from('node_profile')
      .select('*')
      .eq('id', nodeId)
      .eq('status', 'active')
      .maybeSingle(),

    supabase
      .from('node_jurisdiction_list')
      .select('*')
      .eq('node_id', nodeId)
      .order('is_primary', {
        ascending: false,
      })
      .order('jurisdiction_name', {
        ascending: true,
      }),

    supabase
      .from('node_participant_list')
      .select('*')
      .eq('node_id', nodeId)
      .order('display_name', {
        ascending: true,
      }),

    supabase
      .from('node_skill_summary')
      .select('*')
      .eq('node_id', nodeId)
      .order('person_count', {
        ascending: false,
      })
      .order('skill_name', {
        ascending: true,
      }),

    supabase
      .from('node_articulation_list')
      .select('*')
      .eq('node_id', nodeId)
      .order('created_at', {
        ascending: false,
      }),

    supabase
      .from('node_organization_list')
      .select('*')
      .eq('node_id', nodeId)
      .order('organization_name', {
        ascending: true,
      }),
  ])

  if (nodeResult.error) {
    throw new Error(
      `Unable to load node: ${nodeResult.error.message}`
    )
  }

  if (!nodeResult.data) {
    return null
  }

  if (jurisdictionsResult.error) {
    throw new Error(
      `Unable to load node jurisdictions: ${jurisdictionsResult.error.message}`
    )
  }

  if (participantsResult.error) {
    throw new Error(
      `Unable to load node participants: ${participantsResult.error.message}`
    )
  }

  if (skillsResult.error) {
    throw new Error(
      `Unable to load node skills: ${skillsResult.error.message}`
    )
  }

  if (articulationsResult.error) {
    throw new Error(
      `Unable to load node articulations: ${articulationsResult.error.message}`
    )
  }

  if (organizationsResult.error) {
    throw new Error(
      `Unable to load node organizations: ${organizationsResult.error.message}`
    )
  }

  return {
    node: nodeResult.data as NodeProfile,
    jurisdictions:
      (jurisdictionsResult.data ?? []) as NodeJurisdiction[],
    participants:
      (participantsResult.data ?? []) as NodeParticipant[],
    skills:
      (skillsResult.data ?? []) as NodeSkillSummary[],
    articulations:
      (articulationsResult.data ?? []) as NodeArticulation[],
    organizations:
      (organizationsResult.data ?? []) as NodeOrganization[],
  }
}