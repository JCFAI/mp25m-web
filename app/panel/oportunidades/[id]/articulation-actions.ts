'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  addOpportunityArticulationParticipant,
  createOpportunityArticulation,
  createOpportunityArticulationFollowup,
  removeOpportunityArticulationParticipant,
  transitionOpportunityArticulation,
  type OpportunityArticulation,
  type OpportunityArticulationFollowup,
} from '../../../../lib/opportunities/articulations'
import { createClient } from '../../../../lib/supabase/server'

export type ArticulationActionState = { status: 'idle' | 'success' | 'error'; message: string | null }

async function getCurrentAccess() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims?.sub) redirect('/login')

  const access = await getInternalAccess(data.claims.sub)
  if (access.length === 0) redirect('/sin-acceso')

  return access
}

export async function createOpportunityArticulationAction(opportunityId: string, _state: ArticulationActionState, formData: FormData): Promise<ArticulationActionState> {
  const access = await getCurrentAccess()
  const title = String(formData.get('title') ?? '').trim()
  const objective = String(formData.get('objective') ?? '').trim()
  const responsibleInternalUserId = String(formData.get('responsible_internal_user_id') ?? '').trim() || null
  if (title.length < 3 || objective.length < 3) return { status: 'error', message: 'Completá un título y objetivo de al menos 3 caracteres.' }
  try { await createOpportunityArticulation(access, { opportunityId, title, objective, responsibleInternalUserId }) }
  catch (error) { console.error('[MP25M] Articulation creation failed:', error); return { status: 'error', message: 'No se pudo registrar la articulación. No se modificó ningún dato.' } }
  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return { status: 'success', message: 'La articulación fue registrada en borrador.' }
}

export async function transitionOpportunityArticulationAction(opportunityId: string, articulationId: string, _state: ArticulationActionState, formData: FormData): Promise<ArticulationActionState> {
  const access = await getCurrentAccess()
  const status = String(formData.get('status') ?? '') as OpportunityArticulation['status']
  const rationale = String(formData.get('rationale') ?? '').trim()
  const responsibleInternalUserId = String(formData.get('responsible_internal_user_id') ?? '').trim() || null
  const closingSummary = String(formData.get('closing_summary') ?? '').trim() || null

  if (rationale.length < 3) return { status: 'error', message: 'Explicá brevemente el motivo del cambio.' }

  try {
    await transitionOpportunityArticulation(access, { articulationId, status, rationale, responsibleInternalUserId, closingSummary })
  } catch (error) {
    console.error('[MP25M] Articulation transition failed:', error)
    return { status: 'error', message: 'No se pudo actualizar la articulación. Revisá el responsable y el cierre si corresponde.' }
  }

  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return { status: 'success', message: 'El estado de la articulación fue actualizado.' }
}

export async function addOpportunityArticulationParticipantAction(opportunityId: string, articulationId: string, _state: ArticulationActionState, formData: FormData): Promise<ArticulationActionState> {
  const access = await getCurrentAccess()
  const actor = String(formData.get('actor') ?? '')
  const rationale = String(formData.get('rationale') ?? '').trim()
  const [actorType, actorId] = actor.split(':', 2)

  if (!actorId || !['person', 'organization'].includes(actorType) || rationale.length < 3) {
    return { status: 'error', message: 'Elegí un participante y explicá por qué se suma.' }
  }

  try {
    await addOpportunityArticulationParticipant(access, {
      articulationId,
      personId: actorType === 'person' ? actorId : null,
      organizationId: actorType === 'organization' ? actorId : null,
      rationale,
    })
  } catch (error) {
    console.error('[MP25M] Articulation participant addition failed:', error)
    return { status: 'error', message: 'No se pudo sumar el participante. Puede que ya esté activo o no esté disponible.' }
  }

  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return { status: 'success', message: 'El participante fue incorporado a la articulación.' }
}

export async function removeOpportunityArticulationParticipantAction(opportunityId: string, participantId: string, _state: ArticulationActionState, formData: FormData): Promise<ArticulationActionState> {
  const access = await getCurrentAccess()
  const rationale = String(formData.get('rationale') ?? '').trim()
  if (rationale.length < 3) return { status: 'error', message: 'Indicá el motivo del retiro.' }

  try {
    await removeOpportunityArticulationParticipant(access, { participantId, rationale })
  } catch (error) {
    console.error('[MP25M] Articulation participant removal failed:', error)
    return { status: 'error', message: 'No se pudo retirar el participante. No se modificó ningún dato.' }
  }

  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return { status: 'success', message: 'El participante fue retirado de la articulación.' }
}

export async function createOpportunityArticulationFollowupAction(opportunityId: string, articulationId: string, _state: ArticulationActionState, formData: FormData): Promise<ArticulationActionState> {
  const access = await getCurrentAccess()
  const followupType = String(formData.get('followup_type') ?? '') as OpportunityArticulationFollowup['followup_type']
  const detail = String(formData.get('detail') ?? '').trim()

  if (detail.length < 3) return { status: 'error', message: 'Describí la novedad para registrarla.' }

  try {
    await createOpportunityArticulationFollowup(access, { articulationId, followupType, detail })
  } catch (error) {
    console.error('[MP25M] Articulation followup creation failed:', error)
    return { status: 'error', message: 'No se pudo registrar la novedad. No se modificó ningún dato.' }
  }

  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return { status: 'success', message: 'La novedad fue registrada en el seguimiento.' }
}
