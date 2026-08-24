'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  updateOpportunityStatus,
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