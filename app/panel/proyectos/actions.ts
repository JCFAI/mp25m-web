'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createProject, createProjectFollowup, transitionProject, type ProjectStatus } from '../../../lib/projects/projects'
import { createClient } from '../../../lib/supabase/server'

export type ProjectActionState = { status: 'idle' | 'success' | 'error'; message: string | null }

async function getCurrentAccess() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')
  const access = await getInternalAccess(data.claims.sub)
  if (!access.length) redirect('/sin-acceso')
  return access
}

export async function createProjectAction(_state: ProjectActionState, formData: FormData): Promise<ProjectActionState> {
  const sourceArticulationId = String(formData.get('source_articulation_id') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const objective = String(formData.get('objective') ?? '').trim()
  const responsibleInternalUserId = String(formData.get('responsible_internal_user_id') ?? '').trim() || null
  if (!sourceArticulationId || title.length < 3 || objective.length < 3) return { status: 'error', message: 'Elegí una articulación cerrada y completá título y objetivo.' }
  try { await createProject(await getCurrentAccess(), { sourceArticulationId, title, objective, responsibleInternalUserId }) }
  catch (error) { console.error('[MP25M] Project creation failed:', error); return { status: 'error', message: 'No se pudo crear el proyecto. Confirmá que la articulación siga disponible.' } }
  revalidatePath('/panel/proyectos')
  return { status: 'success', message: 'El proyecto quedó creado en borrador.' }
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
