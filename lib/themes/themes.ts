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

export type ThemeStatus = 'active' | 'monitoring' | 'paused' | 'closed'
export type ThemePriority = 'low' | 'normal' | 'high' | 'urgent'
export type ThemeResponsibilityRole = 'principal' | 'responsible' | 'promoter'
export type ThemeFollowupType = 'general' | 'meeting' | 'decision' | 'commitment' | 'next_step' | 'result' | 'observation'

export type Theme = {
  theme_id: string
  name: string
  normalized_name: string
  description: string
  purpose: string
  status: ThemeStatus
  priority: ThemePriority
  start_date: string
  current_summary: string | null
  territorial_scope_summary: string | null
  closing_summary: string | null
  closing_date: string | null
  created_by_internal_user_id: string
  created_by_display_name: string
  created_at: string
  updated_at: string
  closed_at: string | null
  active_responsibility_count: number
  principal_internal_user_id: string | null
  principal_display_name: string | null
  responsible_names: string[]
  latest_followup_detail: string | null
  latest_followup_at: string | null
}

export type ThemeReference = Pick<Theme, 'theme_id' | 'name' | 'description' | 'status' | 'priority' | 'start_date' | 'current_summary' | 'principal_display_name' | 'responsible_names' | 'latest_followup_at'>

export type ThemeResponsibility = {
  responsibility_id: string
  theme_id: string
  internal_user_id: string
  display_name: string
  responsibility_role: ThemeResponsibilityRole
  rationale: string
  started_at: string
  added_by_display_name: string
  ended_at: string | null
  ended_by_display_name: string | null
  ending_rationale: string | null
}

export type ThemeFollowup = {
  followup_id: string
  theme_id: string
  followup_type: ThemeFollowupType
  detail: string
  occurred_at: string
  responsible_internal_user_id: string | null
  responsible_display_name: string | null
  next_due_at: string | null
  created_by_internal_user_id: string
  created_by_display_name: string
  created_at: string
}

export type ThemeStatusHistory = {
  history_id: string
  theme_id: string
  transition_no: number
  status: ThemeStatus
  priority: ThemePriority
  closing_summary: string | null
  rationale: string
  changed_by_internal_user_id: string
  changed_by_display_name: string
  changed_at: string
}

type ThemeCursor = { name: string; id: string }

function actorId(access: InternalAccess[]) {
  const ids = [...new Set(access.map((item) => item.internal_user_id))]
  if (ids.length !== 1) throw new Error('Unable to resolve a unique internal user')
  return ids[0]
}

export function canGovernThemes(access: InternalAccess[]) {
  return access.some((item) => item.is_administrative && item.scope_type === 'global')
}

export function canFollowupTheme(access: InternalAccess[], responsibilities: ThemeResponsibility[]) {
  if (canGovernThemes(access)) return true
  const currentActorId = actorId(access)
  return responsibilities.some((item) => item.internal_user_id === currentActorId && item.ended_at === null)
}

export function canManageTheme(access: InternalAccess[], responsibilities: ThemeResponsibility[]) {
  if (canGovernThemes(access)) return true
  const currentActorId = actorId(access)
  return responsibilities.some((item) =>
    item.internal_user_id === currentActorId &&
    item.ended_at === null &&
    (item.responsibility_role === 'principal' || item.responsibility_role === 'responsible')
  )
}

export async function listThemePage(input: {
  query: string
  statuses?: ThemeStatus[]
  priorities?: ThemePriority[]
  responsibleInternalUserId?: string | null
  cursor?: string | null
  limit: number
}): Promise<ReferencePage<ThemeReference>> {
  const query = normalizeReferenceQuery(input.query)
  const context = createReferenceContext({
    query,
    statuses: input.statuses ?? [],
    priorities: input.priorities ?? [],
    responsibleInternalUserId: input.responsibleInternalUserId ?? null,
  })
  const position = decodeReferenceCursor(input.cursor ?? null, 'theme-directory', context) as ThemeCursor | null
  const { data, error } = await createAdminClient().rpc('theme_page', {
    p_query: query,
    p_statuses: input.statuses?.length ? input.statuses : null,
    p_priorities: input.priorities?.length ? input.priorities : null,
    p_responsible_internal_user_id: input.responsibleInternalUserId ?? null,
    p_after_name: position?.name ?? null,
    p_after_id: position?.id ?? null,
    p_limit: input.limit,
  })
  if (error) throw new Error(`Unable to load themes: ${error.message}`)
  const rows = (data ?? []) as (ThemeReference & { cursor_name: string })[]
  const hasMore = rows.length > input.limit
  const pageRows = rows.slice(0, input.limit)
  const last = pageRows.at(-1)
  return {
    items: pageRows.map((row) => ({
      theme_id: row.theme_id,
      name: row.name,
      description: row.description,
      status: row.status,
      priority: row.priority,
      start_date: row.start_date,
      current_summary: row.current_summary,
      principal_display_name: row.principal_display_name,
      responsible_names: row.responsible_names,
      latest_followup_at: row.latest_followup_at,
    })),
    nextCursor: hasMore && last
      ? encodeReferenceCursor('theme-directory', context, { name: last.cursor_name, id: last.theme_id })
      : null,
  }
}

