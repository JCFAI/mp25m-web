import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type OpportunityArticulation = {
  articulation_id: string
  opportunity_id: string
  title: string
  objective: string
  status: 'draft' | 'active' | 'follow_up' | 'paused' | 'closed_with_result' | 'closed_without_result' | 'cancelled'
  responsible_internal_user_id: string | null
  responsible_display_name: string | null
  created_by_display_name: string
  closing_summary: string | null
  participant_count: number
  latest_followup_detail: string | null
  latest_followup_at: string | null
  created_at: string
}

export type OpportunityArticulationParticipant = {
  opportunity_id: string
  participant_id: string
  articulation_id: string
  participant_type: 'person' | 'organization'
  display_name: string
  rationale: string
  added_at: string
  added_by_display_name: string
}

export type OpportunityArticulationFollowup = {
  opportunity_id: string
  followup_id: string
  articulation_id: string
  followup_type: 'general' | 'meeting' | 'commitment' | 'contact' | 'result'
  detail: string
  created_at: string
  created_by_display_name: string
}

function actorId(access: InternalAccess[]) {
  const ids = [...new Set(access.map((item) => item.internal_user_id))]
  if (ids.length !== 1) throw new Error('Unable to resolve a unique internal user')
  return ids[0]
}

export async function listOpportunityArticulations(opportunityId: string) {
  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_list')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Unable to load opportunity articulations: ${error.message}`)
  return (data ?? []) as OpportunityArticulation[]
}

export async function createOpportunityArticulation(access: InternalAccess[], input: {
  opportunityId: string; title: string; objective: string; responsibleInternalUserId: string | null
}) {
  const { error } = await createAdminClient().rpc('create_opportunity_articulation', {
    p_actor_internal_user_id: actorId(access), p_opportunity_id: input.opportunityId,
    p_title: input.title, p_objective: input.objective,
    p_responsible_internal_user_id: input.responsibleInternalUserId,
  })
  if (error) throw new Error(error.message)
}

export async function listOpportunityArticulationParticipants(opportunityId: string) {
  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_participant_list')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('added_at', { ascending: true })

  if (error) throw new Error(`Unable to load opportunity articulation participants: ${error.message}`)
  return (data ?? []) as OpportunityArticulationParticipant[]
}

export async function listOpportunityArticulationFollowups(opportunityId: string) {
  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_followup_list')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Unable to load opportunity articulation followups: ${error.message}`)
  return (data ?? []) as OpportunityArticulationFollowup[]
}

export async function transitionOpportunityArticulation(access: InternalAccess[], input: {
  articulationId: string
  status: OpportunityArticulation['status']
  rationale: string
  responsibleInternalUserId: string | null
  closingSummary: string | null
}) {
  const { error } = await createAdminClient().rpc('transition_opportunity_articulation', {
    p_actor_internal_user_id: actorId(access),
    p_articulation_id: input.articulationId,
    p_status: input.status,
    p_rationale: input.rationale,
    p_responsible_internal_user_id: input.responsibleInternalUserId,
    p_closing_summary: input.closingSummary,
  })

  if (error) throw new Error(error.message)
}

export async function addOpportunityArticulationParticipant(access: InternalAccess[], input: {
  articulationId: string
  personId: string | null
  organizationId: string | null
  rationale: string
}) {
  const { error } = await createAdminClient().rpc('add_opportunity_articulation_participant', {
    p_actor_internal_user_id: actorId(access),
    p_articulation_id: input.articulationId,
    p_person_id: input.personId,
    p_organization_id: input.organizationId,
    p_rationale: input.rationale,
  })

  if (error) throw new Error(error.message)
}

export async function removeOpportunityArticulationParticipant(access: InternalAccess[], input: {
  participantId: string
  rationale: string
}) {
  const { error } = await createAdminClient().rpc('remove_opportunity_articulation_participant', {
    p_actor_internal_user_id: actorId(access),
    p_participant_id: input.participantId,
    p_rationale: input.rationale,
  })

  if (error) throw new Error(error.message)
}

export async function createOpportunityArticulationFollowup(access: InternalAccess[], input: {
  articulationId: string
  followupType: OpportunityArticulationFollowup['followup_type']
  detail: string
}) {
  const { error } = await createAdminClient().rpc('create_opportunity_articulation_followup', {
    p_actor_internal_user_id: actorId(access),
    p_articulation_id: input.articulationId,
    p_followup_type: input.followupType,
    p_detail: input.detail,
  })

  if (error) throw new Error(error.message)
}
