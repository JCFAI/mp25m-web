import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type CommunicationType = 'general' | 'convocation' | 'reminder' | 'follow_up' | 'request_information' | 'update'
export type CommunicationStatus = 'draft' | 'audience_resolved' | 'recipients_confirmed' | 'cancelled'
export type CommunicationContextType = 'independent' | 'person' | 'node' | 'organization' | 'opportunity' | 'articulation' | 'project' | 'theme' | 'need_offer' | 'agenda_entry'
export type CriterionType = 'person' | 'organization' | 'node_participants' | 'articulation_participants' | 'project_participants' | 'person_skill' | 'organization_capability' | 'theme_responsibles'
export type CriterionOperation = 'include' | 'exclude'

export type Communication = {
  communication_id: string; communication_type: CommunicationType; status: CommunicationStatus
  planned_channels: ('email' | 'whatsapp')[]; audience_revision: number; subject: string; body: string
  context_type: CommunicationContextType; context_id: string | null; context_title: string | null
  current_resolution_id: string | null; current_resolution_no: number | null
  current_resolution_resolved_at: string | null; current_resolution_confirmed_at: string | null
  created_by_internal_user_id: string; created_by_display_name: string; created_at: string; updated_at: string; cancelled_at: string | null
  recipient_count: number; included_recipient_count: number; excluded_recipient_count: number; duplicate_recipient_count: number
}
export type CommunicationCriterion = {
  criterion_id: string; communication_id: string; audience_revision: number; group_no: number
  criterion_type: CriterionType; criterion_operation: CriterionOperation
  person_id: string | null; organization_id: string | null; node_id: string | null; articulation_id: string | null; project_id: string | null; skill_id: string | null; theme_id: string | null
  verification_statuses: string[] | null; created_at: string
}
export type CommunicationResolution = {
  resolution_id: string; communication_id: string; resolution_no: number; audience_revision: number; resolved_at: string; confirmed_at: string | null; is_current: boolean
  recipient_count: number; included_recipient_count: number; excluded_recipient_count: number; duplicate_recipient_count: number
  person_email_unavailable_count: number; person_whatsapp_unavailable_count: number; unsupported_organization_count: number; unsupported_internal_user_count: number
}
export type CommunicationRecipient = {
  recipient_id: string; resolution_id: string; recipient_kind: 'person' | 'organization' | 'internal_user'; person_id: string | null; organization_id: string | null; internal_user_id: string | null
  display_name_snapshot: string; manually_added: boolean; included: boolean; exclusion_reason: string | null
  email_availability_status: string; whatsapp_availability_status: string; duplicate_status: string; diagnostic_detail: unknown; sources: unknown; created_at: string
}
export type CommunicationRecipientSourceSummary = {
  criterion_id: string
  recipient_count: number
  multi_criterion_recipient_count: number
}

function actorId(access: InternalAccess[]) {
  const ids = [...new Set(access.map((item) => item.internal_user_id))]
  if (ids.length !== 1) throw new Error('Unable to resolve a unique internal user')
  return ids[0]
}
function rpcError(error: { message: string } | null, fallback: string) { if (error) throw new Error(`${fallback}: ${error.message}`) }