export async function getTheme(themeId: string) {
  const { data, error } = await createAdminClient().from('theme_list').select('*').eq('theme_id', themeId).maybeSingle()
  if (error) throw new Error(`Unable to load theme: ${error.message}`)
  return data as Theme | null
}

export async function listThemeResponsibilities(themeId: string) {
  const { data, error } = await createAdminClient().from('theme_responsibility_list').select('*').eq('theme_id', themeId).order('started_at', { ascending: false })
  if (error) throw new Error(`Unable to load theme responsibilities: ${error.message}`)
  return (data ?? []) as ThemeResponsibility[]
}

export async function listThemeFollowups(themeId: string) {
  const { data, error } = await createAdminClient().from('theme_followup_list').select('*').eq('theme_id', themeId).order('occurred_at', { ascending: false })
  if (error) throw new Error(`Unable to load theme follow-ups: ${error.message}`)
  return (data ?? []) as ThemeFollowup[]
}

export async function listThemeStatusHistory(themeId: string) {
  const { data, error } = await createAdminClient().from('theme_status_history_list').select('*').eq('theme_id', themeId).order('transition_no', { ascending: false })
  if (error) throw new Error(`Unable to load theme history: ${error.message}`)
  return (data ?? []) as ThemeStatusHistory[]
}

export async function createTheme(access: InternalAccess[], input: {
  name: string; description: string; purpose: string; priority: ThemePriority; startDate: string
  currentSummary: string | null; territorialScopeSummary: string | null; principalInternalUserId: string | null; rationale: string
}) {
  const { data, error } = await createAdminClient().rpc('create_theme', {
    p_actor_internal_user_id: actorId(access), p_name: input.name, p_description: input.description,
    p_purpose: input.purpose, p_priority: input.priority, p_start_date: input.startDate,
    p_current_summary: input.currentSummary, p_territorial_scope_summary: input.territorialScopeSummary,
    p_principal_internal_user_id: input.principalInternalUserId, p_rationale: input.rationale,
  })
  if (error) throw new Error(error.message)
  return data as string
}

export async function updateTheme(access: InternalAccess[], input: {
  themeId: string; name: string; description: string; purpose: string; priority: ThemePriority; startDate: string
  currentSummary: string | null; territorialScopeSummary: string | null; rationale: string
}) {
  const { error } = await createAdminClient().rpc('update_theme', {
    p_actor_internal_user_id: actorId(access), p_theme_id: input.themeId, p_name: input.name,
    p_description: input.description, p_purpose: input.purpose, p_priority: input.priority,
    p_start_date: input.startDate, p_current_summary: input.currentSummary,
    p_territorial_scope_summary: input.territorialScopeSummary, p_rationale: input.rationale,
  })
  if (error) throw new Error(error.message)
}

export async function transitionTheme(access: InternalAccess[], input: { themeId: string; status: ThemeStatus; rationale: string; closingSummary: string | null }) {
  const { error } = await createAdminClient().rpc('transition_theme', {
    p_actor_internal_user_id: actorId(access), p_theme_id: input.themeId, p_status: input.status,
    p_rationale: input.rationale, p_closing_summary: input.closingSummary,
  })
  if (error) throw new Error(error.message)
}

export async function addThemeResponsibility(access: InternalAccess[], input: { themeId: string; internalUserId: string; role: ThemeResponsibilityRole; rationale: string }) {
  const { error } = await createAdminClient().rpc('add_theme_responsibility', {
    p_actor_internal_user_id: actorId(access), p_theme_id: input.themeId, p_internal_user_id: input.internalUserId,
    p_responsibility_role: input.role, p_rationale: input.rationale,
  })
  if (error) throw new Error(error.message)
}

export async function removeThemeResponsibility(access: InternalAccess[], input: { responsibilityId: string; rationale: string }) {
  const { error } = await createAdminClient().rpc('remove_theme_responsibility', {
    p_actor_internal_user_id: actorId(access), p_responsibility_id: input.responsibilityId, p_rationale: input.rationale,
  })
  if (error) throw new Error(error.message)
}

export async function createThemeFollowup(access: InternalAccess[], input: {
  themeId: string; followupType: ThemeFollowupType; detail: string; occurredAt: string | null
  responsibleInternalUserId: string | null; nextDueAt: string | null
}) {
  const { error } = await createAdminClient().rpc('create_theme_followup', {
    p_actor_internal_user_id: actorId(access), p_theme_id: input.themeId, p_followup_type: input.followupType,
    p_detail: input.detail, p_occurred_at: input.occurredAt, p_responsible_internal_user_id: input.responsibleInternalUserId,
    p_next_due_at: input.nextDueAt,
  })
  if (error) throw new Error(error.message)
}
