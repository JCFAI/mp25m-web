'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  createOpportunityFollowup,
  updateOpportunityStatus,
  type OpportunityFollowupKind,
} from '../../../../lib/opportunities/detail'
import type {
  OpportunityStatus,
} from '../../../../lib/opportunities/server'
import { createClient } from '../../../../lib/supabase/server'

export type StatusActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

const allowedStatuses = new Set([
  'open',
  'under_analysis',
  'in_progress',
  'resolved',
  'discarded',
])

export async function updateOpportunityStatusAction(
  opportunityId: string,
  _previousState: StatusActionState,
  formData: FormData
): Promise<StatusActionState> {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const authUserId = claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access = await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const newStatus = String(
    formData.get('status') ?? ''
  )

  const reason = String(
    formData.get('reason') ?? ''
  ).trim()

  if (!allowedStatuses.has(newStatus)) {
    return {
      status: 'error',
      message:
        'El estado seleccionado no es válido.',
    }
  }

  try {
    await updateOpportunityStatus(
      access,
      opportunityId,
      newStatus as OpportunityStatus,
      reason
    )
  } catch (error) {
    console.error(
      '[MP25M] Opportunity status update failed:',
      error
    )

    const detail =
      error instanceof Error
        ? error.message
        : ''

    if (
      detail.includes(
        'already has the requested status'
      )
    ) {
      return {
        status: 'error',
        message:
          'La oportunidad ya se encuentra en ese estado.',
      }
    }

    return {
      status: 'error',
      message:
        'No se pudo actualizar el estado. No se modificó ningún dato.',
    }
  }

  revalidatePath(
    `/panel/oportunidades/${opportunityId}`
  )
  revalidatePath('/panel/oportunidades')

  return {
    status: 'success',
    message:
      'El estado fue actualizado correctamente.',
  }
}
export type FollowupActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

const allowedFollowupKinds =
  new Set<OpportunityFollowupKind>([
    'note',
    'contact',
    'meeting',
    'commitment',
    'delivery',
    'other',
  ])

export async function createOpportunityFollowupAction(
  opportunityId: string,
  _previousState: FollowupActionState,
  formData: FormData
): Promise<FollowupActionState> {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const authUserId = claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access = await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const kind = String(
    formData.get('kind') ?? ''
  ) as OpportunityFollowupKind

  const body = String(
    formData.get('body') ?? ''
  ).trim()

  if (!allowedFollowupKinds.has(kind)) {
    return {
      status: 'error',
      message:
        'Seleccioná un tipo de novedad válido.',
    }
  }

  if (body.length < 3) {
    return {
      status: 'error',
      message:
        'La novedad debe tener al menos 3 caracteres.',
    }
  }

  if (body.length > 5000) {
    return {
      status: 'error',
      message:
        'La novedad no puede superar los 5000 caracteres.',
    }
  }

  try {
    await createOpportunityFollowup(
      access,
      opportunityId,
      kind,
      body
    )
  } catch (error) {
    console.error(
      '[MP25M] Opportunity follow-up creation failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo registrar la novedad. El texto permanece cargado para que puedas volver a intentar.',
    }
  }

  revalidatePath(
    `/panel/oportunidades/${opportunityId}`
  )

  return {
    status: 'success',
    message:
      'La novedad fue registrada correctamente.',
  }
}