import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import {
  createReferenceContext,
  decodeReferenceCursor,
  encodeReferenceCursor,
  normalizeReferenceQuery,
  type ReferencePage,
} from '../reference-pagination'
import { createAdminClient } from '../supabase/admin'

export type NeedOfferRecordType = 'need' | 'offer'

export type NeedOfferStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'closed'
  | 'cancelled'

export type NeedOfferFollowupType =
  | 'general'
  | 'observation'
  | 'update'
  | 'next_step'
  | 'result'

export type NeedOfferUserOption = {
  id: string
  display_name: string
}

export type NeedOffer = {
  need_offer_id: string
  record_type: NeedOfferRecordType
  title: string
  normalized_title: string
  description: string
  status: NeedOfferStatus

  responsible_internal_user_id: string
  responsible_display_name: string

  node_id: string | null
  node_name: string | null

  created_by_internal_user_id: string
  created_by_display_name: string

  created_at: string
  updated_at: string
  ended_at: string | null

  latest_followup_type: NeedOfferFollowupType | null
  latest_followup_detail: string | null
  latest_followup_at: string | null
}

export type NeedOfferReference = Pick<
  NeedOffer,
  | 'need_offer_id'
  | 'record_type'
  | 'title'
  | 'description'
  | 'status'
  | 'responsible_internal_user_id'
  | 'responsible_display_name'
  | 'node_id'
  | 'node_name'
  | 'latest_followup_detail'
  | 'latest_followup_at'
  | 'updated_at'
>

export type NeedOfferFollowup = {
  followup_id: string
  need_offer_id: string
  followup_type: NeedOfferFollowupType
  detail: string
  occurred_at: string
  created_by_internal_user_id: string
  created_by_display_name: string
  created_at: string
}

export type NeedOfferStatusHistory = {
  history_id: string
  need_offer_id: string
  transition_no: number
  status: NeedOfferStatus

  responsible_internal_user_id: string
  responsible_display_name: string

  node_id: string | null
  node_name: string | null

  rationale: string

  changed_by_internal_user_id: string
  changed_by_display_name: string
  changed_at: string
}

type NeedOfferCursor = {
  title: string
  id: string
}

