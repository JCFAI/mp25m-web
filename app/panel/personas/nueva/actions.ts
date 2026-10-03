'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { createCanonicalPerson } from '../../../../lib/people/manage'
import { createClient } from '../../../../lib/supabase/server'

export type CreatePersonActionState = {
  status: 'idle' | 'error'
  message: string | null
  fieldErrors: {
    displayName?: string
  }
}

const initialFailure = (message: string, displayName?: string) => ({
  status: 'error' as const,
  message,
  fieldErrors: displayName ? { displayName } : {},
})

export async function createPersonAction(
  _previousState: CreatePersonActionState,
  formData: FormData,
): Promise<CreatePersonActionState> {
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

  const displayName = String(
    formData.get('display_name') ?? '',
  ).trim()

  if (displayName.length < 2 || displayName.length > 200) {
    return initialFailure(
      'Corregí el nombre antes de crear la persona.',
      'El nombre debe tener entre 2 y 200 caracteres.',
    )
  }

  let personId: string

  try {
    personId = await createCanonicalPerson(access, displayName)
  } catch (error) {
    console.error('[MP25M] Person creation failed:', error)
    const detail = error instanceof Error ? error.message : ''

    if (/not allowed|cannot manage|permission/i.test(detail)) {
      return initialFailure(
        'Tu usuario no tiene permisos para crear personas canónicas.',
      )
    }

    return initialFailure(
      'No se pudo crear la persona. No se registró ningún dato.',
    )
  }

  revalidatePath('/panel/personas')
  redirect(`/panel/personas/${personId}`)
}
