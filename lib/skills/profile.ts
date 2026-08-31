import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type SkillProfile = {
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
  created_at: string
  updated_at: string
}

export type SkillAlias = {
  skill_id: string
  alias_id: string
  alias: string
  normalized_alias: string
}

export type SkillPerson = {
  skill_id: string
  person_skill_id: string
  person_id: string
  display_name: string
  profession_text: string | null
  proficiency_level: number | null
  verification_status: string
  experience_range: string | null
  experience_notes: string | null
  notes: string | null
  last_self_reported_at: string | null
  node_ids: string[]
  node_numbers: Array<number | null>
  node_names: string[]
  created_at: string
  updated_at: string
}

export type SkillOrganizationCapability = {
  skill_id: string
  organization_capability_id: string
  organization_id: string
  organization_name: string
  organization_type_code: string
  organization_type_name: string
  scope_node_id: string | null
  scope_node_number: number | null
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

export type SkillNodePresence = {
  skill_id: string
  node_id: string
  node_number: number | null
  node_name: string
  person_count: number
  organization_count: number
}

export type GlobalSkillProfile = {
  skill: SkillProfile
  aliases: SkillAlias[]
  people: SkillPerson[]
  organizations: SkillOrganizationCapability[]
  nodePresence: SkillNodePresence[]
}

export async function getGlobalSkillProfile(
  skillId: string
): Promise<GlobalSkillProfile | null> {
  const supabase = createAdminClient()

  const [
    skillResult,
    aliasResult,
    peopleResult,
    organizationResult,
    nodePresenceResult,
  ] = await Promise.all([
    supabase
      .from('skill_profile')
      .select('*')
      .eq('id', skillId)
      .maybeSingle(),

    supabase
      .from('skill_alias_list')
      .select('*')
      .eq('skill_id', skillId)
      .order('alias', {
        ascending: true,
      }),

    supabase
      .from('skill_person_list')
      .select('*')
      .eq('skill_id', skillId)
      .order('display_name', {
        ascending: true,
      }),

    supabase
      .from('skill_organization_capability_list')
      .select('*')
      .eq('skill_id', skillId)
      .order('organization_name', {
        ascending: true,
      })
      .order('scope_node_name', {
        ascending: true,
        nullsFirst: true,
      }),

    supabase
      .from('skill_node_presence_list')
      .select('*')
      .eq('skill_id', skillId)
      .order('node_name', {
        ascending: true,
      }),
  ])

  if (skillResult.error) {
    throw new Error(
      `Unable to load skill profile: ${skillResult.error.message}`
    )
  }

  if (!skillResult.data) {
    return null
  }

  if (aliasResult.error) {
    throw new Error(
      `Unable to load skill aliases: ${aliasResult.error.message}`
    )
  }

  if (peopleResult.error) {
    throw new Error(
      `Unable to load skill people: ${peopleResult.error.message}`
    )
  }

  if (organizationResult.error) {
    throw new Error(
      `Unable to load skill organizations: ${organizationResult.error.message}`
    )
  }

  if (nodePresenceResult.error) {
    throw new Error(
      `Unable to load skill node presence: ${nodePresenceResult.error.message}`
    )
  }

  return {
    skill: skillResult.data as SkillProfile,
    aliases:
      (aliasResult.data ?? []) as SkillAlias[],
    people:
      (peopleResult.data ?? []) as SkillPerson[],
    organizations:
      (
        organizationResult.data ?? []
      ) as SkillOrganizationCapability[],
    nodePresence:
      (
        nodePresenceResult.data ?? []
      ) as SkillNodePresence[],
  }
}