export async function listCommunicationPage(access: InternalAccess[], input: { query?: string; statuses?: CommunicationStatus[]; cursor?: { updatedAt: string; id: string } | null; limit?: number }) {
  const limit = input.limit ?? 50
  const { data, error } = await createAdminClient().rpc('communication_page', {
    p_actor_internal_user_id: actorId(access), p_query: input.query?.trim() || null, p_statuses: input.statuses?.length ? input.statuses : null,
    p_communication_types: null, p_context_types: null, p_created_by_internal_user_id: null,
    p_after_updated_at: input.cursor?.updatedAt ?? null, p_after_communication_id: input.cursor?.id ?? null, p_limit: limit + 1,
  })
  rpcError(error, 'Unable to load communications')
  const rows = (data ?? []) as Communication[]; const items = rows.slice(0, limit); const last = items.at(-1)
  return { items, nextCursor: rows.length > limit && last ? { updatedAt: last.updated_at, id: last.communication_id } : null }
}
export async function getCommunication(access: InternalAccess[], id: string) {
  const { data, error } = await createAdminClient().rpc('communication_detail', { p_actor_internal_user_id: actorId(access), p_communication_id: id })
  rpcError(error, 'Unable to load communication'); return ((data ?? [])[0] ?? null) as Communication | null
}
export async function listCommunicationCriteria(access: InternalAccess[], id: string) {
  const { data, error } = await createAdminClient().rpc('communication_criteria_list', { p_actor_internal_user_id: actorId(access), p_communication_id: id, p_audience_revision: null })
  rpcError(error, 'Unable to load audience criteria'); return (data ?? []) as CommunicationCriterion[]
}
export async function listCommunicationCriterionLabels(criteria: CommunicationCriterion[]) {
  const ids = (key: keyof CommunicationCriterion) => [...new Set(criteria.map((item) => item[key]).filter((value): value is string => typeof value === 'string'))]
  const [people, organizations, nodes, articulations, projects, skills, themes] = await Promise.all([
    ids('person_id').length ? createAdminClient().from('person_profile').select('id, display_name').in('id', ids('person_id')) : Promise.resolve({ data: [], error: null }),
    ids('organization_id').length ? createAdminClient().from('organization_directory').select('id, display_name').in('id', ids('organization_id')) : Promise.resolve({ data: [], error: null }),
    ids('node_id').length ? createAdminClient().from('node_directory').select('id, display_name').in('id', ids('node_id')) : Promise.resolve({ data: [], error: null }),
    ids('articulation_id').length ? createAdminClient().from('opportunity_articulation_list').select('articulation_id, title').in('articulation_id', ids('articulation_id')) : Promise.resolve({ data: [], error: null }),
    ids('project_id').length ? createAdminClient().from('project_list').select('project_id, title').in('project_id', ids('project_id')) : Promise.resolve({ data: [], error: null }),
    ids('skill_id').length ? createAdminClient().from('skill_directory').select('id, display_name').in('id', ids('skill_id')) : Promise.resolve({ data: [], error: null }),
    ids('theme_id').length ? createAdminClient().from('theme_list').select('theme_id, name').in('theme_id', ids('theme_id')) : Promise.resolve({ data: [], error: null }),
  ])
  for (const result of [people, organizations, nodes, articulations, projects, skills, themes]) rpcError(result.error, 'Unable to load criterion references')
  return Object.fromEntries([...(people.data ?? []).map((row) => [row.id, row.display_name]), ...(organizations.data ?? []).map((row) => [row.id, row.display_name]), ...(nodes.data ?? []).map((row) => [row.id, row.display_name]), ...(articulations.data ?? []).map((row) => [row.articulation_id, row.title]), ...(projects.data ?? []).map((row) => [row.project_id, row.title]), ...(skills.data ?? []).map((row) => [row.id, row.display_name]), ...(themes.data ?? []).map((row) => [row.theme_id, row.name])]) as Record<string, string>
}
export async function listCommunicationResolutions(access: InternalAccess[], id: string) {
  const { data, error } = await createAdminClient().rpc('communication_resolution_list', { p_actor_internal_user_id: actorId(access), p_communication_id: id })
  rpcError(error, 'Unable to load audience resolutions'); return (data ?? []) as CommunicationResolution[]
}
export async function listCommunicationRecipients(access: InternalAccess[], resolutionId: string) {
  const page = await listCommunicationRecipientPage(access, resolutionId, {})
  return page.items
}
export async function listCommunicationRecipientPage(access: InternalAccess[], resolutionId: string, input: { query?: string; cursor?: { displayName: string; id: string } | null; limit?: number }) {
  const limit = input.limit ?? 50
  const { data, error } = await createAdminClient().rpc('communication_recipient_page', { p_actor_internal_user_id: actorId(access), p_resolution_id: resolutionId, p_query: input.query?.trim() || null, p_recipient_kinds: null, p_included: null, p_after_display_name: input.cursor?.displayName ?? null, p_after_recipient_id: input.cursor?.id ?? null, p_limit: limit + 1 })
  rpcError(error, 'Unable to load recipients')
  const rows = (data ?? []) as CommunicationRecipient[]; const items = rows.slice(0, limit); const last = items.at(-1)
  return { items, nextCursor: rows.length > limit && last ? { displayName: last.display_name_snapshot, id: last.recipient_id } : null }
}
export async function createCommunication(access: InternalAccess[], input: { type: CommunicationType; channels: string[]; subject: string; body: string; context: Partial<Record<Exclude<CommunicationContextType, 'independent'>, string>> }) {
  const context = input.context
  const { data, error } = await createAdminClient().rpc('create_communication', {
    p_actor_internal_user_id: actorId(access), p_communication_type: input.type, p_planned_channels: input.channels, p_subject: input.subject, p_body: input.body,
    p_generation_mode: 'manual', p_generation_metadata: {}, p_person_id: context.person ?? null, p_node_id: context.node ?? null, p_organization_id: context.organization ?? null,
    p_opportunity_id: context.opportunity ?? null, p_articulation_id: context.articulation ?? null, p_project_id: context.project ?? null, p_theme_id: context.theme ?? null,
    p_need_offer_id: context.need_offer ?? null, p_agenda_entry_id: context.agenda_entry ?? null,
  }); rpcError(error, 'Unable to create communication'); if (typeof data !== 'string') throw new Error('Communication creation did not return an identifier'); return data
}
export async function updateCommunication(access: InternalAccess[], id: string, input: { channels: string[]; subject: string; body: string; rationale?: string }) {
  const { error } = await createAdminClient().rpc('update_communication', { p_actor_internal_user_id: actorId(access), p_communication_id: id, p_planned_channels: input.channels, p_subject: input.subject, p_body: input.body, p_generation_mode: 'manual', p_generation_metadata: {}, p_change_rationale: input.rationale ?? null }); rpcError(error, 'Unable to update communication')
}
export async function replaceAudience(access: InternalAccess[], id: string, criteria: unknown[], rationale?: string) { const { error } = await createAdminClient().rpc('replace_communication_audience_criteria', { p_actor_internal_user_id: actorId(access), p_communication_id: id, p_criteria: criteria, p_rationale: rationale ?? null }); rpcError(error, 'Unable to replace audience') }
export async function resolveAudience(access: InternalAccess[], id: string, rationale?: string) { const { data, error } = await createAdminClient().rpc('resolve_communication_audience', { p_actor_internal_user_id: actorId(access), p_communication_id: id, p_rationale: rationale ?? null }); rpcError(error, 'Unable to resolve audience'); return data as string }
export async function setRecipientIncluded(access: InternalAccess[], recipientId: string, included: boolean) { const { error } = await createAdminClient().rpc('set_communication_recipient_included', { p_actor_internal_user_id: actorId(access), p_recipient_id: recipientId, p_included: included, p_reason: null }); rpcError(error, 'Unable to update recipient') }
export async function listCommunicationRecipientSourceSummary(access: InternalAccess[], resolutionId: string) { const { data, error } = await createAdminClient().rpc('communication_recipient_source_summary', { p_actor_internal_user_id: actorId(access), p_resolution_id: resolutionId }); rpcError(error, 'Unable to load recipient source summary'); return (data ?? []) as CommunicationRecipientSourceSummary[] }
export async function addManualPerson(access: InternalAccess[], resolutionId: string, personId: string, reason: string) { const { error } = await createAdminClient().rpc('add_communication_person_recipient', { p_actor_internal_user_id: actorId(access), p_resolution_id: resolutionId, p_person_id: personId, p_reason: reason }); rpcError(error, 'Unable to add recipient') }
export async function confirmRecipients(access: InternalAccess[], communicationId: string, resolutionId: string, reason?: string) { const { error } = await createAdminClient().rpc('confirm_communication_recipients', { p_actor_internal_user_id: actorId(access), p_communication_id: communicationId, p_resolution_id: resolutionId, p_reason: reason ?? null }); rpcError(error, 'Unable to confirm recipients') }