function actorId(access: InternalAccess[]) {
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

export function canGovernNeedsOffers(
  access: InternalAccess[]
) {
  return access.some(
    (item) =>
      item.is_administrative &&
      item.scope_type === 'global'
  )
}

export function canManageNeedOffer(
  access: InternalAccess[],
  needOffer: Pick<
    NeedOffer,
    'responsible_internal_user_id'
  >
) {
  if (canGovernNeedsOffers(access)) {
    return true
  }

  return (
    needOffer.responsible_internal_user_id ===
    actorId(access)
  )
}

export function canFollowupNeedOffer(
  access: InternalAccess[],
  needOffer: Pick<
    NeedOffer,
    'responsible_internal_user_id' | 'status'
  >
) {
  if (
    needOffer.status === 'closed' ||
    needOffer.status === 'cancelled'
  ) {
    return false
  }

  return canManageNeedOffer(access, needOffer)
}

export async function listNeedOfferPage(input: {
  query: string
  types?: NeedOfferRecordType[]
  statuses?: NeedOfferStatus[]
  responsibleInternalUserId?: string | null
  nodeId?: string | null
  cursor?: string | null
  limit: number
}): Promise<ReferencePage<NeedOfferReference>> {
  const query = normalizeReferenceQuery(
    input.query
  )

  const context = createReferenceContext({
    query,
    types: input.types ?? [],
    statuses: input.statuses ?? [],
    responsibleInternalUserId:
      input.responsibleInternalUserId ?? null,
    nodeId: input.nodeId ?? null,
  })

  const position = decodeReferenceCursor(
    input.cursor ?? null,
    'need-offer-directory',
    context
  ) as NeedOfferCursor | null

  const { data, error } =
    await createAdminClient().rpc(
      'need_offer_page',
      {
        p_query: query,
        p_types:
          input.types?.length
            ? input.types
            : null,
        p_statuses:
          input.statuses?.length
            ? input.statuses
            : null,
        p_responsible_internal_user_id:
          input.responsibleInternalUserId ??
          null,
        p_node_id: input.nodeId ?? null,
        p_after_title:
          position?.title ?? null,
        p_after_id:
          position?.id ?? null,
        p_limit: input.limit,
      }
    )

  if (error) {
    throw new Error(
      `Unable to load needs and offers: ${error.message}`
    )
  }

  const rows = (data ?? []) as (
    NeedOfferReference & {
      cursor_title: string
    }
  )[]

  const hasMore =
    rows.length > input.limit

  const pageRows =
    rows.slice(0, input.limit)

  const last = pageRows.at(-1)

  return {
    items: pageRows.map((row) => ({
      need_offer_id:
        row.need_offer_id,
      record_type:
        row.record_type,
      title:
        row.title,
      description:
        row.description,
      status:
        row.status,
      responsible_internal_user_id:
        row.responsible_internal_user_id,
      responsible_display_name:
        row.responsible_display_name,
      node_id:
        row.node_id,
      node_name:
        row.node_name,
      latest_followup_detail:
        row.latest_followup_detail,
      latest_followup_at:
        row.latest_followup_at,
      updated_at:
        row.updated_at,
    })),
    nextCursor:
      hasMore && last
        ? encodeReferenceCursor(
            'need-offer-directory',
            context,
            {
              title:
                last.cursor_title,
              id:
                last.need_offer_id,
            }
          )
        : null,
  }
}

export async function getNeedOffer(
  needOfferId: string
) {
  const { data, error } =
    await createAdminClient()
      .from('need_offer_list')
      .select('*')
      .eq(
        'need_offer_id',
        needOfferId
      )
      .maybeSingle()

  if (error) {
    throw new Error(
      `Unable to load need or offer: ${error.message}`
    )
  }

  return data as NeedOffer | null
}

export async function listNeedOfferFollowups(
  needOfferId: string
) {
  const { data, error } =
    await createAdminClient()
      .from('need_offer_followup_list')
      .select('*')
      .eq(
        'need_offer_id',
        needOfferId
      )
      .order(
        'occurred_at',
        { ascending: false }
      )

  if (error) {
    throw new Error(
      `Unable to load need or offer follow-ups: ${error.message}`
    )
  }

  return (data ?? []) as NeedOfferFollowup[]
}

export async function listNeedOfferStatusHistory(
  needOfferId: string
) {
  const { data, error } =
    await createAdminClient()
      .from(
        'need_offer_status_history_list'
      )
      .select('*')
      .eq(
        'need_offer_id',
        needOfferId
      )
      .order(
        'transition_no',
        { ascending: false }
      )

  if (error) {
    throw new Error(
      `Unable to load need or offer history: ${error.message}`
    )
  }

  return (
    data ?? []
  ) as NeedOfferStatusHistory[]
}

export async function listNeedOfferUserOptions():
Promise<NeedOfferUserOption[]> {
  const { data, error } =
    await createAdminClient()
      .from(
        'opportunity_assignee_options'
      )
      .select('id, display_name')
      .order(
        'display_name',
        { ascending: true }
      )

  if (error) {
    throw new Error(
      `Unable to load need or offer user options: ${error.message}`
    )
  }

  return (
    data ?? []
  ) as NeedOfferUserOption[]
}

export async function createNeedOffer(
  access: InternalAccess[],
  input: {
    recordType: NeedOfferRecordType
    title: string
    description: string
    responsibleInternalUserId: string
    nodeId: string | null
    rationale: string
  }
) {
  const { data, error } =
    await createAdminClient().rpc(
      'create_need_offer',
      {
        p_actor_internal_user_id:
          actorId(access),
        p_record_type:
          input.recordType,
        p_title:
          input.title,
        p_description:
          input.description,
        p_responsible_internal_user_id:
          input.responsibleInternalUserId,
        p_node_id:
          input.nodeId,
        p_rationale:
          input.rationale,
      }
    )

  if (error) {
    throw new Error(error.message)
  }

  return data as string
}

export async function updateNeedOffer(
  access: InternalAccess[],
  input: {
    needOfferId: string
    title: string
    description: string
    responsibleInternalUserId: string
    nodeId: string | null
    rationale: string
  }
) {
  const { error } =
    await createAdminClient().rpc(
      'update_need_offer',
      {
        p_actor_internal_user_id:
          actorId(access),
        p_need_offer_id:
          input.needOfferId,
        p_title:
          input.title,
        p_description:
          input.description,
        p_responsible_internal_user_id:
          input.responsibleInternalUserId,
        p_node_id:
          input.nodeId,
        p_rationale:
          input.rationale,
      }
    )

  if (error) {
    throw new Error(error.message)
  }
}

export async function transitionNeedOffer(
  access: InternalAccess[],
  input: {
    needOfferId: string
    status: NeedOfferStatus
    rationale: string
  }
) {
  const { error } =
    await createAdminClient().rpc(
      'transition_need_offer',
      {
        p_actor_internal_user_id:
          actorId(access),
        p_need_offer_id:
          input.needOfferId,
        p_status:
          input.status,
        p_rationale:
          input.rationale,
      }
    )

  if (error) {
    throw new Error(error.message)
  }
}

export async function createNeedOfferFollowup(
  access: InternalAccess[],
  input: {
    needOfferId: string
    followupType: NeedOfferFollowupType
    detail: string
    occurredAt: string | null
  }
) {
  const { error } =
    await createAdminClient().rpc(
      'create_need_offer_followup',
      {
        p_actor_internal_user_id:
          actorId(access),
        p_need_offer_id:
          input.needOfferId,
        p_followup_type:
          input.followupType,
        p_detail:
          input.detail,
        p_occurred_at:
          input.occurredAt,
      }
    )

  if (error) {
    throw new Error(error.message)
  }
}

export type NeedOfferNodeOption = {
  id: string
  display_name: string
  status: string
  jurisdiction_name: string | null
}

export async function listNeedOfferNodeOptions():
Promise<NeedOfferNodeOption[]> {
  const { data, error } =
    await createAdminClient()
      .from('node_directory')
      .select(`
        id,
        display_name,
        status,
        jurisdiction_name
      `)
      .in('status', ['forming', 'active'])
      .order('display_name', {
        ascending: true,
      })

  if (error) {
    throw new Error(
      `Unable to load need or offer node options: ${error.message}`
    )
  }

  return (
    data ?? []
  ) as NeedOfferNodeOption[]
}
