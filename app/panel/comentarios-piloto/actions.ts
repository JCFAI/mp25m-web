'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createAdminClient } from '../../../lib/supabase/admin'
import { createClient } from '../../../lib/supabase/server'

export type PilotFeedbackActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

const allowedTypes = new Set([
  'difficulty',
  'suggestion',
  'error',
  'other',
])

const allowedStatuses = new Set([
  'new',
  'in_review',
  'resolved',
  'dismissed',
])

async function resolveInternalUserId() {
  const supabase = await createClient()

  const { data, error } =
    await supabase.auth.getClaims()

  const authUserId =
    data?.claims?.sub

  if (error || !authUserId) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const internalUserIds = [
    ...new Set(
      access.map(
        (item) => item.internal_user_id
      )
    ),
  ]

  if (internalUserIds.length !== 1) {
    throw new Error(
      'Unable to resolve a unique internal user'
    )
  }

  return {
    internalUserId: internalUserIds[0],
    access,
  }
}

export async function createPilotFeedbackAction(
  _previousState: PilotFeedbackActionState,
  formData: FormData
): Promise<PilotFeedbackActionState> {
  let identity

  try {
    identity =
      await resolveInternalUserId()
  } catch {
    return {
      status: 'error',
      message:
        'No se pudo identificar el usuario interno.',
    }
  }

  const feedbackType = String(
    formData.get('feedback_type') ?? ''
  )
  const detail = String(
    formData.get('detail') ?? ''
  ).trim()
  const contextPath = String(
    formData.get('context_path') ?? ''
  ).trim()

  if (!allowedTypes.has(feedbackType)) {
    return {
      status: 'error',
      message:
        'Elegí un tipo de comentario válido.',
    }
  }

  if (
    detail.length < 3 ||
    detail.length > 5000
  ) {
    return {
      status: 'error',
      message:
        'El comentario debe tener entre 3 y 5000 caracteres.',
    }
  }

  if (contextPath.length > 500) {
    return {
      status: 'error',
      message:
        'La pantalla o contexto no puede superar los 500 caracteres.',
    }
  }

  const admin = createAdminClient()

  const { error: rpcError } =
    await admin.rpc(
      'create_pilot_feedback',
      {
        p_actor_internal_user_id:
          identity.internalUserId,
        p_feedback_type: feedbackType,
        p_detail: detail,
        p_context_path:
          contextPath || null,
      }
    )

  if (rpcError) {
    console.error(
      '[MP25M] Pilot feedback failed:',
      rpcError
    )

    return {
      status: 'error',
      message:
        'No se pudo guardar el comentario.',
    }
  }

  revalidatePath(
    '/panel/comentarios-piloto'
  )

  return {
    status: 'success',
    message:
      'Gracias. El comentario quedó registrado.',
  }
}

export async function updatePilotFeedbackAdminAction(
  feedbackId: string,
  _previousState: PilotFeedbackActionState,
  formData: FormData
): Promise<PilotFeedbackActionState> {
  let identity

  try {
    identity =
      await resolveInternalUserId()
  } catch {
    return {
      status: 'error',
      message:
        'No se pudo identificar el usuario interno.',
    }
  }

  const canReview = identity.access.some(
    (item) =>
      [
        'administrator',
        'local_administrator',
        'founder_access',
      ].includes(item.access_role_code)
  )

  if (!canReview) {
    return {
      status: 'error',
      message:
        'No tenés permisos para administrar comentarios.',
    }
  }

  const status = String(
    formData.get('status') ?? ''
  )
  const response = String(
    formData.get('admin_response') ?? ''
  ).trim()

  if (!allowedStatuses.has(status)) {
    return {
      status: 'error',
      message:
        'Elegí un estado válido.',
    }
  }

  if (
    ['resolved', 'dismissed'].includes(
      status
    ) &&
    response.length < 2
  ) {
    return {
      status: 'error',
      message:
        'Para cerrar un comentario tenés que escribir una respuesta.',
    }
  }

  if (response.length > 5000) {
    return {
      status: 'error',
      message:
        'La respuesta no puede superar los 5000 caracteres.',
    }
  }

  const admin = createAdminClient()

  const { error } = await admin.rpc(
    'update_pilot_feedback_admin',
    {
      p_actor_internal_user_id:
        identity.internalUserId,
      p_feedback_id: feedbackId,
      p_status: status,
      p_admin_response:
        response || null,
    }
  )

  if (error) {
    console.error(
      '[MP25M] Pilot feedback update failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo actualizar el comentario.',
    }
  }

  revalidatePath(
    '/panel/comentarios-piloto'
  )

  return {
    status: 'success',
    message:
      'Comentario actualizado.',
  }
}

export async function archivePilotFeedbackAdminAction(
  feedbackId: string,
  _previousState: PilotFeedbackActionState,
  _formData: FormData
): Promise<PilotFeedbackActionState> {
  void _previousState
  void _formData

  let identity

  try {
    identity =
      await resolveInternalUserId()
  } catch {
    return {
      status: 'error',
      message:
        'No se pudo identificar el usuario interno.',
    }
  }

  const canReview = identity.access.some(
    (item) =>
      [
        'administrator',
        'local_administrator',
        'founder_access',
      ].includes(item.access_role_code)
  )

  if (!canReview) {
    return {
      status: 'error',
      message:
        'No tenés permisos para administrar comentarios.',
    }
  }

  const admin = createAdminClient()

  const { error } = await admin.rpc(
    'archive_pilot_feedback_admin',
    {
      p_actor_internal_user_id:
        identity.internalUserId,
      p_feedback_id: feedbackId,
    }
  )

  if (error) {
    console.error(
      '[MP25M] Pilot feedback archive failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo archivar el comentario.',
    }
  }

  revalidatePath(
    '/panel/comentarios-piloto'
  )

  return {
    status: 'success',
    message:
      'Comentario archivado.',
  }
}
