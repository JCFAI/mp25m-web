import 'server-only'

import {
  createReferenceContext,
  decodeReferenceCursor,
  encodeReferenceCursor,
  type ReferencePage,
} from '../reference-pagination'
import { createAdminClient } from '../supabase/admin'

export type AgendaItemKind =
  | 'manual'
  | 'opportunity_due'
  | 'project_deliverable'
  | 'theme_next_due'

export type AgendaItemOrigin =
  | 'manual'
  | 'derived'

export type AgendaEntryType =
  | 'meeting'
  | 'visit'
  | 'training'
  | 'demonstration'
  | 'call'
  | 'follow_up'
  | 'deadline'
  | 'other'

export type AgendaSourceType =
  | 'opportunity'
  | 'articulation'
  | 'project'
  | 'theme'
  | 'need_offer'

export type AgendaStatus =
  | 'scheduled'
  | 'completed'
  | 'cancelled'

export type AgendaMeetingMode =
  | 'in_person'
  | 'virtual'
  | 'hybrid'

export type AgendaMeetingProvider =
  | 'google_meet'
  | 'jitsi'
  | 'other'

export type AgendaItem = {
  item_key: string
  item_kind: AgendaItemKind
  item_origin: AgendaItemOrigin

  agenda_entry_id: string | null

  source_type: AgendaSourceType | null
  source_id: string | null
  source_record_id: string | null
  source_title: string | null

  entry_type: AgendaEntryType
  title: string
  detail: string

  scheduled_date: string
  scheduled_time: string | null
  time_zone: string

  meeting_mode: AgendaMeetingMode | null
  location_text: string | null
  meeting_provider: AgendaMeetingProvider | null
  meeting_url: string | null

  agenda_status: AgendaStatus

  responsible_internal_user_id: string | null
  responsible_display_name: string | null

  created_by_internal_user_id: string | null
  created_by_display_name: string | null

  status_rationale: string | null
  completed_at: string | null
  cancelled_at: string | null

  created_at: string | null
  updated_at: string | null
}

export type AgendaUserOption = {
  id: string
  display_name: string
}

type AgendaCursor = {
  date: string
  time: string | null
  title: string
  itemKey: string
}

export async function listAgendaPage(input: {
  query?: string | null
  fromDate?: string | null
  toDate?: string | null
  itemKinds?: AgendaItemKind[]
  entryTypes?: AgendaEntryType[]
  sourceTypes?: AgendaSourceType[]
  responsibleInternalUserId?: string | null
  unassignedOnly?: boolean
  statuses?: AgendaStatus[]
  cursor?: string | null
  limit: number
}): Promise<ReferencePage<AgendaItem>> {
  const context = createReferenceContext({
    query: input.query ?? '',
    fromDate: input.fromDate ?? null,
    toDate: input.toDate ?? null,
    itemKinds: input.itemKinds ?? [],
    entryTypes: input.entryTypes ?? [],
    sourceTypes: input.sourceTypes ?? [],
    responsibleInternalUserId:
      input.responsibleInternalUserId ?? null,
    unassignedOnly: input.unassignedOnly ?? false,
    statuses: input.statuses ?? [],
  })

  const position = decodeReferenceCursor(
    input.cursor ?? null,
    'agenda-directory',
    context
  ) as AgendaCursor | null

  const { data, error } =
    await createAdminClient().rpc(
      'agenda_item_page',
      {
        p_from_date:
          input.fromDate ?? null,

        p_to_date:
          input.toDate ?? null,

        p_item_kinds:
          input.itemKinds?.length
            ? input.itemKinds
            : null,

        p_entry_types:
          input.entryTypes?.length
            ? input.entryTypes
            : null,

        p_source_types:
          input.sourceTypes?.length
            ? input.sourceTypes
            : null,

        p_responsible_internal_user_id:
          input.responsibleInternalUserId ??
          null,

        p_unassigned_only:
          input.unassignedOnly ?? false,

        p_statuses:
          input.statuses?.length
            ? input.statuses
            : null,

        p_query:
          input.query?.trim() ||
          null,

        p_after_date:
          position?.date ?? null,

        p_after_time:
          position?.time ?? null,

        p_after_title:
          position?.title ?? null,

        p_after_item_key:
          position?.itemKey ?? null,

        p_limit:
          input.limit,
      }
    )

  if (error) {
    throw new Error(
      `Unable to load agenda: ${error.message}`
    )
  }

  const rows =
    (data ?? []) as AgendaItem[]

  const hasMore =
    rows.length > input.limit

  const pageRows =
    rows.slice(0, input.limit)

  const last =
    pageRows.at(-1)

  return {
    items: pageRows,

    nextCursor:
      hasMore && last
        ? encodeReferenceCursor(
            'agenda-directory',
            context,
            {
              date:
                last.scheduled_date,
              time:
                last.scheduled_time,
              title:
                last.title,
              itemKey:
                last.item_key,
            } satisfies AgendaCursor
          )
        : null,
  }
}

