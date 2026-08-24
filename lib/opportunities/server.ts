import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type OpportunityKind = 'opportunity' | 'need'

export type OpportunityStatus =
  | 'draft'
  | 'open'
  | 'under_analysis'
  | 'in_progress'
  | 'resolved'
  | 'discarded'

export type OpportunityPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent'

export type OpportunityOriginActorInput = {
  actorType: 'person' | 'organization' | 'candidate'
  actorId: string
}

export type NewActorCandidateInput = {
  actorKind: 'person' | 'organization'
  displayName: string
  organizationTypeCode?: string | null
  contextText?: string | null
  nodeIds?: string[]
}

export type Opportunity = {
  id: string
  title: string
  description: string
  kind: OpportunityKind
  status: OpportunityStatus
  priority: OpportunityPriority
  source_text: string | null
  due_date: string | null
  created_by_internal_user_id: string
  assigned_to_internal_user_id: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  node_ids: string[]
  node_names: string[]
}

export type OpportunityNodeSearchResult = {
  id: string
  display_name: string
}

export type CreateOpportunityInput = {
  title: string
  description: string
  kind: OpportunityKind
  status: Exclude<OpportunityStatus, 'resolved'>
  priority: OpportunityPriority
  sourceText?: string | null
  dueDate?: string | null
  assignedToInternalUserId?: string | null
  nodeIds?: string[]
  originActors?: OpportunityOriginActorInput[]
  newActorCandidates?: NewActorCandidateInput[]
}

const OPPORTUNITY_CREATOR_ROLES = new Set([
  'administrator',
  'articulator',
  'authority_analyst',
])

export function canCreateOpportunity(
  access: InternalAccess[]
): boolean {
  return access.some(
    (item) =>
      item.is_administrative ||
      OPPORTUNITY_CREATOR_ROLES.has(item.access_role_code)
  )
}

function getActorInternalUserId(
  access: InternalAccess[]
): string {
  const internalUserIds = [
    ...new Set(access.map((item) => item.internal_user_id)),
  ]

  if (internalUserIds.length !== 1) {
    throw new Error('Unable to resolve a unique internal user')
  }

  return internalUserIds[0]
}

function normalizeNodeSearchTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toNodeDisplayName(value: string) {
  return value.replace(/^Nodo\s+/i, '')
}

export async function searchOpportunityNodes(
  query: string
): Promise<OpportunityNodeSearchResult[]> {
  const term = normalizeNodeSearchTerm(query)

  if (term.length < 2) {
    return []
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('opportunity_node_options')
    .select(`
      id,
      display_name
    `)
    .ilike('search_name', `%${term}%`)
    .order('display_name', {
      ascending: true,
    })
    .limit(10)

  if (error) {
    throw new Error(
      `Unable to search opportunity nodes: ${error.message}`
    )
  }

  return (data ?? []) as OpportunityNodeSearchResult[]
}

export async function listOpportunities(): Promise<Opportunity[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
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
    .order('created_at', {
      ascending: false,
    })

  if (error) {
    throw new Error(
      `Unable to list opportunities: ${error.message}`
    )
  }

  return ((data ?? []) as Opportunity[]).map(
    (opportunity) => ({
      ...opportunity,
      node_ids: opportunity.node_ids ?? [],
      node_names: (opportunity.node_names ?? []).map(
        toNodeDisplayName
      ),
    })
  )
}

export async function createOpportunity(
  access: InternalAccess[],
  input: CreateOpportunityInput
): Promise<string> {
  if (!canCreateOpportunity(access)) {
    throw new Error(
      'The current internal user cannot create opportunities'
    )
  }

  const actorInternalUserId =
    getActorInternalUserId(access)

  const title = input.title.trim()
  const description = input.description.trim()
  const sourceText = input.sourceText?.trim() || null
  const nodeIds = [...new Set(input.nodeIds ?? [])]

  if (title.length < 3 || title.length > 200) {
    throw new Error(
      'Opportunity title must contain between 3 and 200 characters'
    )
  }

  if (
    description.length < 10 ||
    description.length > 10000
  ) {
    throw new Error(
      'Opportunity description must contain between 10 and 10000 characters'
    )
  }

  const originActors = input.originActors ?? []

  const newActorCandidates =
    input.newActorCandidates ?? []

  for (const candidate of newActorCandidates) {
    const displayName = candidate.displayName.trim()

    if (
      displayName.length < 2 ||
      displayName.length > 300
    ) {
      throw new Error(
        'Provisional actor name must contain between 2 and 300 characters'
      )
    }

    if (
      candidate.actorKind === 'organization' &&
      !candidate.organizationTypeCode
    ) {
      throw new Error(
        'Organization type is required'
      )
    }
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'create_opportunity',
    {
      p_created_by_internal_user_id:
        actorInternalUserId,
      p_title: title,
      p_description: description,
      p_kind: input.kind,
      p_status: input.status,
      p_priority: input.priority,
      p_source_text: sourceText,
      p_due_date: input.dueDate || null,
      p_assigned_to_internal_user_id:
        input.assignedToInternalUserId || null,
      p_node_ids: nodeIds,

      p_origin_actors: originActors.map(
        (actor) => ({
          actor_type: actor.actorType,
          actor_id: actor.actorId,
        })
      ),

      p_new_actor_candidates:
        newActorCandidates.map(
          (candidate) => ({
            actor_kind: candidate.actorKind,
            display_name:
              candidate.displayName.trim(),
            organization_type_code:
              candidate.actorKind === 'organization'
                ? candidate.organizationTypeCode
                : null,
            context_text:
              candidate.contextText?.trim() || null,
            node_ids: [
              ...new Set(candidate.nodeIds ?? []),
            ],
          })
        ),
    }
  )

  if (error) {
    throw new Error(
      `Unable to create opportunity: ${error.message}`
    )
  }

  if (typeof data !== 'string' || data.length === 0) {
    throw new Error(
      'Opportunity creation did not return an identifier'
    )
  }

  return data
}