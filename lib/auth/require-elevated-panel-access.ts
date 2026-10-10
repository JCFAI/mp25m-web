import 'server-only'

import { notFound, redirect } from 'next/navigation'

import { isBasicParticipantAccess } from './basic-participant'
import { getInternalAccess } from './internal-access'
import { createClient } from '../supabase/server'

export function assertElevatedPanelAccess(
  access: {
    access_role_code: string
  }[]
) {
  if (isBasicParticipantAccess(access)) {
    throw new Error(
      'Elevated panel access is required'
    )
  }
}

export async function requireElevatedPanelAccess() {
  const supabase = await createClient()

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const authUserId = claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access = await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  try {
    assertElevatedPanelAccess(access)
  } catch {
    notFound()
  }

  return access
}
