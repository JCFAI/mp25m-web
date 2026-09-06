import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'
import { getOrganizationActivityActorId } from './activities-manage'

export type ActivityProposal = {
  proposal_id: string
  organization_id: string
  organization_name: string
  proposed_name: string
  created_at: string
  created_by: string | null
  status: 'pending' | 'mapped' | 'rejected'
}

export async function countPendingActivityProposals(access: InternalAccess[]) {
  getOrganizationActivityActorId(access)
  const { count, error } = await createAdminClient()
    .from('organization_activity_proposal_list')
    .select('proposal_id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) throw new Error(`Unable to count activity proposals: ${error.message}`)
  return count ?? 0
}

export async function listPendingActivityProposals(access: InternalAccess[]) {
  getOrganizationActivityActorId(access)
  const { data, error } = await createAdminClient()
    .from('organization_activity_proposal_list')
    .select('proposal_id, organization_id, organization_name, proposed_name, created_at, created_by, status')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .order('proposal_id', { ascending: true })
    .limit(50)
  if (error) throw new Error(`Unable to load activity proposals: ${error.message}`)
  return (data ?? []) as ActivityProposal[]
}