export async function listAgendaUserOptions():
Promise<AgendaUserOption[]> {
  const { data, error } =
    await createAdminClient()
      .from(
        'opportunity_assignee_options'
      )
      .select(
        'id, display_name'
      )
      .order(
        'display_name',
        { ascending: true }
      )

  if (error) {
    throw new Error(
      `Unable to load agenda user options: ${error.message}`
    )
  }

  return (
    data ?? []
  ) as AgendaUserOption[]
}

function actorId(
  access: import('../auth/internal-access').InternalAccess[]
) {
  const ids = [
    ...new Set(
      access.map(
        (item) => item.internal_user_id
      )
    ),
  ]

  if (ids.length !== 1) {
    throw new Error(
      'Unable to resolve a unique internal user'
    )
  }

  return ids[0]
}

export type CreateAgendaEntryInput = {
  entryType: AgendaEntryType
  title: string
  detail: string
  scheduledDate: string
  scheduledTime: string | null
  timeZone: string

  meetingMode: AgendaMeetingMode | null
  locationText: string | null
  meetingProvider: AgendaMeetingProvider | null
  meetingUrl: string | null

  responsibleInternalUserId: string | null

  opportunityId: string | null
  articulationId: string | null
  projectId: string | null
  themeId: string | null
  needOfferId: string | null
}

export async function createAgendaEntry(
  access: import('../auth/internal-access').InternalAccess[],
  input: CreateAgendaEntryInput
) {
  const { data, error } =
    await createAdminClient().rpc(
      'create_agenda_entry',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_entry_type:
          input.entryType,

        p_title:
          input.title,

        p_detail:
          input.detail,

        p_scheduled_date:
          input.scheduledDate,

        p_scheduled_time:
          input.scheduledTime,

        p_time_zone:
          input.timeZone,

        p_meeting_mode:
          input.meetingMode,

        p_location_text:
          input.locationText,

        p_meeting_provider:
          input.meetingProvider,

        p_meeting_url:
          input.meetingUrl,

        p_responsible_internal_user_id:
          input.responsibleInternalUserId,

        p_opportunity_id:
          input.opportunityId,

        p_articulation_id:
          input.articulationId,

        p_project_id:
          input.projectId,

        p_theme_id:
          input.themeId,

        p_need_offer_id:
          input.needOfferId,
      }
    )

  if (error) {
    throw new Error(
      `Unable to create agenda entry: ${error.message}`
    )
  }

  const row =
    Array.isArray(data)
      ? data[0]
      : data

  const agendaEntryId =
    row &&
    typeof row === 'object' &&
    'agenda_entry_id' in row &&
    typeof row.agenda_entry_id === 'string'
      ? row.agenda_entry_id
      : null

  if (!agendaEntryId) {
    throw new Error(
      'Agenda entry creation did not return an identifier'
    )
  }

  return agendaEntryId
}

export type UpdateAgendaEntryInput =
  CreateAgendaEntryInput & {
    rationale: string
  }

export async function updateAgendaEntry(
  access: import('../auth/internal-access').InternalAccess[],
  agendaEntryId: string,
  input: UpdateAgendaEntryInput
) {
  const { data, error } =
    await createAdminClient().rpc(
      'update_agenda_entry',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_agenda_entry_id:
          agendaEntryId,

        p_entry_type:
          input.entryType,

        p_title:
          input.title,

        p_detail:
          input.detail,

        p_scheduled_date:
          input.scheduledDate,

        p_rationale:
          input.rationale,

        p_scheduled_time:
          input.scheduledTime,

        p_time_zone:
          input.timeZone,

        p_meeting_mode:
          input.meetingMode,

        p_location_text:
          input.locationText,

        p_meeting_provider:
          input.meetingProvider,

        p_meeting_url:
          input.meetingUrl,

        p_responsible_internal_user_id:
          input.responsibleInternalUserId,

        p_opportunity_id:
          input.opportunityId,

        p_articulation_id:
          input.articulationId,

        p_project_id:
          input.projectId,

        p_theme_id:
          input.themeId,

        p_need_offer_id:
          input.needOfferId,
      }
    )

  if (error) {
    throw new Error(
      `Unable to update agenda entry: ${error.message}`
    )
  }

  return data
}

export type AgendaTerminalStatus =
  Extract<
    AgendaStatus,
    'completed' | 'cancelled'
  >

export async function transitionAgendaEntry(
  access: import('../auth/internal-access').InternalAccess[],
  agendaEntryId: string,
  status: AgendaTerminalStatus,
  rationale: string
) {
  const { data, error } =
    await createAdminClient().rpc(
      'transition_agenda_entry',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_agenda_entry_id:
          agendaEntryId,

        p_status:
          status,

        p_rationale:
          rationale,
      }
    )

  if (error) {
    throw new Error(
      `Unable to transition agenda entry: ${error.message}`
    )
  }

  return data
}
