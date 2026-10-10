'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getInternalAccess } from '../../../lib/auth/internal-access'
import { assertElevatedPanelAccess } from '../../../lib/auth/require-elevated-panel-access'
import {
  addProjectParticipant,
  createProject,
  createProjectDeliverable,
  createProjectFollowup,
  linkProjectArticulation,
  linkProjectOpportunity,
  removeProjectParticipant,
  transitionProject,
  transitionProjectDeliverable,
  unlinkProjectArticulation,
  unlinkProjectOpportunity,
  type ProjectArticulationRelationType,
  type ProjectDeliverable,
  type ProjectOpportunityRelationType,
  type ProjectStatus,
} from '../../../lib/projects/projects'
import { createClient } from '../../../lib/supabase/server'

export type ProjectActionState = { status: 'idle' | 'success' | 'error'; message: string | null }

async function getCurrentAccess() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')
  const access = await getInternalAccess(data.claims.sub)
  if (!access.length) redirect('/sin-acceso')
  assertElevatedPanelAccess(access)
  return access
}

export async function createProjectAction(
  _state: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const title = String(
    formData.get('title') ?? ''
  ).trim()

  const objective = String(
    formData.get('objective') ?? ''
  ).trim()

  const responsibleInternalUserId =
    String(
      formData.get(
        'responsible_internal_user_id'
      ) ?? ''
    ).trim() || null

  if (
    title.length < 3 ||
    objective.length < 3
  ) {
    return {
      status: 'error',
      message:
        'Completá el nombre y el objetivo del proyecto.',
    }
  }

  let projectId: string

  try {
    projectId = await createProject(
      await getCurrentAccess(),
      {
        title,
        objective,
        responsibleInternalUserId,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Project creation failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo crear el proyecto.',
    }
  }

  revalidatePath('/panel/proyectos')

  redirect(
    `/panel/proyectos/${projectId}`
  )
}

const opportunityRelationTypes = new Set([
  'origin',
  'context',
  'resource',
  'dependency',
  'related',
])

const articulationRelationTypes = new Set([
  'origin',
  'context',
  'coordination',
  'resource',
  'related',
])

export async function linkProjectOpportunityAction(
  projectId: string,
  _state: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const opportunityId = String(
    formData.get('opportunity_id') ?? ''
  ).trim()

  const relationType = String(
    formData.get('relation_type') ?? 'related'
  ) as ProjectOpportunityRelationType

  const relationshipNote =
    String(
      formData.get('relationship_note') ?? ''
    ).trim() || null

  if (
    !opportunityId ||
    !opportunityRelationTypes.has(relationType)
  ) {
    return {
      status: 'error',
      message: 'Elegí una oportunidad y un tipo de vínculo válido.',
    }
  }

  try {
    await linkProjectOpportunity(
      await getCurrentAccess(),
      {
        projectId,
        opportunityId,
        relationType,
        relationshipNote,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Project opportunity link failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo vincular la oportunidad. Puede que ya esté vinculada o que no tengas permiso para operarla.',
    }
  }

  revalidatePath(`/panel/proyectos/${projectId}`)
  revalidatePath(`/panel/oportunidades/${opportunityId}`)

  return {
    status: 'success',
    message: 'La oportunidad quedó vinculada al proyecto.',
  }
}

export async function unlinkProjectOpportunityAction(
  projectId: string,
  opportunityId: string,
  _state: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const rationale = String(
    formData.get('rationale') ?? ''
  ).trim()

  if (rationale.length < 3) {
    return {
      status: 'error',
      message: 'Indicá brevemente el motivo de la desvinculación.',
    }
  }

  try {
    await unlinkProjectOpportunity(
      await getCurrentAccess(),
      {
        projectId,
        opportunityId,
        rationale,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Project opportunity unlink failed:',
      error
    )

    return {
      status: 'error',
      message: 'No se pudo desvincular la oportunidad.',
    }
  }

  revalidatePath(`/panel/proyectos/${projectId}`)
  revalidatePath(`/panel/oportunidades/${opportunityId}`)

  return {
    status: 'success',
    message: 'La oportunidad fue desvinculada.',
  }
}

export async function linkProjectArticulationAction(
  projectId: string,
  _state: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const articulationId = String(
    formData.get('articulation_id') ?? ''
  ).trim()

  const relationType = String(
    formData.get('relation_type') ?? 'related'
  ) as ProjectArticulationRelationType

  const relationshipNote =
    String(
      formData.get('relationship_note') ?? ''
    ).trim() || null

  if (
    !articulationId ||
    !articulationRelationTypes.has(relationType)
  ) {
    return {
      status: 'error',
      message: 'Elegí una articulación y un tipo de vínculo válido.',
    }
  }

  try {
    await linkProjectArticulation(
      await getCurrentAccess(),
      {
        projectId,
        articulationId,
        relationType,
        relationshipNote,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Project articulation link failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo vincular la articulación. Puede que ya esté vinculada o que no tengas permiso para operarla.',
    }
  }

  revalidatePath(`/panel/proyectos/${projectId}`)
  revalidatePath(`/panel/articulaciones/${articulationId}`)

  return {
    status: 'success',
    message: 'La articulación quedó vinculada al proyecto.',
  }
}

export async function unlinkProjectArticulationAction(
  projectId: string,
  articulationId: string,
  _state: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const rationale = String(
    formData.get('rationale') ?? ''
  ).trim()

  if (rationale.length < 3) {
    return {
      status: 'error',
      message: 'Indicá brevemente el motivo de la desvinculación.',
    }
  }

  try {
    await unlinkProjectArticulation(
      await getCurrentAccess(),
      {
        projectId,
        articulationId,
        rationale,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Project articulation unlink failed:',
      error
    )

    return {
      status: 'error',
      message: 'No se pudo desvincular la articulación.',
    }
  }

  revalidatePath(`/panel/proyectos/${projectId}`)
  revalidatePath(`/panel/articulaciones/${articulationId}`)

  return {
    status: 'success',
    message: 'La articulación fue desvinculada.',
  }
}

export async function transitionProjectAction(projectId: string, _state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const status = String(formData.get('status') ?? '') as ProjectStatus
  const rationale = String(formData.get('rationale') ?? '').trim()
  const responsibleInternalUserId = String(formData.get('responsible_internal_user_id') ?? '').trim() || null
  const completionSummary = String(formData.get('completion_summary') ?? '').trim() || null
  if (rationale.length < 3) return { status: 'error', message: 'Explicá brevemente el cambio.' }
  try { await transitionProject(await getCurrentAccess(), { projectId, status, rationale, responsibleInternalUserId, completionSummary }) }
  catch (error) { console.error('[MP25M] Project transition failed:', error); return { status: 'error', message: 'No se pudo actualizar el proyecto. Un proyecto activo necesita responsable y uno completado necesita resumen.' } }
  revalidatePath(`/panel/proyectos/${projectId}`)
  revalidatePath('/panel/proyectos')
  return { status: 'success', message: 'El estado del proyecto fue actualizado.' }
}

export async function createProjectFollowupAction(projectId: string, _state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const followupType = String(formData.get('followup_type') ?? '') as 'general' | 'meeting' | 'commitment' | 'progress' | 'result'
  const detail = String(formData.get('detail') ?? '').trim()
  if (detail.length < 3) return { status: 'error', message: 'Describí la novedad para registrarla.' }
  try { await createProjectFollowup(await getCurrentAccess(), { projectId, followupType, detail }) }
  catch (error) { console.error('[MP25M] Project followup failed:', error); return { status: 'error', message: 'No se pudo registrar la novedad.' } }
  revalidatePath(`/panel/proyectos/${projectId}`)
  return { status: 'success', message: 'La novedad fue registrada.' }
}

export async function addProjectParticipantAction(projectId: string, _state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const actor = String(formData.get('actor') ?? '')
  const [actorType, actorId, extra] = actor.split(':')
  const participationRole = String(formData.get('participation_role') ?? '').trim()
  const contributionSummary = String(formData.get('contribution_summary') ?? '').trim()
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId ?? '')
  if (!actorId || extra !== undefined || !isUuid || !['person', 'organization'].includes(actorType) || participationRole.length < 3 || contributionSummary.length < 3) return { status: 'error', message: 'Elegí una persona u organización canónica e indicá su rol y contribución.' }
  try { await addProjectParticipant(await getCurrentAccess(), { projectId, personId: actorType === 'person' ? actorId : null, organizationId: actorType === 'organization' ? actorId : null, participationRole, contributionSummary }) }
  catch (error) { console.error('[MP25M] Project participant failed:', error); return { status: 'error', message: 'No se pudo incorporar el participante. Puede que ya esté activo.' } }
  revalidatePath(`/panel/proyectos/${projectId}`)
  return { status: 'success', message: 'El participante fue incorporado al proyecto.' }
}

export async function removeProjectParticipantAction(projectId: string, participantId: string, _state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const rationale = String(formData.get('rationale') ?? '').trim()
  if (rationale.length < 3) return { status: 'error', message: 'Indicá el motivo del retiro.' }
  try { await removeProjectParticipant(await getCurrentAccess(), { participantId, rationale }) }
  catch (error) { console.error('[MP25M] Project participant removal failed:', error); return { status: 'error', message: 'No se pudo retirar el participante.' } }
  revalidatePath(`/panel/proyectos/${projectId}`)
  return { status: 'success', message: 'El participante fue retirado del proyecto.' }
}

export async function createProjectDeliverableAction(projectId: string, _state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const responsibleInternalUserId = String(formData.get('responsible_internal_user_id') ?? '').trim() || null
  const targetDate = String(formData.get('target_date') ?? '').trim() || null
  if (title.length < 3 || description.length < 3) return { status: 'error', message: 'Completá el entregable y su descripción.' }
  try { await createProjectDeliverable(await getCurrentAccess(), { projectId, title, description, responsibleInternalUserId, targetDate }) }
  catch (error) { console.error('[MP25M] Project deliverable failed:', error); return { status: 'error', message: 'No se pudo registrar el entregable.' } }
  revalidatePath(`/panel/proyectos/${projectId}`)
  return { status: 'success', message: 'El entregable fue registrado.' }
}

export async function transitionProjectDeliverableAction(projectId: string, deliverableId: string, _state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const status = String(formData.get('status') ?? '') as ProjectDeliverable['status']
  const resultSummary = String(formData.get('result_summary') ?? '').trim() || null
  const evidenceReference = String(formData.get('evidence_reference') ?? '').trim() || null
  try { await transitionProjectDeliverable(await getCurrentAccess(), { deliverableId, status, resultSummary, evidenceReference }) }
  catch (error) { console.error('[MP25M] Project deliverable transition failed:', error); return { status: 'error', message: 'No se pudo actualizar el entregable. Una entrega realizada exige resultado y evidencia.' } }
  revalidatePath(`/panel/proyectos/${projectId}`)
  return { status: 'success', message: 'El entregable fue actualizado.' }
}
