'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { setInternalUserDisplayName } from '../../../lib/auth/internal-profile'
import { createClient } from '../../../lib/supabase/server'

export type InternalProfileActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

export async function updateInternalProfileAction(
  _previousState: InternalProfileActionState,
  formData: FormData
): Promise<InternalProfileActionState> {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const displayName = String(
    formData.get('display_name') ?? ''
  ).trim()

  if (displayName.length < 2) {
    return {
      status: 'error',
      message:
        'El nombre visible debe tener al menos 2 caracteres.',
    }
  }

  if (displayName.length > 120) {
    return {
      status: 'error',
      message:
        'El nombre visible no puede superar los 120 caracteres.',
    }
  }

  try {
    await setInternalUserDisplayName(
      access,
      displayName
    )
  } catch (error) {
    console.error(
      '[MP25M] Internal profile update failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo guardar el nombre visible.',
    }
  }

  revalidatePath('/panel')
  revalidatePath('/panel/perfil')
  revalidatePath(
    '/panel/oportunidades'
  )

  return {
    status: 'success',
    message:
      'El nombre visible fue actualizado correctamente.',
  }
}