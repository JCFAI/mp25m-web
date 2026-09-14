import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type ProjectStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'

export type Project = {
  project_id: string
  opportunity_id: string
  opportunity_title: string
  source_articulation_id: string
  source_articulation_title: string
  title: string
  objective: string
  status: ProjectStatus
  responsible_internal_user_id: string | null
  responsible_display_name: string | null
  created_by_display_name: string
  completion_summary: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  latest_followup_detail: string | null
  latest_followup_at: string | null
}

export type ProjectSourceArticulation = {
  articulation_id: string
  opportunity_id: string
  opportunity_title: string
  articulation_title: string
  articulation_objective: string
  closing_summary: string | null
  closed_at: string
  project_id: string | null
}

export type ProjectFollowup = {
  followup_id: string
  project_id: string
  followup_type: 'general' | 'meeting' | 'commitment' | 'progress' | 'result'
  detail: string
  created_at: string
  created_by_display_name: string
}

function actorId(access: InternalAccess[]) {
  const ids = [...new Set(access.map((item) => item.internal_user_id))]
  if (ids.length !== 1) throw new Error('Unable to resolve a unique internal user')
  return ids[0]
}

export async function listProjects() {
  const { data, error } = await createAdminClient().from('project_list').select('*').order('updated_at', { ascending: false })
  if (error) throw new Error(`Unable to load projects: ${error.message}`)
  return (data ?? []) as Project[]
}

export async function getProject(projectId: string) {
  const { data, error } = await createAdminClient().from('project_list').select('*').eq('project_id', projectId).maybeSingle()
  if (error) throw new Error(`Unable to load project: ${error.message}`)
  return data as Project | null
}

export async function listProjectSourceArticulations() {
  const { data, error } = await createAdminClient().from('project_source_articulation_list').select('*').order('closed_at', { ascending: false })
  if (error) throw new Error(`Unable to load project sources: ${error.message}`)
  return (data ?? []) as ProjectSourceArticulation[]
}

export async function listProjectFollowups(projectId: string) {
  const { data, error } = await createAdminClient().from('project_followup_list').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  if (error) throw new Error(`Unable to load project followups: ${error.message}`)
  return (data ?? []) as ProjectFollowup[]
}

export async function createProject(access: InternalAccess[], input: { sourceArticulationId: string; title: string; objective: string; responsibleInternalUserId: string | null }) {
  const { error } = await createAdminClient().rpc('create_project_from_articulation', {
    p_actor_internal_user_id: actorId(access), p_source_articulation_id: input.sourceArticulationId,
    p_title: input.title, p_objective: input.objective, p_responsible_internal_user_id: input.responsibleInternalUserId,
  })
  if (error) throw new Error(error.message)
}

export async function transitionProject(access: InternalAccess[], input: { projectId: string; status: ProjectStatus; rationale: string; responsibleInternalUserId: string | null; completionSummary: string | null }) {
  const { error } = await createAdminClient().rpc('transition_project', {
    p_actor_internal_user_id: actorId(access), p_project_id: input.projectId, p_status: input.status,
    p_rationale: input.rationale, p_responsible_internal_user_id: input.responsibleInternalUserId,
    p_completion_summary: input.completionSummary,
  })
  if (error) throw new Error(error.message)
}

export async function createProjectFollowup(access: InternalAccess[], input: { projectId: string; followupType: ProjectFollowup['followup_type']; detail: string }) {
  const { error } = await createAdminClient().rpc('create_project_followup', {
    p_actor_internal_user_id: actorId(access), p_project_id: input.projectId,
    p_followup_type: input.followupType, p_detail: input.detail,
  })
  if (error) throw new Error(error.message)
}
