'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import {
  createArticulation, transitionOpportunityArticulation,
  addOpportunityArticulationParticipant, removeOpportunityArticulationParticipant,
  createOpportunityArticulationFollowup, linkArticulationOpportunity,
  unlinkArticulationOpportunity, listArticulationParticipants,
  type OpportunityArticulation, type OpportunityArticulationFollowup,
  type ArticulationOpportunityLink,
} from '../../../lib/opportunities/articulations'
import { createClient } from '../../../lib/supabase/server'

export type ArticulationActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

async function getCurrentAccess() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims?.sub) redirect('/login')

  const access = await getInternalAccess(data.claims.sub)

  if (!access.length) redirect('/sin-acceso')

  return access
}

export async function createArticulationAction(
  _state: ArticulationActionState,
  formData: FormData,
): Promise<ArticulationActionState> {
  const title = String(
    formData.get('title') ?? '',
  ).trim()

  const objective = String(
    formData.get('objective') ?? '',
  ).trim()

  const responsibleInternalUserId =
    String(
      formData.get(
        'responsible_internal_user_id',
      ) ?? '',
    ).trim() || null

  if (
    title.length < 3 ||
    objective.length < 3
  ) {
    return {
      status: 'error',
      message:
        'Completá el nombre y el objetivo de la articulación.',
    }
  }

  const access = await getCurrentAccess()
  let articulationId: string

  try {
    articulationId = await createArticulation(
      access,
      {
        title,
        objective,
        responsibleInternalUserId,
      },
    )
  } catch (error) {
    console.error(
      '[MP25M] Articulation creation failed:',
      error,
    )

    return {
      status: 'error',
      message:
        'No se pudo crear la articulación.',
    }
  }

  revalidatePath('/panel/articulaciones')

  redirect(
    `/panel/articulaciones/${articulationId}`,
  )
}


const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim()
const validText = (text: string) => text.length >= 3 && text.length <= 10000
const failure = (message: string): ArticulationActionState => ({ status: 'error', message })

async function mutateArticulation(
  articulationId: string,
  operation: (access: Awaited<ReturnType<typeof getCurrentAccess>>) => Promise<unknown>,
  message: string,
): Promise<ArticulationActionState> {
  const access = await getCurrentAccess()
  if (!uuidPattern.test(articulationId)) return failure('La articulación no es válida.')
  try {
    // Each existing RPC enforces can_manage_articulation, including standalone scope.
    await operation(access)
  } catch (error) {
    console.error('[MP25M] Articulation mutation failed:', error)
    return failure('No se pudo completar la operación. Revisá los datos y tus permisos e intentá nuevamente.')
  }
  revalidatePath('/panel/articulaciones')
  revalidatePath(`/panel/articulaciones/${articulationId}`)
  // Invalidate every related surface, including the opportunity just unlinked.
  revalidatePath('/panel/oportunidades/[id]', 'page')
  revalidatePath('/panel/proyectos/[id]', 'page')
  revalidatePath('/panel/proyectos')
  return { status: 'success', message }
}

export async function transitionArticulationAction(articulationId: string, _state: ArticulationActionState, data: FormData) {
  const status = field(data, 'status') as OpportunityArticulation['status']
  const rationale = field(data, 'rationale')
  const responsibleInternalUserId = field(data, 'responsible_internal_user_id') || null
  const closingSummary = field(data, 'closing_summary') || null

  if (
    !['draft', 'active', 'follow_up', 'paused', 'closed_with_result', 'closed_without_result', 'cancelled'].includes(status) ||
    !validText(rationale) ||
    (responsibleInternalUserId && !uuidPattern.test(responsibleInternalUserId)) ||
    (closingSummary && closingSummary.length > 10000)
  ) {
    return failure('Revisá el estado, el responsable y el motivo del cambio.')
  }

  if (status === 'active' && !responsibleInternalUserId) {
    return failure('Para activar la articulación, asigná un responsable.')
  }

  if (
    ['closed_with_result', 'closed_without_result'].includes(status) &&
    (!responsibleInternalUserId || !validText(closingSummary ?? ''))
  ) {
    return failure(
      'Para cerrar la articulación, asigná un responsable y completá un resumen de cierre.',
    )
  }

  return mutateArticulation(
    articulationId,
    (access) =>
      transitionOpportunityArticulation(access, {
        articulationId,
        status,
        rationale,
        responsibleInternalUserId,
        closingSummary,
      }),
    'La articulación fue actualizada.',
  )
}

export async function addArticulationParticipantAction(articulationId: string, _state: ArticulationActionState, data: FormData) {
  const [actorType, actorId, extra] = field(data, 'actor').split(':')
  const rationale = field(data, 'rationale')
  if (!['person', 'organization'].includes(actorType) || !uuidPattern.test(actorId ?? '') || extra !== undefined || !validText(rationale)) {
    return failure('Elegí una persona u organización y explicá por qué se suma.')
  }
  return mutateArticulation(articulationId, (access) => addOpportunityArticulationParticipant(access, {
    articulationId, personId: actorType === 'person' ? actorId : null,
    organizationId: actorType === 'organization' ? actorId : null, rationale,
  }), 'El participante fue incorporado.')
}

export async function removeArticulationParticipantAction(articulationId: string, participantId: string, _state: ArticulationActionState, data: FormData) {
  const rationale = field(data, 'rationale')
  if (!uuidPattern.test(participantId) || !validText(rationale)) return failure('Indicá el motivo del retiro.')
  return mutateArticulation(articulationId, async (access) => {
    const participants = await listArticulationParticipants(articulationId)
    if (!participants.some((participant) => participant.participant_id === participantId)) throw new Error('Participant does not belong to articulation')
    await removeOpportunityArticulationParticipant(access, { participantId, rationale })
  }, 'El participante fue retirado.')
}

export async function createArticulationFollowupAction(articulationId: string, _state: ArticulationActionState, data: FormData) {
  const followupType = field(data, 'followup_type') as OpportunityArticulationFollowup['followup_type']
  const detail = field(data, 'detail')
  if (!['general', 'meeting', 'commitment', 'contact', 'result'].includes(followupType) || !validText(detail)) return failure('Elegí un tipo y describí la novedad.')
  return mutateArticulation(articulationId, (access) => createOpportunityArticulationFollowup(access, {
    articulationId, followupType, detail,
  }), 'La novedad fue registrada.')
}

export async function linkArticulationOpportunityAction(articulationId: string, _state: ArticulationActionState, data: FormData) {
  const opportunityId = field(data, 'opportunity_id')
  const relationType = field(data, 'relation_type') as ArticulationOpportunityLink['relation_type']
  const relationshipNote = field(data, 'relationship_note') || null
  if (!uuidPattern.test(opportunityId) || !['origin', 'context', 'related'].includes(relationType) ||
    (relationshipNote && relationshipNote.length > 10000)) return failure('Elegí una oportunidad y un tipo de vínculo válido.')
  return mutateArticulation(articulationId, (access) => linkArticulationOpportunity(access, {
    articulationId, opportunityId, relationType, relationshipNote,
  }), 'La oportunidad fue vinculada.')
}

export async function unlinkArticulationOpportunityAction(articulationId: string, opportunityId: string, _state: ArticulationActionState, data: FormData) {
  const rationale = field(data, 'rationale')
  if (!uuidPattern.test(opportunityId) || !validText(rationale)) return failure('Indicá el motivo de la desvinculación.')
  return mutateArticulation(articulationId, (access) => unlinkArticulationOpportunity(access, {
    articulationId, opportunityId, rationale,
  }), 'La oportunidad fue desvinculada.')
}
