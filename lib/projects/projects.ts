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

export type ProjectParticipant = {
  participant_id: string
  project_id: string
  participant_type: 'person' | 'organization'
  display_name: string
  participation_role: string
  contribution_summary: string
  added_at: string
  added_by_display_name: string
}

export type ProjectSourceParticipant = {
  project_id: string
  participant_type: 'person' | 'organization'
  actor_id: string
  display_name: string
}

export type ProjectDeliverable = {
  deliverable_id: string
  project_id: string
  title: string
  description: string
  status: 'planned' | 'in_progress' | 'delivered' | 'accepted' | 'cancelled'
  responsible_internal_user_id: string | null
  responsible_display_name: string | null
  target_date: string | null
  result_summary: string | null
  evidence_reference: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
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

export async function getProjectBySourceArticulation(
  articulationId: string
) {
  const { data, error } = await createAdminClient()
    .from('project_list')
    .select('*')
    .eq('source_articulation_id', articulationId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `Unable to load project by source articulation: ${error.message}`
    )
  }

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

export async function listProjectParticipants(projectId: string) {
  const { data, error } = await createAdminClient().from('project_participant_list').select('*').eq('project_id', projectId).order('added_at', { ascending: true })
  if (error) throw new Error(`Unable to load project participants: ${error.message}`)
  return (data ?? []) as ProjectParticipant[]
}

export async function listProjectSourceParticipants(projectId: string) {
  const { data, error } = await createAdminClient().from('project_source_participant_list').select('*').eq('project_id', projectId).order('display_name', { ascending: true })
  if (error) throw new Error(`Unable to load project source participants: ${error.message}`)
  return (data ?? []) as ProjectSourceParticipant[]
}

export async function listProjectDeliverables(projectId: string) {
  const { data, error } = await createAdminClient().from('project_deliverable_list').select('*').eq('project_id', projectId).order('target_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
  if (error) throw new Error(`Unable to load project deliverables: ${error.message}`)
  return (data ?? []) as ProjectDeliverable[]
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

export async function addProjectParticipant(access: InternalAccess[], input: { projectId: string; personId: string | null; organizationId: string | null; participationRole: string; contributionSummary: string }) {
  const { error } = await createAdminClient().rpc('add_project_participant', { p_actor_internal_user_id: actorId(access), p_project_id: input.projectId, p_person_id: input.personId, p_organization_id: input.organizationId, p_participation_role: input.participationRole, p_contribution_summary: input.contributionSummary })
  if (error) throw new Error(error.message)
}

export async function removeProjectParticipant(access: InternalAccess[], input: { participantId: string; rationale: string }) {
  const { error } = await createAdminClient().rpc('remove_project_participant', { p_actor_internal_user_id: actorId(access), p_participant_id: input.participantId, p_rationale: input.rationale })
  if (error) throw new Error(error.message)
}

export async function createProjectDeliverable(access: InternalAccess[], input: { projectId: string; title: string; description: string; responsibleInternalUserId: string | null; targetDate: string | null }) {
  const { error } = await createAdminClient().rpc('create_project_deliverable', { p_actor_internal_user_id: actorId(access), p_project_id: input.projectId, p_title: input.title, p_description: input.description, p_responsible_internal_user_id: input.responsibleInternalUserId, p_target_date: input.targetDate })
  if (error) throw new Error(error.message)
}

export async function transitionProjectDeliverable(access: InternalAccess[], input: { deliverableId: string; status: ProjectDeliverable['status']; resultSummary: string | null; evidenceReference: string | null }) {
  const { error } = await createAdminClient().rpc('transition_project_deliverable', { p_actor_internal_user_id: actorId(access), p_deliverable_id: input.deliverableId, p_status: input.status, p_result_summary: input.resultSummary, p_evidence_reference: input.evidenceReference })
  if (error) throw new Error(error.message)
}
