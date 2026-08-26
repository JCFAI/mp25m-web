import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type PersonProfile = {
  id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  primary_activity_text: string | null
  profession_text: string | null
  experience_text: string | null
  birth_date: string | null
  gender: string | null
  notes: string | null
  record_status: string
  merged_into_id: string | null
  residence_province_text: string | null
  residence_locality_text: string | null
  created_at: string
  updated_at: string
}

export type PersonTerritory = {
  participation_id: string
  person_id: string
  node_id: string
  node_name: string
  participation_status: string
  participation_verification_status: string
  started_on: string | null
  ended_on: string | null
  participation_notes: string | null
  role_codes: string[]
  role_names: string[]
  role_verification_statuses: string[]
}

export type PersonArticulation = {
  person_id: string
  opportunity_id: string
  title: string
  description: string
  kind: 'opportunity' | 'need'
  status: string
  priority: string
  source_text: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  node_names: string[]
}

export type PersonIdentityAlias = {
  person_id: string
  actor_candidate_id: string
  reported_name: string
  context_text: string | null
  status: string
  created_at: string
  reported_node_names: string[]
  opportunity_ids: string[]
  opportunity_titles: string[]
}

export type PersonSkill = {
  person_skill_id: string
  person_id: string
  skill_id: string
  skill_name: string
  category_code: string | null
  category_name: string | null
  proficiency_level: number | null
  verification_status: string
  experience_range: string | null
  experience_notes: string | null
  notes: string | null
  last_self_reported_at: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type CanonicalPersonProfile = {
  person: PersonProfile
  territories: PersonTerritory[]
  articulations: PersonArticulation[]
  aliases: PersonIdentityAlias[]
  skills: PersonSkill[]
}

export async function getCanonicalPersonProfile(
  personId: string
): Promise<CanonicalPersonProfile | null> {
  const supabase = createAdminClient()

  const [
    personResult,
    territoriesResult,
    articulationsResult,
    aliasesResult,
    skillsResult,
  ] = await Promise.all([
    supabase
      .from('person_profile')
      .select('*')
      .eq('id', personId)
      .maybeSingle(),

    supabase
      .from('person_territorial_profile')
      .select('*')
      .eq('person_id', personId)
      .eq('participation_status', 'active')
      .order('node_name', {
        ascending: true,
      }),

    supabase
      .from('person_articulation_list')
      .select('*')
      .eq('person_id', personId)
      .order('created_at', {
        ascending: false,
      }),

    supabase
      .from('person_identity_aliases')
      .select('*')
      .eq('person_id', personId)
      .order('created_at', {
        ascending: false,
      }),

    supabase
      .from('person_skill_list')
      .select('*')
      .eq('person_id', personId)
      .eq('active', true)
      .order('skill_name', {
        ascending: true,
      }),
  ])

  if (personResult.error) {
    throw new Error(
      `Unable to load person: ${personResult.error.message}`
    )
  }

  if (!personResult.data) {
    return null
  }

  if (territoriesResult.error) {
    throw new Error(
      `Unable to load person territories: ${territoriesResult.error.message}`
    )
  }

  if (articulationsResult.error) {
    throw new Error(
      `Unable to load person articulations: ${articulationsResult.error.message}`
    )
  }

  if (aliasesResult.error) {
    throw new Error(
      `Unable to load person identity history: ${aliasesResult.error.message}`
    )
  }

  if (skillsResult.error) {
    throw new Error(
      `Unable to load person skills: ${skillsResult.error.message}`
    )
  }

  return {
    person:
      personResult.data as PersonProfile,

    territories:
      (territoriesResult.data ?? []) as PersonTerritory[],

    articulations:
      (articulationsResult.data ?? []) as PersonArticulation[],

    aliases:
      (aliasesResult.data ?? []) as PersonIdentityAlias[],

    skills:
      (skillsResult.data ?? []) as PersonSkill[],
  }
}