import 'server-only'

import type { InternalAccess } from './internal-access'
import { createAdminClient } from '../supabase/admin'

export type InternalUserProfile = {
  id: string
  display_name: string | null
  status: string
  role_names: string[]
  scope_names: string[]
}

function getInternalUserId(
  access: InternalAccess[]
) {
  const ids = [
    ...new Set(
      access.map(
        (item) => item.internal_user_id
      )
    ),
  ]

  if (ids.length !== 1) {
    throw new Error(
      'Unable to resolve a unique internal user'
    )
  }

  return ids[0]
}

export async function getInternalUserProfile(
  access: InternalAccess[]
): Promise<InternalUserProfile> {
  const internalUserId =
    getInternalUserId(access)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('internal_user_profile')
    .select(`
      id,
      display_name,
      status,
      role_names,
      scope_names
    `)
    .eq('id', internalUserId)
    .single()

  if (error) {
    throw new Error(
      `Unable to load internal profile: ${error.message}`
    )
  }

  return {
    ...(data as InternalUserProfile),
    role_names: data.role_names ?? [],
    scope_names: data.scope_names ?? [],
  }
}

export async function setInternalUserDisplayName(
  access: InternalAccess[],
  displayName: string
) {
  const internalUserId =
    getInternalUserId(access)

  const normalized =
    displayName.trim()

  if (
    normalized.length < 2 ||
    normalized.length > 120
  ) {
    throw new Error(
      'Invalid internal display name'
    )
  }

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'set_internal_user_display_name',
    {
      p_internal_user_id:
        internalUserId,
      p_display_name:
        normalized,
    }
  )

  if (error) {
    throw new Error(
      `Unable to update internal profile: ${error.message}`
    )
  }
}