'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { resolveActivityProposal, type ActivityResolutionAction } from '../../../../lib/organizations/activity-proposals-manage'
import { createClient } from '../../../../lib/supabase/server'

export type ResolutionState = { status: 'idle' | 'success' | 'error'; message: string }

export async function resolveActivityProposalAction(
  proposalId: string,
  resolutionAction: ActivityResolutionAction,
  _previous: ResolutionState,
  form: FormData,
): Promise<ResolutionState> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) redirect('/login')
  const access = await getInternalAccess(data.claims.sub)
  const field = (name: string) => String(form.get(name) ?? '').trim()
  let result
  try {
    result = await resolveActivityProposal(access, {
      proposalId, resolutionAction,
      targetActivityId: field('target_activity_id'),
      canonicalName: field('canonical_name'),
      description: field('description'),
      reason: field('reason'),
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : ''
    let message = 'No se pudo resolver la propuesta. Intentá nuevamente.'
    if (/canonical activity already exists/i.test(detail)) message = "Ya existe una actividad canónica con ese nombre. Usá 'Mapear a existente'."
    else if (/not pending/i.test(detail)) message = 'La propuesta ya fue resuelta. Actualizá la pantalla para ver su estado actual.'
    else if (/target activity/i.test(detail)) message = 'Seleccioná una actividad destino activa del catálogo. La seleccionada no está disponible.'
    else if (/cannot manage|permission|42501/i.test(detail)) message = 'Tu usuario no tiene permisos para resolver propuestas del catálogo.'
    else if (/reason/i.test(detail)) message = 'La justificación debe tener entre 3 y 2000 caracteres.'
    else if (/canonical activity name/i.test(detail)) message = 'El nombre canónico debe tener entre 2 y 200 caracteres.'
    else if (/description/i.test(detail)) message = 'La descripción no puede superar los 2000 caracteres.'
    else if (/organization not found/i.test(detail)) message = 'La organización de origen ya no está activa o disponible.'
    else if (/proposal/i.test(detail)) message = 'La propuesta no está disponible.'
    return { status: 'error', message }
  }
  revalidatePath('/panel/actividades/propuestas')
  revalidatePath('/panel/organizaciones')
  revalidatePath(`/panel/organizaciones/${result.organization_id}`)
  revalidatePath('/api/panel/actividades')
  const message = result.resolution_action === 'reject'
    ? 'Propuesta rechazada y conservada para trazabilidad.'
    : `${result.resolution_action === 'create' ? 'Actividad canónica creada' : 'Propuesta mapeada'}: ${result.resolved_activity_name}. La actividad no se registró en la organización.`
  return { status: 'success', message }
}
