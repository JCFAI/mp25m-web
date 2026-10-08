import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type OpportunityArticulation = {
  articulation_id: string
  opportunity_id: string | null
  title: string
  objective: string
  status:
    | 'draft'
    | 'active'
    | 'follow_up'
    | 'paused'
    | 'closed_with_result'
    | 'closed_without_result'
    | 'cancelled'
  responsible_internal_user_id: string | null
  responsible_display_name: string | null
  created_by_display_name: string
  closing_summary: string | null
  participant_count: number
  latest_followup_detail: string | null
  latest_followup_at: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

export type ArticulationOpportunityLink = {
  link_id: string
  articulation_id: string
  opportunity_id: string
  opportunity_title: string
  opportunity_status: string
  relation_type: 'origin' | 'context' | 'related'
  relationship_note: string | null
  added_at: string
  added_by_display_name: string
}

export type OpportunityArticulationParticipant = {
  opportunity_id: string | null
  participant_id: string
  articulation_id: string
  participant_type: 'person' | 'organization'
  display_name: string
  person_id: string | null
  organization_id: string | null
  rationale: string
  added_at: string
  added_by_display_name: string
}

export type OpportunityArticulationFollowup = {
  opportunity_id: string | null
  followup_id: string
  articulation_id: string
  followup_type: 'general' | 'meeting' | 'commitment' | 'contact' | 'result'
  detail: string
  created_at: string
  created_by_display_name: string
}

export type OpportunityArticulationStatusHistory = {
  history_id: string
  articulation_id: string
  transition_no: number
  status: OpportunityArticulation['status']
  rationale: string
  responsible_internal_user_id: string | null
  responsible_display_name: string | null
  changed_by_internal_user_id: string
  changed_by_display_name: string
  changed_at: string
}

function actorId(access: InternalAccess[]) {
  const ids = [...new Set(access.map((item) => item.internal_user_id))]
  if (ids.length !== 1) throw new Error('Unable to resolve a unique internal user')
  return ids[0]
}

async function listArticulationIdsForOpportunity(opportunityId: string) {
  const { data, error } = await createAdminClient()
    .from('articulation_opportunity_link_list')
    .select('articulation_id')
    .eq('opportunity_id', opportunityId)

  if (error) {
    throw new Error(`Unable to load opportunity articulation links: ${error.message}`)
  }

  return [...new Set((data ?? []).map((item) => item.articulation_id as string))]
}

export async function canManageArticulation(
  access: InternalAccess[],
  articulationId: string,
): Promise<boolean> {
  if (access.length === 0) {
    return false
  }

  const { data, error } = await createAdminClient().rpc(
    'can_manage_articulation',
    {
      p_actor_internal_user_id: actorId(access),
      p_articulation_id: articulationId,
    },
  )

  if (error) {
    throw new Error(
      `Unable to check articulation permission: ${error.message}`,
    )
  }

  return data === true
}

export async function listOpportunityArticulations(opportunityId: string) {
  const articulationIds = await listArticulationIdsForOpportunity(opportunityId)

  if (articulationIds.length === 0) return []

  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_list')
    .select('*')
    .in('articulation_id', articulationIds)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Unable to load opportunity articulations: ${error.message}`)
  }

  return (data ?? []) as OpportunityArticulation[]
}

export async function listArticulations() {
  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_list')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Unable to load articulations: ${error.message}`)

  return (data ?? []) as OpportunityArticulation[]
}

export async function getArticulation(articulationId: string) {
  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_list')
    .select('*')
    .eq('articulation_id', articulationId)
    .maybeSingle()

  if (error) throw new Error(`Unable to load articulation: ${error.message}`)

  return data as OpportunityArticulation | null
}

export async function listArticulationStatusHistory(
  articulationId: string,
) {
  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_status_history_list')
    .select('*')
    .eq('articulation_id', articulationId)
    .order('transition_no', { ascending: false })

  if (error) {
    throw new Error(
      `Unable to load articulation status history: ${error.message}`,
    )
  }

  return (data ?? []) as OpportunityArticulationStatusHistory[]
}

export async function createArticulation(
  access: InternalAccess[],
  input: {
    title: string
    objective: string
    responsibleInternalUserId: string | null
  },
) {
  const { data, error } = await createAdminClient().rpc('create_articulation', {
    p_actor_internal_user_id: actorId(access),
    p_title: input.title,
    p_objective: input.objective,
    p_responsible_internal_user_id: input.responsibleInternalUserId,
  })

  if (error) throw new Error(error.message)

  const articulationId = data?.[0]?.articulation_id

  if (!articulationId) {
    throw new Error('Articulation was created without returning an identifier')
  }

  return articulationId
}

export async function createOpportunityArticulation(
  access: InternalAccess[],
  input: {
    opportunityId: string
    title: string
    objective: string
    responsibleInternalUserId: string | null
  },
) {
  const { error } = await createAdminClient().rpc('create_opportunity_articulation', {
    p_actor_internal_user_id: actorId(access),
    p_opportunity_id: input.opportunityId,
    p_title: input.title,
    p_objective: input.objective,
    p_responsible_internal_user_id: input.responsibleInternalUserId,
  })

  if (error) throw new Error(error.message)
}

