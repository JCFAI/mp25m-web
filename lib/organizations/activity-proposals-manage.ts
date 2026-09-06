import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'
import { getOrganizationActivityActorId } from './activities-manage'

export type ActivityResolutionAction = 'map' | 'create' | 'reject'
export type ActivityResolutionResult = {
  proposal_id: string
  organization_id: string
  organization_name: string
  proposed_name: string
  resolved_activity_id: string | null
  resolved_activity_name: string | null
  status: 'mapped' | 'rejected'
  resolution_action: ActivityResolutionAction
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function resolveActivityProposal(access: InternalAccess[], input: {
  proposalId: string
  resolutionAction: ActivityResolutionAction
  targetActivityId?: string | null
  canonicalName?: string | null
  description?: string | null
  reason: string
}): Promise<ActivityResolutionResult> {
  const actor = getOrganizationActivityActorId(access)
  const reason = input.reason.trim()
  const name = input.canonicalName?.trim() || null
  const description = input.description?.trim() || null
  if (!uuid.test(input.proposalId)) throw new Error('Invalid proposal id')
  if (!['map', 'create', 'reject'].includes(input.resolutionAction)) throw new Error('Invalid resolution action')
  if (reason.length < 3 || reason.length > 2000) throw new Error('Invalid resolution reason')
  if (input.resolutionAction === 'map' && !uuid.test(input.targetActivityId ?? '')) throw new Error('Invalid target activity')
  if (input.resolutionAction === 'create' && (!name || name.length < 2 || name.length > 200)) throw new Error('Invalid canonical activity name')
  if (description && description.length > 2000) throw new Error('Invalid activity description')
  const { data, error } = await createAdminClient().rpc('resolve_organization_activity_proposal', {
    p_actor_internal_user_id: actor,
    p_proposal_id: input.proposalId,
    p_resolution_action: input.resolutionAction,
    p_target_activity_id: input.resolutionAction === 'map' ? input.targetActivityId : null,
    p_canonical_name: input.resolutionAction === 'create' ? name : null,
    p_description: input.resolutionAction === 'create' ? description : null,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Activity resolution returned no result')
  return row as ActivityResolutionResult
}
