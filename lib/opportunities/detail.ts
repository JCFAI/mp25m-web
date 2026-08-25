import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'
import {
  canCreateOpportunity,
  type Opportunity,
  type OpportunityStatus,
} from './server'

export type OpportunityOrigin = {
  origin_id: string
  opportunity_id: string
  actor_type: 'person' | 'organization' | 'candidate'
  actor_id: string
  display_name: string
  type_label: string
  is_provisional: boolean
  actor_status: string
  context_text: string | null
  node_names: string[]
  role_names: string[]
  review_candidate_id: string | null
}

export type OpportunityHistoryEvent = {
  opportunity_id: string
  event_id: string
  action: string
  actor_internal_user_id: string | null
  target_table: string | null
  target_id: string | null
  reason: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  result: string
  metadata: Record<string, unknown>
  occurred_at: string
}

export type OpportunityDetail = {
  opportunity: Opportunity
  origins: OpportunityOrigin[]
  history: OpportunityHistoryEvent[]
}

function getActorInternalUserId(
  access: InternalAccess[]
): string {
  const ids = [
    ...new Set(
      access.map((item) => item.internal_user_id)
    ),
  ]

  if (ids.length !== 1) {
    throw new Error(
      'Unable to resolve a unique internal user'
    )
  }

  return ids[0]
}

function toNodeDisplayName(value: string) {
  return value.replace(/^Nodo\s+/i, '')
}

export function canManageOpportunity(
  access: InternalAccess[]
) {
  return canCreateOpportunity(access)
}

export async function getOpportunityDetail(
  opportunityId: string
): Promise<OpportunityDetail | null> {
  const supabase = createAdminClient()

  const {
    data: opportunityData,
    error: opportunityError,
  } = await supabase
    .from('opportunity_list')
    .select(`
      id,
      title,
      description,
      kind,
      status,
      priority,
      source_text,
      due_date,
      created_by_internal_user_id,
      assigned_to_internal_user_id,
      resolved_at,
      created_at,
      updated_at,
      node_ids,
      node_names
    `)
    .eq('id', opportunityId)
    .maybeSingle()

  if (opportunityError) {
    throw new Error(
      `Unable to load opportunity: ${opportunityError.message}`
    )
  }

  if (!opportunityData) {
    return null
  }

  const [
    originsResult,
    historyResult,
  ] = await Promise.all([
    supabase
      .from('opportunity_origin_list')
      .select(`
        origin_id,
        opportunity_id,
        actor_type,
        actor_id,
        display_name,
        type_label,
        is_provisional,
        actor_status,
        context_text,
        node_names,
        role_names
      `)
      .eq('opportunity_id', opportunityId)
      .order('display_name', {
        ascending: true,
      }),

    supabase
      .from('opportunity_history')
      .select(`
        opportunity_id,
        event_id,
        action,
        actor_internal_user_id,
        target_table,
        target_id,
        reason,
        old_data,
        new_data,
        result,
        metadata,
        occurred_at
      `)
      .eq('opportunity_id', opportunityId)
      .order('occurred_at', {
        ascending: false,
      }),
  ])

  if (originsResult.error) {
    throw new Error(
      `Unable to load opportunity origins: ${originsResult.error.message}`
    )
  }

  if (historyResult.error) {
    throw new Error(
      `Unable to load opportunity history: ${historyResult.error.message}`
    )
  }

  const opportunity =
    opportunityData as Opportunity

  const history =
    (historyResult.data ?? []) as OpportunityHistoryEvent[]

  const candidateReviewByActorId =
    new Map<string, string>()

  for (const event of history) {
    if (
      event.action !==
      'opportunity.origin_resolved'
    ) {
      continue
    }

    const actorId =
      typeof event.new_data?.actor_id ===
      'string'
        ? event.new_data.actor_id
        : null

    const candidateId =
      typeof event.metadata
        ?.actor_candidate_id === 'string'
        ? event.metadata.actor_candidate_id
        : null

    if (
      actorId &&
      candidateId &&
      !candidateReviewByActorId.has(actorId)
    ) {
      candidateReviewByActorId.set(
        actorId,
        candidateId
      )
    }
  }

  const origins =
    (
      (originsResult.data ?? []) as Omit<
        OpportunityOrigin,
        'review_candidate_id'
      >[]
    ).map((origin) => ({
      ...origin,

      review_candidate_id:
        origin.actor_type === 'candidate'
          ? origin.actor_id
          : origin.actor_type === 'person'
            ? candidateReviewByActorId.get(
                origin.actor_id
              ) ?? null
            : null,
    }))

  return {
    opportunity: {
      ...opportunity,
      node_ids: opportunity.node_ids ?? [],
      node_names: (
        opportunity.node_names ?? []
      ).map(toNodeDisplayName),
    },

    origins,

    history,
  }
}

export type UpdateOpportunityDetailsInput = {
  title: string
  description: string
  kind: 'opportunity' | 'need'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  sourceText: string
  dueDate: string | null
  nodeIds: string[]
  originActors: {
    actorType: 'person' | 'organization' | 'candidate'
    actorId: string
  }[]
  newActorCandidates: {
    actorKind: 'person' | 'organization'
    displayName: string
    organizationTypeCode?: string | null
    contextText?: string | null
    nodeIds: string[]
  }[]
}

