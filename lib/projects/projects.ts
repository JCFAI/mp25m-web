import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type ProjectStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled'

export type Project = {
  project_id: string
  opportunity_id: string | null
  opportunity_title: string | null
  source_articulation_id: string | null
  source_articulation_title: string | null
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

export type ProjectOpportunityRelationType =
  | 'origin'
  | 'context'
  | 'resource'
  | 'dependency'
  | 'related'

export type ProjectArticulationRelationType =
  | 'origin'
  | 'context'
  | 'coordination'
  | 'resource'
  | 'related'

export type ProjectOpportunityLink = {
  link_id: string
  project_id: string
  opportunity_id: string
  opportunity_title: string
  opportunity_status: string
  relation_type: ProjectOpportunityRelationType
  relationship_note: string | null
  added_at: string
  added_by_display_name: string
}

export type ProjectArticulationLink = {
  link_id: string
  project_id: string
  articulation_id: string
  articulation_title: string
  articulation_status: string
  opportunity_id: string | null
  opportunity_title: string | null
  relation_type: ProjectArticulationRelationType
  relationship_note: string | null
  added_at: string
  added_by_display_name: string
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

export async function listProjectOpportunityLinks(
  projectId: string
) {
  const { data, error } = await createAdminClient()
    .from('project_opportunity_link_list')
    .select('*')
    .eq('project_id', projectId)
    .order('added_at', { ascending: true })

  if (error) {
    throw new Error(
      `Unable to load project opportunity links: ${error.message}`
    )
  }

  return (data ?? []) as ProjectOpportunityLink[]
}

export async function listProjectArticulationLinks(
  projectId: string
) {
  const { data, error } = await createAdminClient()
    .from('project_articulation_link_list')
    .select('*')
    .eq('project_id', projectId)
    .order('added_at', { ascending: true })

  if (error) {
    throw new Error(
      `Unable to load project articulation links: ${error.message}`
    )
  }

  return (data ?? []) as ProjectArticulationLink[]
}

export async function listProjectsByOpportunity(
  opportunityId: string
) {
  const supabase = createAdminClient()

  const { data: links, error: linksError } =
    await supabase
      .from('project_opportunity_link_list')
      .select('project_id')
      .eq('opportunity_id', opportunityId)

  if (linksError) {
    throw new Error(
      `Unable to load opportunity project links: ${linksError.message}`
    )
  }

  const projectIds = [
    ...new Set(
      (links ?? []).map(
        (link) => link.project_id
      )
    ),
  ]

  if (projectIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('project_list')
    .select('*')
    .in('project_id', projectIds)
    .order('updated_at', {
      ascending: false,
    })

  if (error) {
    throw new Error(
      `Unable to load opportunity projects: ${error.message}`
    )
  }

  return (data ?? []) as Project[]
}

export async function listProjectsByArticulation(
  articulationId: string
) {
  const supabase = createAdminClient()

  const { data: links, error: linksError } =
    await supabase
      .from('project_articulation_link_list')
      .select('project_id')
      .eq('articulation_id', articulationId)

  if (linksError) {
    throw new Error(
      `Unable to load articulation project links: ${linksError.message}`
    )
  }

  const projectIds = [
    ...new Set(
      (links ?? []).map(
        (link) => link.project_id
      )
    ),
  ]

  if (projectIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('project_list')
    .select('*')
    .in('project_id', projectIds)
    .order('updated_at', {
      ascending: false,
    })

  if (error) {
    throw new Error(
      `Unable to load articulation projects: ${error.message}`
    )
  }

  return (data ?? []) as Project[]
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

export async function createProject(
  access: InternalAccess[],
  input: {
    title: string
    objective: string
    responsibleInternalUserId: string | null
  }
) {
  const { data, error } = await createAdminClient().rpc(
    'create_project',
    {
      p_actor_internal_user_id: actorId(access),
      p_title: input.title,
      p_objective: input.objective,
      p_responsible_internal_user_id:
        input.responsibleInternalUserId,
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  const created = Array.isArray(data)
    ? data[0]
    : data

  const projectId =
    created &&
    typeof created === 'object' &&
    'project_id' in created
      ? String(created.project_id)
      : null

  if (!projectId) {
    throw new Error(
      'Project creation did not return an id'
    )
  }

  return projectId
}

export async function linkProjectOpportunity(
  access: InternalAccess[],
  input: {
    projectId: string
    opportunityId: string
    relationType: ProjectOpportunityRelationType
    relationshipNote: string | null
  }
) {
  const { error } = await createAdminClient().rpc(
    'link_project_opportunity',
    {
      p_actor_internal_user_id: actorId(access),
      p_project_id: input.projectId,
      p_opportunity_id: input.opportunityId,
      p_relation_type: input.relationType,
      p_relationship_note: input.relationshipNote,
    }
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function unlinkProjectOpportunity(
  access: InternalAccess[],
  input: {
    projectId: string
    opportunityId: string
    rationale: string
  }
) {
  const { error } = await createAdminClient().rpc(
    'unlink_project_opportunity',
    {
      p_actor_internal_user_id: actorId(access),
      p_project_id: input.projectId,
      p_opportunity_id: input.opportunityId,
      p_rationale: input.rationale,
    }
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function linkProjectArticulation(
  access: InternalAccess[],
  input: {
    projectId: string
    articulationId: string
    relationType: ProjectArticulationRelationType
    relationshipNote: string | null
  }
) {
  const { error } = await createAdminClient().rpc(
    'link_project_articulation',
    {
      p_actor_internal_user_id: actorId(access),
      p_project_id: input.projectId,
      p_articulation_id: input.articulationId,
      p_relation_type: input.relationType,
      p_relationship_note: input.relationshipNote,
    }
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function unlinkProjectArticulation(
  access: InternalAccess[],
  input: {
    projectId: string
    articulationId: string
    rationale: string
  }
) {
  const { error } = await createAdminClient().rpc(
    'unlink_project_articulation',
    {
      p_actor_internal_user_id: actorId(access),
      p_project_id: input.projectId,
      p_articulation_id: input.articulationId,
      p_rationale: input.rationale,
    }
  )

  if (error) {
    throw new Error(error.message)
  }
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
