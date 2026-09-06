import 'server-only'

import { createAdminClient } from '../supabase/admin'
import type { PendingSkillProposalReferenceOption } from './pending-proposal-reference'

export type SkillProposalStatus =
  | 'pending'
  | 'mapped'
  | 'created'
  | 'rejected'

export type SkillProposal = {
  proposal_id: string
  proposed_name: string
  normalized_name: string
  description: string | null
  suggested_category_code: string | null
  suggested_category_name: string | null
  suggested_applies_to_person: boolean | null
  suggested_applies_to_organization: boolean | null
  status: SkillProposalStatus
  resolved_skill_id: string | null
  resolved_skill_name: string | null
  exact_skill_id: string | null
  exact_skill_name: string | null
  exact_alias_skill_id: string | null
  exact_alias_skill_name: string | null
  exact_alias: string | null
  created_by_internal_user_id: string
  created_by: string | null
  created_at: string
  resolved_by_internal_user_id: string | null
  resolved_by: string | null
  resolved_at: string | null
  resolution_reason: string | null
}

const PENDING_PROPOSAL_REFERENCE_LIMIT = 500

export async function listSkillProposals({
  status = 'pending',
}: {
  status?: SkillProposalStatus | 'all'
} = {}): Promise<SkillProposal[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('skill_proposal_list')
    .select(
      `
      proposal_id,
      proposed_name,
      normalized_name,
      description,
      suggested_category_code,
      suggested_category_name,
      suggested_applies_to_person,
      suggested_applies_to_organization,
      status,
      resolved_skill_id,
      resolved_skill_name,
      exact_skill_id,
      exact_skill_name,
      exact_alias_skill_id,
      exact_alias_skill_name,
      exact_alias,
      created_by_internal_user_id,
      created_by,
      created_at,
      resolved_by_internal_user_id,
      resolved_by,
      resolved_at,
      resolution_reason
    `
    )
    .order('created_at', {
      ascending: true,
    })

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } =
    await query.limit(50)

  if (error) {
    throw new Error(
      `Unable to load skill proposals: ${error.message}`
    )
  }

  return (data ?? []) as SkillProposal[]
}

export async function listPendingSkillProposalReferenceOptions(): Promise<
  PendingSkillProposalReferenceOption[]
> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('skill_proposal_list')
    .select(
      `
      proposal_id,
      proposed_name,
      normalized_name
    `
    )
    .eq('status', 'pending')
    .order('created_at', {
      ascending: true,
    })
    .limit(PENDING_PROPOSAL_REFERENCE_LIMIT)

  if (error) {
    throw new Error(
      `Unable to load pending skill proposals: ${error.message}`
    )
  }

  return (
    data ?? []
  ) as PendingSkillProposalReferenceOption[]
}