export async function updateOpportunityDetails(
  access: InternalAccess[],
  opportunityId: string,
  input: UpdateOpportunityDetailsInput
) {
  if (!canManageOpportunity(access)) {
    throw new Error(
      'The current internal user cannot manage opportunities'
    )
  }

  const actorInternalUserId =
    getActorInternalUserId(access)

  const title = input.title.trim()
  const description = input.description.trim()

  if (title.length < 3 || title.length > 200) {
    throw new Error('Invalid opportunity title')
  }

  if (
    description.length < 10 ||
    description.length > 10000
  ) {
    throw new Error('Invalid opportunity description')
  }

  const nodeIds = [
    ...new Set(input.nodeIds),
  ]

  const originActors = input.originActors.map(
    (actor) => ({
      actor_type: actor.actorType,
      actor_id: actor.actorId,
    })
  )

  const newActorCandidates =
    input.newActorCandidates.map(
      (candidate) => ({
        actor_kind: candidate.actorKind,
        display_name:
          candidate.displayName.trim(),
        organization_type_code:
          candidate.actorKind === 'organization'
            ? candidate.organizationTypeCode ?? null
            : null,
        context_text:
          candidate.contextText?.trim() || null,
        node_ids: [
          ...new Set(candidate.nodeIds),
        ],
      })
    )

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'update_opportunity_details',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_opportunity_id:
        opportunityId,
      p_title:
        title,
      p_description:
        description,
      p_kind:
        input.kind,
      p_priority:
        input.priority,
      p_source_text:
        input.sourceText.trim(),
      p_due_date:
        input.dueDate || null,
      p_node_ids:
        nodeIds,
      p_origin_actors:
        originActors,
      p_new_actor_candidates:
        newActorCandidates,
    }
  )

  if (error) {
    throw new Error(
      `Unable to update opportunity details: ${error.message}`
    )
  }
}

export type OpportunityFollowupKind =
  | 'note'
  | 'contact'
  | 'meeting'
  | 'commitment'
  | 'delivery'
  | 'other'

export async function createOpportunityFollowup(
  access: InternalAccess[],
  opportunityId: string,
  kind: OpportunityFollowupKind,
  body: string
) {
  if (!canManageOpportunity(access)) {
    throw new Error(
      'The current internal user cannot manage opportunities'
    )
  }

  const actorInternalUserId =
    getActorInternalUserId(access)

  const normalizedBody = body.trim()

  if (
    normalizedBody.length < 3 ||
    normalizedBody.length > 5000
  ) {
    throw new Error(
      'Invalid opportunity follow-up body'
    )
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'create_opportunity_followup',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_opportunity_id:
        opportunityId,
      p_kind:
        kind,
      p_body:
        normalizedBody,
    }
  )

  if (error) {
    throw new Error(
      `Unable to create opportunity follow-up: ${error.message}`
    )
  }

  return data as string
}

export type OpportunityAssigneeOption = {
  id: string
  display_name: string
  role_names: string[]
  scope_names: string[]
}

export async function listOpportunityAssigneeOptions():
Promise<OpportunityAssigneeOption[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('opportunity_assignee_options')
    .select(`
      id,
      display_name,
      role_names,
      scope_names
    `)
    .order('display_name', {
      ascending: true,
    })

  if (error) {
    throw new Error(
      `Unable to load opportunity assignees: ${error.message}`
    )
  }

  return (data ?? []).map((item) => ({
    id: item.id,
    display_name: item.display_name,
    role_names: item.role_names ?? [],
    scope_names: item.scope_names ?? [],
  }))
}

export async function updateOpportunityAssignee(
  access: InternalAccess[],
  opportunityId: string,
  assigneeId: string | null,
  reason?: string | null
) {
  if (!canManageOpportunity(access)) {
    throw new Error(
      'The current internal user cannot manage opportunities'
    )
  }

  const actorInternalUserId =
    getActorInternalUserId(access)

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'update_opportunity_assignee',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_opportunity_id:
        opportunityId,
      p_assigned_to_internal_user_id:
        assigneeId || null,
      p_reason:
        reason?.trim() || null,
    }
  )

  if (error) {
    throw new Error(
      `Unable to update opportunity assignee: ${error.message}`
    )
  }
}

export async function updateOpportunityStatus(
  access: InternalAccess[],
  opportunityId: string,
  status: OpportunityStatus,
  reason?: string | null
) {
  if (!canManageOpportunity(access)) {
    throw new Error(
      'The current internal user cannot manage opportunities'
    )
  }

  const actorInternalUserId =
    getActorInternalUserId(access)

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'update_opportunity_status',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_opportunity_id:
        opportunityId,
      p_new_status:
        status,
      p_reason:
        reason?.trim() || null,
    }
  )

  if (error) {
    throw new Error(
      `Unable to update opportunity status: ${error.message}`
    )
  }
}