export async function listArticulationOpportunityLinks(articulationId: string) {
  const { data, error } = await createAdminClient()
    .from('articulation_opportunity_link_list')
    .select('*')
    .eq('articulation_id', articulationId)
    .order('added_at', { ascending: true })

  if (error) {
    throw new Error(`Unable to load articulation opportunity links: ${error.message}`)
  }

  return (data ?? []) as ArticulationOpportunityLink[]
}

export async function linkArticulationOpportunity(
  access: InternalAccess[],
  input: {
    articulationId: string
    opportunityId: string
    relationType: ArticulationOpportunityLink['relation_type']
    relationshipNote: string | null
  },
) {
  const { error } = await createAdminClient().rpc('link_articulation_opportunity', {
    p_actor_internal_user_id: actorId(access),
    p_articulation_id: input.articulationId,
    p_opportunity_id: input.opportunityId,
    p_relation_type: input.relationType,
    p_relationship_note: input.relationshipNote,
  })

  if (error) throw new Error(error.message)
}

export async function unlinkArticulationOpportunity(
  access: InternalAccess[],
  input: {
    articulationId: string
    opportunityId: string
    rationale: string
  },
) {
  const { error } = await createAdminClient().rpc('unlink_articulation_opportunity', {
    p_actor_internal_user_id: actorId(access),
    p_articulation_id: input.articulationId,
    p_opportunity_id: input.opportunityId,
    p_rationale: input.rationale,
  })

  if (error) throw new Error(error.message)
}

export async function listArticulationParticipants(articulationId: string) {
  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_participant_list')
    .select('*')
    .eq('articulation_id', articulationId)
    .order('added_at', { ascending: true })

  if (error) {
    throw new Error(`Unable to load articulation participants: ${error.message}`)
  }

  return (data ?? []) as OpportunityArticulationParticipant[]
}

export async function listOpportunityArticulationParticipants(opportunityId: string) {
  const articulationIds = await listArticulationIdsForOpportunity(opportunityId)

  if (articulationIds.length === 0) return []

  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_participant_list')
    .select('*')
    .in('articulation_id', articulationIds)
    .order('added_at', { ascending: true })

  if (error) {
    throw new Error(`Unable to load opportunity articulation participants: ${error.message}`)
  }

  return (data ?? []) as OpportunityArticulationParticipant[]
}

export async function listArticulationFollowups(articulationId: string) {
  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_followup_list')
    .select('*')
    .eq('articulation_id', articulationId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Unable to load articulation followups: ${error.message}`)
  }

  return (data ?? []) as OpportunityArticulationFollowup[]
}

export async function listOpportunityArticulationFollowups(opportunityId: string) {
  const articulationIds = await listArticulationIdsForOpportunity(opportunityId)

  if (articulationIds.length === 0) return []

  const { data, error } = await createAdminClient()
    .from('opportunity_articulation_followup_list')
    .select('*')
    .in('articulation_id', articulationIds)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Unable to load opportunity articulation followups: ${error.message}`)
  }

  return (data ?? []) as OpportunityArticulationFollowup[]
}

export async function transitionOpportunityArticulation(
  access: InternalAccess[],
  input: {
    articulationId: string
    status: OpportunityArticulation['status']
    rationale: string
    responsibleInternalUserId: string | null
    closingSummary: string | null
  },
) {
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

export async function addOpportunityArticulationParticipant(
  access: InternalAccess[],
  input: {
    articulationId: string
    personId: string | null
    organizationId: string | null
    rationale: string
  },
) {
  const { error } = await createAdminClient().rpc('add_opportunity_articulation_participant', {
    p_actor_internal_user_id: actorId(access),
    p_articulation_id: input.articulationId,
    p_person_id: input.personId,
    p_organization_id: input.organizationId,
    p_rationale: input.rationale,
  })

  if (error) throw new Error(error.message)
}

export async function removeOpportunityArticulationParticipant(
  access: InternalAccess[],
  input: {
    participantId: string
    rationale: string
  },
) {
  const { error } = await createAdminClient().rpc('remove_opportunity_articulation_participant', {
    p_actor_internal_user_id: actorId(access),
    p_participant_id: input.participantId,
    p_rationale: input.rationale,
  })

  if (error) throw new Error(error.message)
}

export async function createOpportunityArticulationFollowup(
  access: InternalAccess[],
  input: {
    articulationId: string
    followupType: OpportunityArticulationFollowup['followup_type']
    detail: string
  },
) {
  const { error } = await createAdminClient().rpc('create_opportunity_articulation_followup', {
    p_actor_internal_user_id: actorId(access),
    p_articulation_id: input.articulationId,
    p_followup_type: input.followupType,
    p_detail: input.detail,
  })

  if (error) throw new Error(error.message)
}
